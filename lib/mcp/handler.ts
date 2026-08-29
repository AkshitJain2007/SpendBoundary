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
