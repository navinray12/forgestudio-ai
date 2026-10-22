import React from "react";
import type { PublishingState } from "../../../types";

/** What renderModalFooter reads: the PublishModal values and callbacks the inline JSX used. */
export interface ModalFooterDeps {
  onClose: () => void;
  onOpenPreview: () => void;
  publishing: PublishingState;
  websiteId: string | undefined;
}

/**
 * Modal footer: save feedback, live-site link and the close action.
 * Moved verbatim from PublishModal.tsx's JSX return (lines 3525-3557 before the move). A plain
 * function, not a component: PublishModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderModalFooter({
  onClose,
  onOpenPreview,
  publishing,
  websiteId,
}: ModalFooterDeps): React.ReactNode {
  return (
        <div className="border-t border-slate-800 bg-slate-950/60 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenPreview();
              }}
              className="text-xs font-bold text-blue-400 hover:text-blue-300 transition cursor-pointer flex items-center gap-1"
            >
              <span>👁️</span>
              <span>Open Interactive Preview</span>
            </button>
            {publishing.status === "PUBLISHED" && Boolean(publishing.publishedAt) && Boolean(websiteId) && (
              <a
                href={`/site/${websiteId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition flex items-center gap-1"
              >
                <span>🌐</span>
                <span>Visit Live Site ↗</span>
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-700 transition cursor-pointer"
          >
            Close
          </button>
        </div>
  );
}
