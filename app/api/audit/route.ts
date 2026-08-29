import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuditChain } from "@/lib/audit-chain";

export async function GET() {
  try {
    const events = await prisma.auditEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const verification = await verifyAuditChain();

    const formatted = events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      requestId: e.requestId,
      payload: JSON.parse(e.payloadJson),
      previousHash: e.previousHash,
      eventHash: e.eventHash,
      createdAt: e.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      verification,
      events: formatted,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch audit trail" },
      { status: 500 }
    );
  }
}
