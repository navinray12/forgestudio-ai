import React from "react";
import { Link } from "react-router-dom";
import type { SupportTicket } from "../types/support.types";
import { TicketStatusBadge } from "./TicketStatus";
import { TicketPriorityBadge } from "./TicketPriority";
import { SlaBadge } from "./SlaBadge";

export interface TicketTableProps {
  tickets: SupportTicket[];
  isStaff?: boolean;
  selectedTicketIds?: string[];
  onToggleSelect?: (ticketId: string) => void;
  onToggleSelectAll?: () => void;
}

export const TicketTable: React.FC<TicketTableProps> = ({
  tickets,
  isStaff = false,
  selectedTicketIds = [],
  onToggleSelect,
  onToggleSelectAll,
}) => {
  if (tickets.length === 0) {
    return (
      <div className="text-center py-12 bg-slate-900/40 rounded-xl border border-slate-800">
        <p className="text-slate-400 text-sm">No support tickets found.</p>
      </div>
    );
  }

  const allSelected = tickets.length > 0 && tickets.every((t) => selectedTicketIds.includes(t.id));

  return (
    <div className="w-full overflow-x-auto border border-slate-800 rounded-xl bg-slate-900/50">
      <table className="w-full text-left text-xs text-slate-300">
        <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold text-[11px] border-b border-slate-800">
          <tr>
            {isStaff && onToggleSelectAll && (
              <th className="py-3.5 px-4 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0 cursor-pointer"
                />
              </th>
            )}
            <th className="py-3.5 px-4">Ticket</th>
            <th className="py-3.5 px-4">Subject</th>
            <th className="py-3.5 px-4">Category</th>
            <th className="py-3.5 px-4">Status</th>
            <th className="py-3.5 px-4">Priority</th>
            {isStaff && <th className="py-3.5 px-4">Assignee</th>}
            {isStaff && <th className="py-3.5 px-4">SLA</th>}
            <th className="py-3.5 px-4">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {tickets.map((t) => {
            const isSelected = selectedTicketIds.includes(t.id);
            return (
              <tr
                key={t.id}
                className={`hover:bg-slate-800/40 transition-all ${
                  isSelected ? "bg-purple-950/20" : ""
                }`}
              >
                {isStaff && onToggleSelect && (
                  <td className="py-3.5 px-4">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(t.id)}
                      className="rounded border-slate-700 bg-slate-950 text-purple-600 focus:ring-0 cursor-pointer"
                    />
                  </td>
                )}
                <td className="py-3.5 px-4 font-mono font-bold text-blue-400 whitespace-nowrap">
                  <Link to={`/support/tickets/${t.id}`} className="hover:underline">
                    {t.ticketNumber}
                  </Link>
                </td>
                <td className="py-3.5 px-4 max-w-[260px]">
                  <Link to={`/support/tickets/${t.id}`} className="font-semibold text-slate-100 hover:text-blue-400 truncate block">
                    {t.subject}
                  </Link>
                  {t.user && isStaff && (
                    <span className="text-[11px] text-slate-400 block truncate">{t.user.fullName || t.user.email}</span>
                  )}
                </td>
                <td className="py-3.5 px-4 whitespace-nowrap text-slate-300">
                  {t.category?.name || "General"}
                </td>
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <TicketStatusBadge status={t.status} />
                </td>
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <TicketPriorityBadge priority={t.priority} />
                </td>
                {isStaff && (
                  <td className="py-3.5 px-4 whitespace-nowrap text-slate-300">
                    {t.assignedAgent?.fullName || "Unassigned"}
                  </td>
                )}
                {isStaff && (
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <SlaBadge status={t.sla?.status || "ON_TRACK"} />
                  </td>
                )}
                <td className="py-3.5 px-4 whitespace-nowrap text-slate-400">
                  {new Date(t.updatedAt).toLocaleDateString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
