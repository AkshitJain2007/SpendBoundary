import React from "react";
import { PolicyBadge } from "./PolicyBadge";
import { Shield, CreditCard, AlertOctagon, CheckCircle2, Clock, Ban, ArrowRight } from "lucide-react";

export interface DecisionCardProps {
  decision: "ALLOW" | "REVIEW" | "DENY" | null;
  requestId?: string;
  calculatedTotalPaise?: number;
  reasons?: Array<{
    ruleId: string;
    message: string;
    requestedPaise?: number;
    limitPaise?: number;
  }>;
  policyVersion?: string;
  payment?: {
    status: string;
    providerOrderId?: string;
    idempotencyKey?: string;
  } | null;
  onApproveClick?: () => void;
}

export function DecisionCard({
  decision,
  requestId,
  calculatedTotalPaise = 0,
  reasons = [],
  policyVersion = "v1.0",
  payment,
  onApproveClick,
}: DecisionCardProps) {
  if (!decision) {
    return (
      <div className="rounded-xl border border-navy-700 bg-navy-800/40 p-8 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-navy-700/50 flex items-center justify-center text-slate-400 mb-3">
          <Shield className="h-6 w-6" />
        </div>
        <h3 className="text-base font-medium text-slate-200">No Active Evaluation</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
          Run a scenario from the Demo Control bar or submit an agent goal to see deterministic policy enforcement and payment gateway decisions.
        </p>
      </div>
    );
  }

  const formattedAmount = (calculatedTotalPaise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
  });

  const cardBorder =
    decision === "ALLOW"
      ? "border-emerald-800/60 bg-emerald-950/20"
      : decision === "REVIEW"
      ? "border-amber-800/60 bg-amber-950/20"
      : "border-red-800/60 bg-red-950/20";

  return (
    <div className={`rounded-xl border ${cardBorder} p-6 space-y-5 transition-all shadow-lg`}>
      {/* Header with Decision & ID */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-navy-700/60">
        <div className="flex items-center space-x-3">
          <PolicyBadge decision={decision} size="lg" />
          <div>
            <div className="text-xs font-mono text-slate-400">Request ID: <span className="text-slate-200 font-semibold">{requestId || "N/A"}</span></div>
            <div className="text-[11px] text-slate-500 font-mono">Policy Version: {policyVersion}</div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs text-slate-400">Server-Recalculated Amount</div>
          <div className="text-xl font-bold font-mono text-slate-100">₹{formattedAmount}</div>
        </div>
      </div>

      {/* Primary Reason Block */}
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Policy Evaluation Reasons</div>
        <div className="space-y-2">
          {reasons.map((r, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg border text-xs leading-relaxed flex items-start space-x-2.5 ${
                decision === "ALLOW"
                  ? "bg-emerald-900/30 border-emerald-700/40 text-emerald-200"
                  : decision === "REVIEW"
                  ? "bg-amber-900/30 border-amber-700/40 text-amber-200"
                  : "bg-red-900/30 border-red-700/40 text-red-200"
              }`}
            >
              <div className="mt-0.5 font-bold font-mono shrink-0">[{r.ruleId}]</div>
              <div className="flex-1">{r.message}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Gateway Execution Boundary Status */}
      <div className="p-4 rounded-lg bg-navy-900/80 border border-navy-700/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div
            className={`p-2 rounded-md ${
              decision === "ALLOW"
                ? "bg-emerald-500/20 text-emerald-400"
                : decision === "REVIEW"
                ? "bg-amber-500/20 text-amber-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-200">
              {decision === "ALLOW"
                ? "Mock Payment Gateway Invoked"
                : decision === "REVIEW"
                ? "Payment Held — Human Approval Required"
                : "Payment Boundary Protected (Zero Calls)"}
            </div>
            <div className="text-[11px] text-slate-400">
              {decision === "ALLOW"
                ? `Order ID: ${payment?.providerOrderId || "N/A"} (${payment?.status || "CAPTURED"})`
                : decision === "REVIEW"
                ? "Payment order will not be created until a human operator approves."
                : "No payment attempt or provider order was generated."}
            </div>
          </div>
        </div>

        {decision === "REVIEW" && onApproveClick && (
          <button
            onClick={onApproveClick}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold text-xs transition"
          >
            <span>Review in Queue</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
