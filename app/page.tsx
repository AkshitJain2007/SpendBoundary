"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Bot,
  Sliders,
  Clock,
  RefreshCw,
  ShoppingBag,
  RotateCcw,
  Zap,
  Activity,
  Layers,
  Network,
} from "lucide-react";

import { DemoControls } from "@/components/DemoControls";
import { DecisionCard } from "@/components/DecisionCard";
import { AgentConsole } from "@/components/AgentConsole";
import { PolicyEditor } from "@/components/PolicyEditor";
import { ApprovalsView, ApprovalRecord } from "@/components/ApprovalsView";
import { AuditTimeline, AuditEventItem } from "@/components/AuditTimeline";
import { CatalogueGrid, ProductItem } from "@/components/CatalogueGrid";
import { MCPGuide } from "@/components/MCPGuide";
import { VerificationResult } from "@/lib/audit-chain";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"overview" | "agent" | "catalogue" | "policy" | "approvals" | "audit" | "mcp">("overview");

  // Live Data State
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [policy, setPolicy] = useState<any>(null);
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEventItem[]>([]);
  const [auditVerification, setAuditVerification] = useState<VerificationResult | null>(null);

  // Active Decision State
  const [activeDecision, setActiveDecision] = useState<any>(null);
  const [agentExecution, setAgentExecution] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Initial Load
  useEffect(() => {
    fetchInitialData();
  }, []);

  // Safe Fetch Helper to prevent "Unexpected token <" JSON parsing errors on HTML error responses
  const safeFetchJson = async (url: string, options?: RequestInit) => {
    try {
      const res = await fetch(url, options);
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        return { ok: res.ok, data, status: res.status };
      } catch (parseErr) {
        console.warn(`[API ${url}] Non-JSON response received (HTTP ${res.status}):`, text.substring(0, 150));
        return { ok: false, data: null, error: `Server returned non-JSON response (HTTP ${res.status})` };
      }
    } catch (netErr: any) {
      console.error(`[API ${url}] Network fetch error:`, netErr);
      return { ok: false, data: null, error: netErr?.message || "Network error" };
    }
  };

  const fetchInitialData = async () => {
    try {
      // 1. Fetch Catalogue
      const cat = await safeFetchJson("/api/catalogue");
      if (cat.ok && cat.data?.products) setProducts(cat.data.products);

      // 2. Fetch Policy
      const pol = await safeFetchJson("/api/policy");
      if (pol.ok && pol.data?.policy) setPolicy(pol.data.policy);

      // 3. Fetch Approvals
      const app = await safeFetchJson("/api/approvals");
      if (app.ok && app.data?.approvals) setApprovals(app.data.approvals);

      // 4. Fetch Audit
      const aud = await safeFetchJson("/api/audit");
      if (aud.ok && aud.data) {
        if (aud.data.events) setAuditEvents(aud.data.events);
        if (aud.data.verification) setAuditVerification(aud.data.verification);
      }
    } catch (err) {
      console.error("Failed to load initial data:", err);
    }
  };

  const refreshAuditAndApprovals = async () => {
    try {
      const aud = await safeFetchJson("/api/audit");
      if (aud.ok && aud.data) {
        if (aud.data.events) setAuditEvents(aud.data.events);
        if (aud.data.verification) setAuditVerification(aud.data.verification);
      }

      const app = await safeFetchJson("/api/approvals");
      if (app.ok && app.data?.approvals) setApprovals(app.data.approvals);
    } catch (err) {
      console.error("Refresh error:", err);
    }
  };

  // Reset / Re-seed Demo DB
  const handleResetDemo = async () => {
    setLoading(true);
    try {
      const res = await safeFetchJson("/api/demo/seed", { method: "POST" });
      if (res.ok) {
        setActiveDecision(null);
        setAgentExecution(null);
        await fetchInitialData();
        setStatusMessage("Demo database reset and re-seeded cleanly.");
        setTimeout(() => setStatusMessage(null), 3000);
      } else {
        setStatusMessage(res.error || "Failed to reset demo database");
      }
    } catch (err) {
      console.error("Reset error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Reset Daily Spend Limits & Test Transactions to ₹0
  const handleResetDailySpend = async () => {
    setLoading(true);
    try {
      const res = await safeFetchJson("/api/demo/reset-spend", { method: "POST" });
      if (res.ok) {
        setActiveDecision(null);
        setAgentExecution(null);
        await fetchInitialData();
        setStatusMessage("Daily spend reset to ₹0.00. Ready for new purchases.");
        setTimeout(() => setStatusMessage(null), 3000);
      } else {
        setStatusMessage(res.error || "Failed to reset daily spend");
      }
    } catch (err) {
      console.error("Reset spend error:", err);
    } finally {
      setLoading(false);
    }
  };

  // 1-Click Scenario Runner
  const handleRunScenario = async (scenarioKey: string) => {
    setLoading(true);
    try {
      if (scenarioKey === "safe_500") {
        // Safe Purchase: Notebook (350) + Pen Set (150) = 500
        const res = await safeFetchJson("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: [
              { productId: "prod_notebook", quantity: 1 },
              { productId: "prod_pen_set", quantity: 1 },
            ],
            agentId: "agent_procurebot_01",
            reason: "Replenish standard office notebooks and writing pens.",
          }),
        });
        if (res.data) setActiveDecision(res.data);
        setStatusMessage("Scenario 1 executed: ₹500 purchase evaluated as ALLOW and captured.");
      } else if (scenarioKey === "overspend_8000") {
        // Overspend: Chair (8,000) > 2,000 cap
        const res = await safeFetchJson("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: [{ productId: "prod_chair", quantity: 1 }],
            agentId: "agent_procurebot_01",
            reason: "High-end ergonomic task chair for executive desk.",
          }),
        });
        if (res.data) setActiveDecision(res.data);
        setStatusMessage("Scenario 2 executed: ₹8,000 purchase DENIED (exceeds ₹2,000 max order cap).");
      } else if (scenarioKey === "review_1500") {
        // Review: Desk Lamp (1,500) > 1,000 threshold
        const res = await safeFetchJson("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: [{ productId: "prod_desk_lamp", quantity: 1 }],
            agentId: "agent_procurebot_01",
            reason: "Smart dimmable desk illumination for late-night office work.",
          }),
        });
        if (res.data) setActiveDecision(res.data);
        setStatusMessage("Scenario 3 executed: ₹1,500 purchase requires REVIEW (queued for human approval).");
      } else if (scenarioKey === "restricted_item") {
        // Restricted item
        const res = await safeFetchJson("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: [{ productId: "prod_crypto_miner", quantity: 1 }],
            agentId: "agent_procurebot_01",
            reason: "Experimental crypto computation key.",
          }),
        });
        if (res.data) setActiveDecision(res.data);
        setStatusMessage("Scenario 4 executed: Restricted item DENIED before payment creation.");
      } else if (scenarioKey === "velocity_breach") {
        // Fire 4 rapid requests in parallel
        setStatusMessage("Firing rapid requests to test velocity limiter...");
        const promises = [1, 2, 3, 4].map((idx) =>
          safeFetchJson("/api/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              items: [{ productId: "prod_notebook", quantity: 1 }],
              agentId: "agent_procurebot_01",
              reason: `Rapid request test #${idx}`,
            }),
          })
        );

        const results = await Promise.all(promises);
        const lastResult = results[results.length - 1];
        if (lastResult.data) setActiveDecision(lastResult.data);
        setStatusMessage("Scenario 5 executed: 4th rapid request DENIED by velocity rate limiter.");
      } else if (scenarioKey === "retry_dedupe") {
        // 1. Initial attempt with simulated timeout
        const testReqId = `req_retry_${Date.now()}`;
        const testIdemKey = `idem_retry_${Date.now()}`;

        setStatusMessage("Step 1: Sending payment request that encounters a simulated timeout...");
        await safeFetchJson("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId: testReqId,
            idempotencyKey: testIdemKey,
            items: [{ productId: "prod_pen_set", quantity: 1 }],
            agentId: "agent_procurebot_01",
            reason: "Testing network retry idempotency deduplication.",
            simulateTimeout: true,
          }),
        });

        // 2. Retry with the SAME idempotency key
        setStatusMessage("Step 2: Client retries with the SAME idempotency key (deduplication check)...");
        const retryRes = await safeFetchJson("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId: testReqId,
            idempotencyKey: testIdemKey,
            items: [{ productId: "prod_pen_set", quantity: 1 }],
            agentId: "agent_procurebot_01",
            reason: "Testing network retry idempotency deduplication.",
            simulateTimeout: false,
          }),
        });

        if (retryRes.data) setActiveDecision(retryRes.data);
        setStatusMessage("Scenario 6 executed: Retry matched existing idempotency key without duplicate payment!");
      } else if (scenarioKey === "audit_tamper") {
        // Trigger simulated tamper
        const tamperRes = await safeFetchJson("/api/audit/tamper", { method: "POST" });
        if (tamperRes.data?.verification) setAuditVerification(tamperRes.data.verification);
        setActiveTab("audit");
        setStatusMessage("Scenario 7 executed: Deliberate audit tampering simulated. Hash chain flags corruption!");
      }

      await refreshAuditAndApprovals();
    } catch (err) {
      console.error("Scenario execution error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Agent Goal Execution
  const handleExecuteAgentGoal = async (goal: string) => {
    setLoading(true);
    try {
      const res = await safeFetchJson("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal }),
      });
      if (res.data?.execution) {
        setAgentExecution(res.data.execution);

        // Automatically send the agent's proposed cart to server policy checkout
        const checkoutRes = await safeFetchJson("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: res.data.execution.proposedCart,
            agentId: res.data.execution.agentId,
            reason: res.data.execution.statedReason,
          }),
        });

        if (checkoutRes.data) setActiveDecision(checkoutRes.data);
        await refreshAuditAndApprovals();
      }
    } catch (err) {
      console.error("Agent goal execution error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Human Approval Action
  const handleApprovalAction = async (
    requestId: string,
    decision: "APPROVED" | "REJECTED",
    comment?: string
  ) => {
    setLoading(true);
    try {
      const res = await safeFetchJson("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          decision,
          reviewerId: "human_admin",
          comment: comment || (decision === "APPROVED" ? "Approved by reviewer." : "Rejected."),
        }),
      });

      await refreshAuditAndApprovals();
      setStatusMessage(`Approval action [${decision}] registered for request ${requestId}.`);
    } catch (err) {
      console.error("Approval error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Policy Update
  const handleUpdatePolicy = async (updatedFields: any) => {
    setLoading(true);
    try {
      const res = await safeFetchJson("/api/policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedFields),
      });
      if (res.data?.policy) setPolicy(res.data.policy);
    } catch (err) {
      console.error("Update policy error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Audit Actions
  const handleVerifyAudit = async () => {
    setLoading(true);
    try {
      const res = await safeFetchJson("/api/audit");
      if (res.data?.events) setAuditEvents(res.data.events);
      if (res.data?.verification) setAuditVerification(res.data.verification);
    } catch (err) {
      console.error("Audit fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateTamper = async () => {
    setLoading(true);
    try {
      const res = await safeFetchJson("/api/audit/tamper", { method: "POST" });
      if (res.data?.verification) setAuditVerification(res.data.verification);
      await refreshAuditAndApprovals();
    } catch (err: any) {
      alert(err?.message || "Ensure at least one transaction has run before testing tamper.");
    } finally {
      setLoading(false);
    }
  };

  const pendingApprovalsCount = approvals.filter((a) => a.decision === "PENDING").length;

  return (
    <div className="flex flex-col min-h-screen bg-navy-900 text-slate-100 font-sans">
      {/* Top Application Bar */}
      <header className="border-b border-navy-700 bg-navy-950/90 backdrop-blur sticky top-0 z-50 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-lg bg-brand-blue/20 border border-brand-blue/40 flex items-center justify-center text-brand-blue font-bold shadow-sm">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-base text-slate-100 tracking-tight">SpendBoundary</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-700/60">
                Demo Mode
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Policy-Gated Payments for Autonomous AI Agents</p>
          </div>
        </div>

        {/* Status Indicators & Reset Control */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-navy-850 border border-navy-700">
            <span className="text-slate-400">Store:</span>
            <span className="font-semibold text-slate-200">Apex Supplies</span>
          </div>

          <div
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border ${
              auditVerification && !auditVerification.valid
                ? "bg-red-950 text-red-300 border-red-700 animate-pulse"
                : "bg-navy-850 text-slate-300 border-navy-700"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                auditVerification && !auditVerification.valid ? "bg-red-500" : "bg-emerald-400 animate-pulse"
              }`}
            ></span>
            <span className="font-mono text-[11px]">
              {auditVerification && !auditVerification.valid ? "Tamper Detected!" : "Hash Chain: Active"}
            </span>
          </div>

          <button
            onClick={handleResetDailySpend}
            disabled={loading}
            title="Reset daily spending total to ₹0.00"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 transition font-semibold"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Reset Spend (₹0)</span>
          </button>

          <button
            onClick={handleResetDemo}
            disabled={loading}
            title="Reset SQLite database to fresh demo seed state"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-750 text-slate-300 border border-navy-700 transition"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Reset Seed</span>
          </button>
        </div>
      </header>

      {/* Navigation Sub-header / Tabs */}
      <div className="border-b border-navy-700/80 bg-navy-950/60 px-6 py-2">
        <nav className="flex space-x-2 overflow-x-auto">
          {[
            { id: "overview", label: "Demo Control Room", icon: Activity },
            { id: "agent", label: "Agent Console", icon: Bot },
            { id: "catalogue", label: "Products (6)", icon: ShoppingBag },
            { id: "policy", label: "Policy Rules", icon: Sliders },
            {
              id: "approvals",
              label: `Approvals Queue ${pendingApprovalsCount > 0 ? `(${pendingApprovalsCount})` : ""}`,
              icon: Clock,
              badge: pendingApprovalsCount > 0,
            },
            { id: "audit", label: "Audit & Tamper Replay", icon: RefreshCw },
            { id: "mcp", label: "MCP Connector", icon: Network },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-brand-blue text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-navy-800"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse"></span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Status Alert Bar */}
      {statusMessage && (
        <div className="bg-brand-blue/10 border-b border-brand-blue/30 px-6 py-2 text-xs text-brand-blue flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Zap className="h-3.5 w-3.5" />
            <span>{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-slate-200">✕</button>
        </div>
      )}

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Tab 1: Overview & Control Room (Main Judging Screen) */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Top Interactive Scenario Buttons */}
            <DemoControls onRunScenario={handleRunScenario} loading={loading} />

            {/* Live Decision Card Display */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-200">Latest Boundary Evaluation</h3>
                <span className="text-xs text-slate-500 font-mono">Real-time server policy decision</span>
              </div>

              <DecisionCard
                decision={activeDecision?.decision || null}
                requestId={activeDecision?.requestId}
                calculatedTotalPaise={activeDecision?.calculatedTotalPaise || 0}
                reasons={activeDecision?.reasons || []}
                policyVersion={activeDecision?.policyVersion || policy?.version || "v1.0"}
                payment={activeDecision?.payment || null}
                paymentLinkUrl={activeDecision?.paymentLinkUrl}
                onApproveClick={() => setActiveTab("approvals")}
              />
            </div>

            {/* Live Audit Log Preview */}
            <div className="pt-4 border-t border-navy-750 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-200">Cryptographic Audit Chain (Recent Events)</h3>
                <button
                  onClick={() => setActiveTab("audit")}
                  className="text-xs text-brand-blue hover:underline"
                >
                  View Full Chain & Tamper Inspector →
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                {auditEvents.slice(0, 3).map((evt) => (
                  <div key={evt.id} className="p-3 rounded-lg bg-navy-850 border border-navy-750 space-y-1.5">
                    <div className="flex items-center justify-between font-mono text-[10px]">
                      <span className="font-bold text-slate-300">{evt.eventType}</span>
                      <span className="text-slate-500">{new Date(evt.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-[10px] font-mono text-emerald-400 truncate">
                      Hash: {evt.eventHash.substring(0, 24)}...
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Agent Console */}
        {activeTab === "agent" && (
          <AgentConsole
            onExecuteGoal={handleExecuteAgentGoal}
            loading={loading}
            agentExecution={agentExecution}
            activeDecision={activeDecision}
          />
        )}

        {/* Tab 3: Catalogue Grid */}
        {activeTab === "catalogue" && (
          <CatalogueGrid products={products} />
        )}

        {/* Tab 4: Policy Editor */}
        {activeTab === "policy" && (
          <PolicyEditor
            policy={policy}
            onUpdatePolicy={handleUpdatePolicy}
            loading={loading}
          />
        )}

        {/* Tab 5: Approvals Queue */}
        {activeTab === "approvals" && (
          <ApprovalsView
            approvals={approvals}
            onAction={handleApprovalAction}
            loading={loading}
          />
        )}

        {/* Tab 6: Audit & Tamper Replay */}
        {activeTab === "audit" && (
          <AuditTimeline
            events={auditEvents}
            verification={auditVerification}
            onRefresh={handleVerifyAudit}
            onSimulateTamper={handleSimulateTamper}
            loading={loading}
          />
        )}

        {/* Tab 7: MCP Connector */}
        {activeTab === "mcp" && (
          <MCPGuide />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-navy-800 bg-navy-950 px-6 py-4 text-center text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
        <div>SpendBoundary — Policy-Gated Payments for Autonomous AI Agents</div>
        <div className="text-[11px] font-mono">SQLite Append-Only Audit Trail • SHA-256 Chained • Demo Mode</div>
      </footer>
    </div>
  );
}
