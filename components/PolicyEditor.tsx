import React, { useState, useEffect } from "react";
import { Sliders, Save, Check, RefreshCw } from "lucide-react";

interface PolicyConfigData {
  id: string;
  merchantId: string;
  maxOrderPaise: number;
  dailyLimitPaise: number;
  velocityCount: number;
  velocityWindowSeconds: number;
  allowedCategories: string[];
  approvalThresholdPaise: number;
  version: string;
}

interface PolicyEditorProps {
  policy: PolicyConfigData | null;
  onUpdatePolicy: (updated: Partial<PolicyConfigData>) => Promise<void>;
  loading: boolean;
}

export function PolicyEditor({ policy, onUpdatePolicy, loading }: PolicyEditorProps) {
  const [maxOrderRupees, setMaxOrderRupees] = useState(2000);
  const [dailyLimitRupees, setDailyLimitRupees] = useState(5000);
  const [approvalThresholdRupees, setApprovalThresholdRupees] = useState(1000);
  const [velocityCount, setVelocityCount] = useState(3);
  const [velocityWindowSeconds, setVelocityWindowSeconds] = useState(60);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (policy) {
      setMaxOrderRupees(policy.maxOrderPaise / 100);
      setDailyLimitRupees(policy.dailyLimitPaise / 100);
      setApprovalThresholdRupees(policy.approvalThresholdPaise / 100);
      setVelocityCount(policy.velocityCount);
      setVelocityWindowSeconds(policy.velocityWindowSeconds);
    }
  }, [policy]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdatePolicy({
      maxOrderPaise: maxOrderRupees * 100,
      dailyLimitPaise: dailyLimitRupees * 100,
      approvalThresholdPaise: approvalThresholdRupees * 100,
      velocityCount,
      velocityWindowSeconds,
      version: `v1.${Date.now().toString().substring(8)}`,
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="rounded-xl border border-navy-700 bg-navy-850 p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between pb-4 border-b border-navy-700">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-brand-blue/20 text-brand-blue">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Merchant Spending & Policy Rules</h3>
            <p className="text-xs text-slate-400">Configure deterministic limits evaluated on every checkout request.</p>
          </div>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 rounded bg-navy-800 border border-navy-700 text-slate-300">
          Policy: {policy?.version || "v1.0"}
        </span>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Maximum Single Order Cap */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-medium">
            <span className="text-slate-300">Max Single Order Cap (₹)</span>
            <span className="text-brand-blue font-mono font-bold">₹{maxOrderRupees.toLocaleString()}</span>
          </div>
          <input
            type="range"
            min={500}
            max={10000}
            step={250}
            value={maxOrderRupees}
            onChange={(e) => setMaxOrderRupees(Number(e.target.value))}
            className="w-full h-2 bg-navy-950 rounded-lg appearance-none cursor-pointer accent-brand-blue"
          />
          <p className="text-[11px] text-slate-500">Orders exceeding this limit trigger immediate DENY before payment order creation.</p>
        </div>

        {/* Daily Cumulative Spend Limit */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-medium">
            <span className="text-slate-300">Daily Cumulative Spend Limit (₹)</span>
            <span className="text-brand-blue font-mono font-bold">₹{dailyLimitRupees.toLocaleString()}</span>
          </div>
          <input
            type="range"
            min={1000}
            max={25000}
            step={500}
            value={dailyLimitRupees}
            onChange={(e) => setDailyLimitRupees(Number(e.target.value))}
            className="w-full h-2 bg-navy-950 rounded-lg appearance-none cursor-pointer accent-brand-blue"
          />
          <p className="text-[11px] text-slate-500">Total amount an AI agent can spend across all transactions in a single day.</p>
        </div>

        {/* Human Approval Threshold */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-medium">
            <span className="text-slate-300">Human Approval Threshold (₹)</span>
            <span className="text-amber-400 font-mono font-bold">₹{approvalThresholdRupees.toLocaleString()}</span>
          </div>
          <input
            type="range"
            min={250}
            max={5000}
            step={250}
            value={approvalThresholdRupees}
            onChange={(e) => setApprovalThresholdRupees(Number(e.target.value))}
            className="w-full h-2 bg-navy-950 rounded-lg appearance-none cursor-pointer accent-amber-400"
          />
          <p className="text-[11px] text-slate-500">Orders exceeding this value are paused in REVIEW state until approved by a human.</p>
        </div>

        {/* Velocity Rate Limits */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Max Requests (Velocity Count)</label>
            <input
              type="number"
              min={1}
              max={20}
              value={velocityCount}
              onChange={(e) => setVelocityCount(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-navy-950 border border-navy-700 text-xs text-slate-100 focus:outline-none focus:border-brand-blue"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Window Period (Seconds)</label>
            <input
              type="number"
              min={10}
              max={300}
              step={10}
              value={velocityWindowSeconds}
              onChange={(e) => setVelocityWindowSeconds(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-navy-950 border border-navy-700 text-xs text-slate-100 focus:outline-none focus:border-brand-blue"
            />
          </div>
        </div>

        {/* Save Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-navy-700">
          <div className="text-xs text-slate-400">
            {savedSuccess && (
              <span className="flex items-center space-x-1.5 text-emerald-400 font-medium">
                <Check className="h-4 w-4" />
                <span>Policy saved and updated in SQLite!</span>
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 rounded-lg bg-brand-blue hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white flex items-center space-x-2 transition shadow-sm"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>Save Policy Rules</span>
          </button>
        </div>
      </form>
    </div>
  );
}
