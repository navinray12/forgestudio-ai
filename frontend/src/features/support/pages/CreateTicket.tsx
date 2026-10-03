import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LifeBuoy, ArrowLeft, Send, Loader2, AlertCircle } from "lucide-react";
import { ticketService } from "../services/ticketService";
import type { SupportCategory } from "../types/support.types";

export const CreateTicketPage: React.FC = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<SupportCategory[]>([]);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ticketService
      .getCategories()
      .then((res) => {
        setCategories(res.categories);
        if (res.categories.length > 0) {
          setCategoryId(res.categories[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim() || !categoryId) {
      setError("Please fill out all required fields.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Automatic client browser & OS context capture
      const contextData = {
        browser: navigator.userAgent.includes("Chrome")
          ? "Chrome"
          : navigator.userAgent.includes("Firefox")
          ? "Firefox"
          : navigator.userAgent.includes("Safari")
          ? "Safari"
          : "Other Browser",
        os: navigator.platform,
        url: window.location.href,
        submittedAt: new Date().toISOString(),
      };

      const res = await ticketService.createTicket({
        subject: subject.trim(),
        description: description.trim(),
        categoryId,
        priority,
        contextData,
      });

      navigate(`/support/tickets/${res.ticket.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to create support ticket.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Support</span>
      </button>

      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-5 mb-6">
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <LifeBuoy className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">Submit a Support Ticket</h1>
            <p className="text-xs text-slate-400">
              Describe your problem or question. Our support team will assist you shortly.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Category <span className="text-red-400">*</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="LOW">Low — Minor question</option>
                <option value="NORMAL">Normal — Standard issue</option>
                <option value="HIGH">High — Important issue</option>
                <option value="URGENT">Urgent — Severe impact</option>
                <option value="CRITICAL">Critical — System outage / Blocker</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Subject <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of the issue..."
              maxLength={255}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide detailed information, steps to reproduce, or any error messages..."
              rows={6}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-lg p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Submit Ticket</span>
                  <Send className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
