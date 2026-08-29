import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CheckoutRequestSchema } from "@/lib/schemas";
import { recalculateCartTotal } from "@/lib/cart-total";
import { evaluatePolicy, PolicyRuleConfig } from "@/lib/policy-engine";
import { mockGateway } from "@/lib/payments/mock-gateway";
import { razorpayGateway } from "@/lib/payments/razorpay-gateway";
import { appendAuditEvent } from "@/lib/audit-chain";

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parseResult = CheckoutRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid checkout request payload.",
            details: parseResult.error.errors,
          },
        },
        { status: 400 }
      );
    }

    const { items, agentId, reason } = parseResult.data;
    const customRequestId = rawBody.requestId;
    const customIdempotencyKey = rawBody.idempotencyKey;
    const simulateTimeout = Boolean(rawBody.simulateTimeout);

    const requestId = customRequestId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const idempotencyKey = customIdempotencyKey || `idem_${requestId}`;

    // 1. Log incoming agent checkout attempt
    await appendAuditEvent("AGENT_CHECKOUT_REQUESTED", requestId, {
      agentId,
      reason,
      itemCount: items.reduce((s, i) => s + i.quantity, 0),
      timestamp: new Date().toISOString(),
    });

    // 2. Server recalculation of cart
    const recalculated = await recalculateCartTotal(items);

    if (recalculated.validationErrors.length > 0) {
      await appendAuditEvent("CHECKOUT_VALIDATION_FAILED", requestId, {
        errors: recalculated.validationErrors,
      });

      return NextResponse.json(
        {
          error: {
            code: "INVALID_CART_ITEMS",
            message: recalculated.validationErrors.join("; "),
            request_id: requestId,
            retryable: false,
          },
        },
        { status: 400 }
      );
    }

    // 3. Load active policy
    let dbPolicy = await prisma.policy.findFirst({
      where: { id: "policy_default" },
    });

    if (!dbPolicy) {
      dbPolicy = await prisma.policy.create({
        data: {
          id: "policy_default",
          merchantId: "merchant_apex_01",
          maxOrderPaise: 200000,
          dailyLimitPaise: 500000,
          velocityCount: 3,
          velocityWindowSeconds: 60,
          allowedCategories: JSON.stringify(["Office Supplies", "Electronics", "Home Office", "Furniture"]),
          approvalThresholdPaise: 100000,
          version: "v1.0",
        },
      });
    }

    const policyConfig: PolicyRuleConfig = {
      id: dbPolicy.id,
      merchantId: dbPolicy.merchantId,
      maxOrderPaise: dbPolicy.maxOrderPaise,
      dailyLimitPaise: dbPolicy.dailyLimitPaise,
      velocityCount: dbPolicy.velocityCount,
      velocityWindowSeconds: dbPolicy.velocityWindowSeconds,
      allowedCategories: JSON.parse(dbPolicy.allowedCategories),
      approvalThresholdPaise: dbPolicy.approvalThresholdPaise,
      version: dbPolicy.version,
    };

    // 4. Calculate today's cumulative spend for this agent
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const paidToday = await prisma.agentRequest.findMany({
      where: {
        agentId,
        status: "PAID",
        createdAt: { gte: startOfToday },
      },
    });

    const totalDailySpentPaise = paidToday.reduce(
      (sum, r) => sum + r.requestedAmountPaise,
      0
    );

    // 5. Calculate recent request velocity in window
    const windowStart = new Date(
      Date.now() - policyConfig.velocityWindowSeconds * 1000
    );
    const recentRequests = await prisma.agentRequest.findMany({
      where: {
        agentId,
        createdAt: { gte: windowStart },
      },
      select: { createdAt: true, requestedAmountPaise: true },
    });

    const recentRequestsInWindow = recentRequests.map((r) => ({
      timestamp: r.createdAt,
      amountPaise: r.requestedAmountPaise,
    }));

    // 6. Deterministic Policy Evaluation (Pure Function)
    const policyResult = evaluatePolicy({
      requestId,
      agentId,
      policy: policyConfig,
      items: recalculated.items,
      totalDailySpentPaise,
      recentRequestsInWindow,
    });

    // 7. Persist AgentRequest & Decision
    const createdRequest = await prisma.agentRequest.create({
      data: {
        id: requestId,
        agentId,
        cartSnapshot: JSON.stringify(recalculated.items),
        requestedAmountPaise: recalculated.totalPaise,
        reason,
        status:
          policyResult.decision === "ALLOW"
            ? "ALLOWED"
            : policyResult.decision === "REVIEW"
            ? "REVIEW_REQUIRED"
            : "REJECTED",
      },
    });

    await prisma.policyDecision.create({
      data: {
        requestId,
        decision: policyResult.decision,
        reasons: JSON.stringify(policyResult.reasons),
        policyVersion: policyResult.policyVersion,
      },
    });

    // 8. Append Decision to Audit Trail
    await appendAuditEvent("POLICY_DECISION_EVALUATED", requestId, {
      decision: policyResult.decision,
      reasons: policyResult.reasons,
      calculatedTotalPaise: recalculated.totalPaise,
      policyVersion: policyResult.policyVersion,
    });

    // 9. Branch on Decision
    if (policyResult.decision === "ALLOW") {
      // Execute payment via Razorpay / Gateway
      const paymentResult = await razorpayGateway.createOrder({
        requestId,
        amountPaise: recalculated.totalPaise,
        currency: "INR",
        idempotencyKey,
        description: reason,
        simulateTimeout,
      });

      await appendAuditEvent("PAYMENT_ATTEMPT_RECORDED", requestId, {
        provider: paymentResult.provider,
        providerOrderId: paymentResult.providerOrderId,
        status: paymentResult.status,
        idempotencyKey,
        amountPaise: paymentResult.amountPaise,
      });

      return NextResponse.json({
        success: true,
        decision: "ALLOW",
        requestId,
        calculatedTotalPaise: recalculated.totalPaise,
        reasons: policyResult.reasons,
        policyVersion: policyResult.policyVersion,
        payment: paymentResult,
      });
    }

    if (policyResult.decision === "REVIEW") {
      // Create pending human approval
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins expiry
      const approval = await prisma.approval.create({
        data: {
          requestId,
          decision: "PENDING",
          expiresAt,
        },
      });

      // Create hosted Razorpay Payment Link
      const paymentLink = await razorpayGateway.createPaymentLink({
        requestId,
        amountPaise: recalculated.totalPaise,
        currency: "INR",
        description: reason,
      });

      await appendAuditEvent("HUMAN_APPROVAL_QUEUED", requestId, {
        approvalId: approval.id,
        expiresAt: expiresAt.toISOString(),
        amountPaise: recalculated.totalPaise,
        paymentLinkId: paymentLink.id,
        paymentLinkUrl: paymentLink.shortUrl,
      });

      return NextResponse.json({
        success: true,
        decision: "REVIEW",
        requestId,
        calculatedTotalPaise: recalculated.totalPaise,
        reasons: policyResult.reasons,
        policyVersion: policyResult.policyVersion,
        paymentLinkUrl: paymentLink.shortUrl,
        paymentLinkId: paymentLink.id,
        approval: {
          id: approval.id,
          expiresAt: expiresAt.toISOString(),
          status: "PENDING",
          paymentLinkUrl: paymentLink.shortUrl,
        },
        message: `Order exceeds threshold. Submitted to human approval queue. Razorpay Payment Link generated: ${paymentLink.shortUrl}`,
      });
    }

    // DENY: Stop before payment creation
    await appendAuditEvent("PURCHASE_BLOCKED_BY_POLICY", requestId, {
      reasons: policyResult.reasons,
      blockedAmountPaise: recalculated.totalPaise,
    });

    return NextResponse.json({
      success: false,
      decision: "DENY",
      requestId,
      calculatedTotalPaise: recalculated.totalPaise,
      reasons: policyResult.reasons,
      policyVersion: policyResult.policyVersion,
      paymentCreated: false,
      message: "Payment blocked by policy engine before order creation.",
    });
  } catch (error: any) {
    console.error("Checkout route error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: error?.message || "Failed to process checkout",
        },
      },
      { status: 500 }
    );
  }
}
