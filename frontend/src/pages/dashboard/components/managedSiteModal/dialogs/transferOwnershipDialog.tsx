import React from "react";
import { ArrowRightLeft } from "lucide-react";

/** What renderTransferOwnershipDialog reads: the ManagedSiteModal values and callbacks the inline JSX used. */
export interface TransferOwnershipDialogDeps {
  handleTransferOwnership: () => Promise<void>;
  setTransferConfirmName: React.Dispatch<React.SetStateAction<string>>;
  setTransferModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  transferConfirmName: string;
  transferEmail: string;
  transferModalOpen: boolean;
  transferring: boolean;
  website: { id: string; name: string; slug: string; status: string; wpConnection?: { id: string; siteUrl: string; wpSiteName?: string | null | undefined; status: string; lastVerifiedAt?: string | null | undefined; } | null | undefined; };
}

/**
 * Website ownership transfer dialog (logs & transfer tab).
 * Moved verbatim from ManagedSiteModal.tsx's JSX return (lines 4675-4735 before the move). A plain
 * function, not a component: ManagedSiteModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderTransferOwnershipDialog({
  handleTransferOwnership,
  setTransferConfirmName,
  setTransferModalOpen,
  transferConfirmName,
  transferEmail,
  transferModalOpen,
  transferring,
  website,
}: TransferOwnershipDialogDeps): React.ReactNode {
  return (
        transferModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-slate-900 p-6 text-slate-100 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
                  <ArrowRightLeft className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Transfer Website Ownership</h4>
                  <p className="text-xs text-red-400">Irreversible Account Delegation</p>
                </div>
              </div>

              <div className="rounded-xl border border-red-500/20 bg-red-950/20 p-3 text-xs text-slate-300 space-y-2">
                <p>
                  You are transferring ownership of <strong>{website.name}</strong> to:
                </p>
                <p className="font-mono font-bold text-white text-sm bg-slate-950 p-2 rounded border border-slate-800 truncate">
                  {transferEmail}
                </p>
                <p className="text-[11px] text-red-300">
                  Once confirmed, this website will disappear from your dashboard and belong to the recipient.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Type <span className="font-mono text-white font-bold">{website.name}</span> to confirm:
                </label>
                <input
                  type="text"
                  value={transferConfirmName}
                  onChange={(e) => setTransferConfirmName(e.target.value)}
                  placeholder={website.name}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-red-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setTransferModalOpen(false);
                    setTransferConfirmName("");
                  }}
                  className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3.5 py-1.5 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleTransferOwnership}
                  disabled={transferring || transferConfirmName.trim() !== website.name}
                  className="rounded-lg bg-red-600 hover:bg-red-500 px-4 py-1.5 text-xs font-semibold text-white transition disabled:opacity-40"
                >
                  {transferring ? "Transferring..." : "Confirm & Transfer Ownership"}
                </button>
              </div>
            </div>
          </div>
        )
  );
}
