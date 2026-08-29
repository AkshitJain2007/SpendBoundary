import React, { useState } from "react";
import { Clock, CheckCircle2, XCircle, AlertCircle, ShoppingBag, ShieldCheck, UserCheck } from "lucide-react";

export interface ApprovalRecord {
  id: string;
  requestId: string;
  agentId: string;
  requestedAmountPaise: number;
  cartSnapshot: Array<{
    productId: string;
    name: string;
    category: string;
    pricePaise: number;
    quantity: number;
  }>;
  reason: string;
  decision: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  reviewerId?: string;
  comment?: string;
  paymentLinkUrl?: string;
  expiresAt: string;
  createdAt: string;
}

interface ApprovalsViewProps {
  approvals: ApprovalRecord[];
  onAction: (requestId: string, decision: "APPROVED" | "REJECTED", comment?: string) => Promise<void>;
  loading: boolean;
}

export function ApprovalsView({ approvals, onAction, loading }: ApprovalsViewProps) {
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  const handleCommentChange = (requestId: string, text: string) => {
    setCommentInputs((prev) => ({ ...prev, [requestId]: text }));
  };

  const pendingApprovals = approvals.filter((a) => a.decision === "PENDING");
  const pastApprovals = approvals.filter((a) => a.decision !== "PENDING");

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-navy-700">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Human Approval Queue</h3>
            <p className="text-xs text-slate-400">
              Orders requiring explicit operator sign-off before payment execution.
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-950/80 text-amber-400 border border-amber-600/50">
          {pendingApprovals.length} Pending Actions
        </span>
      </div>

      {/* Pending List */}
      <div className="space-y-4">
        {pendingApprovals.length === 0 ? (
          <div className="rounded-xl border border-navy-700 bg-navy-850 p-8 text-center">
            <UserCheck className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
            <h4 className="text-sm font-medium text-slate-200">Approval Queue is Clear</h4>
            <p className="text-xs text-slate-400 mt-1">
              No orders are currently waiting for human intervention.
            </p>
          </div>
        ) : (
          pendingApprovals.map((approval) => {
            const formattedTotal = (approval.requestedAmountPaise / 100).toLocaleString("en-IN", {
              minimumFractionDigits: 2,
            });

            return (
              <div
                key={approval.id}
                className="rounded-xl border border-amber-800/60 bg-amber-950/20 p-5 space-y-4 transition shadow-md"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-navy-700/60">
                  <div className="flex items-center space-x-2.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-900/60 text-amber-300 border border-amber-700/50 font-mono">
                      REVIEW REQUIRED
                    </span>
                    <span className="text-xs font-mono text-slate-300">{approval.requestId}</span>
                  </div>

                  <div className="text-sm font-bold font-mono text-slate-100">
                    Total: ₹{formattedTotal}
                  </div>
                </div>

                {/* Reason & Agent Statement */}
                <div className="p-3 rounded-lg bg-navy-900/80 border border-navy-750 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="font-semibold text-slate-300">Agent Stated Justification:</span>
                    <span className="font-mono text-[11px]">{approval.agentId}</span>
                  </div>
                  <p className="text-slate-200 italic">"{approval.reason}"</p>
                </div>

                {/* Cart Snapshot */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                    <ShoppingBag className="h-3.5 w-3.5" />
                    <span>Cart Items Snapshot</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {approval.cartSnapshot.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-navy-950 border border-navy-800 flex justify-between text-xs"
                      >
                        <div>
                          <div className="font-medium text-slate-200">{item.name}</div>
                          <div className="text-[11px] text-slate-400">Qty: {item.quantity} × ₹{(item.pricePaise / 100).toLocaleString()}</div>
                        </div>
                        <div className="font-mono font-semibold text-slate-200">
                          ₹{((item.pricePaise * item.quantity) / 100).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Buyer Payment Link Info for Merchant */}
                {approval.paymentLinkUrl && (
                  <div className="p-2.5 rounded-lg bg-navy-950 border border-navy-800 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2 text-slate-400">
                      <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping"></span>
                      <span className="font-semibold text-slate-300">Customer Payment Link:</span>
                      <span className="font-mono text-emerald-400 truncate max-w-xs">{approval.paymentLinkUrl}</span>
                    </div>
                    <a
                      href={approval.paymentLinkUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-brand-blue hover:underline font-semibold shrink-0"
                    >
                      Open Link ↗
                    </a>
                  </div>
                )}

                {/* Reviewer Comment & Action Buttons */}
                <div className="pt-2 flex flex-col sm:flex-row gap-3 items-center justify-between">
                  <input
                    type="text"
                    placeholder="Optional review comment / approval notes..."
                    value={commentInputs[approval.requestId] || ""}
                    onChange={(e) => handleCommentChange(approval.requestId, e.target.value)}
                    className="w-full sm:flex-1 px-3 py-2 rounded-lg bg-navy-950 border border-navy-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-blue"
                  />

                  <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => onAction(approval.requestId, "REJECTED", commentInputs[approval.requestId])}
                      disabled={loading}
                      className="px-4 py-2 rounded-lg bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-700/50 text-xs font-semibold flex items-center space-x-1.5 transition disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" />
                      <span>Reject</span>
                    </button>

                    <button
                      onClick={() => onAction(approval.requestId, "APPROVED", commentInputs[approval.requestId])}
                      disabled={loading}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold flex items-center space-x-1.5 transition shadow-sm disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Approve & Execute Payment</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Historical Approvals */}
      {pastApprovals.length > 0 && (
        <div className="space-y-3 pt-6 border-t border-navy-700">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Resolved Decision History
          </h4>
          <div className="space-y-2">
            {pastApprovals.map((pa) => (
              <div
                key={pa.id}
                className="p-3 rounded-lg bg-navy-850 border border-navy-750 flex items-center justify-between text-xs"
              >
                <div className="flex items-center space-x-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                      pa.decision === "APPROVED"
                        ? "bg-emerald-950 text-emerald-400 border border-emerald-700/50"
                        : "bg-red-950 text-red-400 border border-red-700/50"
                    }`}
                  >
                    {pa.decision}
                  </span>
                  <span className="font-mono text-slate-400">{pa.requestId}</span>
                  <span className="text-slate-300 truncate max-w-xs">{pa.reason}</span>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold text-slate-200">
                    ₹{(pa.requestedAmountPaise / 100).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-500">{new Date(pa.createdAt).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
