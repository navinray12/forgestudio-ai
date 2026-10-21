import React from "react";
import { RefreshCw, RotateCcw, Sparkles } from "lucide-react";

/** What renderRollbackConfirmDialog reads: the ManagedSiteModal values and callbacks the inline JSX used. */
export interface RollbackConfirmDialogDeps {
  handleInstantRollback: (releaseId: string) => Promise<void>;
  rollbackConfirmOpen: boolean;
  rollbackLoading: boolean;
  rollbackTargetRelease: any;
  setRollbackConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setRollbackTargetRelease: React.Dispatch<any>;
}

/**
 * Instant rollback confirmation dialog (deployments tab).
 * Moved verbatim from ManagedSiteModal.tsx's JSX return (lines 4737-4809 before the move). A plain
 * function, not a component: ManagedSiteModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderRollbackConfirmDialog({
  handleInstantRollback,
  rollbackConfirmOpen,
  rollbackLoading,
  rollbackTargetRelease,
  setRollbackConfirmOpen,
  setRollbackTargetRelease,
}: RollbackConfirmDialogDeps): React.ReactNode {
  return (
        rollbackConfirmOpen && rollbackTargetRelease && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Instant Zero-Downtime Rollback</h3>
                  <p className="text-xs text-slate-400">Atomic pointer swap to previous release</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">Target Release:</span>
                  <span className="font-mono font-bold text-white">{rollbackTargetRelease.releaseId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Notes:</span>
                  <span className="text-slate-200">{rollbackTargetRelease.notes || "Version release"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Created:</span>
                  <span>{new Date(rollbackTargetRelease.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Environment:</span>
                  <span className="font-semibold text-indigo-400">{rollbackTargetRelease.environment}</span>
                </div>
              </div>

              <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/30 p-3 text-[11px] text-indigo-300 flex items-start gap-2">
                <Sparkles className="w-4 h-4 shrink-0 text-indigo-400 mt-0.5" />
                <span>
                  <strong>Zero Downtime Guaranteed:</strong> The public site router instantly repoints traffic in &lt;100ms. No build process is triggered and working editor drafts remain unaffected.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setRollbackConfirmOpen(false);
                    setRollbackTargetRelease(null);
                  }}
                  disabled={rollbackLoading}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleInstantRollback(rollbackTargetRelease.releaseId)}
                  disabled={rollbackLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
                >
                  {rollbackLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Swapping Pointer...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Confirm Rollback</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )
  );
}
