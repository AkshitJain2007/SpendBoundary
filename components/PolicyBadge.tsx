import React from "react";
import { CheckCircle2, Clock, Ban, AlertCircle } from "lucide-react";

interface PolicyBadgeProps {
  decision: "ALLOW" | "REVIEW" | "DENY" | "PENDING";
  size?: "sm" | "md" | "lg";
}

export function PolicyBadge({ decision, size = "md" }: PolicyBadgeProps) {
  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5 font-semibold",
    lg: "px-4 py-2 text-sm gap-2 font-bold tracking-wide",
  };

  if (decision === "ALLOW") {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-600/50 shadow-sm ${sizeClasses[size]}`}
      >
        <CheckCircle2 className={size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5"} />
        <span>ALLOW</span>
      </span>
    );
  }

  if (decision === "REVIEW") {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-amber-950/80 text-amber-400 border border-amber-600/50 shadow-sm ${sizeClasses[size]}`}
      >
        <Clock className={size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5"} />
        <span>REVIEW</span>
      </span>
    );
  }

  if (decision === "DENY") {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-red-950/80 text-red-400 border border-red-600/50 shadow-sm ${sizeClasses[size]}`}
      >
        <Ban className={size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5"} />
        <span>DENY</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full bg-slate-800 text-slate-300 border border-slate-700 ${sizeClasses[size]}`}
    >
      <AlertCircle className="h-3.5 w-3.5" />
      <span>PENDING</span>
    </span>
  );
}
