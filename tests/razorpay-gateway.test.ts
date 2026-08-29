import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Regression tests for the reported bug:
 *
 *   "ChatGPT showed clear success but there was no payment recorded
 *    in the Razorpay dashboard."
 *
 * Root causes fixed and pinned down here:
 *   1. With live keys configured, a failed Razorpay API call was SILENTLY
 *      swapped for a fabricated "simulated" order marked CAPTURED.
 *   2. Merely creating a Razorpay Order was treated as a captured payment -
 *      an order never moves money; a real payment entity is required.
 *   3. A past payment id (pay_...) from the ₹1 verification link was treated
 *      as a re-chargeable card token. It is not.
 */

// ---- In-memory Prisma stub -------------------------------------------------
const storedAttempts: any[] = [];
const requestStatusUpdates: Array<{ id: string; status: string }> = [];

vi.mock("../lib/prisma", () => ({
  prisma: {
    paymentAttempt: {
      findFirst: vi.fn(async ({ where }: any) => {
        return storedAttempts.find((a) => a.idempotencyKey === where?.idempotencyKey) || null;
      }),
      create: vi.fn(async ({ data }: any) => {
        const record = { id: `att_${storedAttempts.length + 1}`, createdAt: new Date(), ...data };
        storedAttempts.push(record);
        return record;
      }),
    },
    agentRequest: {
      update: vi.fn(async ({ where, data }: any) => {
        requestStatusUpdates.push({ id: where.id, status: data.status });
        return {};
      }),
    },
  },
}));

import { RazorpayGatewayAdapter, PaymentExecutionError } from "../lib/payments/razorpay-gateway";

function jsonResponse(body: any, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

const fakeMandate = {
  agentId: "chatgpt_user",
  cardLast4: "8192",
  cardNetwork: "Visa",
  email: "user@spendboundary.ai",
};

const baseInput = {
  requestId: "req_test_notebook_350",
  amountPaise: 35000, // the ₹350 notebook
  currency: "INR",
  idempotencyKey: "idem_req_test_notebook_350",
  description: "Buy a notebook for 350rs",
};

describe("RazorpayGatewayAdapter.createOrder - LIVE mode (keys configured)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let gateway: RazorpayGatewayAdapter;

  beforeEach(() => {
    storedAttempts.length = 0;
    requestStatusUpdates.length = 0;
    process.env.RAZORPAY_KEY_ID = "rzp_test_fakekeyid";
    process.env.RAZORPAY_KEY_SECRET = "fake_secret_value";
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    gateway = new RazorpayGatewayAdapter();
  });

  afterEach(() => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    vi.unstubAllGlobals();
  });

  it("REFUSES to fake success when the mandate only holds a pay_... reference (the ₹1 link payment) - the reported bug", async () => {
    await expect(
      gateway.createOrder({
        ...baseInput,
        mandate: { ...fakeMandate, customerId: "cust_abc123", tokenId: "pay_OneRupeePayment" },
      })
    ).rejects.toMatchObject({
      name: "PaymentExecutionError",
      code: "TOKENIZED_DEBIT_UNAVAILABLE",
    });

    // It must NOT have called Razorpay at all (no orphan orders),
    expect(fetchMock).not.toHaveBeenCalled();
    // ...it must have recorded a FAILED attempt in the ledger,
    expect(storedAttempts).toHaveLength(1);
    expect(storedAttempts[0].status).toBe("FAILED");
    // ...and the request must be marked FAILED, never PAID.
    expect(requestStatusUpdates).toEqual([{ id: baseInput.requestId, status: "FAILED" }]);
  });

  it("throws and marks FAILED when the Razorpay Order API errors - no silent simulated fallback", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { description: "Bad credentials" } }, false, 401)
    );

    await expect(
      gateway.createOrder({
        ...baseInput,
        mandate: { ...fakeMandate, customerId: "cust_abc123", tokenId: "token_Real123" },
      })
    ).rejects.toMatchObject({ name: "PaymentExecutionError", code: "ORDER_CREATION_FAILED" });

    expect(storedAttempts[0]?.status).toBe("FAILED");
    expect(requestStatusUpdates).toEqual([{ id: baseInput.requestId, status: "FAILED" }]);
    // No second call happened after order creation failed.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("actually CHARGES via /v1/payments/create/recurring and only reports success for a real captured payment", async () => {
    fetchMock
      // Step A: order creation
      .mockResolvedValueOnce(jsonResponse({ id: "order_NB350" }))
      // Step B: recurring charge of the saved token
      .mockResolvedValueOnce(jsonResponse({ id: "pay_CapturedNB350", status: "captured" }));

    const result = await gateway.createOrder({
      ...baseInput,
      mandate: { ...fakeMandate, customerId: "cust_abc123", tokenId: "token_Real123" },
    });

    expect(result.status).toBe("CAPTURED");
    // The payment id (not an order id / fake id) is what proves money movement.
    expect(result.providerOrderId).toBe("pay_CapturedNB350");

    const urls = fetchMock.mock.calls.map((c: any[]) => String(c[0]));
    expect(urls[0]).toBe("https://api.razorpay.com/v1/orders");
    expect(urls[1]).toBe("https://api.razorpay.com/v1/payments/create/recurring");

    const chargeBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(chargeBody).toMatchObject({
      amount: 35000,
      order_id: "order_NB350",
      customer_id: "cust_abc123",
      token: "token_Real123",
      recurring: "1",
    });

    expect(storedAttempts[0].status).toBe("CAPTURED");
    expect(requestStatusUpdates).toEqual([{ id: baseInput.requestId, status: "PAID" }]);
  });

  it("explicitly captures an authorized-only recurring payment before claiming success", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: "order_NB350" }))
      .mockResolvedValueOnce(jsonResponse({ id: "pay_AuthNB350", status: "authorized" }))
      .mockResolvedValueOnce(jsonResponse({ id: "pay_AuthNB350", status: "captured" }));

    const result = await gateway.createOrder({
      ...baseInput,
      mandate: { ...fakeMandate, customerId: "cust_abc123", tokenId: "token_Real123" },
    });

    expect(result.status).toBe("CAPTURED");
    const urls = fetchMock.mock.calls.map((c: any[]) => String(c[0]));
    expect(urls[2]).toBe("https://api.razorpay.com/v1/payments/pay_AuthNB350/capture");
  });

  it("treats a non-captured recurring payment as a failure, never success", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: "order_NB350" }))
      .mockResolvedValueOnce(jsonResponse({ id: "pay_FailedNB350", status: "failed" }));

    await expect(
      gateway.createOrder({
        ...baseInput,
        mandate: { ...fakeMandate, customerId: "cust_abc123", tokenId: "token_Real123" },
      })
    ).rejects.toMatchObject({ name: "PaymentExecutionError", code: "PAYMENT_NOT_CAPTURED" });

    expect(storedAttempts[0].status).toBe("FAILED");
  });

  it("returns a previously CAPTURED attempt on idempotent retry instead of double-charging", async () => {
    storedAttempts.push({
      id: "att_prev",
      status: "CAPTURED",
      providerOrderId: "pay_previous",
      amountPaise: 35000,
      idempotencyKey: baseInput.idempotencyKey,
      createdAt: new Date("2026-08-29T10:00:00Z"),
    });

    const result = await gateway.createOrder({
      ...baseInput,
      mandate: { ...fakeMandate, customerId: "cust_abc123", tokenId: "token_Real123" },
    });

    expect(result.providerOrderId).toBe("pay_previous");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("RazorpayGatewayAdapter.createOrder - OFFLINE demo mode (no keys configured)", () => {
  beforeEach(() => {
    storedAttempts.length = 0;
    requestStatusUpdates.length = 0;
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
  });

  it("still provides the deterministic simulated capture (demo UX preserved)", async () => {
    const gateway = new RazorpayGatewayAdapter();
    const result = await gateway.createOrder({ ...baseInput });

    expect(result.status).toBe("CAPTURED");
    expect(result.providerOrderId).toMatch(/^order_rzp_/);
    expect(result.message).toContain("Simulated");
  });
});
