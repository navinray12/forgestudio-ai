import React, { useState } from "react";
import { GitBranch, X, Loader2 } from "lucide-react";
import { ticketService } from "../services/ticketService";
import type { SupportTicket, SupportCategory } from "../types/support.types";

interface TicketSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceTicket: SupportTicket;
  categories: SupportCategory[];
  onSplitSuccess: () => void;
}

export const TicketSplitModal: React.FC<TicketSplitModalProps> = ({
  isOpen,
  onClose,
  sourceTicket,
  categories,
  onSplitSuccess,
}) => {
  const [subject, setSubject] = useState(`[Split from ${sourceTicket.ticketNumber}] `);
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(sourceTicket.categoryId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      setError("Subject and description are required for the new ticket.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await ticketService.splitTicket(sourceTicket.id, {
        subject: subject.trim(),
        description: description.trim(),
        categoryId,
      });
      onSplitSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to split ticket");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-semibold text-slate-100">Split Ticket {sourceTicket.ticketNumber}</h3>
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
            <label className="block text-xs font-medium text-slate-400 mb-1">New Ticket Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Separate Issue Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the secondary issue being split out into a new ticket..."
              rows={4}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
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
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Split Ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
