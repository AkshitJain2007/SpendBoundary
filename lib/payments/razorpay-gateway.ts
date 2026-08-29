import crypto from "crypto";
import fs from "fs";
import path from "path";
import { PaymentGateway, CreateOrderInput, CreateOrderResult, PaymentAttemptStatus } from "./gateway";
import { planMandateDebit } from "./debit-plan";
import { prisma } from "../prisma";

// Ensure .env.local is automatically loaded even when invoked as standalone stdio MCP server from Claude Desktop
function loadEnvLocal() {
  try {
    const envPaths = [
      path.resolve(process.cwd(), ".env.local"),
      path.resolve(__dirname, "../../.env.local"),
      path.resolve(__dirname, "../.env.local"),
    ];
    for (const envPath of envPaths) {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf8");
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
            const idx = trimmed.indexOf("=");
            const key = trimmed.substring(0, idx).trim();
            let val = trimmed.substring(idx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (val && (!process.env[key] || process.env[key] === "")) {
              process.env[key] = val;
            }
          }
        }
        break;
      }
    }
  } catch {
    // Ignore error in edge runtimes
  }
}
loadEnvLocal();

export interface RazorpayPaymentLinkParams {
  requestId: string;
  amountPaise: number;
  currency: string;
  description: string;
  customerName?: string;
  customerEmail?: string;
  customerContact?: string;
}

export type PaymentExecutionErrorCode =
  | "ORDER_CREATION_FAILED"
  | "TOKENIZED_DEBIT_UNAVAILABLE"
  | "RECURRING_CHARGE_FAILED"
  | "PAYMENT_NOT_CAPTURED"
  | "PAYMENT_LINK_FAILED";

/**
 * Raised when a payment could NOT actually be executed at Razorpay.
 * Callers must surface this to the agent/user instead of claiming success.
 */
export class PaymentExecutionError extends Error {
  code: PaymentExecutionErrorCode;
  providerOrderId?: string | null;
  providerResponse?: string;

  constructor(
    code: PaymentExecutionErrorCode,
    message: string,
    options?: { providerOrderId?: string | null; providerResponse?: string }
  ) {
    super(message);
    this.name = "PaymentExecutionError";
    this.code = code;
    this.providerOrderId = options?.providerOrderId ?? null;
    this.providerResponse = options?.providerResponse;
  }
}

export interface RazorpayPaymentLinkResult {
  id: string;
  shortUrl: string;
  amountPaise: number;
  status: "created" | "paid" | "expired";
  requestId: string;
  provider: "RAZORPAY_TEST" | "RAZORPAY_SIMULATED";
  createdAt: string;
}

export class RazorpayGatewayAdapter implements PaymentGateway {
  providerName = "RAZORPAY_TEST";

  private getKeyId(): string | undefined {
    return process.env.RAZORPAY_KEY_ID;
  }

  private getKeySecret(): string | undefined {
    return process.env.RAZORPAY_KEY_SECRET;
  }

  private isLiveConfigured(): boolean {
    const keyId = this.getKeyId()?.trim();
    const keySecret = this.getKeySecret()?.trim();
    return Boolean(keyId && keySecret && keyId.length > 5 && keySecret.length > 5);
  }

  private getAuthHeader(): string {
    const keyId = this.getKeyId()!.trim();
    const keySecret = this.getKeySecret()!.trim();
    return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
  }

  private async recordFailedAttempt(
    requestId: string,
    amountPaise: number,
    idempotencyKey: string,
    providerOrderId?: string | null
  ) {
    try {
      await prisma.paymentAttempt.create({
        data: {
          requestId,
          provider: "RAZORPAY_TEST",
          providerOrderId: providerOrderId ?? null,
          status: "FAILED",
          amountPaise,
          idempotencyKey,
        },
      });
    } catch (dbErr: any) {
      console.error("Failed to record FAILED payment attempt:", dbErr?.message);
    }

    try {
      await prisma.agentRequest.update({
        where: { id: requestId },
        data: { status: "FAILED" },
      });
    } catch (dbErr: any) {
      console.error("Failed to mark agent request FAILED:", dbErr?.message);
    }
  }

  /**
   * Creates a Razorpay Order. Throws PaymentExecutionError on API failure -
   * an order alone NEVER moves money.
   */
  private async createRazorpayOrder(params: {
    requestId: string;
    amountPaise: number;
    currency: string;
    idempotencyKey: string;
    description?: string;
  }): Promise<any> {
    const { requestId, amountPaise, currency, idempotencyKey, description } = params;

    const rzpResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.getAuthHeader(),
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency,
        receipt: requestId.substring(0, 40),
        notes: {
          idempotencyKey,
          description: description || "SpendBoundary AI Purchase",
          agentSystem: "SpendBoundary",
        },
      }),
    });

    if (!rzpResponse.ok) {
      const errText = await rzpResponse.text();
      console.error(`[Razorpay Order API Error ${rzpResponse.status}]:`, errText);
      throw new PaymentExecutionError(
        "ORDER_CREATION_FAILED",
        `Razorpay Order API returned HTTP ${rzpResponse.status}: ${errText}`,
        { providerResponse: errText }
      );
    }

    return rzpResponse.json();
  }

  /**
   * Charges a saved, RBI-compliant card token WITHOUT customer interaction:
   * POST /v1/payments/create/recurring (requires a real customer_id + token_id).
   */
  private async chargeSavedCardToken(params: {
    amountPaise: number;
    currency: string;
    orderId: string;
    customerId: string;
    tokenId: string;
    email?: string | null;
    contact?: string | null;
    description?: string;
  }): Promise<any> {
    const {
      amountPaise,
      currency,
      orderId,
      customerId,
      tokenId,
      email = "user@spendboundary.ai",
      contact = "+919876543210",
      description,
    } = params;

    const rzpResponse = await fetch("https://api.razorpay.com/v1/payments/create/recurring", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.getAuthHeader(),
      },
      body: JSON.stringify({
        email,
        contact,
        amount: amountPaise,
        currency,
        order_id: orderId,
        customer_id: customerId,
        token: tokenId,
        recurring: "1",
        description: (description || "SpendBoundary Mandate Auto-Debit").substring(0, 200),
      }),
    });

    const bodyText = await rzpResponse.text();
    if (!rzpResponse.ok) {
      console.error(`[Razorpay Recurring Charge Error ${rzpResponse.status}]:`, bodyText);
      throw new PaymentExecutionError(
        "RECURRING_CHARGE_FAILED",
        `Razorpay recurring charge API returned HTTP ${rzpResponse.status}: ${bodyText}`,
        { providerOrderId: orderId, providerResponse: bodyText }
      );
    }

    return JSON.parse(bodyText);
  }

  /** Explicitly captures an authorized payment. */
  private async capturePayment(paymentId: string, amountPaise: number, currency: string): Promise<any> {
    const rzpResponse = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.getAuthHeader(),
      },
      body: JSON.stringify({ amount: amountPaise, currency }),
    });

    const bodyText = await rzpResponse.text();
    if (!rzpResponse.ok) {
      console.error(`[Razorpay Capture Error ${rzpResponse.status}]:`, bodyText);
      throw new PaymentExecutionError(
        "PAYMENT_NOT_CAPTURED",
        `Razorpay capture API returned HTTP ${rzpResponse.status}: ${bodyText}`,
        { providerOrderId: paymentId, providerResponse: bodyText }
      );
    }

    return JSON.parse(bodyText);
  }

  /**
   * Creates an order AND executes the actual payment for tokenized / auto-debit checkouts.
   *
   * HONESTY GUARANTEE: when live Razorpay keys are configured this method either
   * returns a real captured payment, or throws a PaymentExecutionError. It NEVER
   * fabricates a simulated success. Simulated mode is used only when keys are
   * entirely absent (offline demo).
   */
  async createOrder(params: CreateOrderInput): Promise<CreateOrderResult> {
    const { requestId, amountPaise, currency = "INR", idempotencyKey, description, mandate } = params;

    // 1. Idempotency Check - a previously CAPTURED attempt is a real success, reuse it.
    //    A previous FAILED attempt is retried under a derived idempotency key so the
    //    unique constraint is preserved while the audit trail stays complete.
    const existingAttempt = await prisma.paymentAttempt.findFirst({
      where: { idempotencyKey },
    });

    if (existingAttempt && existingAttempt.status === "CAPTURED") {
      return {
        provider: "RAZORPAY_TEST",
        providerOrderId: existingAttempt.providerOrderId || `ord_${existingAttempt.id}`,
        status: existingAttempt.status as PaymentAttemptStatus,
        amountPaise: existingAttempt.amountPaise,
        idempotencyKey: existingAttempt.idempotencyKey,
        createdAt: existingAttempt.createdAt.toISOString(),
        message: "Existing captured payment returned via idempotency deduplication.",
      };
    }

    const attemptKey = existingAttempt
      ? `${idempotencyKey}_retry_${Date.now().toString(36)}`
      : idempotencyKey;

    // 2. Decide the debit strategy BEFORE touching Razorpay so we never create
    //    orphan orders or fake captures.
    const strategy = planMandateDebit({
      liveKeysConfigured: this.isLiveConfigured(),
      customerId: mandate?.customerId,
      tokenId: mandate?.tokenId,
    });

    if (strategy !== "SIMULATED_DEMO") {
      try {
        if (strategy === "CHARGE_SAVED_TOKEN") {
          // Step A: create the Razorpay order (payment intent).
          const rzpOrder = await this.createRazorpayOrder({
            requestId,
            amountPaise,
            currency,
            idempotencyKey,
            description,
          });

          // Step B: actually debit the saved card token - the step that moves money.
          const charge = await this.chargeSavedCardToken({
            amountPaise,
            currency,
            orderId: rzpOrder.id,
            customerId: mandate!.customerId!,
            tokenId: mandate!.tokenId!,
            email: mandate?.email,
            contact: mandate?.contact,
            description,
          });

          // Step C: capture if only authorized.
          let payment = charge;
          if (charge.status === "authorized") {
            payment = await this.capturePayment(charge.id, amountPaise, currency);
          }

          if (payment.status !== "captured") {
            throw new PaymentExecutionError(
              "PAYMENT_NOT_CAPTURED",
              `Razorpay payment ${payment.id} ended in status "${payment.status}" instead of "captured". No charge is treated as successful.`,
              { providerOrderId: payment.id }
            );
          }

          // Step D: only now record CAPTURED / PAID - a real payment entity exists.
          const paymentRecord = await prisma.paymentAttempt.create({
            data: {
              requestId,
              provider: "RAZORPAY_TEST",
              providerOrderId: payment.id,
              status: "CAPTURED",
              amountPaise,
              idempotencyKey: attemptKey,
            },
          });

          await prisma.agentRequest.update({
            where: { id: requestId },
            data: { status: "PAID" },
          });

          return {
            provider: "RAZORPAY_TEST",
            providerOrderId: payment.id,
            status: "CAPTURED",
            amountPaise,
            idempotencyKey: attemptKey,
            createdAt: paymentRecord.createdAt.toISOString(),
            message: `Live Razorpay payment ${payment.id} captured on saved card for order ${rzpOrder.id}.`,
          };
        }

        // strategy === MANUAL_PAYMENT_REQUIRED: the stored mandate reference is NOT a
        // reusable Razorpay card token (e.g. it is just the payment id of the ₹1
        // verification). A silent charge is impossible, so fail loudly and let the
        // caller hand the user a real hosted payment link instead of faking success.
        throw new PaymentExecutionError(
          "TOKENIZED_DEBIT_UNAVAILABLE",
          `No reusable Razorpay card token is stored for this mandate (stored reference: "${mandate?.tokenId || "none"}", customerId: "${mandate?.customerId || "none"}"). Only genuine "token_..." tokens bound to a "cust_..." customer can be charged silently. The stored token was NOT charged and no payment was created.`,
        );
      } catch (err: any) {
        const execError =
          err instanceof PaymentExecutionError
            ? err
            : new PaymentExecutionError(
                "RECURRING_CHARGE_FAILED",
                `Razorpay payment execution failed: ${err?.message || err}`
              );

        // Honest ledger: record the FAILED attempt and mark the request FAILED.
        await this.recordFailedAttempt(
          requestId,
          amountPaise,
          attemptKey,
          execError.providerOrderId
        );
        throw execError;
      }
    }

    // 3. Deterministic Simulated Mode - reachable ONLY when no live keys are configured.
    const simulatedOrderId = `order_rzp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const paymentRecord = await prisma.paymentAttempt.create({
      data: {
        requestId,
        provider: "RAZORPAY_TEST",
        providerOrderId: simulatedOrderId,
        status: "CAPTURED",
        amountPaise,
        idempotencyKey: attemptKey,
      },
    });

    await prisma.agentRequest.update({
      where: { id: requestId },
      data: { status: "PAID" },
    });

    return {
      provider: "RAZORPAY_TEST",
      providerOrderId: simulatedOrderId,
      status: "CAPTURED",
      amountPaise,
      idempotencyKey: attemptKey,
      createdAt: paymentRecord.createdAt.toISOString(),
      message: "Simulated Razorpay test order captured (offline demo mode - no live Razorpay keys configured).",
    };
  }

  /**
   * Fetches the current status of a payment attempt
   */
  async fetchStatus(orderId: string): Promise<{ status: PaymentAttemptStatus; amountPaise: number }> {
    const attempt = await prisma.paymentAttempt.findFirst({
      where: { providerOrderId: orderId },
    });

    return {
      status: (attempt?.status as PaymentAttemptStatus) || "CAPTURED",
      amountPaise: attempt?.amountPaise || 0,
    };
  }

  /**
   * Generates a Hosted Razorpay Payment Link (https://rzp.io/l/...) for Human REVIEW flows
   */
  async createPaymentLink(params: RazorpayPaymentLinkParams): Promise<RazorpayPaymentLinkResult> {
    const {
      requestId,
      amountPaise,
      currency = "INR",
      description,
      customerName = "Apex Customer",
      customerEmail = "customer@apexsupplies.demo",
    } = params;

    // Real Razorpay Payment Link API Call
    if (this.isLiveConfigured()) {
      try {
        const keyId = this.getKeyId()!.trim();
        const keySecret = this.getKeySecret()!.trim();
        const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;

        const rzpResponse = await fetch("https://api.razorpay.com/v1/payment_links", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          body: JSON.stringify({
            amount: amountPaise,
            currency,
            accept_partial: false,
            description: `[SpendBoundary Approval] ${description}`.substring(0, 200),
            customer: {
              name: customerName,
              email: customerEmail,
              contact: "+919876543210",
            },
            notify: { sms: false, email: false },
            reminder_enable: false,
            notes: {
              requestId,
            },
          }),
        });

        if (rzpResponse.ok) {
          const linkData = await rzpResponse.json();
          console.log(`[Razorpay Payment Link Created]: ${linkData.short_url} (${linkData.id})`);
          return {
            id: linkData.id,
            shortUrl: linkData.short_url,
            amountPaise,
            status: linkData.status,
            requestId,
            provider: "RAZORPAY_TEST",
            createdAt: new Date().toISOString(),
          };
        } else {
          const errText = await rzpResponse.text();
          console.error(`[Razorpay Payment Link API Error ${rzpResponse.status}]:`, errText);
          // Live keys are configured - returning a fabricated rzp.io URL would be a
          // broken link presented to a real user, so fail loudly instead.
          throw new PaymentExecutionError(
            "PAYMENT_LINK_FAILED",
            `Razorpay Payment Link API returned HTTP ${rzpResponse.status}: ${errText}`,
            { providerResponse: errText }
          );
        }
      } catch (err: any) {
        if (err instanceof PaymentExecutionError) throw err;
        throw new PaymentExecutionError(
          "PAYMENT_LINK_FAILED",
          `Live Razorpay Payment Link creation failed: ${err?.message || err}`
        );
      }
    }

    // Simulated Razorpay Payment Link (offline demo only - no live keys configured)
    const linkId = `plink_${requestId.replace(/[^a-zA-Z0-9]/g, "")}`;
    const simulatedShortUrl = `https://rzp.io/l/${linkId}`;

    return {
      id: linkId,
      shortUrl: simulatedShortUrl,
      amountPaise,
      status: "created",
      requestId,
      provider: "RAZORPAY_SIMULATED",
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Fetches all saved (tokenized) card tokens for a Razorpay customer.
   * Used to discover real reusable `token_...` ids after an authorization.
   */
  async fetchCustomerTokens(customerId: string): Promise<any | null> {
    if (!this.isLiveConfigured()) return null;
    try {
      const res = await fetch(`https://api.razorpay.com/v1/customers/${customerId}/tokens`, {
        headers: { Authorization: this.getAuthHeader() },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Creates (or reuses) a Razorpay Customer for an agent mandate.
   * Required for recurring tokenized charges.
   */
  async createOrFetchCustomer(params: {
    email: string;
    contact?: string;
    name?: string;
  }): Promise<any | null> {
    if (!this.isLiveConfigured()) return null;
    try {
      const res = await fetch("https://api.razorpay.com/v1/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: this.getAuthHeader(),
        },
        body: JSON.stringify({
          name: params.name || "SpendBoundary Agent User",
          email: params.email,
          contact: params.contact || "+919876543210",
          fail_existing: "0",
        }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Fetches real-time status of a hosted payment link from Razorpay API
   */
  async fetchPaymentLink(linkId: string): Promise<any | null> {
    if (!this.isLiveConfigured()) return null;
    try {
      const keyId = this.getKeyId()!.trim();
      const keySecret = this.getKeySecret()!.trim();
      const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;

      const res = await fetch(`https://api.razorpay.com/v1/payment_links/${linkId}`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Fetches payment details (card last4, network, method) from Razorpay API
   */
  async fetchPayment(paymentId: string): Promise<any | null> {
    if (!this.isLiveConfigured()) return null;
    try {
      const keyId = this.getKeyId()!.trim();
      const keySecret = this.getKeySecret()!.trim();
      const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;

      const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Cryptographically verifies Razorpay Webhook HMAC-SHA256 signature
   */
  verifyWebhookSignature(rawBody: string, signature: string, secret?: string): boolean {
    const webhookSecret = secret || process.env.RAZORPAY_WEBHOOK_SECRET || "spendboundary_demo_secret";
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
  }
}

export const razorpayGateway = new RazorpayGatewayAdapter();
