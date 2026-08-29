// SpendBoundary - Payment Gateway Interfaces

export type PaymentAttemptStatus =
  | "CREATED"
  | "AUTHORIZED"
  | "CAPTURED"
  | "FAILED"
  | "TIMEOUT";

export interface CreateOrderInput {
  requestId: string;
  amountPaise: number;
  currency: string;
  idempotencyKey: string;
  description: string;
  simulateTimeout?: boolean;
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
