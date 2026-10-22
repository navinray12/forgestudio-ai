import React from "react";
import type { TabType } from "../types";
import { ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";

/** What renderWordpressSyncTab reads: the ManagedSiteModal values and callbacks the inline JSX used. */
export interface WordpressSyncTabDeps {
  actionLoading: boolean;
  activeTab: TabType;
  details: any;
  handleVerifyConnection: () => Promise<void>;
  handleWordPressSync: () => Promise<void>;
  isWpConnected: boolean;
  onClose: () => void;
  website: { id: string; name: string; slug: string; status: string; wpConnection?: { id: string; siteUrl: string; wpSiteName?: string | null | undefined; status: string; lastVerifiedAt?: string | null | undefined; } | null | undefined; };
  wpConn: any;
}

/**
 * WordPress sync tab (connection, verification, page sync).
 * Moved verbatim from ManagedSiteModal.tsx's JSX return (lines 1729-1822 before the move). A plain
 * function, not a component: ManagedSiteModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderWordpressSyncTab({
  actionLoading,
  activeTab,
  details,
  handleVerifyConnection,
  handleWordPressSync,
  isWpConnected,
  onClose,
  website,
  wpConn,
}: WordpressSyncTabDeps): React.ReactNode {
  return (
              activeTab === "wordpress" && (
                <div className="space-y-6">
                  {isWpConnected ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-950/20 flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{wpConn.wpSiteName || "WordPress Site"}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">ACTIVE</span>
                          </div>
                          <p className="text-xs text-indigo-300 font-mono mt-1">{wpConn.siteUrl}</p>
                          <p className="text-[11px] text-slate-500 mt-2">
                            Last verified: {wpConn.lastVerifiedAt ? new Date(wpConn.lastVerifiedAt).toLocaleString() : "Never"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleVerifyConnection}
                            disabled={actionLoading}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Verify
                          </button>
                          <button
                            onClick={handleWordPressSync}
                            disabled={actionLoading}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white flex items-center gap-1"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? "animate-spin" : ""}`} /> Sync Now
                          </button>
                        </div>
                      </div>

                      {/* Synced Mappings Table */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Synced Page Mappings</h4>
                        {details?.wpPageMappings?.length === 0 ? (
                          <div className="p-6 text-center border border-slate-800 rounded-xl bg-slate-950/40 text-xs text-slate-500">
                            No pages synchronized to WordPress yet. Click "Sync Now" to push pages.
                          </div>
                        ) : (
                          <div className="border border-slate-800 rounded-xl overflow-hidden">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                                <tr>
                                  <th className="py-2.5 px-3">Forge Page ID</th>
                                  <th className="py-2.5 px-3">WP Post ID</th>
                                  <th className="py-2.5 px-3">Remote Slug</th>
                                  <th className="py-2.5 px-3">Synced URL</th>
                                  <th className="py-2.5 px-3 text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/60">
                                {details?.wpPageMappings?.map((m: any) => (
                                  <tr key={m.id} className="hover:bg-slate-800/20">
                                    <td className="py-2 px-3 font-mono text-slate-300">{m.forgePageId}</td>
                                    <td className="py-2 px-3 font-bold text-indigo-400">#{m.wpPostId}</td>
                                    <td className="py-2 px-3 text-slate-400">/{m.wpPostSlug}</td>
                                    <td className="py-2 px-3">
                                      <a href={m.wpPostUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline flex items-center gap-1 truncate max-w-[200px]">
                                        <span>{m.wpPostUrl}</span>
                                        <ExternalLink className="w-3 h-3 shrink-0" />
                                      </a>
                                    </td>
                                    <td className="py-2 px-3 text-right">
                                      <button
                                        onClick={() => {
                                          onClose();
                                          window.location.href = `/editor?websiteId=${website.id}&pageId=${m.forgePageId}`;
                                        }}
                                        className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold shadow-sm transition inline-flex items-center gap-1"
                                      >
                                        ⚡ Open in Editor
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center border border-slate-800 rounded-xl bg-slate-950/40 space-y-3">
                      <div className="text-3xl">🔌</div>
                      <h4 className="text-sm font-bold text-white">No WordPress Connection Configured</h4>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        Link your WordPress site using the WordPress Connector plugin to synchronize pages seamlessly.
                      </p>
                    </div>
                  )}
                </div>
              )
  );
}
