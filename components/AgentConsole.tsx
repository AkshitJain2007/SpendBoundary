import React, { useState } from "react";
import { Bot, Send, Terminal, ShoppingCart, Sparkles, ArrowRight, Shield } from "lucide-react";
import { ToolCallEvent } from "@/lib/agent/mock-agent";
import { CartItem } from "@/lib/schemas";

interface AgentConsoleProps {
  onExecuteGoal: (goal: string) => Promise<void>;
  loading: boolean;
  activeDecision?: any;
  agentExecution: {
    goal: string;
    agentId: string;
    thoughtTrace: string[];
    toolCalls: ToolCallEvent[];
    proposedCart: CartItem[];
    statedReason: string;
  } | null;
}

export function AgentConsole({
  onExecuteGoal,
  loading,
  activeDecision,
  agentExecution,
}: AgentConsoleProps) {
  const [inputGoal, setInputGoal] = useState("Buy office supplies under ₹500");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputGoal.trim() || loading) return;
    onExecuteGoal(inputGoal.trim());
  };

  const sampleGoals = [
    "Buy office supplies under ₹500",
    "Procure an executive task chair for the office",
    "Find desktop lighting under ₹2,000",
    "Order crypto mining hardware",
  ];

  return (
    <div className="space-y-6">
      {/* Header & Goal Input */}
      <div className="rounded-xl border border-navy-700 bg-navy-850 p-5 space-y-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-brand-violet/20 text-brand-violet">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">AI Buyer Agent Console</h3>
            <p className="text-xs text-slate-400">
              The agent translates natural language goals into typed tool calls. All money calculations and policy enforcement happen on the server.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={inputGoal}
            onChange={(e) => setInputGoal(e.target.value)}
            placeholder="e.g. Buy notebooks and pens under ₹500..."
            className="flex-1 px-4 py-2.5 rounded-lg bg-navy-950 border border-navy-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-blue"
          />
          <button
            type="submit"
            disabled={loading || !inputGoal.trim()}
            className="px-5 py-2.5 rounded-lg bg-brand-blue hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white flex items-center space-x-2 transition"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{loading ? "Agent Running..." : "Execute Goal"}</span>
          </button>
        </form>

        {/* Quick Sample Goal Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] text-slate-400">Try sample goals:</span>
          {sampleGoals.map((g, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setInputGoal(g)}
              className="text-[11px] px-2.5 py-1 rounded-md bg-navy-800 hover:bg-navy-700 text-slate-300 border border-navy-700 transition"
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Split View: Thought Trace vs Tool Calls & Cart */}
      {agentExecution ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Agent Cognitive Loop */}
          <div className="rounded-xl border border-navy-700 bg-navy-850 p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-navy-700">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
                <Sparkles className="h-4 w-4 text-brand-violet" />
                <span>Agent Thought Trace</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">{agentExecution.agentId}</span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-navy-950 border border-navy-800">
                <span className="text-slate-400 font-medium">Objective: </span>
                <span className="text-slate-200">"{agentExecution.goal}"</span>
              </div>

              <div className="space-y-2 font-mono text-[11px] text-slate-300">
                {agentExecution.thoughtTrace.map((thought, i) => (
                  <div key={i} className="flex items-start space-x-2">
                    <span className="text-brand-violet select-none">›</span>
                    <span>{thought}</span>
                  </div>
                ))}
              </div>

              {agentExecution.statedReason && (
                <div className="mt-4 p-3 rounded-lg bg-navy-900 border border-navy-750">
                  <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Stated Business Reason</div>
                  <p className="text-xs text-slate-200">{agentExecution.statedReason}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Typed Tool Calls & Proposed Cart */}
          <div className="rounded-xl border border-navy-700 bg-navy-850 p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-navy-700">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
                <Terminal className="h-4 w-4 text-brand-blue" />
                <span>Typed Tool Executions</span>
              </div>
              <div className="flex items-center space-x-1 text-xs text-slate-400">
                <ShoppingCart className="h-3.5 w-3.5" />
                <span>{agentExecution.proposedCart.length} items proposed</span>
              </div>
            </div>

            {/* Tool Calls Log */}
            <div className="space-y-3">
              {agentExecution.toolCalls.map((tc, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-navy-950 border border-navy-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-brand-blue">
                      tool: {tc.tool}()
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(tc.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="text-[11px] font-mono text-slate-400 bg-navy-900 p-2 rounded border border-navy-850 overflow-x-auto">
                    <div className="text-slate-500">// Arguments:</div>
                    <pre>{JSON.stringify(tc.arguments, null, 2)}</pre>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-navy-700 bg-navy-800/40 p-8 text-center">
          <Bot className="h-8 w-8 text-slate-500 mx-auto mb-2" />
          <p className="text-xs text-slate-400">Type an objective above or click a sample goal to run the agent.</p>
        </div>
      )}

      {/* Active Agent Policy Decision & Razorpay Link */}
      {activeDecision && (
        <div
          className={`rounded-xl border p-5 space-y-3 transition shadow-lg ${
            activeDecision.decision === "ALLOW"
              ? "border-emerald-700/60 bg-emerald-950/30"
              : activeDecision.decision === "REVIEW"
              ? "border-amber-700/60 bg-amber-950/30"
              : "border-red-700/60 bg-red-950/30"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div
                className={`p-2 rounded-lg ${
                  activeDecision.decision === "ALLOW"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : activeDecision.decision === "REVIEW"
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                  <span>
                    {activeDecision.decision === "ALLOW"
                      ? "AI Purchase Completed & Captured"
                      : activeDecision.decision === "REVIEW"
                      ? "Human Approval & Payment Link Required"
                      : "AI Purchase Blocked by Merchant Policy"}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                      activeDecision.decision === "ALLOW"
                        ? "bg-emerald-900 text-emerald-300 border border-emerald-700"
                        : activeDecision.decision === "REVIEW"
                        ? "bg-amber-900 text-amber-300 border border-amber-700"
                        : "bg-red-900 text-red-300 border border-red-700"
                    }`}
                  >
                    {activeDecision.decision}
                  </span>
                </div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">
                  Calculated Total: ₹{((activeDecision.calculatedTotalPaise || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })} • Request ID: {activeDecision.requestId}
                </div>
              </div>
            </div>

            {/* Direct Razorpay Link in AI Chat */}
            {activeDecision.paymentLinkUrl && (
              <a
                href={activeDecision.paymentLinkUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-1.5 transition shadow-sm"
              >
                <span>Pay via Razorpay Link ↗</span>
              </a>
            )}
          </div>

          {activeDecision.reasons && activeDecision.reasons.length > 0 && (
            <div className="pt-2 border-t border-navy-750/60 space-y-1">
              {activeDecision.reasons.map((r: any, idx: number) => (
                <div key={idx} className="text-xs text-slate-300 flex items-start space-x-2">
                  <span className="font-mono text-slate-400">[{r.ruleId}]:</span>
                  <span>{r.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
