import React, { useState } from "react";
import { Star, X, Send, Loader2 } from "lucide-react";
import { ticketService } from "../services/ticketService";
import type { SupportTicket } from "../types/support.types";

interface CsatRatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: SupportTicket;
  onSuccess: () => void;
}

export const CsatRatingModal: React.FC<CsatRatingModalProps> = ({
  isOpen,
  onClose,
  ticket,
  onSuccess,
}) => {
  const [score, setScore] = useState<number>(5);
  const [hoverScore, setHoverScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      await ticketService.submitCsat(ticket.id, score, comment);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to submit rating");
    } finally {
      setSubmitting(false);
    }
  };

  const activeRating = hoverScore || score;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
            <h3 className="text-base font-semibold text-slate-100">Rate Your Support Experience</h3>
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

        <form onSubmit={handleSubmit} className="space-y-4 text-center">
          <p className="text-xs text-slate-400">
            How satisfied were you with the resolution of ticket <span className="font-semibold text-slate-200">{ticket.ticketNumber}</span>?
          </p>

          <div className="flex items-center justify-center gap-2 py-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setScore(star)}
                onMouseEnter={() => setHoverScore(star)}
                onMouseLeave={() => setHoverScore(null)}
                className="p-1.5 transition-transform transform hover:scale-125 focus:outline-none"
              >
                <Star
                  className={`w-8 h-8 ${
                    star <= activeRating
                      ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                      : "text-slate-700"
                  }`}
                />
              </button>
            ))}
          </div>

          <p className="text-xs font-semibold text-amber-400">
            {activeRating === 5 && "Excellent! 🌟"}
            {activeRating === 4 && "Good 👍"}
            {activeRating === 3 && "Okay 😐"}
            {activeRating === 2 && "Needs Improvement 👎"}
            {activeRating === 1 && "Unsatisfied 😞"}
          </p>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share additional feedback on your agent or resolution (optional)..."
            rows={3}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-left"
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-800"
            >
              Skip
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Submit Feedback <Send className="w-3.5 h-3.5" /></>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
