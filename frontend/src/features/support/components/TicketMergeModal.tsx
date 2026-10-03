import React, { useState } from "react";
import { GitMerge, X, Loader2 } from "lucide-react";
import { ticketService } from "../services/ticketService";
import type { SupportTicket } from "../types/support.types";

interface TicketMergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceTicket: SupportTicket;
  onMergeSuccess: () => void;
}

export const TicketMergeModal: React.FC<TicketMergeModalProps> = ({
  isOpen,
  onClose,
  sourceTicket,
  onMergeSuccess,
}) => {
  const [targetTicketNumber, setTargetTicketNumber] = useState("");
  const [targetTicketId, setTargetTicketId] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [targetTicket, setTargetTicket] = useState<SupportTicket | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLookupTarget = async () => {
    if (!targetTicketNumber.trim()) return;
    try {
      setSearching(true);
      setError(null);
      const res = await ticketService.listTickets({ query: targetTicketNumber.trim() });
      if (res.items && res.items.length > 0) {
        const found = res.items.find(
          (t) => t.ticketNumber.toLowerCase() === targetTicketNumber.trim().toLowerCase()
        ) || res.items[0];
        setTargetTicket(found);
        setTargetTicketId(found.id);
      } else {
        setError(`Ticket "${targetTicketNumber}" not found.`);
        setTargetTicket(null);
      }
    } catch (err: any) {
      setError(err.message || "Failed to search target ticket");
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTicketId) {
      setError("Please search and select a target ticket to merge into.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await ticketService.mergeTickets(sourceTicket.id, targetTicketId, reason);
      onMergeSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to merge tickets");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-purple-400" />
            <h3 className="text-base font-semibold text-slate-100">Merge Ticket {sourceTicket.ticketNumber}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Target Ticket Number (e.g., FS-1002)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={targetTicketNumber}
                onChange={(e) => setTargetTicketNumber(e.target.value)}
                placeholder="Enter ticket number..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
              />
              <button
                type="button"
                onClick={handleLookupTarget}
                disabled={searching || !targetTicketNumber.trim()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-200"
              >
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
              </button>
            </div>
          </div>

          {targetTicket && (
            <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-1 text-xs">
              <p className="font-semibold text-purple-300">Selected Target Ticket: {targetTicket.ticketNumber}</p>
              <p className="text-slate-300 line-clamp-1">Subject: {targetTicket.subject}</p>
              <p className="text-slate-400">Created by: {targetTicket.user?.fullName} ({targetTicket.status})</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Reason for Merge (Optional)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Duplicate issue reported by customer..."
              rows={3}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !targetTicketId}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Merge"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
