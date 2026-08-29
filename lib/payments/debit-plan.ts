// SpendBoundary - Auto-Debit Planning (Pure Logic)
//
// Decides HOW an approved (ALLOW) order's payment must be executed.
// Extracted as a pure function so the honesty guarantees can be unit-tested:
// SpendBoundary must NEVER report a successful charge unless a real
// captured payment exists at the provider.

export type DebitStrategy =
  | "CHARGE_SAVED_TOKEN"       // Live Razorpay recurring charge via customer_id + token_id
  | "MANUAL_PAYMENT_REQUIRED"  // No reusable token on file -> user must pay via a real hosted link
  | "SIMULATED_DEMO";          // No live keys configured -> deterministic offline demo mode

export interface MandateDebitContext {
  liveKeysConfigured: boolean;
  customerId?: string | null;
  tokenId?: string | null;
}

/**
 * Razorpay reusable card tokens always look like `token_XXXXXXXX`.
 * A `pay_XXXXXXXX` id is a past PAYMENT id (e.g. the ₹1 authorization payment
 * captured through a hosted payment link) and CANNOT be charged again -
 * treating it as a token is exactly what produced silent "phantom" success.
 */
export function isReusableCardToken(tokenId?: string | null): boolean {
  return typeof tokenId === "string" && /^token_[A-Za-z0-9]+$/.test(tokenId.trim());
}

/**
 * Decide the debit strategy for an approved order.
 *
 * Rules:
 *  - Without live Razorpay keys this is an offline demo -> SIMULATED_DEMO.
 *  - A silent auto-debit is ONLY possible with a real customer_id AND a
 *    reusable `token_...` card token (Razorpay "recurring payments" API).
 *  - Anything else (e.g. a mandate that was only verified by a ₹1 payment-link
 *    payment, or no mandate at all) MUST NOT pretend to charge the card ->
 *    MANUAL_PAYMENT_REQUIRED so the caller can issue a real hosted link.
 */
export function planMandateDebit(ctx: MandateDebitContext): DebitStrategy {
  if (!ctx.liveKeysConfigured) {
    return "SIMULATED_DEMO";
  }

  const hasCustomer = typeof ctx.customerId === "string" && ctx.customerId.trim().length > 0;
  if (hasCustomer && isReusableCardToken(ctx.tokenId)) {
    return "CHARGE_SAVED_TOKEN";
  }

  return "MANUAL_PAYMENT_REQUIRED";
}
