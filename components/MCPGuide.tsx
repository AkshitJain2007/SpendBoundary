import React, { useState } from "react";
import { Network, Copy, Check, Terminal, Globe, Shield, Play, ArrowRight, ExternalLink } from "lucide-react";

export function MCPGuide() {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [testTool, setTestTool] = useState("search_catalogue");
  const [testQuery, setTestQuery] = useState("office supplies");
  const [testResponse, setTestResponse] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);

  const claudeConfig = JSON.stringify(
    {
      mcpServers: {
        spendboundary: {
          command: "npx",
          args: ["-y", "tsx", "../scripts/mcp-server.ts"],
        },
      },
    },
    null,
    2
  );

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleTestMCP = async () => {
    setTestLoading(true);
    try {
      let params: any = {};
      if (testTool === "search_catalogue") {
        params = { query: testQuery };
      } else if (testTool === "get_policy_limits") {
        params = {};
      } else if (testTool === "request_checkout") {
        params = {
          items: [{ productId: "prod_notebook", quantity: 1 }],
          reason: "Purchase via MCP tester",
          agentId: "claude_mcp_user",
        };
      }

      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "tools/call",
          params: {
            name: testTool,
            arguments: params,
          },
        }),
      });

      const data = await res.json();
      setTestResponse(data);
    } catch (err: any) {
      setTestResponse({ error: err?.message || "Failed to call MCP endpoint" });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="rounded-xl border border-navy-700 bg-gradient-to-r from-navy-850 to-navy-900 p-6 space-y-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-lg bg-brand-violet/20 text-brand-violet">
            <Network className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-slate-100">SpendBoundary MCP Connector</h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-brand-violet/20 text-brand-violet border border-brand-violet/40">
                JSON-RPC 2.0
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Connect external AI agents (Claude Desktop, Cursor, ChatGPT, or autonomous agents) to merchant shopping tools protected by SpendBoundary.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Option 1: Claude Desktop (Local Stdio) */}
        <div className="rounded-xl border border-navy-700 bg-navy-850 p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-navy-750">
              <div className="flex items-center space-x-2">
                <Terminal className="h-4 w-4 text-brand-blue" />
                <h3 className="text-xs font-bold text-slate-200">1. Claude Desktop / Cursor (Local Stdio)</h3>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">claude_desktop_config.json</span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Add SpendBoundary as a local MCP server to Claude Desktop. Claude can directly browse products and request checkouts with automatic spending limits.
            </p>

            <div className="relative">
              <pre className="p-3.5 rounded-lg bg-navy-950 border border-navy-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
                {claudeConfig}
              </pre>
              <button
                onClick={() => copyToClipboard(claudeConfig, "claude")}
                className="absolute top-2.5 right-2.5 p-1.5 rounded-md bg-navy-800 hover:bg-navy-700 text-slate-300 border border-navy-700 transition"
              >
                {copiedField === "claude" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 bg-navy-900 p-2.5 rounded-lg border border-navy-750 flex items-center space-x-2">
            <Shield className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Runs locally with SQLite. Claude cannot bypass spending caps.</span>
          </div>
        </div>

        {/* Option 2: Cloudflare Tunnel (Remote MCP / ChatGPT) */}
        <div className="rounded-xl border border-navy-700 bg-navy-850 p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-navy-750">
              <div className="flex items-center space-x-2">
                <Globe className="h-4 w-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-slate-200">2. Remote MCP via Cloudflare Tunnel</h3>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">cloudflared</span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Expose your local SpendBoundary MCP endpoint to the internet in 5 seconds with zero setup or open ports:
            </p>

            <div className="space-y-2">
              <div className="text-[10px] uppercase font-bold text-slate-400">Step 1: Run Tunnel in Terminal</div>
              <div className="relative">
                <pre className="p-3 rounded-lg bg-navy-950 border border-navy-800 text-[11px] font-mono text-emerald-300">
                  cloudflared tunnel --url http://localhost:3000
                </pre>
                <button
                  onClick={() => copyToClipboard("cloudflared tunnel --url http://localhost:3000", "tunnel")}
                  className="absolute top-2 right-2 p-1.5 rounded-md bg-navy-800 hover:bg-navy-700 text-slate-300 border border-navy-700 transition"
                >
                  {copiedField === "tunnel" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>

              <div className="text-[10px] uppercase font-bold text-slate-400 pt-1">Step 2: MCP Endpoint URL</div>
              <div className="p-2.5 rounded-lg bg-navy-950 border border-navy-800 text-[11px] font-mono text-slate-300">
                https://&lt;your-tunnel-subdomain&gt;.trycloudflare.com/api/mcp
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 bg-navy-900 p-2.5 rounded-lg border border-navy-750">
            Paste the tunnel URL into any remote MCP client or ChatGPT Custom Action.
          </div>
        </div>
      </div>

      {/* Live Interactive MCP Tester */}
      <div className="rounded-xl border border-navy-700 bg-navy-850 p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-navy-700">
          <div className="flex items-center space-x-2">
            <Play className="h-4 w-4 text-brand-blue" />
            <h3 className="text-sm font-bold text-slate-100">Live MCP Protocol Simulator</h3>
          </div>
          <span className="text-xs text-slate-400">Test how external AI agents see MCP responses</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-400">Tool:</span>
            <select
              value={testTool}
              onChange={(e) => setTestTool(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-navy-950 border border-navy-700 text-xs text-slate-200 focus:outline-none focus:border-brand-blue font-mono"
            >
              <option value="search_catalogue">search_catalogue()</option>
              <option value="get_policy_limits">get_policy_limits()</option>
              <option value="request_checkout">request_checkout()</option>
            </select>
          </div>

          {testTool === "search_catalogue" && (
            <input
              type="text"
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              placeholder="Query (e.g. office, chair, lamp)..."
              className="px-3 py-1.5 rounded-lg bg-navy-950 border border-navy-700 text-xs text-slate-200 focus:outline-none focus:border-brand-blue"
            />
          )}

          <button
            onClick={handleTestMCP}
            disabled={testLoading}
            className="px-4 py-1.5 rounded-lg bg-brand-blue hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white transition flex items-center space-x-1.5"
          >
            <span>{testLoading ? "Calling MCP..." : "Send MCP Request"}</span>
          </button>
        </div>

        {testResponse && (
          <div className="space-y-1.5 pt-2">
            <div className="text-[10px] font-mono text-slate-400 uppercase font-bold">JSON-RPC 2.0 Response:</div>
            <pre className="p-4 rounded-xl bg-navy-950 border border-navy-800 text-[11px] font-mono text-slate-200 overflow-x-auto max-h-72">
              {JSON.stringify(testResponse, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
