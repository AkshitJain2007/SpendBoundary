import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    let policy = await prisma.policy.findFirst({
      where: { id: "policy_default" },
    });

    if (!policy) {
      policy = await prisma.policy.create({
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

    return NextResponse.json({
      success: true,
      policy: {
        ...policy,
        allowedCategories: JSON.parse(policy.allowedCategories),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch policy" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    const updated = await prisma.policy.upsert({
      where: { id: "policy_default" },
      update: {
        maxOrderPaise: body.maxOrderPaise,
        dailyLimitPaise: body.dailyLimitPaise,
        velocityCount: body.velocityCount,
        velocityWindowSeconds: body.velocityWindowSeconds,
        approvalThresholdPaise: body.approvalThresholdPaise,
        allowedCategories: JSON.stringify(body.allowedCategories || []),
        version: body.version || "v1.1",
      },
      create: {
        id: "policy_default",
        merchantId: "merchant_apex_01",
        maxOrderPaise: body.maxOrderPaise || 200000,
        dailyLimitPaise: body.dailyLimitPaise || 500000,
        velocityCount: body.velocityCount || 3,
        velocityWindowSeconds: body.velocityWindowSeconds || 60,
        approvalThresholdPaise: body.approvalThresholdPaise || 100000,
        allowedCategories: JSON.stringify(body.allowedCategories || []),
        version: "v1.1",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Policy updated successfully",
      policy: {
        ...updated,
        allowedCategories: JSON.parse(updated.allowedCategories),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to update policy" },
      { status: 500 }
    );
  }
}
