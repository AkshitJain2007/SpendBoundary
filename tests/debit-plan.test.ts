import { describe, it, expect } from "vitest";
import { isReusableCardToken, planMandateDebit } from "../lib/payments/debit-plan";

/**
 * These tests pin down the fix for the reported bug:
 * "ChatGPT showed clear success but no payment was recorded in Razorpay dashboard."
 *
 * The gateway uses planMandateDebit() to decide how an ALLOW-ed order is paid.
 * The critical guarantee: a silent auto-charge may ONLY be attempted with a
 * genuine reusable Razorpay card token + customer id. Anything else must go
 * down the MANUAL_PAYMENT_REQUIRED path (real hosted payment link) and can
 * never masquerade as a successful charge.
 */

describe("isReusableCardToken", () => {
  it("accepts genuine Razorpay card tokens (token_ + alphanumeric id)", () => {
    expect(isReusableCardToken("token_Habcxyz123")).toBe(true);
    expect(isReusableCardToken("token_NxHkLq3E4F5g6H")).toBe(true);
  });

  it("rejects payment ids from the ₹1 authorization link (not re-chargeable)", () => {
    expect(isReusableCardToken("pay_QwErTy123456")).toBe(false);
    expect(isReusableCardToken("pay_link_plinkabcd1234")).toBe(false);
  });

  it("rejects fabricated / legacy token references (the phantom-success source)", () => {
    // Fabricated demo tokens like the DB default "token_rzp_preauth_card" must
    // NOT be treated as real chargeable Razorpay tokens.
    expect(isReusableCardToken("token_rzp_preauth_card")).toBe(false);
    expect(isReusableCardToken("token_rzp_chatgptuse_card")).toBe(false);
    expect(isReusableCardToken("order_rzp_123")).toBe(false);
    expect(isReusableCardToken("")).toBe(false);
    expect(isReusableCardToken(null)).toBe(false);
    expect(isReusableCardToken(undefined)).toBe(false);
  });
});

describe("planMandateDebit", () => {
  it("uses SIMULATED_DEMO only when no live keys are configured", () => {
    expect(
      planMandateDebit({ liveKeysConfigured: false, customerId: "cust_1", tokenId: "token_1" })
    ).toBe("SIMULATED_DEMO");

    expect(
      planMandateDebit({ liveKeysConfigured: false, customerId: null, tokenId: null })
    ).toBe("SIMULATED_DEMO");
  });

  it("allows a silent CHARGE_SAVED_TOKEN only with customerId + real token", () => {
    expect(
      planMandateDebit({
        liveKeysConfigured: true,
        customerId: "cust_NxHkLq3E4F5g6H",
        tokenId: "token_NxHkLq3E4F5g6H",
      })
    ).toBe("CHARGE_SAVED_TOKEN");
  });

  it("forces MANUAL_PAYMENT_REQUIRED when the mandate only holds a pay_... reference (the reported bug)", () => {
    // This is exactly the state produced by the ₹1 payment-link verification:
    // card "fetched" (last4 + network known) but tokenId is a payment id.
    expect(
      planMandateDebit({
        liveKeysConfigured: true,
        customerId: "cust_NxHkLq3E4F5g6H",
        tokenId: "pay_NxHkLq3E4F5g6H",
      })
    ).toBe("MANUAL_PAYMENT_REQUIRED");
  });

  it("forces MANUAL_PAYMENT_REQUIRED when no customer id is bound to the mandate", () => {
    expect(
      planMandateDebit({
        liveKeysConfigured: true,
        customerId: null,
        tokenId: "token_NxHkLq3E4F5g6H",
      })
    ).toBe("MANUAL_PAYMENT_REQUIRED");
  });

  it("forces MANUAL_PAYMENT_REQUIRED when no mandate exists at all", () => {
    expect(
      planMandateDebit({ liveKeysConfigured: true, customerId: undefined, tokenId: undefined })
    ).toBe("MANUAL_PAYMENT_REQUIRED");
  });
});
