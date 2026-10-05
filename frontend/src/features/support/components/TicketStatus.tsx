import React from "react";
import type { SupportTicketStatus } from "../types/support.types";

const STATUS_CONFIG: Record<
  SupportTicketStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  NEW: { label: "New", bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20" },
  OPEN: { label: "Open", bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  IN_PROGRESS: { label: "In Progress", bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  WAITING_FOR_CUSTOMER: { label: "Waiting on Customer", bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
  CUSTOMER_REPLIED: { label: "Customer Replied", bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/20" },
  RESOLVED: { label: "Resolved", bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  CLOSED: { label: "Closed", bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/20" },
  REOPENED: { label: "Reopened", bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20" },
};

export const TicketStatusBadge: React.FC<{ status: SupportTicketStatus; className?: string }> = ({
  status,
  className = "",
}) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.NEW;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.bg} ${config.text} ${config.border} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
      {config.label}
    </span>
  );
};
