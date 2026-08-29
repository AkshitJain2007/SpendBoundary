import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appendAuditEvent } from "@/lib/audit-chain";

export async function POST() {
  try {
    // Delete test transaction records to reset daily spend to ₹0
    await prisma.paymentAttempt.deleteMany();
    await prisma.approval.deleteMany();
    await prisma.policyDecision.deleteMany();
    await prisma.agentRequest.deleteMany();

    await appendAuditEvent("SYSTEM_DAILY_SPEND_RESET", `reset_${Date.now()}`, {
      message: "Daily spend reset to ₹0.00 by operator.",
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      dailySpentPaise: 0,
      dailySpentRupees: 0,
      message: "Daily spend and test transactions have been successfully reset to ₹0.00.",
    });
  } catch (error: any) {
    console.error("Failed to reset daily spend:", error);
    return NextResponse.json({ error: error?.message || "Failed to reset daily spend" }, { status: 500 });
  }
}
