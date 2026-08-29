// SpendBoundary - Local Mock Payment Gateway
// Always available for offline demo testing with zero external dependencies.

import { PaymentGateway, CreateOrderInput, CreateOrderResult, PaymentAttemptStatus } from "./gateway";
import { prisma } from "../prisma";

export class MockPaymentGateway implements PaymentGateway {
  /**
   * Creates or returns an existing mock order using the idempotency key.
   */
  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const {
      requestId,
      amountPaise,
      idempotencyKey,
      simulateTimeout = false,
    } = input;

    // Check for existing attempt with this idempotency key
    const existingAttempt = await prisma.paymentAttempt.findUnique({
      where: { idempotencyKey },
    });

    if (existingAttempt) {
      return {
        provider: "MOCK",
        providerOrderId: existingAttempt.providerOrderId || `mock_order_${existingAttempt.id}`,
        status: existingAttempt.status as PaymentAttemptStatus,
        amountPaise: existingAttempt.amountPaise,
        idempotencyKey: existingAttempt.idempotencyKey,
        createdAt: existingAttempt.createdAt.toISOString(),
        message: "Existing payment attempt matched via idempotency key (duplicate call deduplicated).",
      };
    }

    if (simulateTimeout) {
      // Create record with TIMEOUT status for retry demonstration
      const timeoutAttempt = await prisma.paymentAttempt.create({
        data: {
          requestId,
          provider: "MOCK",
          providerOrderId: `mock_order_timeout_${Date.now()}`,
          idempotencyKey,
          status: "TIMEOUT",
          amountPaise,
        },
      });

      return {
        provider: "MOCK",
        providerOrderId: timeoutAttempt.providerOrderId!,
        status: "TIMEOUT",
        amountPaise,
        idempotencyKey,
        createdAt: timeoutAttempt.createdAt.toISOString(),
        message: "Simulated network timeout. Attempt recorded with status TIMEOUT.",
      };
    }

    // Normal successful mock capture
    const mockOrderId = `mock_ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newAttempt = await prisma.paymentAttempt.create({
      data: {
        requestId,
        provider: "MOCK",
        providerOrderId: mockOrderId,
        idempotencyKey,
        status: "CAPTURED",
        amountPaise,
      },
    });

    // Update AgentRequest status to PAID
    await prisma.agentRequest.update({
      where: { id: requestId },
      data: { status: "PAID" },
    });

    return {
      provider: "MOCK",
      providerOrderId: mockOrderId,
      status: "CAPTURED",
      amountPaise,
      idempotencyKey,
      createdAt: newAttempt.createdAt.toISOString(),
      message: "Mock payment authorized and captured successfully.",
    };
  }

  async fetchStatus(orderId: string): Promise<{ status: PaymentAttemptStatus; amountPaise: number }> {
    const attempt = await prisma.paymentAttempt.findFirst({
      where: { providerOrderId: orderId },
    });

    if (!attempt) {
      return { status: "FAILED", amountPaise: 0 };
    }

    return {
      status: attempt.status as PaymentAttemptStatus,
      amountPaise: attempt.amountPaise,
    };
  }
}

export const mockGateway = new MockPaymentGateway();
