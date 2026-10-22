import React from "react";
import type { DeploymentConfig, DeploymentRecord, PageConfig, PublishingState } from "../../../types";

/** What renderInternalPublishTab reads: the PublishModal values and callbacks the inline JSX used. */
export interface InternalPublishTabDeps {
  approvalWorkflowEnabled: boolean;
  canPublish: boolean;
  customDomain: string;
  deployment: DeploymentConfig;
  deployments: DeploymentRecord[];
  getStatusBadge: (status: string) => React.JSX.Element;
  handlePublishClick: (dest?: "INTERNAL" | "WORDPRESS") => Promise<void>;
  handleRollbackClick: (deploymentId: string, version: number) => Promise<void>;
  handleSaveDeploymentConfig: (e: React.FormEvent<Element>) => void;
  handleSubmitApproval: () => Promise<void>;
  isActuallyDeployed: boolean;
  isPublishing: boolean;
  isRollingBack: string | null;
  isSubmittingApproval: boolean;
  loadDeployments: () => Promise<void>;
  loadingDeployments: boolean;
  pages: PageConfig[];
  publishing: PublishingState;
  setCustomDomain: React.Dispatch<React.SetStateAction<string>>;
  setWebhookUrl: React.Dispatch<React.SetStateAction<string>>;
  webhookUrl: string;
  websiteId: string | undefined;
}

/**
 * ForgeStudio Live (internal) tab: status overview, publish actions, deployment history and the domain / hosting
 * settings form.
 * Moved verbatim from PublishModal.tsx's JSX return (lines 1064-1292 before the move). A plain
 * function, not a component: PublishModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderInternalPublishTab({
  approvalWorkflowEnabled,
  canPublish,
  customDomain,
  deployment,
  deployments,
  getStatusBadge,
  handlePublishClick,
  handleRollbackClick,
  handleSaveDeploymentConfig,
  handleSubmitApproval,
  isActuallyDeployed,
  isPublishing,
  isRollingBack,
  isSubmittingApproval,
  loadDeployments,
  loadingDeployments,
  pages,
  publishing,
  setCustomDomain,
  setWebhookUrl,
  webhookUrl,
  websiteId,
}: InternalPublishTabDeps): React.ReactNode {
  return (
              <>
              <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-4 space-y-3">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Current Website Status
                </span>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg bg-slate-900/60 p-3 border border-slate-800">
                    <span className="block text-slate-400 text-[10px] uppercase font-bold">Publish State</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          publishing.status === "PUBLISHED"
                            ? "bg-emerald-500 shadow-sm shadow-emerald-500"
                            : publishing.status.includes("FAILED")
                            ? "bg-rose-500"
                            : "bg-amber-500"
                        }`}
                      />
                      <span className="font-extrabold text-white">{publishing.status}</span>
                      <span className="text-[10px] text-slate-400 font-mono">v{publishing.version || 1}</span>
                    </div>
                    {publishing.publishedAt ? (
                      <p className="text-[10px] text-slate-400 mt-1">
                        Published: {new Date(publishing.publishedAt).toLocaleString()}
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-500 mt-1">Not yet published</p>
                    )}
                  </div>

                  <div className="rounded-lg bg-slate-900/60 p-3 border border-slate-800">
                    <span className="block text-slate-400 text-[10px] uppercase font-bold">Deployment Hosting</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          isActuallyDeployed ? "bg-emerald-500 shadow-sm shadow-emerald-500" : "bg-slate-500"
                        }`}
                      />
                      <span className="font-extrabold text-white">
                        {isActuallyDeployed ? "LIVE PRODUCTION" : "LOCAL BUILDER"}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 truncate">
                      {deployment?.customDomain
                        ? `Domain: ${deployment.customDomain}`
                        : "No external domain connected"}
                    </p>
                  </div>
                </div>

                {/* Verification checklist */}
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span>Total Pages to Publish:</span>
                    <span className="font-bold text-white">{pages.length} pages</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-300 mt-1">
                    <span>Home Page:</span>
                    <span className="font-bold text-blue-400">
                      {pages.find((p) => p.isHome || p.slug === "/")?.name || "Home"} (/)
                    </span>
                  </div>
                </div>
              </div>

              {/* Publishing Action Box */}
              <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-extrabold text-white">Publish Website Snapshot</h4>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Validates integrity, processes all pages & components, and updates the live production snapshot.
                    </p>
                  </div>
                  {approvalWorkflowEnabled && !canPublish ? (
                    <button
                      type="button"
                      onClick={handleSubmitApproval}
                      disabled={isSubmittingApproval}
                      className="rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-5 py-2.5 shadow-lg shadow-amber-600/30 transition disabled:opacity-50 cursor-pointer shrink-0 flex items-center gap-1.5"
                    >
                      <span>📋</span>
                      <span>{isSubmittingApproval ? "Submitting..." : "Submit for Approval"}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handlePublishClick("INTERNAL")}
                      disabled={isPublishing}
                      className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2.5 shadow-lg shadow-emerald-600/30 transition disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      {isPublishing ? "Publishing..." : "🚀 Publish Now"}
                    </button>
                  )}
                </div>
                {publishing.status === "PUBLISHED" && Boolean(publishing.publishedAt) && Boolean(websiteId) && (
                  <div className="pt-3 border-t border-emerald-900/40 flex items-center justify-between">
                    <span className="text-xs text-emerald-300 font-semibold flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                      Published & Live (v{publishing.version || 1})
                    </span>
                    <a
                      href={`/site/${websiteId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm"
                    >
                      <span>Visit Live Site</span>
                      <span>↗</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Deployment History Table */}
              <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-extrabold text-white">Deployment History</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Audited deployment records and non-destructive rollbacks.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={loadDeployments}
                    className="text-[11px] font-bold text-blue-400 hover:text-blue-300 transition"
                  >
                    Refresh
                  </button>
                </div>

                {loadingDeployments ? (
                  <div className="text-center py-4 text-xs text-slate-400">Loading deployments...</div>
                ) : deployments.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-500">No deployments recorded yet.</div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {deployments.map((d) => {
                      const isCurrentActive = publishing.status === "PUBLISHED" && publishing.version === d.version;
                      return (
                        <div
                          key={d.id}
                          className={`flex items-center justify-between p-2.5 rounded-lg border ${
                            isCurrentActive ? "border-emerald-500/40 bg-emerald-950/20" : "border-slate-800 bg-slate-900/50"
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-extrabold text-white font-mono">v{d.version}</span>
                              {getStatusBadge(d.status)}
                              <span className="text-[10px] text-slate-400 uppercase font-mono">{d.destinationType}</span>
                            </div>
                            <p className="text-[10px] text-slate-400">
                              {new Date(d.createdAt).toLocaleString()}
                              {d.creator?.fullName ? ` • by ${d.creator.fullName}` : ""}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {isCurrentActive ? (
                              <span className="text-[10px] font-bold text-emerald-400 px-2 py-1 bg-emerald-500/10 rounded">
                                Active
                              </span>
                            ) : d.status === "PUBLISHED" ? (
                              <button
                                type="button"
                                onClick={() => handleRollbackClick(d.id, d.version)}
                                disabled={isRollingBack === d.id || isPublishing}
                                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-bold text-slate-200 transition disabled:opacity-50 cursor-pointer"
                              >
                                {isRollingBack === d.id ? "Rolling back..." : "Rollback"}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Domain & Hosting Configuration */}
              <form onSubmit={handleSaveDeploymentConfig} className="rounded-xl border border-slate-800 bg-slate-800/30 p-4 space-y-3">
                <div>
                  <h4 className="text-xs font-extrabold text-white">Production Deployment Integration</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Connect your real hosting provider, custom domain, or deployment webhook.
                  </p>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Custom Domain</label>
                    <input
                      type="text"
                      placeholder="e.g. www.mybrand.com"
                      value={customDomain}
                      onChange={(e) => setCustomDomain(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-mono text-white outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      CI/CD Deploy Webhook (Vercel, Netlify, Cloudflare, Custom Server)
                    </label>
                    <input
                      type="text"
                      placeholder="https://api.vercel.com/v1/integrations/deploy/..."
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-mono text-white outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-slate-400">
                    🔒 We never show false "Live" statuses without a verified deployment.
                  </span>
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition"
                  >
                    Save Hosting Settings
                  </button>
                </div>
              </form>
              </>
  );
}
