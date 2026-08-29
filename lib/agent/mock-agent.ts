// SpendBoundary - Scripted Agent Model
// Deterministic autonomous agent execution for fast, zero-dependency demo runs.

import { CartItem } from "../schemas";

export interface ToolCallEvent {
  tool: string;
  arguments: Record<string, any>;
  result: Record<string, any>;
  timestamp: string;
}

export interface AgentExecutionResult {
  goal: string;
  agentId: string;
  thoughtTrace: string[];
  toolCalls: ToolCallEvent[];
  proposedCart: CartItem[];
  statedReason: string;
  nextAction: "REQUEST_CHECKOUT" | "NO_ACTION";
}

export class ScriptedAgentModel {
  agentId: string = "agent_procurebot_01";

  async executeGoal(goal: string): Promise<AgentExecutionResult> {
    const lowerGoal = goal.toLowerCase();
    const thoughtTrace: string[] = [];
    const toolCalls: ToolCallEvent[] = [];
    let proposedCart: CartItem[] = [];
    let statedReason = "";

    thoughtTrace.push(`Received user objective: "${goal}"`);
    thoughtTrace.push("Parsing requirements and matching available merchant catalogue items...");

    if (lowerGoal.includes("500") || lowerGoal.includes("office") || lowerGoal.includes("notebook") || lowerGoal.includes("safe")) {
      thoughtTrace.push("Identified budget of ₹500 for office supplies.");
      
      // 1. Tool call: search_catalogue
      toolCalls.push({
        tool: "search_catalogue",
        arguments: { query: "office supplies" },
        result: {
          itemsFound: 2,
          products: [
            { id: "prod_notebook", name: "Executive Hardcover Notebook", pricePaise: 35000 },
            { id: "prod_pen_set", name: "Archival Gel Pen Set (Pack of 5)", pricePaise: 15000 },
          ],
        },
        timestamp: new Date().toISOString(),
      });

      // 2. Tool call: add_to_cart
      toolCalls.push({
        tool: "add_to_cart",
        arguments: { productId: "prod_notebook", quantity: 1 },
        result: { cartId: "cart_agent_demo", status: "ADDED" },
        timestamp: new Date().toISOString(),
      });
      toolCalls.push({
        tool: "add_to_cart",
        arguments: { productId: "prod_pen_set", quantity: 1 },
        result: { cartId: "cart_agent_demo", status: "ADDED" },
        timestamp: new Date().toISOString(),
      });

      proposedCart = [
        { productId: "prod_notebook", quantity: 1 },
        { productId: "prod_pen_set", quantity: 1 },
      ];
      statedReason = "Standard office replenishment for team note-taking and archival records.";
      thoughtTrace.push("Selected 1x Notebook (₹350) + 1x Pen Set (₹150) = ₹500 total.");
    } else if (lowerGoal.includes("chair") || lowerGoal.includes("8000") || lowerGoal.includes("8,000") || lowerGoal.includes("overspend") || lowerGoal.includes("furniture")) {
      thoughtTrace.push("Searching for ergonomic seating furniture.");

      toolCalls.push({
        tool: "search_catalogue",
        arguments: { query: "chair furniture" },
        result: {
          itemsFound: 1,
          products: [{ id: "prod_chair", name: "Ergonomic Mesh Task Chair", pricePaise: 800000 }],
        },
        timestamp: new Date().toISOString(),
      });

      toolCalls.push({
        tool: "add_to_cart",
        arguments: { productId: "prod_chair", quantity: 1 },
        result: { cartId: "cart_agent_demo", status: "ADDED" },
        timestamp: new Date().toISOString(),
      });

      proposedCart = [{ productId: "prod_chair", quantity: 1 }];
      statedReason = "High-end ergonomic task chair for executive desk workstation.";
      thoughtTrace.push("Selected 1x Ergonomic Chair (₹8,000). Proposing purchase request to policy gate.");
    } else if (lowerGoal.includes("lamp") || lowerGoal.includes("light") || lowerGoal.includes("1500") || lowerGoal.includes("1,500") || lowerGoal.includes("review")) {
      thoughtTrace.push("Searching for desktop lighting solutions.");

      toolCalls.push({
        tool: "search_catalogue",
        arguments: { query: "desk lamp" },
        result: {
          itemsFound: 1,
          products: [{ id: "prod_desk_lamp", name: "Smart Dimmable LED Desk Lamp", pricePaise: 150000 }],
        },
        timestamp: new Date().toISOString(),
      });

      toolCalls.push({
        tool: "add_to_cart",
        arguments: { productId: "prod_desk_lamp", quantity: 1 },
        result: { cartId: "cart_agent_demo", status: "ADDED" },
        timestamp: new Date().toISOString(),
      });

      proposedCart = [{ productId: "prod_desk_lamp", quantity: 1 }];
      statedReason = "Smart dimmable desk illumination for late-night office work.";
      thoughtTrace.push("Selected 1x Smart Desk Lamp (₹1,500). Exceeds auto-approval limit, submitting for human review.");
    } else if (lowerGoal.includes("crypto") || lowerGoal.includes("miner") || lowerGoal.includes("restricted")) {
      thoughtTrace.push("Attempting to search hardware mining category.");

      toolCalls.push({
        tool: "search_catalogue",
        arguments: { query: "crypto hardware" },
        result: {
          itemsFound: 1,
          products: [{ id: "prod_crypto_miner", name: "USB Hardware Mining Key", pricePaise: 500000 }],
        },
        timestamp: new Date().toISOString(),
      });

      toolCalls.push({
        tool: "add_to_cart",
        arguments: { productId: "prod_crypto_miner", quantity: 1 },
        result: { cartId: "cart_agent_demo", status: "ADDED" },
        timestamp: new Date().toISOString(),
      });

      proposedCart = [{ productId: "prod_crypto_miner", quantity: 1 }];
      statedReason = "Experimental computation hardware key.";
      thoughtTrace.push("Selected 1x Crypto Miner (₹5,000). Proposing purchase request to policy gate.");
    } else {
      // Default: Cable
      toolCalls.push({
        tool: "search_catalogue",
        arguments: { query: goal },
        result: {
          itemsFound: 1,
          products: [{ id: "prod_usb_cable", name: "Braided 100W USB-C Cable (2m)", pricePaise: 49900 }],
        },
        timestamp: new Date().toISOString(),
      });

      toolCalls.push({
        tool: "add_to_cart",
        arguments: { productId: "prod_usb_cable", quantity: 1 },
        result: { cartId: "cart_agent_demo", status: "ADDED" },
        timestamp: new Date().toISOString(),
      });

      proposedCart = [{ productId: "prod_usb_cable", quantity: 1 }];
      statedReason = `Procurement requested for user goal: ${goal}`;
      thoughtTrace.push("Selected 1x USB-C Cable (₹499). Proposing checkout.");
    }

    thoughtTrace.push("Executing request_checkout tool call with server policy engine...");

    toolCalls.push({
      tool: "request_checkout",
      arguments: {
        cartId: "cart_agent_demo",
        itemCount: proposedCart.reduce((sum, i) => sum + i.quantity, 0),
        statedReason,
      },
      result: {
        status: "SUBMITTED_TO_POLICY_GATE",
      },
      timestamp: new Date().toISOString(),
    });

    return {
      goal,
      agentId: this.agentId,
      thoughtTrace,
      toolCalls,
      proposedCart,
      statedReason,
      nextAction: "REQUEST_CHECKOUT",
    };
  }
}

export const scriptedAgent = new ScriptedAgentModel();
