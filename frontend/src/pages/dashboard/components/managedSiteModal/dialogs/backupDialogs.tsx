import React from "react";
import { AlertCircle, Archive, Edit3, RotateCcw, Trash2, X } from "lucide-react";

/** What renderBackupDialogs reads: the ManagedSiteModal values and callbacks the inline JSX used. */
export interface BackupDialogsDeps {
  actionLoading: boolean;
  createBackupModalOpen: boolean;
  deleteBackupConfirmOpen: boolean;
  deleteTargetBackup: any;
  handleCreateBackup: (e: React.FormEvent<Element>) => Promise<void>;
  handleDeleteBackup: () => Promise<void>;
  handleRenameBackup: (e: React.FormEvent<Element>) => Promise<void>;
  handleRestoreBackup: () => Promise<void>;
  newBackupLabel: string;
  newBackupNotes: string;
  renameBackupModalOpen: boolean;
  renameLabel: string;
  renameNotes: string;
  restoreConfirmModalOpen: boolean;
  restoreTargetBackup: any;
  setCreateBackupModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setDeleteBackupConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setDeleteTargetBackup: React.Dispatch<any>;
  setNewBackupLabel: React.Dispatch<React.SetStateAction<string>>;
  setNewBackupNotes: React.Dispatch<React.SetStateAction<string>>;
  setRenameBackupModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setRenameLabel: React.Dispatch<React.SetStateAction<string>>;
  setRenameNotes: React.Dispatch<React.SetStateAction<string>>;
  setRestoreConfirmModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setRestoreTargetBackup: React.Dispatch<any>;
  targetBackup: any;
}

/**
 * Backup dialogs: create, rename, restore and delete confirmations.
 * Moved verbatim from ManagedSiteModal.tsx's JSX return (lines 4354-4551 before the move). A plain
 * function, not a component: ManagedSiteModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderBackupDialogs({
  actionLoading,
  createBackupModalOpen,
  deleteBackupConfirmOpen,
  deleteTargetBackup,
  handleCreateBackup,
  handleDeleteBackup,
  handleRenameBackup,
  handleRestoreBackup,
  newBackupLabel,
  newBackupNotes,
  renameBackupModalOpen,
  renameLabel,
  renameNotes,
  restoreConfirmModalOpen,
  restoreTargetBackup,
  setCreateBackupModalOpen,
  setDeleteBackupConfirmOpen,
  setDeleteTargetBackup,
  setNewBackupLabel,
  setNewBackupNotes,
  setRenameBackupModalOpen,
  setRenameLabel,
  setRenameNotes,
  setRestoreConfirmModalOpen,
  setRestoreTargetBackup,
  targetBackup,
}: BackupDialogsDeps): React.ReactNode {
  return (
        <>
        {createBackupModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Archive className="w-4 h-4 text-blue-400" />
                  Create Manual Snapshot
                </h4>
                <button onClick={() => setCreateBackupModalOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleCreateBackup} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Snapshot Label</label>
                  <input
                    type="text"
                    required
                    value={newBackupLabel}
                    onChange={(e) => setNewBackupLabel(e.target.value)}
                    placeholder="e.g. Pre-Redesign Snapshot"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Notes (Optional)</label>
                  <textarea
                    rows={2}
                    value={newBackupNotes}
                    onChange={(e) => setNewBackupNotes(e.target.value)}
                    placeholder="Summary of changes or purpose for this backup..."
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCreateBackupModalOpen(false)}
                    className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {actionLoading ? "Creating..." : "Save Snapshot"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: RENAME SNAPSHOT */}
        {renameBackupModalOpen && targetBackup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-blue-400" />
                  Rename Snapshot Details
                </h4>
                <button onClick={() => setRenameBackupModalOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleRenameBackup} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Snapshot Label</label>
                  <input
                    type="text"
                    required
                    value={renameLabel}
                    onChange={(e) => setRenameLabel(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Notes</label>
                  <textarea
                    rows={2}
                    value={renameNotes}
                    onChange={(e) => setRenameNotes(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRenameBackupModalOpen(false)}
                    className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {actionLoading ? "Updating..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: RESTORE CONFIRMATION */}
        {restoreConfirmModalOpen && restoreTargetBackup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <RotateCcw className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Restore Website Snapshot</h4>
                  <p className="text-xs text-slate-400">Rollback to "{restoreTargetBackup.label}"</p>
                </div>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  Pre-Restore Safety Guaranteed
                </div>
                <p className="text-[11px] text-amber-300/80">
                  A new safety snapshot will automatically be taken before this restore executes, ensuring you can undo this rollback at any time.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setRestoreConfirmModalOpen(false);
                    setRestoreTargetBackup(null);
                  }}
                  className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRestoreBackup}
                  disabled={actionLoading}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {actionLoading ? "Restoring..." : "Confirm & Restore"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: DELETE BACKUP CONFIRMATION */}
        {deleteBackupConfirmOpen && deleteTargetBackup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Delete Snapshot</h4>
                  <p className="text-xs text-slate-400">Permanently delete "{deleteTargetBackup.label}"</p>
                </div>
              </div>

              <p className="text-xs text-slate-400">
                Are you sure you want to delete this backup snapshot? This action is permanent and cannot be undone.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteBackupConfirmOpen(false);
                    setDeleteTargetBackup(null);
                  }}
                  className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteBackup}
                  disabled={actionLoading}
                  className="rounded-lg bg-red-600 hover:bg-red-500 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {actionLoading ? "Deleting..." : "Delete Snapshot"}
                </button>
              </div>
            </div>
          </div>
        )}
        </>
  );
}
