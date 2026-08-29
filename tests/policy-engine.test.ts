import { describe, it, expect } from "vitest";
import { evaluatePolicy, PolicyRuleConfig, EvaluatedCartItem } from "../lib/policy-engine";

const mockPolicy: PolicyRuleConfig = {
  id: "policy_default",
  merchantId: "merchant_apex_01",
  maxOrderPaise: 200000,       // ₹2,000
  dailyLimitPaise: 500000,     // ₹5,000
  velocityCount: 3,            // Max 3 requests
  velocityWindowSeconds: 60,   // within 60s
  allowedCategories: ["Office Supplies", "Electronics", "Home Office", "Furniture"],
  approvalThresholdPaise: 100000, // ₹1,000 triggers REVIEW
  version: "v1.0",
};

const notebookItem: EvaluatedCartItem = {
  productId: "prod_notebook",
  name: "Executive Hardcover Notebook",
  category: "Office Supplies",
  pricePaise: 35000, // ₹350
  quantity: 1,
  allowed: true,
  stock: 50,
};

const penItem: EvaluatedCartItem = {
  productId: "prod_pen_set",
  name: "Archival Gel Pen Set",
  category: "Office Supplies",
  pricePaise: 15000, // ₹150
  quantity: 1,
  allowed: true,
  stock: 100,
};

const lampItem: EvaluatedCartItem = {
  productId: "prod_desk_lamp",
  name: "Smart Dimmable LED Desk Lamp",
  category: "Home Office",
  pricePaise: 150000, // ₹1,500
  quantity: 1,
  allowed: true,
  stock: 25,
};

const chairItem: EvaluatedCartItem = {
  productId: "prod_chair",
  name: "Ergonomic Mesh Task Chair",
  category: "Furniture",
  pricePaise: 800000, // ₹8,000
  quantity: 1,
  allowed: true,
  stock: 10,
};

const cryptoMinerItem: EvaluatedCartItem = {
  productId: "prod_crypto_miner",
  name: "USB Hardware Mining Key",
  category: "Restricted",
  pricePaise: 500000, // ₹5,000
  quantity: 1,
  allowed: false,
  stock: 5,
};

describe("SpendBoundary Deterministic Policy Engine", () => {
  it("Scenario 1: Allows valid ₹500 purchase under approval threshold", () => {
    const result = evaluatePolicy({
      requestId: "req_demo_01",
      agentId: "agent_buyer_01",
      policy: mockPolicy,
      items: [notebookItem, penItem], // ₹350 + ₹150 = ₹500 (50,000 paise)
      totalDailySpentPaise: 0,
      recentRequestsInWindow: [],
    });

    expect(result.decision).toBe("ALLOW");
    expect(result.calculatedTotalPaise).toBe(50000);
    expect(result.reasons[0].ruleId).toBe("WITHIN_POLICY");
    expect(result.policyVersion).toBe("v1.0");
    expect(result.requestId).toBe("req_demo_01");
  });

  it("Scenario 2: Denies purchase exceeding ₹2,000 single-order cap", () => {
    const result = evaluatePolicy({
      requestId: "req_demo_02",
      agentId: "agent_buyer_01",
      policy: mockPolicy,
      items: [chairItem], // ₹8,000 (800,000 paise)
      totalDailySpentPaise: 0,
      recentRequestsInWindow: [],
    });

    expect(result.decision).toBe("DENY");
    expect(result.calculatedTotalPaise).toBe(800000);
    const maxOrderReason = result.reasons.find((r) => r.ruleId === "MAX_ORDER_VALUE_EXCEEDED");
    expect(maxOrderReason).toBeDefined();
    expect(maxOrderReason?.requestedPaise).toBe(800000);
    expect(maxOrderReason?.limitPaise).toBe(200000);
  });

  it("Scenario 3: Denies purchase when cumulative daily spend exceeds ₹5,000 limit", () => {
    const result = evaluatePolicy({
      requestId: "req_demo_03",
      agentId: "agent_buyer_01",
      policy: mockPolicy,
      items: [notebookItem, penItem], // ₹500
      totalDailySpentPaise: 480000, // ₹4,800 already spent today -> ₹4,800 + ₹500 = ₹5,300 > ₹5,000
      recentRequestsInWindow: [],
    });

    expect(result.decision).toBe("DENY");
    const dailyReason = result.reasons.find((r) => r.ruleId === "DAILY_LIMIT_EXCEEDED");
    expect(dailyReason).toBeDefined();
    expect(dailyReason?.requestedPaise).toBe(530000);
    expect(dailyReason?.limitPaise).toBe(500000);
  });

  it("Scenario 4: Denies purchase of restricted item or disallowed category", () => {
    const result = evaluatePolicy({
      requestId: "req_demo_04",
      agentId: "agent_buyer_01",
      policy: mockPolicy,
      items: [cryptoMinerItem], // restricted item in "Restricted" category
      totalDailySpentPaise: 0,
      recentRequestsInWindow: [],
    });

    expect(result.decision).toBe("DENY");
    const restrictedProductReason = result.reasons.find((r) => r.ruleId === "RESTRICTED_PRODUCT");
    const disallowedCatReason = result.reasons.find((r) => r.ruleId === "DISALLOWED_CATEGORY");
    expect(restrictedProductReason).toBeDefined();
    expect(disallowedCatReason).toBeDefined();
  });

  it("Scenario 5: Denies purchase when velocity limit is breached", () => {
    const result = evaluatePolicy({
      requestId: "req_demo_05",
      agentId: "agent_buyer_01",
      policy: mockPolicy,
      items: [notebookItem], // ₹350
      totalDailySpentPaise: 0,
      recentRequestsInWindow: [
        { timestamp: new Date(Date.now() - 10000) },
        { timestamp: new Date(Date.now() - 20000) },
        { timestamp: new Date(Date.now() - 30000) },
      ], // 3 existing requests in window, this is 4th -> breaches max 3
    });

    expect(result.decision).toBe("DENY");
    const velocityReason = result.reasons.find((r) => r.ruleId === "VELOCITY_LIMIT_EXCEEDED");
    expect(velocityReason).toBeDefined();
  });

  it("Scenario 6: Requires human REVIEW when order exceeds ₹1,000 threshold but is under max cap", () => {
    const result = evaluatePolicy({
      requestId: "req_demo_06",
      agentId: "agent_buyer_01",
      policy: mockPolicy,
      items: [lampItem], // ₹1,500 (150,000 paise) > ₹1,000 threshold and < ₹2,000 max order cap
      totalDailySpentPaise: 0,
      recentRequestsInWindow: [],
    });

    expect(result.decision).toBe("REVIEW");
    expect(result.calculatedTotalPaise).toBe(150000);
    const reviewReason = result.reasons.find((r) => r.ruleId === "APPROVAL_THRESHOLD_TRIGGERED");
    expect(reviewReason).toBeDefined();
    expect(reviewReason?.requestedPaise).toBe(150000);
    expect(reviewReason?.limitPaise).toBe(100000);
  });

  it("Scenario 7: Denies purchase when requested quantity exceeds available stock", () => {
    const outOfStockLamp: EvaluatedCartItem = {
      ...lampItem,
      quantity: 50, // stock is only 25
    };

    const result = evaluatePolicy({
      requestId: "req_demo_07",
      agentId: "agent_buyer_01",
      policy: mockPolicy,
      items: [outOfStockLamp],
      totalDailySpentPaise: 0,
      recentRequestsInWindow: [],
    });

    expect(result.decision).toBe("DENY");
    const stockReason = result.reasons.find((r) => r.ruleId === "INSUFFICIENT_STOCK");
    expect(stockReason).toBeDefined();
  });

  it("Scenario 8: Safely denies empty cart or invalid quantities", () => {
    const emptyResult = evaluatePolicy({
      requestId: "req_demo_08a",
      agentId: "agent_buyer_01",
      policy: mockPolicy,
      items: [],
    });
    expect(emptyResult.decision).toBe("DENY");
    expect(emptyResult.reasons[0].ruleId).toBe("INVALID_CART");

    const invalidQtyResult = evaluatePolicy({
      requestId: "req_demo_08b",
      agentId: "agent_buyer_01",
      policy: mockPolicy,
      items: [{ ...notebookItem, quantity: -1 }],
    });
    expect(invalidQtyResult.decision).toBe("DENY");
    expect(invalidQtyResult.reasons[0].ruleId).toBe("INVALID_QUANTITY");
  });
});
