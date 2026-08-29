import React from "react";
import { CheckCircle2, Ban, Clock, ShieldAlert, Zap, Repeat, FileWarning, Play } from "lucide-react";

export interface DemoControlsProps {
  onRunScenario: (scenarioKey: string) => void;
  loading: boolean;
}

export function DemoControls({ onRunScenario, loading }: DemoControlsProps) {
  const scenarios = [
    {
      key: "safe_500",
      title: "1. Safe Purchase (₹500)",
      description: "1x Notebook + 1x Pen Set. Evaluates ALLOW and captures mock payment.",
      badge: "ALLOW",
      badgeColor: "bg-emerald-950 text-emerald-400 border-emerald-700/50",
      icon: CheckCircle2,
    },
    {
      key: "overspend_8000",
      title: "2. Overspend Attempt (₹8,000)",
      description: "1x Task Chair. Exceeds ₹2,000 cap. Zero payment calls generated.",
      badge: "DENY",
      badgeColor: "bg-red-950 text-red-400 border-red-700/50",
      icon: Ban,
    },
    {
      key: "review_1500",
      title: "3. Review Required (₹1,500)",
      description: "1x Desk Lamp. Exceeds ₹1,000 threshold. Queued for human approval.",
      badge: "REVIEW",
      badgeColor: "bg-amber-950 text-amber-400 border-amber-700/50",
      icon: Clock,
    },
    {
      key: "restricted_item",
      title: "4. Restricted Product",
      description: "1x Crypto Mining Key. Blocked product & category. Denied instantly.",
      badge: "DENY",
      badgeColor: "bg-red-950 text-red-400 border-red-700/50",
      icon: ShieldAlert,
    },
    {
      key: "velocity_breach",
      title: "5. Velocity Burst (4x Requests)",
      description: "Rapidly fires 4 checkout requests in <5s to trigger rate limiting.",
      badge: "VELOCITY",
      badgeColor: "bg-purple-950 text-purple-400 border-purple-700/50",
      icon: Zap,
    },
    {
      key: "retry_dedupe",
      title: "6. Retry Deduplication",
      description: "Simulates timeout, then retries with same idempotency key.",
      badge: "IDEMPOTENT",
      badgeColor: "bg-cyan-950 text-cyan-400 border-cyan-700/50",
      icon: Repeat,
    },
    {
      key: "audit_tamper",
      title: "7. Audit Tamper Test",
      description: "Deliberately alters a past audit record. Hash chain flags tampering.",
      badge: "TAMPER TEST",
      badgeColor: "bg-rose-950 text-rose-400 border-rose-700/50",
      icon: FileWarning,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">Interactive Demo Scenarios</h2>
          <p className="text-xs text-slate-400">1-click triggers testing policy gates, mock payments, and audit verifications.</p>
        </div>
        {loading && (
          <div className="flex items-center space-x-2 text-xs text-brand-blue font-mono animate-pulse">
            <span>Evaluating boundary...</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {scenarios.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.key}
              onClick={() => onRunScenario(s.key)}
              disabled={loading}
              className="text-left p-3.5 rounded-xl border border-navy-700 bg-navy-800/80 hover:bg-navy-750 hover:border-brand-blue/50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${s.badgeColor}`}>
                    {s.badge}
                  </span>
                  <Play className="h-3 w-3 text-slate-500 group-hover:text-brand-blue transition-colors" />
                </div>
                <div className="font-semibold text-xs text-slate-100 group-hover:text-brand-blue transition-colors">
                  {s.title}
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed line-clamp-2">
                  {s.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
