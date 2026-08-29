import { NextResponse } from "next/server";
import { MCP_TOOLS_DEFINITIONS, executeMCPTool } from "@/lib/mcp/handler";

// Standard JSON-RPC 2.0 MCP Endpoint over HTTP
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { id = 1, method, params = {} } = body;

    // 1. MCP Initialization
    if (method === "initialize") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          serverInfo: {
            name: "spendboundary-mcp",
            version: "1.0.0",
          },
          capabilities: {
            tools: {},
          },
          instructions:
            "SpendBoundary Policy-Gated Merchant Connector. Use 'search_catalogue' to browse items, 'get_product_details' for pricing, and 'request_checkout' to execute policy-checked purchases.",
        },
      });
    }

    // 2. List Available Tools
    if (method === "tools/list") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          tools: MCP_TOOLS_DEFINITIONS,
        },
      });
    }

    // 3. Call Tool
    if (method === "tools/call") {
      const { name, arguments: args = {} } = params;
      const toolResult = await executeMCPTool(name, args);

      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: toolResult,
      });
    }

    // 4. Ping
    if (method === "ping") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {},
      });
    }

    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      error: {
        code: -32601,
        message: `Method '${method}' not found. Supported methods: 'initialize', 'tools/list', 'tools/call', 'ping'.`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32603,
          message: error?.message || "Internal MCP error",
        },
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "online",
    protocol: "Model Context Protocol (MCP) JSON-RPC 2.0",
    service: "SpendBoundary Policy Gate",
    endpoint: "/api/mcp",
    toolsAvailable: MCP_TOOLS_DEFINITIONS.map((t) => t.name),
    instructions: {
      claudeDesktop: "Add stdio command 'npx -y tsx ./scripts/mcp-server.ts' to claude_desktop_config.json",
      cloudflareTunnel: "Expose via 'cloudflared tunnel --url http://localhost:3000' and connect to https://<tunnel>/api/mcp",
    },
  });
}
