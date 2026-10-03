import React from "react";
import { Lock, ShieldAlert } from "lucide-react";
import type { SupportTicketMessage } from "../types/support.types";

export const InternalNoteCard: React.FC<{ message: SupportTicketMessage }> = ({ message }) => {
  return (
    <div className="my-4 p-4 rounded-lg bg-amber-950/30 border border-amber-500/40 shadow-lg relative overflow-hidden">
      <div className="absolute top-0 left-0 bottom-0 w-1 bg-amber-500" />
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-amber-500/20 text-amber-300 text-xs font-semibold uppercase tracking-wider">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-amber-400" />
          <span>Internal Note — Visible Only to Support Staff</span>
        </div>
        <div className="flex items-center gap-1.5 text-amber-400/80 normal-case font-normal">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Hidden from Customer</span>
        </div>
      </div>
      <div className="text-sm text-amber-100 whitespace-pre-wrap leading-relaxed">
        {message.content}
      </div>
      <div className="mt-3 text-xs text-amber-400/70 flex items-center justify-between">
        <span>By {message.author?.fullName || message.author?.email || "Support Agent"}</span>
        <span>{new Date(message.createdAt).toLocaleString()}</span>
      </div>
    </div>
  );
};
