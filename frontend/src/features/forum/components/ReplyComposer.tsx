import React, { useState } from "react";
import { Send, AtSign, Paperclip } from "lucide-react";

interface ReplyComposerProps {
  onSubmit: (content: string) => Promise<void>;
  placeholder?: string;
  parentPostId?: string;
  onCancel?: () => void;
}

export const ReplyComposer: React.FC<ReplyComposerProps> = ({
  onSubmit,
  placeholder = "Write a reply...",
  onCancel,
}) => {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(content);
      setContent("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="my-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-md">
      <textarea
        rows={3}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-800/60 border border-slate-700/80 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none"
      />

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center space-x-2 text-slate-400">
          <button type="button" className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-slate-200 transition-colors" title="Mention user">
            <AtSign className="w-4 h-4" />
          </button>
          <button type="button" className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-slate-200 transition-colors" title="Attach file">
            <Paperclip className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 font-medium transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={!content.trim() || isSubmitting}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center space-x-1.5 transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSubmitting ? "Posting..." : "Post Reply"}</span>
          </button>
        </div>
      </div>
    </form>
  );
};
