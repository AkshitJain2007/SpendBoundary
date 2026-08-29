import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApprovalActionSchema } from "@/lib/schemas";
import { mockGateway } from "@/lib/payments/mock-gateway";
import { appendAuditEvent } from "@/lib/audit-chain";

export async function GET() {
  try {
    const approvals = await prisma.approval.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        request: {
          include: {
            decision: true,
            paymentAttempts: true,
          },
        },
      },
    });

    const formatted = approvals.map((a) => ({
      id: a.id,
      requestId: a.requestId,
      agentId: a.request.agentId,
      requestedAmountPaise: a.request.requestedAmountPaise,
      cartSnapshot: JSON.parse(a.request.cartSnapshot),
      reason: a.request.reason,
      decision: a.decision,
      reviewerId: a.reviewerId,
      comment: a.comment,
      expiresAt: a.expiresAt.toISOString(),
      createdAt: a.createdAt.toISOString(),
      policyDecision: a.request.decision
        ? {
            decision: a.request.decision.decision,
            reasons: JSON.parse(a.request.decision.reasons),
            policyVersion: a.request.decision.policyVersion,
          }
        : null,
      paymentAttempts: a.request.paymentAttempts,
    }));

    return NextResponse.json({
      success: true,
      approvals: formatted,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch approvals" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parseResult = ApprovalActionSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid approval action payload",
            details: parseResult.error.errors,
          },
        },
        { status: 400 }
      );
    }

    const { requestId, decision, reviewerId, comment } = parseResult.data;

    const approval = await prisma.approval.findUnique({
      where: { requestId },
      include: { request: true },
    });

    if (!approval) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: `No approval request found for request ID ${requestId}` } },
        { status: 404 }
      );
    }

    if (approval.decision !== "PENDING") {
      return NextResponse.json(
        {
          error: {
            code: "ALREADY_DECIDED",
            message: `Approval has already been marked as ${approval.decision}.`,
          },
        },
        { status: 400 }
      );
    }

    // Check expiry
    if (new Date() > approval.expiresAt) {
      await prisma.approval.update({
        where: { requestId },
        data: { decision: "EXPIRED" },
      });

      await appendAuditEvent("APPROVAL_EXPIRED", requestId, {
        reviewerId,
        expiredAt: new Date().toISOString(),
      });

      return NextResponse.json(
        {
          error: {
            code: "APPROVAL_EXPIRED",
            message: "This approval request has expired. Re-review is required.",
          },
        },
        { status: 400 }
      );
    }

    if (decision === "APPROVED") {
      // 1. Update Approval record
      await prisma.approval.update({
        where: { requestId },
        data: {
          decision: "APPROVED",
          reviewerId,
          comment: comment || "Approved by human operator.",
        },
      });

      await appendAuditEvent("HUMAN_APPROVAL_ACCEPTED", requestId, {
        reviewerId,
        comment,
        amountPaise: approval.request.requestedAmountPaise,
        approvedAt: new Date().toISOString(),
      });

      // 2. Create one mock payment attempt
      const idempotencyKey = `idem_approval_${requestId}`;
      const paymentResult = await mockGateway.createOrder({
        requestId,
        amountPaise: approval.request.requestedAmountPaise,
        currency: "INR",
        idempotencyKey,
        description: `Human-approved procurement: ${approval.request.reason}`,
      });

      await appendAuditEvent("PAYMENT_ATTEMPT_RECORDED", requestId, {
        provider: paymentResult.provider,
        providerOrderId: paymentResult.providerOrderId,
        status: paymentResult.status,
        idempotencyKey,
        amountPaise: paymentResult.amountPaise,
        origin: "HUMAN_APPROVAL_GATE",
      });

      return NextResponse.json({
        success: true,
        decision: "APPROVED",
        requestId,
        payment: paymentResult,
        message: "Human approval registered. Payment captured successfully.",
      });
    } else {
      // REJECTED
      await prisma.approval.update({
        where: { requestId },
        data: {
          decision: "REJECTED",
          reviewerId,
          comment: comment || "Rejected by human reviewer.",
        },
      });

      await prisma.agentRequest.update({
        where: { id: requestId },
        data: { status: "REJECTED" },
      });

      await appendAuditEvent("HUMAN_APPROVAL_REJECTED", requestId, {
        reviewerId,
        comment,
        rejectedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        decision: "REJECTED",
        requestId,
        paymentCreated: false,
        message: "Human reviewer rejected the request. Zero payment attempts created.",
      });
    }
  } catch (error: any) {
    console.error("Approval action error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to process approval" },
      { status: 500 }
    );
  }
}
