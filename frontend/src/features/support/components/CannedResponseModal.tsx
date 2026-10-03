import React, { useState, useEffect } from "react";
import { Search, Zap, X, Check } from "lucide-react";
import { ticketService } from "../services/ticketService";
import type { SupportCannedResponse, SupportTicket } from "../types/support.types";

interface CannedResponseModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket?: SupportTicket;
  onSelectResponse: (interpolatedText: string) => void;
}

export const CannedResponseModal: React.FC<CannedResponseModalProps> = ({
  isOpen,
  onClose,
  ticket,
  onSelectResponse,
}) => {
  const [cannedResponses, setCannedResponses] = useState<SupportCannedResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      ticketService
        .getCannedResponses(ticket?.categoryId)
        .then((res) => {
          setCannedResponses(res.cannedResponses || []);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [isOpen, ticket?.categoryId]);

  if (!isOpen) return null;

  const filtered = cannedResponses.filter(
    (c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.shortcut.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (template: string) => {
    let result = template;
    result = result.replace(/\{\{\s*customer_name\s*\}\}/g, ticket?.user?.fullName || "Valued Customer");
    result = result.replace(/\{\{\s*ticket_number\s*\}\}/g, ticket?.ticketNumber || "Ticket");
    result = result.replace(/\{\{\s*website_name\s*\}\}/g, ticket?.website?.name || "Website");
    result = result.replace(/\{\{\s*workspace_name\s*\}\}/g, ticket?.workspace?.name || "Workspace");
    result = result.replace(/\{\{\s*agent_name\s*\}\}/g, "Support Team");
    onSelectResponse(result);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-semibold text-slate-100">Insert Canned Response</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates by title or shortcut (e.g., wp-rest)..."
            className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          />
        </div>

        <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <p className="text-xs text-slate-500 text-center py-6">Loading canned responses...</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">No matching canned responses found.</p>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelect(item.content)}
                className="p-3 bg-slate-950/50 hover:bg-slate-800/80 border border-slate-800/80 rounded-xl cursor-pointer transition-all group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-slate-200 group-hover:text-amber-300">{item.title}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-400">/{item.shortcut}</span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2">{item.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
