import React from "react";

/** What renderRollbackPanel reads: the PublishModal values and callbacks the inline JSX used. */
export interface RollbackPanelDeps {
  handleExecuteRollback: () => Promise<void>;
  isLoadingRollbackTargets: boolean;
  isRollingBackWpPage: boolean;
  loadWpPagePublishStatus: (pageId?: string | undefined) => Promise<void>;
  loadWpRollbackTargets: (pageId?: string | undefined) => Promise<void>;
  selectedRollbackTarget: any;
  setSelectedRollbackTarget: React.Dispatch<any>;
  setShowRollbackConfirm: React.Dispatch<React.SetStateAction<boolean>>;
  showRollbackConfirm: boolean;
  wpRollbackError: string | null;
  wpRollbackResult: any;
  wpRollbackStep: string;
  wpRollbackTargets: any[];
}

/**
 * WordPress publish rollback panel (F-497): progress, result, history and confirmation.
 * Moved verbatim from PublishModal.tsx's JSX return (lines 2341-2505 before the move). A plain
 * function, not a component: PublishModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderRollbackPanel({
  handleExecuteRollback,
  isLoadingRollbackTargets,
  isRollingBackWpPage,
  loadWpPagePublishStatus,
  loadWpRollbackTargets,
  selectedRollbackTarget,
  setSelectedRollbackTarget,
  setShowRollbackConfirm,
  showRollbackConfirm,
  wpRollbackError,
  wpRollbackResult,
  wpRollbackStep,
  wpRollbackTargets,
}: RollbackPanelDeps): React.ReactNode {
  return (
                  <div className="rounded-xl border border-purple-900/50 bg-slate-900/90 p-4 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div>
                        <h4 className="text-xs font-black text-white uppercase tracking-wide flex items-center gap-1.5">
                          <span>⏪</span> WordPress Publish History & Rollback (F-497)
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Restore a previously successful publish snapshot to WordPress without changing remote page ID or breaking public URLs.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => loadWpRollbackTargets()}
                        disabled={isLoadingRollbackTargets}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-bold transition cursor-pointer"
                      >
                        🔄 Refresh History
                      </button>
                    </div>

                    {/* Progress Bar during Rollback */}
                    {isRollingBackWpPage && (
                      <div className="p-3.5 rounded-lg bg-purple-950/40 border border-purple-800/50 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-purple-300">
                          <span className="flex items-center gap-2">
                            <span className="animate-spin text-purple-400">⏳</span> {wpRollbackStep}
                          </span>
                          <span className="text-[10px] text-purple-400 font-mono">Processing Rollback</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500 animate-pulse w-3/4 rounded-full"></div>
                        </div>
                      </div>
                    )}

                    {/* Rollback Error Display */}
                    {wpRollbackError && (
                      <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/50 text-rose-300 text-xs space-y-2">
                        <div className="font-extrabold text-rose-200 flex items-center gap-1">
                          <span>❌ Rollback Error:</span>
                        </div>
                        <div className="font-mono text-[11px] text-rose-300">{wpRollbackError}</div>
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => loadWpPagePublishStatus()}
                            className="px-2.5 py-1 bg-rose-900 hover:bg-rose-800 border border-rose-700 text-white font-bold rounded text-[10px] transition cursor-pointer"
                          >
                            Check Status
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Rollback Success Display */}
                    {wpRollbackResult && (
                      <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-extrabold text-emerald-200 flex items-center gap-1.5">
                            <span>✅ Rollback Executed Successfully!</span>
                            <span className="px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 text-[10px] font-mono uppercase">
                              RESTORED (WP ID: {wpRollbackResult.wordpressPageId})
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(wpRollbackResult.publishedAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-300">
                          Status: <span className="text-emerald-400 font-bold">{wpRollbackResult.status}</span> | URL: {wpRollbackResult.url}
                        </div>
                      </div>
                    )}

                    {/* History List */}
                    {isLoadingRollbackTargets ? (
                      <div className="py-6 text-center text-xs text-slate-400 italic">
                        Loading publish history & snapshots...
                      </div>
                    ) : wpRollbackTargets.length === 0 ? (
                      <div className="py-4 text-center text-xs text-slate-500 bg-slate-950/40 rounded-lg border border-slate-800">
                        No previous published snapshots found for this page. Publish a version first to enable rollback targets.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {wpRollbackTargets.map((target, idx) => (
                          <div
                            key={target.snapshotId || idx}
                            className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-slate-700 flex items-center justify-between gap-3 text-xs transition"
                          >
                            <div className="space-y-1 truncate">
                              <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 rounded bg-purple-950 border border-purple-800/60 text-purple-300 font-mono text-[10px] font-black">
                                  v{target.sourceVersion}
                                </span>
                                <span className="font-bold text-slate-200 truncate">{target.title}</span>
                                {idx === 0 && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[9px] font-black uppercase">
                                    Latest Publish
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-3">
                                <span>📅 {new Date(target.publishedAt).toLocaleString()}</span>
                                <span>🧩 {target.elementCount || 0} Elements</span>
                                <span>🔗 /{target.slug}</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedRollbackTarget(target);
                                setShowRollbackConfirm(true);
                              }}
                              disabled={isRollingBackWpPage}
                              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] shadow transition disabled:opacity-50 cursor-pointer shrink-0"
                            >
                              Rollback to v{target.sourceVersion}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Confirmation Modal */}
                    {showRollbackConfirm && selectedRollbackTarget && (
                      <div className="p-3.5 rounded-xl bg-purple-950/80 border border-purple-700 space-y-3 shadow-2xl">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-black text-purple-200 uppercase tracking-wide flex items-center gap-1.5">
                            <span>⚠️</span> Confirm WordPress Rollback
                          </h5>
                          <button
                            type="button"
                            onClick={() => setShowRollbackConfirm(false)}
                            className="text-slate-400 hover:text-white text-xs font-bold"
                          >
                            ✕
                          </button>
                        </div>
                        <p className="text-xs text-slate-300">
                          Are you sure you want to restore <strong className="text-white">v{selectedRollbackTarget.sourceVersion}</strong> ({new Date(selectedRollbackTarget.publishedAt).toLocaleString()}) to WordPress?
                        </p>
                        <div className="p-2 rounded bg-purple-900/40 text-[11px] text-purple-300 font-mono">
                          This action will overwrite live WordPress page content (WP ID {selectedRollbackTarget.wordpressPageId}). Your current working draft in ForgeStudio will remain intact.
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setShowRollbackConfirm(false)}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleExecuteRollback}
                            disabled={isRollingBackWpPage}
                            className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-black shadow-lg shadow-purple-600/30 transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                          >
                            <span>⏪</span> Confirm Rollback
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
  );
}
