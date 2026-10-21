import React from "react";

/** What renderDisconnectConfirmDialog reads: the PublishModal values and callbacks the inline JSX used. */
export interface DisconnectConfirmDialogDeps {
  confirmDisconnect: () => Promise<void>;
  isDisconnectingWp: boolean;
  setShowDisconnectConfirm: React.Dispatch<React.SetStateAction<boolean>>;
  showDisconnectConfirm: boolean;
}

/**
 * WordPress disconnect confirmation dialog (shown while showDisconnectConfirm).
 * Moved verbatim from PublishModal.tsx's JSX return (lines 3560-3594 before the move). A plain
 * function, not a component: PublishModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderDisconnectConfirmDialog({
  confirmDisconnect,
  isDisconnectingWp,
  setShowDisconnectConfirm,
  showDisconnectConfirm,
}: DisconnectConfirmDialogDeps): React.ReactNode {
  return (
      showDisconnectConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-rose-900/40 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-base font-extrabold text-white">Disconnect WordPress Destination?</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              This will stop ForgeStudio from publishing or synchronizing pages with this WordPress site.
            </p>
            <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800 text-[11px] text-slate-300 space-y-1">
              <div className="font-bold text-emerald-400">Preserved Data Guarantee:</div>
              <div>• Your ForgeStudio pages, documents, and revisions remain completely safe.</div>
              <div>• Content already published to WordPress will NOT be deleted.</div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDisconnectConfirm(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDisconnect}
                disabled={isDisconnectingWp}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-lg shadow-rose-600/30 transition disabled:opacity-50 cursor-pointer"
              >
                {isDisconnectingWp ? "Disconnecting..." : "Confirm Disconnect"}
              </button>
            </div>
          </div>
        </div>
      )
  );
}
