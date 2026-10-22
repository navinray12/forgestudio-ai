import React from "react";
import { X } from "lucide-react";

/** What renderModalHeader reads: the ManagedSiteModal values and callbacks the inline JSX used. */
export interface ModalHeaderDeps {
  isWpConnected: boolean;
  onClose: () => void;
  website: { id: string; name: string; slug: string; status: string; wpConnection?: { id: string; siteUrl: string; wpSiteName?: string | null | undefined; status: string; lastVerifiedAt?: string | null | undefined; } | null | undefined; };
}

/**
 * Modal header: site name, status and close.
 * Moved verbatim from ManagedSiteModal.tsx's JSX return (lines 1555-1587 before the move). A plain
 * function, not a component: ManagedSiteModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderModalHeader({
  isWpConnected,
  onClose,
  website,
}: ModalHeaderDeps): React.ReactNode {
  return (
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold shadow-md shadow-blue-500/20">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">{website.name}</h2>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                  website.status === "PUBLISHED"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    : "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                }`}>
                  {website.status}
                </span>
                {isWpConnected && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    WP Linked
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">/{website.slug}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
  );
}
