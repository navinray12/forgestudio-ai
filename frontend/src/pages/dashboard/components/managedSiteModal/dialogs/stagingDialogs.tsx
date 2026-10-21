import React from "react";
import { Trash2, Zap } from "lucide-react";

/** What renderStagingDialogs reads: the ManagedSiteModal values and callbacks the inline JSX used. */
export interface StagingDialogsDeps {
  deleteStagingConfirmModalOpen: boolean;
  handleDeleteStaging: () => Promise<void>;
  handlePromoteStaging: () => Promise<void>;
  promoteConfirmModalOpen: boolean;
  setDeleteStagingConfirmModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setPromoteConfirmModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  stagingActionLoading: boolean;
}

/**
 * Staging dialogs: promote-to-production and delete-staging confirmations.
 * Moved verbatim from ManagedSiteModal.tsx's JSX return (lines 4553-4632 before the move). A plain
 * function, not a component: ManagedSiteModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderStagingDialogs({
  deleteStagingConfirmModalOpen,
  handleDeleteStaging,
  handlePromoteStaging,
  promoteConfirmModalOpen,
  setDeleteStagingConfirmModalOpen,
  setPromoteConfirmModalOpen,
  stagingActionLoading,
}: StagingDialogsDeps): React.ReactNode {
  return (
        <>
        {promoteConfirmModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Promote Staging to Live Production</h4>
                  <p className="text-xs text-slate-400">Publish current sandbox changes</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                This will copy the current staging pages, styles, and configurations to your live production website and trigger an instant release.
              </p>

              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                <span className="font-bold">Automated Safeguard:</span> A pre-publish backup of live production will automatically be captured prior to deployment.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPromoteConfirmModalOpen(false)}
                  className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePromoteStaging}
                  disabled={stagingActionLoading}
                  className="rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {stagingActionLoading ? "Publishing to Live..." : "Confirm & Push to Production"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: DELETE STAGING CONFIRMATION */}
        {deleteStagingConfirmModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Delete Staging Sandbox</h4>
                  <p className="text-xs text-slate-400">Tear down staging environment</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Are you sure you want to destroy this staging sandbox? The isolated preview URL and unpublished sandbox drafts will be deleted. Your live production website will NOT be affected.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteStagingConfirmModalOpen(false)}
                  className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteStaging}
                  disabled={stagingActionLoading}
                  className="rounded-lg bg-red-600 hover:bg-red-500 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {stagingActionLoading ? "Deleting..." : "Destroy Sandbox"}
                </button>
              </div>
            </div>
          </div>
        )}
        </>
  );
}
