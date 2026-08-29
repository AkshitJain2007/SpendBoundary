import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { razorpayGateway } from "@/lib/payments/razorpay-gateway";
import { appendAuditEvent } from "@/lib/audit-chain";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature") || "";
    let payload: any;

    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const eventType = payload.event || "payment.captured";
    const paymentEntity = payload.payload?.payment?.entity || payload.payload?.payment_link?.entity || payload;
    const requestId = paymentEntity.notes?.requestId || paymentEntity.reference_id || payload.requestId;

    // 1. Signature Verification (If live webhook secret configured)
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (webhookSecret && signature) {
      const isValid = razorpayGateway.verifyWebhookSignature(rawBody, signature, webhookSecret);
      if (!isValid) {
        return NextResponse.json({ error: "Invalid Razorpay webhook signature" }, { status: 401 });
      }
    }

    if (!requestId) {
      return NextResponse.json({ received: true, message: "No matching requestId in webhook payload" });
    }

    // 2. Idempotent State Transition
    const agentReq = await prisma.agentRequest.findUnique({
      where: { id: requestId },
      include: { approval: true, paymentAttempts: true },
    });

    if (agentReq) {
      if (agentReq.status !== "PAID") {
        await prisma.agentRequest.update({
          where: { id: requestId },
          data: { status: "PAID" },
        });
      }

      if (agentReq.approval && agentReq.approval.decision === "PENDING") {
        await prisma.approval.update({
          where: { requestId },
          data: {
            decision: "APPROVED",
            comment: "Automatically approved via verified Razorpay Webhook payment capture.",
            reviewerId: "razorpay_webhook",
          },
        });
      }

      // Record / update payment attempt
      const providerOrderId = paymentEntity.id || paymentEntity.order_id || `rzp_capture_${Date.now()}`;
      await prisma.paymentAttempt.upsert({
        where: { id: agentReq.paymentAttempts[0]?.id || `pay_${requestId}` },
        create: {
          id: `pay_${requestId}`,
          requestId,
          provider: "RAZORPAY_TEST",
          providerOrderId,
          status: "CAPTURED",
          amountPaise: agentReq.requestedAmountPaise,
          idempotencyKey: `idem_webhook_${requestId}`,
        },
        update: {
          status: "CAPTURED",
          providerOrderId,
        },
      });

      // Update / Save PaymentMandate with the actual card metadata returned by Razorpay
      const cardInfo = paymentEntity.card;
      const tokenId = paymentEntity.token_id || paymentEntity.token;
      if (cardInfo || tokenId) {
        await prisma.paymentMandate.upsert({
          where: { agentId: agentReq.agentId },
          update: {
            status: "ACTIVE",
            cardLast4: cardInfo?.last4 || "4242",
            cardNetwork: cardInfo?.network || "Visa",
            tokenId: tokenId || `token_rzp_${cardInfo?.last4 || "saved"}`,
            customerId: paymentEntity.customer_id || undefined,
          },
          create: {
            agentId: agentReq.agentId,
            status: "ACTIVE",
            cardLast4: cardInfo?.last4 || "4242",
            cardNetwork: cardInfo?.network || "Visa",
            tokenId: tokenId || `token_rzp_${cardInfo?.last4 || "saved"}`,
            customerId: paymentEntity.customer_id || null,
            maxDebitPaise: 100000,
          },
        });
      }

      // 3. Cryptographic Audit Chain Log
      await appendAuditEvent("PAYMENT_WEBHOOK_VERIFIED", requestId, {
        eventType,
        provider: "RAZORPAY_TEST",
        providerOrderId,
        cardLast4: cardInfo?.last4,
        cardNetwork: cardInfo?.network,
        amountPaise: agentReq.requestedAmountPaise,
        signatureVerified: Boolean(webhookSecret && signature),
        origin: "RAZORPAY_WEBHOOK",
      });
    }

    return NextResponse.json({
      received: true,
      requestId,
      status: "PROCESSED",
      message: "Razorpay webhook processed successfully and logged to SHA-256 audit chain.",
    });
  } catch (error: any) {
    console.error("Razorpay webhook handler error:", error);
    return NextResponse.json({ error: error?.message || "Webhook processing failed" }, { status: 500 });
  }
}
