import { NextResponse } from "next/server";
import { injectTamperedAuditEvent, verifyAuditChain, appendAuditEvent } from "@/lib/audit-chain";

export async function POST() {
  try {
    const tamperResult = await injectTamperedAuditEvent();

    // Log the tampering detection event attempt
    const verification = await verifyAuditChain();

    return NextResponse.json({
      success: true,
      message: "Simulated audit block tampering executed.",
      tamperDetails: tamperResult,
      verification,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to inject tamper" },
      { status: 400 }
    );
  }
}
