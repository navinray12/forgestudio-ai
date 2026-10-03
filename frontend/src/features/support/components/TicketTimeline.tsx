import React from "react";
import { User, Shield, Info, Download, Paperclip } from "lucide-react";
import type { SupportTicketMessage, SupportTicketEvent } from "../types/support.types";
import { InternalNoteCard } from "./InternalNote";

export interface TicketTimelineProps {
  messages: SupportTicketMessage[];
  events?: SupportTicketEvent[];
  currentUserId?: string;
  isStaff?: boolean;
}

export const TicketTimeline: React.FC<TicketTimelineProps> = ({
  messages,
  events = [],
  currentUserId,
  isStaff = false,
}) => {
  // Combine messages and events into a single sorted timeline
  const combinedTimeline = [
    ...messages.map((m) => ({ kind: "message" as const, timestamp: new Date(m.createdAt).getTime(), data: m })),
    ...events.map((e) => ({ kind: "event" as const, timestamp: new Date(e.createdAt).getTime(), data: e })),
  ].sort((a, b) => a.timestamp - b.timestamp);

  return (
    <div className="space-y-4 my-6">
      {combinedTimeline.length === 0 && (
        <div className="text-center py-8 text-slate-500 text-sm">
          No conversation messages yet.
        </div>
      )}

      {combinedTimeline.map((item, idx) => {
        if (item.kind === "event") {
          const ev = item.data;
          return (
            <div key={`ev-${ev.id || idx}`} className="flex items-center gap-2 text-xs text-slate-400 py-1 px-3 bg-slate-900/40 border border-slate-800/60 rounded-lg">
              <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>
                <strong className="text-slate-300 font-semibold">{ev.actor?.fullName || "System"}</strong>: {ev.eventType}{" "}
                {ev.oldValue && ev.newValue ? `(${ev.oldValue} → ${ev.newValue})` : ev.newValue || ""}
              </span>
              <span className="ml-auto text-[11px] text-slate-500">{new Date(ev.createdAt).toLocaleTimeString()}</span>
            </div>
          );
        }

        const msg = item.data;
        if (msg.type === "INTERNAL_NOTE") {
          return <InternalNoteCard key={`msg-${msg.id}`} message={msg} />;
        }

        const isMe = msg.authorId === currentUserId;
        const isSupport = ["SUPPORT_AGENT", "SUPPORT_MANAGER", "SUPPORT_ADMIN", "ADMIN", "SUPER_ADMIN"].includes(
          msg.author?.role
        );

        return (
          <div
            key={`msg-${msg.id}`}
            className={`flex gap-3 p-4 rounded-xl border ${
              isSupport
                ? "bg-slate-900/90 border-blue-500/30 text-slate-100"
                : "bg-slate-950/70 border-slate-800 text-slate-200"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                isSupport ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-200"
              }`}
            >
              {isSupport ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>

            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-slate-100">
                    {msg.author?.fullName || msg.author?.email || "User"}
                  </span>
                  {isSupport && (
                    <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      Support Staff
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-400">{new Date(msg.createdAt).toLocaleString()}</span>
              </div>

              <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed pt-1">
                {msg.content}
              </div>

              {msg.attachments && msg.attachments.length > 0 && (
                <div className="mt-3 pt-2 border-t border-slate-800/80 flex flex-wrap gap-2">
                  {msg.attachments.map((att) => (
                    <a
                      key={att.id}
                      href={`/api/v1/support/tickets/${msg.ticketId}/attachments/${att.id}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-blue-400 font-medium transition-all"
                    >
                      <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate max-w-[150px]">{att.fileName}</span>
                      <Download className="w-3 h-3 text-slate-400 ml-1" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
