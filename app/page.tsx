"use client";

import React, { useState } from "react";
import { ShieldCheck, Bot, FileText, CheckCircle2, Clock, Ban, RefreshCw, AlertTriangle, ArrowRight } from "lucide-react";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"overview" | "agent" | "policy" | "approvals" | "audit">("overview");

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Header */}
      <header className="border-b border-navy-700 bg-navy-950/80 backdrop-blur sticky top-0 z-50 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-lg bg-brand-blue/20 border border-brand-blue/40 flex items-center justify-center text-brand-blue font-bold shadow-sm">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-base text-slate-100 tracking-tight">SpendBoundary</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-700/50">
                Demo Mode
              </span>
            </div>
            <p className="text-xs text-slate-400">Policy-Gated Payments for AI Agents</p>
          </div>
        </div>

        {/* Merchant info & quick status */}
        <div className="flex items-center space-x-4 text-xs">
          <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-md bg-navy-800 border border-navy-700">
            <span className="text-slate-400">Merchant:</span>
            <span className="font-medium text-slate-200">Apex Supplies Ltd</span>
          </div>
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-navy-800 border border-navy-700">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-slate-300 font-mono">SQLite Hash Chain: Active</span>
          </div>
        </div>
      </header>

      {/* Navigation Sub-header / Tabs */}
      <div className="border-b border-navy-700/80 bg-navy-900/60 px-6 py-2">
        <nav className="flex space-x-2">
          {[
            { id: "overview", label: "Demo Control Room", icon: ShieldCheck },
            { id: "agent", label: "Agent Actions", icon: Bot },
            { id: "policy", label: "Policy Engine", icon: FileText },
            { id: "approvals", label: "Human Approvals", icon: Clock },
            { id: "audit", label: "Audit & Tamper Replay", icon: RefreshCw },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isActive
                    ? "bg-brand-blue text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-navy-800"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Banner */}
        <div className="rounded-xl border border-navy-700 bg-gradient-to-r from-navy-800 to-navy-900 p-6 relative overflow-hidden">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">
              Let AI shop. Keep the merchant in control.
            </h1>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              SpendBoundary ensures autonomous purchasing agents call strictly typed tools, recalculates totals on the server, and enforces deterministic spending policies before creating any test/mock payment order.
            </p>
          </div>
        </div>

        {/* 3 Core Decision States Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-emerald-900/40 bg-emerald-950/20">
            <div className="flex items-center space-x-2 text-emerald-400 font-semibold text-sm">
              <CheckCircle2 className="h-4 w-4" />
              <span>ALLOW</span>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              Within limits (e.g. ₹500 purchase). Creates 1 mock payment attempt.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-amber-900/40 bg-amber-950/20">
            <div className="flex items-center space-x-2 text-amber-400 font-semibold text-sm">
              <Clock className="h-4 w-4" />
              <span>REVIEW</span>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              High-value threshold (e.g. ₹1,500). Holds payment until human sign-off.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-red-900/40 bg-red-950/20">
            <div className="flex items-center space-x-2 text-red-400 font-semibold text-sm">
              <Ban className="h-4 w-4" />
              <span>DENY</span>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              Overspend or restricted category (e.g. ₹8,000). Zero payment calls.
            </p>
          </div>
        </div>

        {/* Phase 0 Status Notice */}
        <div className="p-5 rounded-xl border border-brand-blue/30 bg-navy-800/80">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-brand-blue/10 text-brand-blue">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-200">Phase 0 Initialized</h2>
              <p className="text-xs text-slate-400 mt-1">
                Database seeded with 6 synthetic products and default policy rules. Next step: Phase 1 (Deterministic Policy Engine + Vitest unit tests).
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-navy-800 bg-navy-950 px-6 py-4 text-center text-xs text-slate-500">
        SpendBoundary — Synthetic Demo Environment. No real credentials or live payment data used.
      </footer>
    </div>
  );
}
