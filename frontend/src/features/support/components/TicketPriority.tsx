import React from "react";
import type { SupportTicketPriority } from "../types/support.types";

const PRIORITY_CONFIG: Record<
  SupportTicketPriority,
  { label: string; bg: string; text: string; border: string; icon?: string }
> = {
  URGENT: { label: "Urgent", bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30", icon: "🔥" },
  HIGH: { label: "High", bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/30", icon: "⚡" },
  NORMAL: { label: "Normal", bg: "bg-slate-500/10", text: "text-slate-300", border: "border-slate-500/20" },
  LOW: { label: "Low", bg: "bg-zinc-500/10", text: "text-zinc-400", border: "border-zinc-500/20" },
};

export const TicketPriorityBadge: React.FC<{ priority: SupportTicketPriority; className?: string }> = ({
  priority,
  className = "",
}) => {
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.NORMAL;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${config.bg} ${config.text} ${config.border} ${className}`}
    >
      {config.icon && <span className="mr-1 text-[10px]">{config.icon}</span>}
      {config.label}
    </span>
  );
};
