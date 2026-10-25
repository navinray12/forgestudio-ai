import React from "react";
import type { TabType } from "../types";
import { Layers, RefreshCw, RotateCcw } from "lucide-react";

/** What renderDeploymentsTab reads: the ManagedSiteModal values and callbacks the inline JSX used. */
export interface DeploymentsTabDeps {
  activeTab: TabType;
  currentReleaseId: string | null;
  fetchReleases: () => Promise<void>;
  releases: any[];
  releasesLoading: boolean;
  setRollbackConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setRollbackTargetRelease: React.Dispatch<any>;
}

/**
 * Deployments & atomic releases timeline tab.
 * Moved verbatim from ManagedSiteModal.tsx's JSX return (lines 3512-3635 before the move). A plain
 * function, not a component: ManagedSiteModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderDeploymentsTab({
  activeTab,
  currentReleaseId,
  fetchReleases,
  releases,
  releasesLoading,
  setRollbackConfirmOpen,
  setRollbackTargetRelease,
}: DeploymentsTabDeps): React.ReactNode {
  return (
              activeTab === "deployments" && (
                <div className="space-y-6">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <RotateCcw className="w-5 h-5 text-indigo-400" />
                        Deployments & Atomic Releases Timeline
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Every publish produces an immutable, compiled snapshot. Instantly roll back in &lt;100ms with zero downtime.
                      </p>
                    </div>
                    <button
                      onClick={fetchReleases}
                      disabled={releasesLoading}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition self-start sm:self-auto"
                      title="Refresh Releases"
                    >
                      <RefreshCw className={`w-4 h-4 ${releasesLoading ? "animate-spin" : ""}`} />
                    </button>
                  </div>

                  {/* Releases Timeline List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Release History ({releases.length})
                      </h4>
                      <span className="text-[11px] text-indigo-400 font-medium">
                        Instant Atomic Pointer Swap Architecture
                      </span>
                    </div>

                    {releasesLoading ? (
                      <div className="p-8 text-center border border-slate-800 rounded-xl bg-slate-950/40 text-xs text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-400" />
                        Loading releases timeline...
                      </div>
                    ) : releases.length === 0 ? (
                      <div className="p-8 text-center border border-slate-800 rounded-xl bg-slate-950/40 text-xs text-slate-500">
                        <Layers className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        No deployment releases recorded yet. Publish your site to create the first immutable release.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {releases.map((rel: any, index: number) => {
                          const isCurrentActive =
                            rel.releaseId === currentReleaseId || rel.isActive || (index === 0 && !currentReleaseId);

                          return (
                            <div
                              key={rel.releaseId}
                              className={`rounded-xl border p-4 transition ${
                                isCurrentActive
                                  ? "border-emerald-500/40 bg-gradient-to-r from-emerald-950/30 via-slate-900 to-slate-950 shadow-md shadow-emerald-500/5"
                                  : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="space-y-1.5">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-bold text-sm text-white font-mono">
                                      {rel.releaseId}
                                    </span>
                                    {rel.version && (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                        v{rel.version}
                                      </span>
                                    )}
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                                      SHA: {rel.deployHash ? rel.deployHash.slice(0, 8) : "compiled"}
                                    </span>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                      {rel.environment || "PRODUCTION"}
                                    </span>
                                    {isCurrentActive && (
                                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 shadow-sm shadow-emerald-500/20">
                                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                        ACTIVE NOW
                                      </span>
                                    )}
                                  </div>

                                  <div className="text-xs text-slate-300">
                                    {rel.notes || `Production release v${rel.version || index + 1}`}
                                  </div>

                                  <div className="flex items-center gap-3 text-[11px] text-slate-500">
                                    <span>
                                      Deployed on {new Date(rel.createdAt).toLocaleString()}
                                    </span>
                                    {rel.createdBy && <span>• Author: {rel.createdBy}</span>}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 self-end sm:self-center">
                                  {!isCurrentActive ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRollbackTargetRelease(rel);
                                        setRollbackConfirmOpen(true);
                                      }}
                                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-amber-600 hover:text-white text-slate-200 text-xs font-semibold border border-slate-700 hover:border-amber-500 transition shadow-sm"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                                      <span>Rollback to this version</span>
                                    </button>
                                  ) : (
                                    <span className="text-xs text-emerald-400 font-bold px-3 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                                      Live Traffic Serving
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
  );
}
