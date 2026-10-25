import React from "react";
import type { TabType } from "../types";
import { ArrowUpRight, ExternalLink, GitBranch, Plus, RefreshCw, ShieldCheck, Zap } from "lucide-react";

/** What renderStagingTab reads: the ManagedSiteModal values and callbacks the inline JSX used. */
export interface StagingTabDeps {
  activeTab: TabType;
  fetchStagingInfo: () => Promise<void>;
  handleCreateStaging: () => Promise<void>;
  setDeleteStagingConfirmModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setPromoteConfirmModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  stagingActionLoading: boolean;
  stagingInfo: any;
  stagingLoading: boolean;
  website: { id: string; name: string; slug: string; status: string; wpConnection?: { id: string; siteUrl: string; wpSiteName?: string | null | undefined; status: string; lastVerifiedAt?: string | null | undefined; } | null | undefined; };
}

/**
 * Staging environment tab.
 * Moved verbatim from ManagedSiteModal.tsx's JSX return (lines 3029-3200 before the move). A plain
 * function, not a component: ManagedSiteModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderStagingTab({
  activeTab,
  fetchStagingInfo,
  handleCreateStaging,
  setDeleteStagingConfirmModalOpen,
  setPromoteConfirmModalOpen,
  stagingActionLoading,
  stagingInfo,
  stagingLoading,
  website,
}: StagingTabDeps): React.ReactNode {
  return (
              activeTab === "staging" && (
                <div className="space-y-6">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <GitBranch className="w-5 h-5 text-indigo-400" />
                        Staging Sandbox Environment
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Develop, test, and preview website changes in an isolated sandbox clone before pushing to live production.
                      </p>
                    </div>
                    <button
                      onClick={fetchStagingInfo}
                      disabled={stagingLoading}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                      title="Refresh Staging Status"
                    >
                      <RefreshCw className={`w-4 h-4 ${stagingLoading ? "animate-spin" : ""}`} />
                    </button>
                  </div>

                  {stagingLoading ? (
                    <div className="p-8 text-center border border-slate-800 rounded-xl bg-slate-950/40 text-xs text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-400" />
                      Loading staging status...
                    </div>
                  ) : !stagingInfo?.enabled ? (
                    /* Inactive Staging Onboarding Card */
                    <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 p-6 sm:p-8 text-center space-y-6">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center mx-auto shadow-xl shadow-indigo-500/20">
                        <GitBranch className="w-8 h-8 text-white" />
                      </div>

                      <div className="max-w-md mx-auto space-y-2">
                        <h4 className="text-lg font-bold text-white">Isolated Staging Sandbox</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Provision a high-fidelity replica of your website. Safely experiment with new designs, modify custom code, and get stakeholder sign-off without risking your live production visitors.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto text-left">
                        <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60">
                          <div className="font-semibold text-xs text-slate-200 mb-0.5">Isolated Clone</div>
                          <div className="text-[11px] text-slate-400">Clones live pages, database, and editor state safely.</div>
                        </div>
                        <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60">
                          <div className="font-semibold text-xs text-slate-200 mb-0.5">Shareable Sandbox</div>
                          <div className="text-[11px] text-slate-400">Custom staging subdomain for review and QA testing.</div>
                        </div>
                        <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60">
                          <div className="font-semibold text-xs text-slate-200 mb-0.5">1-Click Promotion</div>
                          <div className="text-[11px] text-slate-400">Push to live with automatic pre-publish safety backup.</div>
                        </div>
                      </div>

                      <div>
                        <button
                          onClick={handleCreateStaging}
                          disabled={stagingActionLoading}
                          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 px-6 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 transition disabled:opacity-50"
                        >
                          {stagingActionLoading ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              Provisioning Sandbox Clone...
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4" />
                              Create Staging Environment
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Active Staging Environment Control Panel */
                    <div className="space-y-4">
                      {/* Status Card */}
                      <div className="rounded-xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-950 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                              Staging Environment Active
                            </span>
                          </div>
                          <div className="text-base font-bold text-white">
                            {stagingInfo.stagingDomain || `staging-${website.slug}.forgestudio.app`}
                          </div>
                          <div className="text-xs text-slate-400">
                            Provisioned on {new Date(stagingInfo.createdAt).toLocaleDateString()} &bull; Target: Isolated Clone
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <a
                            href={`https://${stagingInfo.stagingDomain || `staging-${website.slug}.forgestudio.app`}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition"
                          >
                            <span>Visit Sandbox</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <a
                            href={`/builder/${website.id}?env=staging`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-500/20 transition"
                          >
                            <span>Open Staging Editor</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>

                      {/* Deployment & Sync Stats */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Last Staging Sync</div>
                          <div className="text-sm font-semibold text-slate-200">
                            {stagingInfo.lastDeployedAt ? new Date(stagingInfo.lastDeployedAt).toLocaleString() : "Initial clone deployed"}
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Staging state is isolated from production visitors until explicitly promoted.
                          </p>
                        </div>
                        <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Promotion Protocol</div>
                          <div className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4" />
                            Pre-Publish Safety Shield Active
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Promoting creates an automated snapshot before overriding live production.
                          </p>
                        </div>
                      </div>

                      {/* Promotion & Deletion Actions */}
                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                          <h4 className="text-xs font-bold text-white">Push Sandbox Changes to Live Site</h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Promote staging pages, assets, and configurations into the public production release.
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setDeleteStagingConfirmModalOpen(true)}
                            disabled={stagingActionLoading}
                            className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-medium transition"
                          >
                            Delete Staging
                          </button>
                          <button
                            onClick={() => setPromoteConfirmModalOpen(true)}
                            disabled={stagingActionLoading}
                            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            Push Changes to Production
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
  );
}
