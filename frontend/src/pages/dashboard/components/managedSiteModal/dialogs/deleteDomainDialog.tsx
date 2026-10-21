import React from "react";
import { Globe } from "lucide-react";

/** What renderDeleteDomainDialog reads: the ManagedSiteModal values and callbacks the inline JSX used. */
export interface DeleteDomainDialogDeps {
  actionLoading: boolean;
  deleteDomainConfirmOpen: boolean;
  deleteDomainTarget: string | null;
  handleDeleteDomain: () => Promise<void>;
  setDeleteDomainConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setDeleteDomainTarget: React.Dispatch<React.SetStateAction<string | null>>;
}

/**
 * Custom domain delete confirmation dialog.
 * Moved verbatim from ManagedSiteModal.tsx's JSX return (lines 4634-4673 before the move). A plain
 * function, not a component: ManagedSiteModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderDeleteDomainDialog({
  actionLoading,
  deleteDomainConfirmOpen,
  deleteDomainTarget,
  handleDeleteDomain,
  setDeleteDomainConfirmOpen,
  setDeleteDomainTarget,
}: DeleteDomainDialogDeps): React.ReactNode {
  return (
        deleteDomainConfirmOpen && deleteDomainTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
                  <Globe className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Disconnect Custom Domain</h4>
                  <p className="text-xs text-slate-400 font-mono">{deleteDomainTarget}</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Are you sure you want to disconnect this domain? Visitors navigating to <span className="font-mono text-white">{deleteDomainTarget}</span> will no longer be routed to this website.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteDomainConfirmOpen(false);
                    setDeleteDomainTarget(null);
                  }}
                  className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteDomain}
                  disabled={actionLoading}
                  className="rounded-lg bg-red-600 hover:bg-red-500 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {actionLoading ? "Disconnecting..." : "Disconnect Domain"}
                </button>
              </div>
            </div>
          </div>
        )
  );
}
