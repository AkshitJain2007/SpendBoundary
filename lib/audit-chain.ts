// SpendBoundary - Cryptographic SHA-256 Audit Hash Chain
// Implements tamper-evident audit logging for all policy decisions and payment actions.

import { createHash } from "crypto";
import { prisma } from "./prisma";

export interface AuditEventData {
  id: string;
  eventType: string;
  requestId: string | null;
  payloadJson: string;
  previousHash: string;
  eventHash: string;
  createdAt: Date;
}

export interface VerificationResult {
  valid: boolean;
  totalEvents: number;
  message: string;
  firstInvalidEvent?: {
    id: string;
    eventType: string;
    expectedHash: string;
    storedHash: string;
    requestId: string | null;
  };
}

/**
 * Computes canonical SHA-256 hash for an audit block
 */
export function calculateEventHash(
  previousHash: string,
  canonicalPayload: string,
  eventType: string,
  timestamp: string | Date
): string {
  const tsString = timestamp instanceof Date ? timestamp.toISOString() : new Date(timestamp).toISOString();
  const rawString = `${previousHash}|${canonicalPayload}|${eventType}|${tsString}`;
  return createHash("sha256").update(rawString, "utf8").digest("hex");
}

/**
 * Appends a new verified event to the audit hash chain
 */
export async function appendAuditEvent(
  eventType: string,
  requestId: string | null,
  payload: Record<string, any>
): Promise<AuditEventData> {
  // Fetch the latest event in the chain to get the previousHash
  const latestEvent = await prisma.auditEvent.findFirst({
    orderBy: { createdAt: "desc" },
  });

  const previousHash =
    latestEvent?.eventHash ||
    "0000000000000000000000000000000000000000000000000000000000000000";

  // Canonicalize JSON (sort keys)
  const canonicalPayload = JSON.stringify(payload, Object.keys(payload).sort());
  const now = new Date();
  const eventHash = calculateEventHash(previousHash, canonicalPayload, eventType, now);

  const created = await prisma.auditEvent.create({
    data: {
      eventType,
      requestId,
      payloadJson: canonicalPayload,
      previousHash,
      eventHash,
      createdAt: now,
    },
  });

  return created;
}

/**
 * Validates the entire SHA-256 hash chain from genesis to head
 */
export async function verifyAuditChain(): Promise<VerificationResult> {
  const events = await prisma.auditEvent.findMany({
    orderBy: { createdAt: "asc" },
  });

  if (events.length === 0) {
    return {
      valid: true,
      totalEvents: 0,
      message: "Audit trail is empty.",
    };
  }

  let previousHash = "0000000000000000000000000000000000000000000000000000000000000000";

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    // Genesis block check
    if (i === 0 && event.eventType === "SYSTEM_GENESIS") {
      previousHash = event.eventHash;
      continue;
    }

    // Verify linkage to previous hash
    if (event.previousHash !== previousHash) {
      return {
        valid: false,
        totalEvents: events.length,
        message: `Broken chain link at event #${i + 1} (${event.eventType}). Previous hash mismatch.`,
        firstInvalidEvent: {
          id: event.id,
          eventType: event.eventType,
          expectedHash: previousHash,
          storedHash: event.previousHash,
          requestId: event.requestId,
        },
      };
    }

    // Verify hash integrity of the event itself
    const computedHash = calculateEventHash(
      event.previousHash,
      event.payloadJson,
      event.eventType,
      event.createdAt
    );

    if (computedHash !== event.eventHash) {
      return {
        valid: false,
        totalEvents: events.length,
        message: `Tampering detected at event #${i + 1} (${event.eventType}). Payload hash does not match stored hash.`,
        firstInvalidEvent: {
          id: event.id,
          eventType: event.eventType,
          expectedHash: computedHash,
          storedHash: event.eventHash,
          requestId: event.requestId,
        },
      };
    }

    previousHash = event.eventHash;
  }

  return {
    valid: true,
    totalEvents: events.length,
    message: `All ${events.length} audit events cryptographically verified with zero tampering.`,
  };
}

/**
 * Demo helper: deliberately tampers with an audit event to demonstrate detection
 */
export async function injectTamperedAuditEvent(): Promise<{
  tamperedEventId: string;
  originalPayload: string;
  tamperedPayload: string;
}> {
  // Find a non-genesis event to tamper with
  const eventToTamper = await prisma.auditEvent.findFirst({
    where: {
      eventType: { not: "SYSTEM_GENESIS" },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!eventToTamper) {
    throw new Error("No existing non-genesis audit events found to tamper with. Run a transaction first!");
  }

  const originalPayload = eventToTamper.payloadJson;
  const parsed = JSON.parse(originalPayload);
  parsed.__tamperedByAttacker = true;
  parsed.alteredAmountPaise = 99999999;
  const tamperedPayload = JSON.stringify(parsed);

  // Directly mutate the stored payload without updating hash
  await prisma.auditEvent.update({
    where: { id: eventToTamper.id },
    data: {
      payloadJson: tamperedPayload,
    },
  });

  return {
    tamperedEventId: eventToTamper.id,
    originalPayload,
    tamperedPayload,
  };
}
