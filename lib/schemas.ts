import { z } from "zod";

// Cart Item Schema
export const CartItemSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z.number().int().positive("Quantity must be a positive integer"),
});

export type CartItem = z.infer<typeof CartItemSchema>;

// Agent Request Input Schema
export const AgentGoalInputSchema = z.object({
  goal: z.string().min(1, "User goal is required"),
  sessionId: z.string().optional().default("demo_session"),
});

export type AgentGoalInput = z.infer<typeof AgentGoalInputSchema>;

// Checkout Request Schema
export const CheckoutRequestSchema = z.object({
  cartId: z.string().optional().default("cart_demo"),
  items: z.array(CartItemSchema).min(1, "Cart cannot be empty"),
  agentId: z.string().min(1, "Agent ID is required"),
  reason: z.string().min(1, "Reason for purchase is required"),
});

export type CheckoutRequest = z.infer<typeof CheckoutRequestSchema>;

// Decision Rule Reason Schema
export const PolicyReasonSchema = z.object({
  ruleId: z.string(),
  message: z.string(),
  requestedPaise: z.number().int().nonnegative().optional(),
  limitPaise: z.number().int().nonnegative().optional(),
});

export type PolicyReason = z.infer<typeof PolicyReasonSchema>;

// Policy Decision Output Schema
export const PolicyDecisionResultSchema = z.object({
  decision: z.enum(["ALLOW", "REVIEW", "DENY"]),
  reasons: z.array(PolicyReasonSchema),
  policyVersion: z.string(),
  requestId: z.string(),
  evaluatedAt: z.string().datetime().optional(),
});

export type PolicyDecisionResult = z.infer<typeof PolicyDecisionResultSchema>;

// Human Approval Action Schema
export const ApprovalActionSchema = z.object({
  requestId: z.string().min(1, "Request ID is required"),
  decision: z.enum(["APPROVED", "REJECTED"]),
  reviewerId: z.string().min(1, "Reviewer ID is required"),
  comment: z.string().optional(),
});

export type ApprovalAction = z.infer<typeof ApprovalActionSchema>;

// Payment Attempt Webhook Schema
export const PaymentWebhookEventSchema = z.object({
  eventId: z.string().min(1),
  requestId: z.string().min(1),
  providerOrderId: z.string().min(1),
  status: z.enum(["AUTHORIZED", "CAPTURED", "FAILED"]),
  amountPaise: z.number().int().positive(),
  signature: z.string().optional(),
});

export type PaymentWebhookEvent = z.infer<typeof PaymentWebhookEventSchema>;
