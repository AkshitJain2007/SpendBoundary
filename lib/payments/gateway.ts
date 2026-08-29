// SpendBoundary - Payment Gateway Interfaces

export type PaymentAttemptStatus =
  | "CREATED"
  | "AUTHORIZED"
  | "CAPTURED"
  | "FAILED"
  | "TIMEOUT";

/**
 * Saved-card mandate context for an auto-debit attempt.
 * `customerId` + `tokenId` must be genuine Razorpay entities
 * (`cust_...` + `token_...`) for a silent recurring charge to be possible.
 */
export interface MandateChargeContext {
  agentId?: string;
  customerId?: string | null;
  tokenId?: string | null;
  cardLast4?: string | null;
  cardNetwork?: string | null;
  email?: string | null;
  contact?: string | null;
}

export interface CreateOrderInput {
  requestId: string;
  amountPaise: number;
  currency: string;
  idempotencyKey: string;
  description: string;
  simulateTimeout?: boolean;
  mandate?: MandateChargeContext;
}

export interface CreateOrderResult {
  provider: "MOCK" | "RAZORPAY_TEST";
  providerOrderId: string;
  status: PaymentAttemptStatus;
  amountPaise: number;
  idempotencyKey: string;
  createdAt: string;
  message: string;
}

export interface PaymentGateway {
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  fetchStatus(orderId: string): Promise<{ status: PaymentAttemptStatus; amountPaise: number }>;
}
