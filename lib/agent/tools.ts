// SpendBoundary - Agent Tool Definitions

export interface AgentToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export const AGENT_TOOLS: AgentToolDefinition[] = [
  {
    name: "search_catalogue",
    description: "Search merchant product catalogue by keywords or category.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query or category keyword" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_product",
    description: "Fetch full details and price for a specific product ID.",
    parameters: {
      type: "object",
      properties: {
        productId: { type: "string", description: "Unique product ID" },
      },
      required: ["productId"],
    },
  },
  {
    name: "add_to_cart",
    description: "Add a quantity of an item to the agent's active shopping cart.",
    parameters: {
      type: "object",
      properties: {
        productId: { type: "string", description: "Product identifier" },
        quantity: { type: "integer", description: "Quantity to purchase" },
      },
      required: ["productId", "quantity"],
    },
  },
  {
    name: "request_checkout",
    description: "Submit active cart for server-side policy validation and purchase execution.",
    parameters: {
      type: "object",
      properties: {
        cartId: { type: "string", description: "Identifier of the cart to checkout" },
        reason: { type: "string", description: "Stated business justification for this procurement" },
      },
      required: ["reason"],
    },
  },
];
