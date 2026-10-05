import React from "react";
import { Monitor, Globe, HardDrive, Calendar, Clock, UserCheck } from "lucide-react";
import type { SupportTicket } from "../types/support.types";

export const TicketMetadataSidebar: React.FC<{ ticket: SupportTicket }> = ({ ticket }) => {
  const ctx = ticket.contextData || {};

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
        Ticket Information
      </h3>

      <div className="space-y-3 text-xs">
        <div className="flex justify-between items-center">
          <span className="text-slate-400">Ticket Number</span>
          <span className="font-mono font-bold text-slate-200">{ticket.ticketNumber}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-400">Category</span>
          <span className="font-medium text-slate-200">{ticket.category?.name || "General"}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-400">Created By</span>
          <span className="text-slate-200 font-medium">{ticket.user?.fullName || ticket.user?.email || "Customer"}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-400">Assigned Agent</span>
          <span className="text-slate-200 font-medium">
            {ticket.assignedAgent?.fullName || "Unassigned"}
          </span>
        </div>

        {ticket.assignedTeam && (
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Assigned Team</span>
            <span className="text-slate-200 font-medium">{ticket.assignedTeam.name}</span>
          </div>
        )}

        <div className="flex justify-between items-center">
          <span className="text-slate-400">Created At</span>
          <span className="text-slate-300">{new Date(ticket.createdAt).toLocaleString()}</span>
        </div>
      </div>

      {ticket.csatScore && (
        <>
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 border-b border-slate-800 pb-2 pt-2">
            Customer Feedback (CSAT)
          </h3>
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1">
            <div className="flex items-center gap-1 text-amber-300 font-bold">
              <span>Rating:</span>
              <span>{"⭐".repeat(ticket.csatScore)}</span>
              <span className="ml-1 text-slate-400">({ticket.csatScore}/5)</span>
            </div>
            {ticket.csatComment && (
              <p className="text-slate-300 italic text-[11px]">"{ticket.csatComment}"</p>
            )}
          </div>
        </>
      )}

      {ticket.isMerged && (
        <div className="p-2.5 rounded bg-purple-950/30 border border-purple-500/30 text-xs text-purple-300 font-semibold">
          📌 Merged into ticket #{ticket.mergedIntoTicketId}
        </div>
      )}

      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2 pt-2">
        Technical Context
      </h3>

      <div className="space-y-3 text-xs">
        {ticket.website && (
          <div className="flex items-start gap-2 text-slate-300">
            <Globe className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-slate-200">{ticket.website.name}</div>
              <div className="text-[11px] text-slate-400">Site ID: {ticket.website.id}</div>
            </div>
          </div>
        )}

        {ctx.wpSiteUrl && (
          <div className="p-2.5 rounded bg-slate-950/50 border border-slate-800 text-[11px]">
            <div className="font-semibold text-slate-300 flex items-center justify-between">
              <span>WordPress Status</span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                {ctx.wpStatus || "CONNECTED"}
              </span>
            </div>
            <div className="mt-1 text-slate-400 truncate">{ctx.wpSiteUrl}</div>
            {ctx.wpPluginVersion && (
              <div className="mt-0.5 text-slate-500">Plugin v{ctx.wpPluginVersion}</div>
            )}
          </div>
        )}

        {ctx.browser && (
          <div className="flex items-center gap-2 text-slate-300">
            <Monitor className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>{ctx.browser} ({ctx.os || "OS"})</span>
          </div>
        )}

        {ticket.workspace && (
          <div className="flex items-center gap-2 text-slate-300">
            <HardDrive className="w-4 h-4 text-purple-400 shrink-0" />
            <span>Workspace: {ticket.workspace.name}</span>
          </div>
        )}
      </div>
    </div>
  );
};
