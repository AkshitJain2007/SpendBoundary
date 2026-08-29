import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEMO_PRODUCTS, DEMO_POLICY } from "@/lib/seed-data";

export async function POST() {
  try {
    // Reset and re-seed
    await prisma.auditEvent.deleteMany({});
    await prisma.paymentAttempt.deleteMany({});
    await prisma.approval.deleteMany({});
    await prisma.policyDecision.deleteMany({});
    await prisma.agentRequest.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.policy.deleteMany({});

    for (const prod of DEMO_PRODUCTS) {
      await prisma.product.create({
        data: {
          id: prod.id,
          name: prod.name,
          category: prod.category,
          pricePaise: prod.pricePaise,
          stock: prod.stock,
          allowed: prod.allowed,
          description: prod.description,
        },
      });
    }

    await prisma.policy.create({
      data: {
        id: DEMO_POLICY.id,
        merchantId: DEMO_POLICY.merchantId,
        maxOrderPaise: DEMO_POLICY.maxOrderPaise,
        dailyLimitPaise: DEMO_POLICY.dailyLimitPaise,
        velocityCount: DEMO_POLICY.velocityCount,
        velocityWindowSeconds: DEMO_POLICY.velocityWindowSeconds,
        allowedCategories: JSON.stringify(DEMO_POLICY.allowedCategories),
        approvalThresholdPaise: DEMO_POLICY.approvalThresholdPaise,
        version: DEMO_POLICY.version,
      },
    });

    await prisma.auditEvent.create({
      data: {
        eventType: "SYSTEM_GENESIS",
        requestId: "genesis",
        payloadJson: JSON.stringify({
          message: "SpendBoundary Genesis Audit Block Reset",
          merchantId: DEMO_POLICY.merchantId,
          timestamp: new Date().toISOString(),
        }),
        previousHash: "0000000000000000000000000000000000000000000000000000000000000000",
        eventHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      },
    });

    return NextResponse.json({
      success: true,
      message: "SpendBoundary database reset and seeded successfully",
      productsSeeded: DEMO_PRODUCTS.length,
      policyVersion: DEMO_POLICY.version,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to seed demo database",
      },
      { status: 500 }
    );
  }
}
