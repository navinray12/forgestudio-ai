import React from "react";

export interface SlaBadgeProps {
  status?: "ON_TRACK" | "WARNING" | "BREACHED" | "COMPLETED";
  firstResponseDue?: string;
  resolutionDue?: string;
  className?: string;
}

export const SlaBadge: React.FC<SlaBadgeProps> = ({ status = "ON_TRACK", className = "" }) => {
  const configs: Record<string, { label: string; style: string }> = {
    ON_TRACK: { label: "SLA On Track", style: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    WARNING: { label: "SLA Warning", style: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20 animate-pulse" },
    BREACHED: { label: "SLA Breached", style: "bg-red-500/10 text-red-400 border-red-500/30 font-bold" },
    COMPLETED: { label: "SLA Met", style: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  };

  const current = configs[status] || configs.ON_TRACK;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${current.style} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
      {current.label}
    </span>
  );
};
