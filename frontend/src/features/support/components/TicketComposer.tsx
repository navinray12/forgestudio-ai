import React, { useState } from "react";
import { Send, Lock, Paperclip, Loader2 } from "lucide-react";

export interface TicketComposerProps {
  isStaff: boolean;
  submitting: boolean;
  onSend: (content: string, type: "PUBLIC_REPLY" | "INTERNAL_NOTE") => Promise<void>;
  onUploadAttachment?: (file: File) => Promise<void>;
}

export const TicketComposer: React.FC<TicketComposerProps> = ({
  isStaff,
  submitting,
  onSend,
  onUploadAttachment,
}) => {
  const [content, setContent] = useState("");
  const [type, setType] = useState<"PUBLIC_REPLY" | "INTERNAL_NOTE">("PUBLIC_REPLY");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    try {
      setError(null);
      await onSend(content.trim(), type);

      if (selectedFile && onUploadAttachment) {
        await onUploadAttachment(selectedFile);
        setSelectedFile(null);
      }

      setContent("");
    } catch (err: any) {
      setError(err.message || "Failed to submit message");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
      {isStaff && (
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            type="button"
            onClick={() => setType("PUBLIC_REPLY")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              type === "PUBLIC_REPLY"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Public Reply (Customer)
          </button>
          <button
            type="button"
            onClick={() => setType("INTERNAL_NOTE")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              type === "INTERNAL_NOTE"
                ? "bg-amber-600 text-white shadow-lg shadow-amber-500/20"
                : "text-amber-400 hover:text-amber-300"
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            Internal Note (Staff Only)
          </button>
        </div>
      )}

      {error && (
        <div className="p-2.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          {error}
        </div>
      )}

      <div className="relative">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            type === "INTERNAL_NOTE"
              ? "Type an internal note visible only to support agents..."
              : "Type your reply to the customer..."
          }
          rows={4}
          className={`w-full bg-slate-950/70 border rounded-lg p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
            type === "INTERNAL_NOTE"
              ? "border-amber-500/40 focus:ring-amber-500/30"
              : "border-slate-800 focus:ring-blue-500/30"
          }`}
        />
      </div>

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-all">
            <Paperclip className="w-3.5 h-3.5 text-slate-400" />
            <span>{selectedFile ? selectedFile.name : "Attach File"}</span>
            <input type="file" onChange={handleFileChange} className="hidden" />
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting || !content.trim()}
          className={`inline-flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-50 ${
            type === "INTERNAL_NOTE"
              ? "bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-500/20"
              : "bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20"
          }`}
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <span>{type === "INTERNAL_NOTE" ? "Save Internal Note" : "Send Reply"}</span>
              <Send className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>
    </form>
  );
};
