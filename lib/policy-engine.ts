// SpendBoundary - Deterministic Policy Engine
// Pure TypeScript function: (PolicyEvaluationInput) -> PolicyDecisionResult
// Zero database, UI, network, or LLM side effects

export interface PolicyRuleConfig {
  id: string;
  merchantId?: string;
  maxOrderPaise: number;
  dailyLimitPaise: number;
  velocityCount: number;
  velocityWindowSeconds: number;
  allowedCategories: string[];
  approvalThresholdPaise: number;
  version: string;
}

export interface EvaluatedCartItem {
  productId: string;
  name: string;
  category: string;
  pricePaise: number;
  quantity: number;
  allowed: boolean;
  stock: number;
}

export interface PolicyEvaluationInput {
  requestId: string;
  agentId: string;
  policy: PolicyRuleConfig;
  items: EvaluatedCartItem[];
  totalDailySpentPaise?: number;
  recentRequestsInWindow?: Array<{
    timestamp: Date | string | number;
    amountPaise?: number;
  }>;
  now?: Date | string | number;
}

export type DecisionType = "ALLOW" | "REVIEW" | "DENY";

export interface DecisionReason {
  ruleId: string;
  message: string;
  requestedPaise?: number;
  limitPaise?: number;
}

export interface PolicyDecisionResult {
  decision: DecisionType;
  reasons: DecisionReason[];
  policyVersion: string;
  requestId: string;
  calculatedTotalPaise: number;
  evaluatedAt: string;
}

/**
 * Pure deterministic evaluation function
 */
export function evaluatePolicy(input: PolicyEvaluationInput): PolicyDecisionResult {
  const {
    requestId,
    agentId,
    policy,
    items,
    totalDailySpentPaise = 0,
    recentRequestsInWindow = [],
    now = new Date(),
  } = input;

  const evaluatedAt = new Date(now).toISOString();
  const reasons: DecisionReason[] = [];

  // 1. Validate Cart items structure
  if (!items || !Array.isArray(items) || items.length === 0) {
    return {
      decision: "DENY",
      reasons: [
        {
          ruleId: "INVALID_CART",
          message: "Cart is empty. At least one item is required for checkout.",
          requestedPaise: 0,
        },
      ],
      policyVersion: policy.version,
      requestId,
      calculatedTotalPaise: 0,
      evaluatedAt,
    };
  }

  for (const item of items) {
    if (!item.productId || typeof item.pricePaise !== "number" || item.pricePaise < 0) {
      return {
        decision: "DENY",
        reasons: [
          {
            ruleId: "INVALID_ITEM_DATA",
            message: `Product data for "${item.name || "Unknown"}" is invalid or has negative pricing.`,
          },
        ],
        policyVersion: policy.version,
        requestId,
        calculatedTotalPaise: 0,
        evaluatedAt,
      };
    }

    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      return {
        decision: "DENY",
        reasons: [
          {
            ruleId: "INVALID_QUANTITY",
            message: `Invalid quantity (${item.quantity}) for product "${item.name}". Must be a positive integer.`,
          },
        ],
        policyVersion: policy.version,
        requestId,
        calculatedTotalPaise: 0,
        evaluatedAt,
      };
    }
  }

  // 2. Stock and Inventory Verification
  for (const item of items) {
    if (item.quantity > item.stock) {
      reasons.push({
        ruleId: "INSUFFICIENT_STOCK",
        message: `Insufficient inventory for "${item.name}". Requested ${item.quantity} units, but only ${item.stock} in stock.`,
      });
    }
  }

  // 3. Restricted Product and Disallowed Category Check
  for (const item of items) {
    if (item.allowed === false) {
      reasons.push({
        ruleId: "RESTRICTED_PRODUCT",
        message: `Product "${item.name}" is restricted by merchant policy.`,
      });
    }

    if (
      Array.isArray(policy.allowedCategories) &&
      policy.allowedCategories.length > 0 &&
      !policy.allowedCategories.includes(item.category)
    ) {
      reasons.push({
        ruleId: "DISALLOWED_CATEGORY",
        message: `Product category "${item.category}" for "${item.name}" is not in the merchant's allowed list.`,
      });
    }
  }

  // If any hard item-level rules failed, return DENY immediately
  if (reasons.length > 0) {
    return {
      decision: "DENY",
      reasons,
      policyVersion: policy.version,
      requestId,
      calculatedTotalPaise: 0,
      evaluatedAt,
    };
  }

  // 4. Server-side total calculation (in integer paise)
  const calculatedTotalPaise = items.reduce(
    (sum, item) => sum + item.pricePaise * item.quantity,
    0
  );

  // 5. Maximum Order Value Cap
  if (calculatedTotalPaise > policy.maxOrderPaise) {
    const formattedReq = (calculatedTotalPaise / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
    });
    const formattedLimit = (policy.maxOrderPaise / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
    });

    reasons.push({
      ruleId: "MAX_ORDER_VALUE_EXCEEDED",
      message: `Order total of ₹${formattedReq} exceeds the maximum single-order cap of ₹${formattedLimit}.`,
      requestedPaise: calculatedTotalPaise,
      limitPaise: policy.maxOrderPaise,
    });
  }

  // 6. Cumulative Daily Spend Limit Cap
  const cumulativeDailySpent = totalDailySpentPaise + calculatedTotalPaise;
  if (cumulativeDailySpent > policy.dailyLimitPaise) {
    const formattedReq = (cumulativeDailySpent / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
    });
    const formattedLimit = (policy.dailyLimitPaise / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
    });

    reasons.push({
      ruleId: "DAILY_LIMIT_EXCEEDED",
      message: `Cumulative daily spend would reach ₹${formattedReq}, exceeding the daily limit of ₹${formattedLimit}.`,
      requestedPaise: cumulativeDailySpent,
      limitPaise: policy.dailyLimitPaise,
    });
  }

  // 7. Velocity Limit (requests in window)
  if (recentRequestsInWindow.length >= policy.velocityCount) {
    reasons.push({
      ruleId: "VELOCITY_LIMIT_EXCEEDED",
      message: `Velocity threshold breached: ${recentRequestsInWindow.length + 1} requests within ${policy.velocityWindowSeconds}s window (limit: ${policy.velocityCount}).`,
    });
  }

  // If any financial or rate limit rules failed, return DENY
  if (reasons.length > 0) {
    return {
      decision: "DENY",
      reasons,
      policyVersion: policy.version,
      requestId,
      calculatedTotalPaise,
      evaluatedAt,
    };
  }

  // 8. Human Approval Threshold
  if (calculatedTotalPaise > policy.approvalThresholdPaise) {
    const formattedReq = (calculatedTotalPaise / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
    });
    const formattedThreshold = (policy.approvalThresholdPaise / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
    });

    return {
      decision: "REVIEW",
      reasons: [
        {
          ruleId: "APPROVAL_THRESHOLD_TRIGGERED",
          message: `Order value of ₹${formattedReq} exceeds the auto-approval threshold of ₹${formattedThreshold} and requires human review.`,
          requestedPaise: calculatedTotalPaise,
          limitPaise: policy.approvalThresholdPaise,
        },
      ],
      policyVersion: policy.version,
      requestId,
      calculatedTotalPaise,
      evaluatedAt,
    };
  }

  // 9. Clean pass -> ALLOW
  return {
    decision: "ALLOW",
    reasons: [
      {
        ruleId: "WITHIN_POLICY",
        message: "Order satisfies all spending, product, inventory, and velocity policies.",
        requestedPaise: calculatedTotalPaise,
      },
    ],
    policyVersion: policy.version,
    requestId,
    calculatedTotalPaise,
    evaluatedAt,
  };
}
