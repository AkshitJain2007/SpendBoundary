import React, { useState } from "react";
import { ShieldCheck, ShieldAlert, RefreshCw, FileWarning, ChevronDown, ChevronRight, Hash, Database } from "lucide-react";
import { VerificationResult } from "@/lib/audit-chain";

export interface AuditEventItem {
  id: string;
  eventType: string;
  requestId: string | null;
  payload: Record<string, any>;
  previousHash: string;
  eventHash: string;
  createdAt: string;
}

interface AuditTimelineProps {
  events: AuditEventItem[];
  verification: VerificationResult | null;
  onRefresh: () => Promise<void>;
  onSimulateTamper: () => Promise<void>;
  loading: boolean;
}

export function AuditTimeline({
  events,
  verification,
  onRefresh,
  onSimulateTamper,
  loading,
}: AuditTimelineProps) {
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedEvents((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isTampered = verification && !verification.valid;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Chain Verification Card */}
      <div
        className={`rounded-xl border p-5 space-y-4 transition shadow-md ${
          isTampered
            ? "bg-red-950/40 border-red-700/80"
            : "bg-navy-850 border-navy-700"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div
              className={`p-2.5 rounded-lg ${
                isTampered
                  ? "bg-red-600 text-white animate-bounce"
                  : "bg-emerald-500/20 text-emerald-400"
              }`}
            >
              {isTampered ? <ShieldAlert className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-100">
                  {isTampered ? "CRYPTOGRAPHIC INTEGRITY BREACH DETECTED" : "SHA-256 Hash Chain: Verified"}
                </h3>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    isTampered
                      ? "bg-red-900 text-red-200 border border-red-500"
                      : "bg-emerald-950 text-emerald-400 border border-emerald-700"
                  }`}
                >
                  {isTampered ? "CHAIN CORRUPTED" : "CHAIN VALID"}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                {verification?.message || "Validating cryptographic event linkage across all records..."}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="px-3.5 py-2 rounded-lg bg-navy-800 hover:bg-navy-750 text-xs font-semibold text-slate-200 border border-navy-700 flex items-center space-x-1.5 transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Verify Integrity</span>
            </button>

            <button
              onClick={onSimulateTamper}
              disabled={loading}
              className="px-3.5 py-2 rounded-lg bg-red-950/80 hover:bg-red-900 text-xs font-bold text-red-300 border border-red-700/60 flex items-center space-x-1.5 transition"
            >
              <FileWarning className="h-3.5 w-3.5" />
              <span>Simulate Tampering</span>
            </button>
          </div>
        </div>

        {isTampered && verification?.firstInvalidEvent && (
          <div className="p-3.5 rounded-lg bg-red-900/60 border border-red-600/70 text-xs space-y-1.5 font-mono text-red-200">
            <div className="font-bold uppercase tracking-wider text-red-100 flex items-center space-x-1.5">
              <ShieldAlert className="h-4 w-4" />
              <span>Tamper Details Found</span>
            </div>
            <div>Corrupted Event ID: {verification.firstInvalidEvent.id}</div>
            <div>Event Type: {verification.firstInvalidEvent.eventType}</div>
            <div>Request ID: {verification.firstInvalidEvent.requestId || "N/A"}</div>
            <div className="truncate">Expected Hash: {verification.firstInvalidEvent.expectedHash}</div>
            <div className="truncate">Stored Hash: {verification.firstInvalidEvent.storedHash}</div>
          </div>
        )}
      </div>

      {/* Events Timeline */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400 pb-1">
          <span>Append-Only Event Ledger ({events.length} blocks)</span>
          <span>Order: Newest First</span>
        </div>

        <div className="space-y-2.5">
          {events.map((event, index) => {
            const isExpanded = expandedEvents[event.id];
            const isGenesis = event.eventType === "SYSTEM_GENESIS";

            return (
              <div
                key={event.id}
                className="rounded-lg border border-navy-750 bg-navy-850 p-3.5 space-y-2 transition hover:border-navy-650 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <button
                      onClick={() => toggleExpand(event.id)}
                      className="p-1 rounded hover:bg-navy-750 text-slate-400"
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>

                    <span
                      className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                        isGenesis
                          ? "bg-purple-950 text-purple-300 border border-purple-800"
                          : event.eventType.includes("DENIED") || event.eventType.includes("BLOCKED")
                          ? "bg-red-950 text-red-300 border border-red-800"
                          : event.eventType.includes("CAPTURED") || event.eventType.includes("ACCEPTED")
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                          : event.eventType.includes("APPROVAL")
                          ? "bg-amber-950 text-amber-300 border border-amber-800"
                          : "bg-navy-950 text-slate-300 border border-navy-700"
                      }`}
                    >
                      {event.eventType}
                    </span>

                    {event.requestId && (
                      <span className="font-mono text-slate-400 text-[11px]">
                        [{event.requestId}]
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] text-slate-500 font-mono">
                    {new Date(event.createdAt).toLocaleTimeString()}
                  </span>
                </div>

                {/* Hashes Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-mono text-slate-400 pt-1">
                  <div className="flex items-center space-x-1 truncate bg-navy-950 px-2 py-1 rounded border border-navy-800">
                    <span className="text-slate-500 shrink-0">Prev:</span>
                    <span className="truncate">{event.previousHash}</span>
                  </div>
                  <div className="flex items-center space-x-1 truncate bg-navy-950 px-2 py-1 rounded border border-navy-800">
                    <span className="text-emerald-500 shrink-0">Hash:</span>
                    <span className="truncate text-slate-300">{event.eventHash}</span>
                  </div>
                </div>

                {/* Expanded Payload Viewer */}
                {isExpanded && (
                  <div className="pt-2 border-t border-navy-800 space-y-1 font-mono text-[11px]">
                    <div className="text-slate-500 text-[10px] uppercase font-bold">Canonical JSON Payload:</div>
                    <pre className="p-2.5 rounded bg-navy-950 border border-navy-800 text-slate-300 overflow-x-auto">
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
