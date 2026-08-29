import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Quick DB check
    const productCount = await prisma.product.count();
    const policyCount = await prisma.policy.count();

    return NextResponse.json({
      status: "healthy",
      service: "SpendBoundary",
      mode: "DEMO_MODE",
      database: "connected",
      products: productCount,
      policies: policyCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "unhealthy",
        error: error?.message || "Unknown database error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
