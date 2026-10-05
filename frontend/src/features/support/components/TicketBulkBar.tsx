import React, { useState } from "react";
import { CheckSquare, UserCheck, ShieldAlert, CheckCircle, Tag, X, Loader2 } from "lucide-react";
import { ticketService } from "../services/ticketService";

interface TicketBulkBarProps {
  selectedTicketIds: string[];
  onClearSelection: () => void;
  onBulkSuccess: () => void;
}

export const TicketBulkBar: React.FC<TicketBulkBarProps> = ({
  selectedTicketIds,
  onClearSelection,
  onBulkSuccess,
}) => {
  const [submitting, setSubmitting] = useState(false);

  if (selectedTicketIds.length === 0) return null;

  const handleBulkAction = async (
    action: "ASSIGN" | "CHANGE_STATUS" | "CHANGE_PRIORITY" | "CLOSE" | "RESOLVE",
    payload: any
  ) => {
    try {
      setSubmitting(true);
      await ticketService.bulkUpdate({
        ticketIds: selectedTicketIds,
        action,
        payload,
      });
      onBulkSuccess();
      onClearSelection();
    } catch (err: any) {
      alert(err.message || "Failed to perform bulk action");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 border border-purple-500/40 backdrop-blur-md px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 text-xs">
      <div className="flex items-center gap-2 text-purple-300 font-semibold border-r border-slate-800 pr-4">
        <CheckSquare className="w-4 h-4 text-purple-400" />
        <span>{selectedTicketIds.length} tickets selected</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => handleBulkAction("CHANGE_STATUS", { status: "IN_PROGRESS" })}
          disabled={submitting}
          className="px-3 py-1.5 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-white font-medium flex items-center gap-1.5"
        >
          {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Mark In Progress"}
        </button>

        <button
          onClick={() => handleBulkAction("RESOLVE", {})}
          disabled={submitting}
          className="px-3 py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white font-medium flex items-center gap-1.5"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          Resolve Selected
        </button>

        <button
          onClick={() => handleBulkAction("CLOSE", {})}
          disabled={submitting}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
        >
          Close
        </button>

        <select
          onChange={(e) => {
            if (e.target.value) {
              handleBulkAction("CHANGE_PRIORITY", { priority: e.target.value });
            }
          }}
          defaultValue=""
          className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
        >
          <option value="" disabled>Set Priority...</option>
          <option value="CRITICAL">🔴 Critical</option>
          <option value="URGENT">🟠 Urgent</option>
          <option value="HIGH">🟡 High</option>
          <option value="NORMAL">🔵 Normal</option>
          <option value="LOW">⚪ Low</option>
        </select>
      </div>

      <button
        onClick={onClearSelection}
        className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 ml-2"
        title="Deselect all"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
