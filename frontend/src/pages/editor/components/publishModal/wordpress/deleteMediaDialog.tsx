import React from "react";

/** What renderDeleteMediaDialog reads: the PublishModal values and callbacks the inline JSX used. */
export interface DeleteMediaDialogDeps {
  deleteMediaForceOption: boolean;
  handleDeleteMediaItem: (mediaId: number, force: boolean) => Promise<void>;
  isDeletingMediaId: number | null;
  setDeleteMediaForceOption: React.Dispatch<React.SetStateAction<boolean>>;
  setShowDeleteMediaModal: React.Dispatch<React.SetStateAction<number | null>>;
  showDeleteMediaModal: number | null;
}

/**
 * WordPress media delete confirmation dialog (trash / permanent).
 * Moved verbatim from PublishModal.tsx's JSX return (lines 3226-3267 before the move). A plain
 * function, not a component: PublishModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderDeleteMediaDialog({
  deleteMediaForceOption,
  handleDeleteMediaItem,
  isDeletingMediaId,
  setDeleteMediaForceOption,
  setShowDeleteMediaModal,
  showDeleteMediaModal,
}: DeleteMediaDialogDeps): React.ReactNode {
  return (
                  showDeleteMediaModal && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
                      <div className="w-full max-w-md rounded-2xl border border-rose-900/40 bg-slate-900 p-6 shadow-2xl space-y-4">
                        <div className="flex items-center gap-3 text-rose-400">
                          <span className="text-2xl">🗑️</span>
                          <h3 className="text-base font-extrabold text-white">Delete WordPress Media Attachment?</h3>
                        </div>
                        <p className="text-xs text-slate-300">
                          Are you sure you want to delete media item <strong className="text-white">#{showDeleteMediaModal}</strong> from the connected WordPress site?
                        </p>
                        <div className="flex items-center gap-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                          <input
                            type="checkbox"
                            id="deleteForceMediaCheck"
                            checked={deleteMediaForceOption}
                            onChange={(e) => setDeleteMediaForceOption(e.target.checked)}
                            className="rounded border-slate-700 bg-slate-800 text-rose-600 focus:ring-rose-500"
                          />
                          <label htmlFor="deleteForceMediaCheck" className="text-xs text-slate-300 font-semibold cursor-pointer">
                            Force permanent deletion (bypass WordPress trash)
                          </label>
                        </div>
                        <div className="flex items-center justify-end gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => setShowDeleteMediaModal(null)}
                            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMediaItem(showDeleteMediaModal, deleteMediaForceOption)}
                            disabled={Boolean(isDeletingMediaId)}
                            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-lg shadow-rose-600/30 transition disabled:opacity-50 cursor-pointer"
                          >
                            {isDeletingMediaId === showDeleteMediaModal ? "Deleting..." : "Confirm Delete"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
  );
}
