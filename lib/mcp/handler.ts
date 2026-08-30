// SpendBoundary - Universal MCP Tools Handler
// Exposes policy-gated merchant capabilities to any external MCP-compliant AI agent.

import { prisma } from "../prisma";
import { recalculateCartTotal } from "../cart-total";
import { evaluatePolicy, PolicyRuleConfig } from "../policy-engine";
import { mockGateway } from "../payments/mock-gateway";
import { appendAuditEvent } from "../audit-chain";

export interface MCPToolCallResult {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
}

export const MCP_TOOLS_DEFINITIONS = [
  {
    name: "search_catalogue",
    description: "Search merchant product catalogue for available items, categories, verified prices, and stock.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query or category keyword (e.g. 'office supplies', 'lamp', 'chair', 'electronics')",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_product_details",
    description: "Get full specifications, category, inventory stock, and price for a specific product ID.",
    inputSchema: {
      type: "object",
      properties: {
        productId: {
          type: "string",
          description: "Unique product identifier (e.g. 'prod_notebook', 'prod_desk_lamp')",
        },
      },
      required: ["productId"],
    },
  },
  {
    name: "get_policy_limits",
    description: "Inspect the merchant's current spending policies, maximum single-order limit, and approval thresholds.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "request_checkout",
    description: "Submit a cart of items to SpendBoundary policy gate. Evaluates spending limits, triggers human approval if needed, or executes mock payment.",
    inputSchema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          description: "List of items to purchase",
          items: {
            type: "object",
            properties: {
              productId: { type: "string", description: "Product ID" },
              quantity: { type: "integer", description: "Positive quantity" },
            },
            required: ["productId", "quantity"],
          },
        },
        reason: {
          type: "string",
          description: "Business justification for this purchase",
        },
        agentId: {
          type: "string",
          description: "Identifier of the AI agent making the request (e.g. 'claude_desktop_user')",
        },
      },
      required: ["items", "reason"],
    },
  },
  {
    name: "check_approval_status",
    description: "Check the status of an order that was held in the Human Approval Queue.",
    inputSchema: {
      type: "object",
      properties: {
        requestId: {
          type: "string",
          description: "The request ID returned when the order entered REVIEW state",
        },
      },
      required: ["requestId"],
    },
  },
];

/**
 * Executes an MCP tool call through SpendBoundary trust boundaries
 */
export async function executeMCPTool(
  toolName: string,
  args: Record<string, any>
): Promise<MCPToolCallResult> {
  try {
    if (toolName === "search_catalogue") {
      const query = String(args.query || "").toLowerCase();
      const allProducts = await prisma.product.findMany({
        orderBy: { pricePaise: "asc" },
      });

      const matched = allProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          query === "all" ||
          query === ""
      );

      const itemsFormatted = matched.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        priceRupees: p.pricePaise / 100,
        pricePaise: p.pricePaise,
        stock: p.stock,
        isAllowed: p.allowed,
        description: p.description,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                resultsCount: itemsFormatted.length,
                products: itemsFormatted,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (toolName === "get_product_details") {
      const product = await prisma.product.findUnique({
        where: { id: args.productId },
      });

      if (!product) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Product with ID "${args.productId}" not found in merchant catalogue.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                id: product.id,
                name: product.name,
                category: product.category,
                priceRupees: product.pricePaise / 100,
                pricePaise: product.pricePaise,
                stock: product.stock,
                isAllowed: product.allowed,
                description: product.description,
              },
              null,
              2
            ),
          },
        ],
      };
    }

<<<<<<< HEAD
// Helper: Retrieve active card mandate or generate a live ₹1 Razorpay setup link
async function getOrCreateMandateSetupLink(agentId: string) {
  let mandate = await prisma.paymentMandate.findUnique({ where: { agentId } });
  if (mandate && mandate.status === "ACTIVE" && mandate.cardLast4) {
    return { mandate, isStored: true, linkUrl: null };
  }

  // ACTIVE RECONCILIATION: Check if pending payment link was paid on Razorpay!
  if (mandate && mandate.paymentLinkId && mandate.status === "PENDING_AUTHORIZATION") {
    try {
      const linkData = await razorpayGateway.fetchPaymentLink(mandate.paymentLinkId);
      if (linkData && (linkData.status === "paid" || (linkData.amount_paid && linkData.amount_paid > 0))) {
        let cardLast4 = "8192";
        let cardNetwork = "Visa";
        let customerId: string | null = null;
        // NOTE: a payment id (pay_...) is NOT a re-chargeable card token.
        let paymentReferenceId = `pay_link_${mandate.paymentLinkId.replace(/[^a-zA-Z0-9]/g, "")}`;
        let reusableTokenId: string | null = null;

        const payments = linkData.payments || [];
        if (payments.length > 0 && payments[0].payment_id) {
          const paymentData = await razorpayGateway.fetchPayment(payments[0].payment_id);
          if (paymentData) {
            cardLast4 = paymentData.card?.last4 || (paymentData.method === "upi" ? "UPI" : "8192");
            cardNetwork = paymentData.card?.network || paymentData.method?.toUpperCase() || "Visa";
            paymentReferenceId = paymentData.id || paymentReferenceId;
            customerId = paymentData.customer_id || null;
            if (typeof paymentData.token_id === "string" && paymentData.token_id.startsWith("token_")) {
              reusableTokenId = paymentData.token_id;
            }
          }
        }

        // Discover a real reusable card token bound to the customer, if one exists.
        if (!reusableTokenId && customerId) {
          const tokenCollection = await razorpayGateway.fetchCustomerTokens(customerId);
          const tokens: any[] = tokenCollection?.items || [];
          const usable = tokens.find(
            (t: any) => typeof (t.id || t.token) === "string" && String(t.id || t.token).startsWith("token_")
          );
          if (usable) reusableTokenId = String(usable.id || usable.token);
        }

        mandate = await prisma.paymentMandate.update({
          where: { agentId },
          data: {
            status: "ACTIVE",
            cardLast4,
            cardNetwork,
            customerId,
            // Store the genuine reusable token when available; otherwise keep the
            // payment reference so audits stay truthful (it cannot be re-charged).
            tokenId: reusableTokenId || paymentReferenceId,
          },
        });

        await appendAuditEvent("PAYMENT_MANDATE_ACTIVATED", agentId, {
          agentId,
          status: "ACTIVE",
          cardLast4,
          cardNetwork,
          customerId,
          hasReusableToken: Boolean(reusableTokenId),
          tokenId: reusableTokenId || paymentReferenceId,
          paymentLinkId: mandate.paymentLinkId,
          origin: "RAZORPAY_API_RECONCILIATION",
        });

        return { mandate, isStored: true, linkUrl: null };
      }
    } catch (err) {
      console.warn("Reconciliation check failed:", err);
    }

    return { mandate, isStored: false, linkUrl: mandate.paymentLinkUrl };
  }

  // Generate a live ₹1 Razorpay Setup Link
  const setupLink = await razorpayGateway.createPaymentLink({
    requestId: `mandate_auth_${agentId.replace(/[^a-zA-Z0-9]/g, "")}_${Date.now()}`,
    amountPaise: 100, // ₹1 authorization
    currency: "INR",
    description: "₹1 Card Verification & Autonomous AI Agent Pre-Authorization",
  });

  mandate = await prisma.paymentMandate.upsert({
    where: { agentId },
    update: {
      status: "PENDING_AUTHORIZATION",
      paymentLinkUrl: setupLink.shortUrl,
      paymentLinkId: setupLink.id,
      cardLast4: "",
      cardNetwork: "",
    },
    create: {
      agentId,
      status: "PENDING_AUTHORIZATION",
      paymentLinkUrl: setupLink.shortUrl,
      paymentLinkId: setupLink.id,
      cardLast4: "",
      cardNetwork: "",
      maxDebitPaise: 100000,
    },
  });

  return { mandate, isStored: false, linkUrl: setupLink.shortUrl };
}

=======
>>>>>>> parent of 9a2b2fc (Merge pull request #4 from AkshitJain2007/main)
    if (toolName === "get_policy_limits") {
      const dbPolicy = await prisma.policy.findFirst({
        where: { id: "policy_default" },
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                merchant: "Apex Supplies Ltd",
                policyVersion: dbPolicy?.version || "v1.0",
                maxOrderRupees: (dbPolicy?.maxOrderPaise || 200000) / 100,
                dailySpendLimitRupees: (dbPolicy?.dailyLimitPaise || 500000) / 100,
                humanApprovalThresholdRupees: (dbPolicy?.approvalThresholdPaise || 100000) / 100,
                velocityLimit: `${dbPolicy?.velocityCount || 3} requests per ${dbPolicy?.velocityWindowSeconds || 60}s`,
                allowedCategories: dbPolicy ? JSON.parse(dbPolicy.allowedCategories) : [],
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (toolName === "request_checkout") {
      const rawItems = args.items;
      const items = Array.isArray(rawItems) ? rawItems : (rawItems ? [rawItems] : []);
      const reason = String(args.reason || "Procurement request via MCP agent");
      const agentId = String(args.agentId || "mcp_external_agent");
      const requestId = `req_mcp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const idempotencyKey = `idem_${requestId}`;

      // 1. Log MCP request
      await appendAuditEvent("MCP_AGENT_CHECKOUT_REQUESTED", requestId, {
        agentId,
        reason,
        itemCount: items.reduce((s: number, i: any) => s + (i.quantity || 1), 0),
        origin: "MCP_CONNECTOR",
      });

      // 2. Server Recalculation (Strictly ignores client totals)
      const recalculated = await recalculateCartTotal(items);

      if (recalculated.validationErrors.length > 0) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Checkout rejected: ${recalculated.validationErrors.join("; ")}`,
            },
          ],
        };
      }

      // 3. Load Policy
      let dbPolicy = await prisma.policy.findFirst({
        where: { id: "policy_default" },
      });

      const policyConfig: PolicyRuleConfig = {
        id: dbPolicy?.id || "policy_default",
        merchantId: dbPolicy?.merchantId || "merchant_apex_01",
        maxOrderPaise: dbPolicy?.maxOrderPaise || 200000,
        dailyLimitPaise: dbPolicy?.dailyLimitPaise || 500000,
        velocityCount: dbPolicy?.velocityCount || 3,
        velocityWindowSeconds: dbPolicy?.velocityWindowSeconds || 60,
        allowedCategories: dbPolicy ? JSON.parse(dbPolicy.allowedCategories) : ["Office Supplies", "Electronics", "Home Office", "Furniture"],
        approvalThresholdPaise: dbPolicy?.approvalThresholdPaise || 100000,
        version: dbPolicy?.version || "v1.0",
      };

      // 4. Calculate today's cumulative spend & velocity
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const paidToday = await prisma.agentRequest.findMany({
        where: { agentId, status: "PAID", createdAt: { gte: startOfToday } },
      });
      const totalDailySpentPaise = paidToday.reduce((sum, r) => sum + r.requestedAmountPaise, 0);

      const windowStart = new Date(Date.now() - policyConfig.velocityWindowSeconds * 1000);
      const recentRequests = await prisma.agentRequest.findMany({
        where: { agentId, createdAt: { gte: windowStart } },
        select: { createdAt: true, requestedAmountPaise: true },
      });

      // 5. Evaluate Pure Policy Engine
      const policyResult = evaluatePolicy({
        requestId,
        agentId,
        policy: policyConfig,
        items: recalculated.items,
        totalDailySpentPaise,
        recentRequestsInWindow: recentRequests.map((r) => ({ timestamp: r.createdAt })),
      });

      // 6. Persist AgentRequest & Decision
      await prisma.agentRequest.create({
        data: {
          id: requestId,
          agentId,
          cartSnapshot: JSON.stringify(recalculated.items),
          requestedAmountPaise: recalculated.totalPaise,
          reason,
          status:
            policyResult.decision === "ALLOW"
              ? "ALLOWED"
              : policyResult.decision === "REVIEW"
              ? "REVIEW_REQUIRED"
              : "REJECTED",
        },
      });

      await prisma.policyDecision.create({
        data: {
          requestId,
          decision: policyResult.decision,
          reasons: JSON.stringify(policyResult.reasons),
          policyVersion: policyResult.policyVersion,
        },
      });

      await appendAuditEvent("POLICY_DECISION_EVALUATED", requestId, {
        decision: policyResult.decision,
        reasons: policyResult.reasons,
        calculatedTotalPaise: recalculated.totalPaise,
        origin: "MCP_CONNECTOR",
      });

      // 7. Branch on Decision
      if (policyResult.decision === "ALLOW") {
<<<<<<< HEAD
        const { mandate, isStored, linkUrl } = await getOrCreateMandateSetupLink(agentId);

        if (!isStored) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    status: "SETUP_CARD_MANDATE_REQUIRED",
                    decision: "PENDING_CARD_AUTHORIZATION",
                    cardStored: false,
                    requestId,
                    totalRupees: recalculated.totalPaise / 100,
                    mandateSetupLinkUrl: linkUrl,
                    actionRequired: "PLEASE_AUTHORIZE_CARD_FIRST",
                    message: `Your order of ₹${(recalculated.totalPaise / 100).toFixed(2)} is approved under policy limits, but no payment card is stored on file yet. Please click this ₹1 Razorpay Authorization Link to save your card: ${linkUrl}. Once you complete the ₹1 verification, your card will be saved securely for automatic sub-limit purchases.`,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        try {
          const paymentResult = await razorpayGateway.createOrder({
            requestId,
            amountPaise: recalculated.totalPaise,
            currency: "INR",
            idempotencyKey,
            description: reason,
            mandate: {
              agentId,
              customerId: mandate.customerId,
              tokenId: mandate.tokenId,
              cardLast4: mandate.cardLast4,
              cardNetwork: mandate.cardNetwork,
              email: mandate.customerEmail,
=======
        const paymentResult = await mockGateway.createOrder({
          requestId,
          amountPaise: recalculated.totalPaise,
          currency: "INR",
          idempotencyKey,
          description: reason,
        });

        await appendAuditEvent("PAYMENT_ATTEMPT_RECORDED", requestId, {
          provider: paymentResult.provider,
          providerOrderId: paymentResult.providerOrderId,
          status: paymentResult.status,
          idempotencyKey,
          amountPaise: paymentResult.amountPaise,
          origin: "MCP_CONNECTOR",
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "APPROVED_AND_PAID",
                  decision: "ALLOW",
                  requestId,
                  totalRupees: recalculated.totalPaise / 100,
                  paymentOrderId: paymentResult.providerOrderId,
                  message: "Order within policy limits. Mock payment captured successfully and logged to SHA-256 audit chain.",
                },
                null,
                2
              ),
>>>>>>> parent of 9a2b2fc (Merge pull request #4 from AkshitJain2007/main)
            },
          });

          // Companion status update (gateway already marked PAID on real capture)
          await prisma.agentRequest.update({
            where: { id: requestId },
            data: { status: "PAID" },
          });

          await appendAuditEvent("PAYMENT_ATTEMPT_RECORDED", requestId, {
            provider: "RAZORPAY_CARD_MANDATE",
            providerOrderId: paymentResult.providerOrderId,
            status: "CAPTURED",
            mandateTokenId: mandate.tokenId,
            cardLast4: mandate.cardLast4,
            cardNetwork: mandate.cardNetwork,
            idempotencyKey,
            amountPaise: paymentResult.amountPaise,
            origin: "MCP_CONNECTOR",
          });

          await appendAuditEvent("MANDATE_AUTO_DEBIT_CAPTURED", requestId, {
            amountPaise: recalculated.totalPaise,
            mandateTokenId: mandate.tokenId,
            status: "PAID",
            agentId,
            origin: "MCP_CONNECTOR",
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    status: "APPROVED_AND_PAID",
                    decision: "ALLOW",
                    requestId,
                    totalRupees: recalculated.totalPaise / 100,
                    isPaid: true,
                    paymentMethod: `PRE_AUTHORIZED_CARD_MANDATE (${mandate.cardNetwork} •••• ${mandate.cardLast4})`,
                    mandateToken: mandate.tokenId,
                    paymentOrderId: paymentResult.providerOrderId,
                    message: `Done — Payment of ₹${(recalculated.totalPaise / 100).toFixed(2)} was automatically completed and debited to your pre-authorized card (${mandate.cardNetwork} •••• ${mandate.cardLast4}) via Razorpay payment ${paymentResult.providerOrderId}. Because the order was within your ₹${(mandate.maxDebitPaise / 100).toLocaleString("en-IN")} autonomous spending limit, no OTP or manual confirmation was required. You can verify this payment in your Razorpay dashboard.`,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (debitErr: any) {
          // HONEST FAILURE PATH: the auto-debit did NOT go through. No money moved.
          // Fabricate nothing - record the failure, issue a REAL hosted payment
          // link, and instruct the agent to hand it to the user.
          const errorCode = debitErr?.code || "PAYMENT_EXECUTION_FAILED";
          const errorMessage = debitErr?.message || "Unknown payment execution error";
          console.error(`[MCP Auto-Debit Failed for ${requestId}] (${errorCode}):`, errorMessage);

          await appendAuditEvent("PAYMENT_AUTO_DEBIT_FAILED", requestId, {
            agentId,
            amountPaise: recalculated.totalPaise,
            errorCode,
            errorMessage,
            mandateTokenReference: mandate.tokenId,
            origin: "MCP_CONNECTOR",
          });

          let fallbackLink: any = null;
          try {
            fallbackLink = await razorpayGateway.createPaymentLink({
              requestId,
              amountPaise: recalculated.totalPaise,
              currency: "INR",
              description: reason,
            });

            const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
            await prisma.approval.upsert({
              where: { requestId },
              update: { decision: "PENDING", expiresAt },
              create: { requestId, decision: "PENDING", expiresAt },
            });

            await prisma.agentRequest.update({
              where: { id: requestId },
              data: { status: "AWAITING_PAYMENT" },
            });

            await appendAuditEvent("MANUAL_PAYMENT_LINK_ISSUED", requestId, {
              paymentLinkId: fallbackLink.id,
              paymentLinkUrl: fallbackLink.shortUrl,
              amountPaise: recalculated.totalPaise,
              reasonForFallback: errorCode,
              origin: "MCP_CONNECTOR",
            });
          } catch (linkErr: any) {
            console.error(`[Fallback payment link also failed for ${requestId}]:`, linkErr?.message);
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    status: "AUTO_DEBIT_FAILED",
                    decision: "ALLOW",
                    isPaid: false,
                    cardCharged: false,
                    requestId,
                    totalRupees: recalculated.totalPaise / 100,
                    errorCode,
                    paymentLinkUrl: fallbackLink?.shortUrl || null,
                    actionRequired: fallbackLink
                      ? "PRESENT_PAYMENT_LINK_TO_USER"
                      : "ASK_USER_TO_RETRY_LATER",
                    message: `⚠️ The automatic card charge did NOT go through (${errorMessage}). IMPORTANT: no money was debited from the card and the previous "success" was NOT a real payment.${
                      fallbackLink
                        ? ` A real Razorpay payment link was generated instead — please ask the user to complete the payment of ₹${(recalculated.totalPaise / 100).toFixed(2)} here: ${fallbackLink.shortUrl}. Call check_approval_status afterwards to confirm capture.`
                        : " Ask the user to retry the purchase later."
                    }`,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }
      }

      if (policyResult.decision === "REVIEW") {
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        const approval = await prisma.approval.create({
          data: {
            requestId,
            decision: "PENDING",
            expiresAt,
          },
        });

        await appendAuditEvent("HUMAN_APPROVAL_QUEUED", requestId, {
          approvalId: approval.id,
          amountPaise: recalculated.totalPaise,
          origin: "MCP_CONNECTOR",
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "HELD_FOR_HUMAN_APPROVAL",
                  decision: "REVIEW",
                  requestId,
                  totalRupees: recalculated.totalPaise / 100,
                  reasons: policyResult.reasons,
                  message: `Order of ₹${(recalculated.totalPaise / 100).toLocaleString()} exceeds auto-approval threshold. It is now held in the merchant human approval queue. Check back with tool 'check_approval_status' once approved.`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // DENY
      await appendAuditEvent("PURCHASE_BLOCKED_BY_POLICY", requestId, {
        reasons: policyResult.reasons,
        blockedAmountPaise: recalculated.totalPaise,
        origin: "MCP_CONNECTOR",
      });

      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "BLOCKED_BY_POLICY",
                decision: "DENY",
                requestId,
                totalRupees: recalculated.totalPaise / 100,
                reasons: policyResult.reasons,
                message: "Purchase request was DENIED by SpendBoundary merchant policy gate. Zero payment calls were created.",
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (toolName === "check_approval_status") {
      const approval = await prisma.approval.findUnique({
        where: { requestId: args.requestId },
        include: { request: { include: { paymentAttempts: true } } },
      });

      if (!approval) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `No approval record found for request ID: ${args.requestId}`,
            },
          ],
        };
      }

<<<<<<< HEAD
      // Find the generated payment link from payment attempt, audit events, or gateway
      let paymentLinkUrl: string | undefined;
      let paymentLinkId: string | undefined;

      const attemptEvent = await prisma.auditEvent.findFirst({
        where: {
          requestId,
          eventType: { in: ["PAYMENT_ATTEMPT_RECORDED", "HUMAN_APPROVAL_QUEUED", "MANUAL_PAYMENT_LINK_ISSUED"] },
        },
        orderBy: { createdAt: "desc" },
      });

      if (attemptEvent) {
        try {
          const payload = JSON.parse(attemptEvent.payloadJson);
          paymentLinkUrl = payload.paymentLinkUrl;
          paymentLinkId = payload.paymentLinkId;
        } catch {}
      }

      // LIVE RAZORPAY RECONCILIATION: Query Razorpay API if status is not yet PAID
      if (paymentLinkId && agentReq.status !== "PAID") {
        try {
          const linkData = await razorpayGateway.fetchPaymentLink(paymentLinkId);
          if (linkData && (linkData.status === "paid" || (linkData.amount_paid && linkData.amount_paid > 0))) {
            await prisma.agentRequest.update({
              where: { id: requestId },
              data: { status: "PAID" },
            });

            if (agentReq.approval) {
              await prisma.approval.update({
                where: { requestId },
                data: {
                  decision: "APPROVED",
                  comment: "Automatically approved via verified Razorpay payment capture.",
                  reviewerId: "razorpay_reconciliation",
                },
              });
            }

            await appendAuditEvent("PAYMENT_CAPTURED", requestId, {
              status: "PAID",
              paymentLinkId,
              amountPaise: agentReq.requestedAmountPaise,
              origin: "RAZORPAY_RECONCILIATION",
            });

            agentReq.status = "PAID";
          }
        } catch (err) {
          console.warn("Reconciliation error in check_approval_status:", err);
        }
      }

      const isPaid = agentReq.status === "PAID";

=======
>>>>>>> parent of 9a2b2fc (Merge pull request #4 from AkshitJain2007/main)
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                requestId: approval.requestId,
                status: approval.decision,
                requestedAmountRupees: approval.request.requestedAmountPaise / 100,
                comment: approval.comment || "Pending reviewer action",
                isPaid: approval.request.status === "PAID",
                paymentAttempts: approval.request.paymentAttempts,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    return {
      isError: true,
      content: [{ type: "text", text: `Unknown MCP tool name: ${toolName}` }],
    };
  } catch (error: any) {
    return {
      isError: true,
      content: [{ type: "text", text: `MCP Execution Error: ${error?.message || "Internal error"}` }],
    };
  }
}
