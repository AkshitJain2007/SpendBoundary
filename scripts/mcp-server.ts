#!/usr/bin/env node

// SpendBoundary - Stdio MCP Server for Claude Desktop & Cursor
// Exposes policy-gated merchant checkout tools over Model Context Protocol (stdio transport)

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { MCP_TOOLS_DEFINITIONS, executeMCPTool } from "../lib/mcp/handler";

async function runMCPServer() {
  const server = new Server(
    {
      name: "spendboundary",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List Available Tools to Claude / Agent
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: MCP_TOOLS_DEFINITIONS as any,
    };
  });

  // Execute Tool with SpendBoundary Policy Enforcement
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    const result = await executeMCPTool(name, args as Record<string, any>);
    return result as any;
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🚀 SpendBoundary Stdio MCP Server running and listening for AI tool calls...");
}

runMCPServer().catch((err) => {
  console.error("Fatal error starting SpendBoundary MCP server:", err);
  process.exit(1);
});
