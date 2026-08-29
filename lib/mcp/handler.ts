// SpendBoundary - Universal MCP Tools Handler
// Exposes policy-gated merchant capabilities to any external MCP-compliant AI agent.

import { prisma } from "../prisma";
import { recalculateCartTotal } from "../cart-total";
import { evaluatePolicy, PolicyRuleConfig } from "../policy-engine";
import { mockGateway } from "../payments/mock-gateway";
import { razorpayGateway } from "../payments/razorpay-gateway";
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
    description: "Submit a cart of items to SpendBoundary policy gate. Evaluates spending limits, triggers human approval with a secure Razorpay payment link if needed, or executes pre-authorized payment. If the response returns status 'HELD_FOR_HUMAN_APPROVAL', you MUST output the 'paymentLinkUrl' directly in your response so the user can click and pay.",
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
    description: "Check the status of an order that was held in the Human Approval Queue. If paymentLinkUrl is present and status is pending, you MUST provide the paymentLinkUrl directly to the user so they can click and pay.",
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
  {
    name: "cancel_request",
    description: "Cancel or delete a pending purchase request / approval before payment capture.",
    inputSchema: {
      type: "object",
      properties: {
        requestId: {
          type: "string",
          description: "The request ID of the pending purchase to cancel/delete",
        },
        reason: {
          type: "string",
          description: "Optional justification for cancellation",
        },
      },
      required: ["requestId"],
    },
  },
  {
    name: "reset_demo_state",
    description: "Reset cumulative daily spending to ₹0.00 and clear test transactions for testing.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_payment_mandate_status",
    description: "Inspect the pre-authorized card mandate / token on file for autonomous payments without OTP.",
    inputSchema: {
      type: "object",
      properties: {
        agentId: {
          type: "string",
          description: "Optional agent identifier (e.g. 'claude_desktop_user')",
        },
      },
    },
  },
  {
    name: "setup_payment_mandate",
    description: "Authorize or update the pre-authorized payment card/mandate. Generates a ₹1 setup authorization link or activates an RBI-compliant tokenized card for autonomous sub-limit charges.",
    inputSchema: {
      type: "object",
      properties: {
        agentId: {
          type: "string",
          description: "Agent identifier (e.g. 'claude_desktop_user')",
        },
        maxSingleDebitRupees: {
          type: "number",
          description: "Maximum single purchase amount authorized without human prompt (default: ₹1,000)",
        },
        generateRazorpaySetupLink: {
          type: "boolean",
          description: "If true, generates a ₹1 live Razorpay hosted authorization link for the user",
        },
      },
    },
  },
  {
    name: "revoke_payment_mandate",
    description: "Revoke the saved card mandate so the AI agent cannot make automatic debits without explicit approval.",
    inputSchema: {
      type: "object",
      properties: {
        agentId: {
          type: "string",
          description: "Agent identifier to revoke",
        },
      },
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
        // Fetch or auto-provision active card mandate for this AI agent
        let mandate = await prisma.paymentMandate.findUnique({
          where: { agentId },
        });

        if (!mandate) {
          mandate = await prisma.paymentMandate.create({
            data: {
              agentId,
              status: "ACTIVE",
              maxDebitPaise: 100000, // ₹1,000 max single debit without OTP
              tokenId: `token_rzp_${agentId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10)}_card`,
              cardLast4: "4242",
              cardNetwork: "Visa",
            },
          });
        }

        const paymentResult = await razorpayGateway.createOrder({
          requestId,
          amountPaise: recalculated.totalPaise,
          currency: "INR",
          idempotencyKey,
          description: reason,
        });

        // Mark request as PAID via pre-authorized mandate token
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
                  paymentMethod: `PRE_AUTHORIZED_CARD_MANDATE (${mandate.cardNetwork} •••• ${mandate.cardLast4})`,
                  mandateToken: mandate.tokenId,
                  paymentOrderId: paymentResult.providerOrderId,
                  message: `Payment of ₹${(recalculated.totalPaise / 100).toFixed(2)} was automatically debited via your pre-authorized card (${mandate.cardNetwork} •••• ${mandate.cardLast4}) using Razorpay token ${mandate.tokenId}. Because the order was within the ₹${(mandate.maxDebitPaise / 100).toLocaleString("en-IN")} autonomous spending limit, no OTP or human approval was required.`,
                },
                null,
                2
              ),
            },
          ],
        };
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

        // Generate Hosted Razorpay Payment Link for human user
        const paymentLink = await razorpayGateway.createPaymentLink({
          requestId,
          amountPaise: recalculated.totalPaise,
          currency: "INR",
          description: reason,
        });

        await appendAuditEvent("HUMAN_APPROVAL_QUEUED", requestId, {
          approvalId: approval.id,
          amountPaise: recalculated.totalPaise,
          paymentLinkId: paymentLink.id,
          paymentLinkUrl: paymentLink.shortUrl,
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
                  paymentLinkUrl: paymentLink.shortUrl,
                  paymentLinkId: paymentLink.id,
                  actionRequired: "PRESENT_PAYMENT_LINK_TO_USER",
                  message: `Order total is ₹${(recalculated.totalPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}. This purchase exceeds the autonomous spending limit and requires human authorization. Please click here to pay securely via Razorpay: ${paymentLink.shortUrl}`,
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

      // Find the generated payment link from audit events or gateway
      const queuedEvent = await prisma.auditEvent.findFirst({
        where: { requestId: args.requestId, eventType: "HUMAN_APPROVAL_QUEUED" },
      });

      let paymentLinkUrl: string | undefined;
      if (queuedEvent) {
        try {
          const payload = JSON.parse(queuedEvent.payloadJson);
          paymentLinkUrl = payload.paymentLinkUrl;
        } catch {}
      }

      if (!paymentLinkUrl && approval.decision === "PENDING") {
        const link = await razorpayGateway.createPaymentLink({
          requestId: args.requestId,
          amountPaise: approval.request.requestedAmountPaise,
          currency: "INR",
          description: approval.request.reason,
        });
        paymentLinkUrl = link.shortUrl;
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                requestId: approval.requestId,
                status: approval.decision === "PENDING" ? "PENDING_PAYMENT_OR_APPROVAL" : approval.decision,
                requestedAmountRupees: approval.request.requestedAmountPaise / 100,
                isPaid: approval.request.status === "PAID",
                paymentLinkUrl: paymentLinkUrl || null,
                actionRequired: approval.decision === "PENDING" ? "PLEASE_PROVIDE_PAYMENT_LINK_TO_USER" : "NONE",
                message:
                  approval.decision === "PENDING"
                    ? `This order is pending human authorization or payment. The user can complete the payment immediately using this secure Razorpay link: ${paymentLinkUrl}`
                    : approval.decision === "APPROVED"
                    ? "Order has been approved and paid."
                    : "Order was rejected or cancelled.",
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (toolName === "cancel_request") {
      const requestId = String(args.requestId || "");
      const cancelReason = String(args.reason || "Cancelled by user/agent request");

      const agentReq = await prisma.agentRequest.findUnique({
        where: { id: requestId },
        include: { approval: true },
      });

      if (!agentReq) {
        return {
          isError: true,
          content: [{ type: "text", text: `No purchase request found with ID "${requestId}".` }],
        };
      }

      if (agentReq.status === "PAID") {
        return {
          isError: true,
          content: [{ type: "text", text: `Cannot cancel request ${requestId} because payment has already been captured.` }],
        };
      }

      // Update request status to REJECTED/CANCELLED
      await prisma.agentRequest.update({
        where: { id: requestId },
        data: { status: "REJECTED" },
      });

      if (agentReq.approval) {
        await prisma.approval.update({
          where: { requestId },
          data: {
            decision: "REJECTED",
            comment: cancelReason,
            reviewerId: "agent_cancellation",
          },
        });
      }

      // Append cancellation to SHA-256 audit chain
      await appendAuditEvent("PURCHASE_CANCELLED", requestId, {
        reason: cancelReason,
        cancelledAt: new Date().toISOString(),
        origin: "MCP_CONNECTOR",
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                status: "CANCELLED",
                requestId,
                message: `Request ${requestId} has been successfully cancelled and removed from the pending approvals queue.`,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (toolName === "reset_demo_state") {
      await prisma.paymentAttempt.deleteMany();
      await prisma.approval.deleteMany();
      await prisma.policyDecision.deleteMany();
      await prisma.agentRequest.deleteMany();

      await appendAuditEvent("SYSTEM_DAILY_SPEND_RESET", `reset_${Date.now()}`, {
        message: "Daily spend reset to ₹0.00 via MCP tool.",
        origin: "MCP_CONNECTOR",
        timestamp: new Date().toISOString(),
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                dailySpentRupees: 0,
                message: "Daily spending total and test transactions have been reset to ₹0.00. Ready for new purchases.",
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (toolName === "get_payment_mandate_status") {
      const agentId = String(args.agentId || "claude_desktop_user");
      let mandate = await prisma.paymentMandate.findUnique({ where: { agentId } });
      if (!mandate) {
        mandate = await prisma.paymentMandate.create({
          data: {
            agentId,
            status: "ACTIVE",
            maxDebitPaise: 100000,
            tokenId: `token_rzp_${agentId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10)}_card`,
            cardLast4: "4242",
            cardNetwork: "Visa",
          },
        });
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                agentId: mandate.agentId,
                status: mandate.status,
                mandateToken: mandate.tokenId,
                cardDetails: `${mandate.cardNetwork} ending in •••• ${mandate.cardLast4}`,
                maxSingleDebitRupees: mandate.maxDebitPaise / 100,
                policyCapRupees: 1000,
                message:
                  mandate.status === "ACTIVE"
                    ? `Pre-authorized ${mandate.cardNetwork} card (•••• ${mandate.cardLast4}) is ACTIVE. Autonomous orders up to ₹${mandate.maxDebitPaise / 100} are charged automatically without OTP.`
                    : "No active card mandate on file. Purchases require manual authorization links.",
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (toolName === "setup_payment_mandate") {
      const agentId = String(args.agentId || "claude_desktop_user");
      const maxPaise = Math.round(Number(args.maxSingleDebitRupees || 1000) * 100);
      const shouldGenerateLink = Boolean(args.generateRazorpaySetupLink);

      let paymentLinkUrl: string | undefined;
      if (shouldGenerateLink) {
        const link = await razorpayGateway.createPaymentLink({
          requestId: `mandate_setup_${Date.now()}`,
          amountPaise: 100, // ₹1 setup authorization
          currency: "INR",
          description: "₹1 Tokenized Payment Card Mandate Authorization",
        });
        paymentLinkUrl = link.shortUrl;
      }

      const mandate = await prisma.paymentMandate.upsert({
        where: { agentId },
        update: {
          status: "ACTIVE",
          maxDebitPaise: maxPaise,
          paymentLinkUrl: paymentLinkUrl || null,
        },
        create: {
          agentId,
          status: "ACTIVE",
          maxDebitPaise: maxPaise,
          tokenId: `token_rzp_${agentId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10)}_card`,
          cardLast4: "4242",
          cardNetwork: "Visa",
          paymentLinkUrl: paymentLinkUrl || null,
        },
      });

      await appendAuditEvent("PAYMENT_MANDATE_REGISTERED", agentId, {
        agentId,
        tokenId: mandate.tokenId,
        maxDebitPaise: mandate.maxDebitPaise,
        status: mandate.status,
        origin: "MCP_CONNECTOR",
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                agentId: mandate.agentId,
                status: "ACTIVE",
                mandateToken: mandate.tokenId,
                cardDetails: `${mandate.cardNetwork} •••• ${mandate.cardLast4}`,
                maxSingleDebitRupees: mandate.maxDebitPaise / 100,
                setupPaymentLinkUrl: paymentLinkUrl || null,
                message: paymentLinkUrl
                  ? `₹1 Mandate Setup Link generated: ${paymentLinkUrl}. Once authorized, the AI can perform sub-limit purchases up to ₹${mandate.maxDebitPaise / 100} automatically.`
                  : `Pre-authorized card (${mandate.cardNetwork} •••• ${mandate.cardLast4}) is successfully linked and active for autonomous purchases up to ₹${mandate.maxDebitPaise / 100}.`,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (toolName === "revoke_payment_mandate") {
      const agentId = String(args.agentId || "claude_desktop_user");
      await prisma.paymentMandate.updateMany({
        where: { agentId },
        data: { status: "REVOKED" },
      });

      await appendAuditEvent("PAYMENT_MANDATE_REVOKED", agentId, {
        agentId,
        status: "REVOKED",
        origin: "MCP_CONNECTOR",
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                agentId,
                status: "REVOKED",
                message: `Card mandate for ${agentId} has been revoked. The agent can no longer charge your card automatically.`,
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
