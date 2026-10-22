import React from "react";
import type { TabType } from "../types";
import { ExternalLink, Gauge, RefreshCw, Sparkles } from "lucide-react";

/** What renderOverviewTab reads: the ManagedSiteModal values and callbacks the inline JSX used. */
export interface OverviewTabDeps {
  actionLoading: boolean;
  activeTab: TabType;
  details: any;
  handleLaunchSso: () => Promise<void>;
  handleWordPressSync: () => Promise<void>;
  isWpConnected: boolean;
  mailerForm: { host: string; port: number; username: string; password: string; fromName: string; fromEmail: string; };
  mailerVerified: boolean;
  optStats: any;
  setActiveTab: React.Dispatch<React.SetStateAction<TabType>>;
  ssoLoading: boolean;
  wpConn: any;
}

/**
 * Overview tab.
 * Moved verbatim from ManagedSiteModal.tsx's JSX return (lines 1651-1727 before the move). A plain
 * function, not a component: ManagedSiteModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderOverviewTab({
  actionLoading,
  activeTab,
  details,
  handleLaunchSso,
  handleWordPressSync,
  isWpConnected,
  mailerForm,
  mailerVerified,
  optStats,
  setActiveTab,
  ssoLoading,
  wpConn,
}: OverviewTabDeps): React.ReactNode {
  return (
              activeTab === "overview" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/50">
                      <div className="text-[11px] font-bold uppercase text-slate-400">Total Pages</div>
                      <div className="text-2xl font-black text-white mt-1">{details?.website?.pagesCount || 1}</div>
                      <div className="text-[11px] text-slate-500 mt-1">Managed canvas views</div>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/50">
                      <div className="text-[11px] font-bold uppercase text-slate-400">WordPress Status</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`w-2 h-2 rounded-full ${isWpConnected ? "bg-emerald-400" : "bg-slate-500"}`} />
                        <span className="text-lg font-bold text-white">{isWpConnected ? "Connected" : "Not Connected"}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 truncate">
                        {wpConn?.siteUrl || "No remote host"}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/50">
                      <div className="text-[11px] font-bold uppercase text-slate-400">Mailer State</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`w-2 h-2 rounded-full ${mailerVerified ? "bg-emerald-400" : "bg-amber-400"}`} />
                        <span className="text-lg font-bold text-white">{mailerVerified ? "Verified SMTP" : "Default / Unverified"}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 truncate">
                        {mailerForm.fromEmail || "System fallback"}
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Matrix */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-5 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Site Governance & Actions</h3>
                    <div className="flex flex-wrap gap-2.5">
                      {isWpConnected && (
                        <button
                          onClick={handleWordPressSync}
                          disabled={actionLoading}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? "animate-spin" : ""}`} />
                          <span>Sync to WordPress</span>
                        </button>
                      )}

                      <button
                        onClick={() => setActiveTab("performance")}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition flex items-center gap-1.5"
                      >
                        <Gauge className="w-3.5 h-3.5 text-blue-400" />
                        <span>Run Performance Audit</span>
                      </button>

                      <button
                        onClick={() => setActiveTab("image-optimization")}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        <span>Optimize Media ({optStats?.remainingCredits ?? 250} Credits)</span>
                      </button>

                      {isWpConnected && (
                        <button
                          onClick={handleLaunchSso}
                          disabled={ssoLoading}
                          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white transition flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>{ssoLoading ? "Authorizing..." : "Launch WP-Admin SSO ↗"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
  );
}
