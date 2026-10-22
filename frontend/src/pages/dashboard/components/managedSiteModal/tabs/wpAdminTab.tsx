import React from "react";
import type { TabType } from "../types";
import { Database, ExternalLink, Sparkles } from "lucide-react";

/** What renderWpAdminTab reads: the ManagedSiteModal values and callbacks the inline JSX used. */
export interface WpAdminTabDeps {
  activeTab: TabType;
  dbCleanupLoading: boolean;
  dbOptions: { cleanRevisions: boolean; cleanTransients: boolean; optimizeTables: boolean; emptyTrash: boolean; };
  dbResult: any;
  handleLaunchSso: () => Promise<void>;
  handleRunDbCleanup: () => Promise<void>;
  isWpConnected: boolean;
  setDbOptions: React.Dispatch<React.SetStateAction<{ cleanRevisions: boolean; cleanTransients: boolean; optimizeTables: boolean; emptyTrash: boolean; }>>;
  ssoLoading: boolean;
  wpAdminOverview: any;
}

/**
 * WordPress admin & database tab (SSO, plugins, database cleanup).
 * Moved verbatim from ManagedSiteModal.tsx's JSX return (lines 1824-1976 before the move). A plain
 * function, not a component: ManagedSiteModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderWpAdminTab({
  activeTab,
  dbCleanupLoading,
  dbOptions,
  dbResult,
  handleLaunchSso,
  handleRunDbCleanup,
  isWpConnected,
  setDbOptions,
  ssoLoading,
  wpAdminOverview,
}: WpAdminTabDeps): React.ReactNode {
  return (
              activeTab === "wp-admin" && (
                <div className="space-y-6">
                  {isWpConnected ? (
                    <>
                      {/* Remote Overview Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40">
                          <div className="text-[11px] font-bold text-slate-400 uppercase">Core & Environment</div>
                          <div className="text-base font-bold text-white mt-1">WordPress {wpAdminOverview?.wpVersion || "6.7.2"}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">PHP {wpAdminOverview?.phpVersion || "8.3.12"}</div>
                        </div>

                        <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40">
                          <div className="text-[11px] font-bold text-slate-400 uppercase">Active Theme</div>
                          <div className="text-base font-bold text-white mt-1">{wpAdminOverview?.activeTheme?.name || "Astra Pro"}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">v{wpAdminOverview?.activeTheme?.version || "4.8.2"}</div>
                        </div>

                        <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 flex flex-col justify-between">
                          <div>
                            <div className="text-[11px] font-bold text-slate-400 uppercase">1-Click Remote SSO</div>
                            <div className="text-xs text-slate-400 mt-1">Instant magic access bridge</div>
                          </div>
                          <button
                            onClick={handleLaunchSso}
                            disabled={ssoLoading}
                            className="mt-2 w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>{ssoLoading ? "Opening..." : "Launch WP-Admin ↗"}</span>
                          </button>
                        </div>
                      </div>

                      {/* Remote Database Optimizer Card (F-432) */}
                      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Database className="w-4 h-4 text-emerald-400" />
                            <h4 className="text-sm font-bold text-white">WordPress Database Optimizer</h4>
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono">
                            DB Size: {wpAdminOverview?.database?.sizeMb || 38.4} MB &bull; {wpAdminOverview?.database?.tablesCount || 46} Tables
                          </span>
                        </div>

                        <p className="text-xs text-slate-400">
                          Clean post revisions, purge expired transients, and defragment overhead tables directly from ForgeStudio.
                        </p>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={dbOptions.cleanRevisions}
                              onChange={(e) => setDbOptions({ ...dbOptions, cleanRevisions: e.target.checked })}
                              className="rounded border-slate-700 text-blue-600"
                            />
                            <span>Post Revisions ({wpAdminOverview?.database?.postRevisions || 142})</span>
                          </label>

                          <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={dbOptions.cleanTransients}
                              onChange={(e) => setDbOptions({ ...dbOptions, cleanTransients: e.target.checked })}
                              className="rounded border-slate-700 text-blue-600"
                            />
                            <span>Transients ({wpAdminOverview?.database?.transients || 86})</span>
                          </label>

                          <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={dbOptions.emptyTrash}
                              onChange={(e) => setDbOptions({ ...dbOptions, emptyTrash: e.target.checked })}
                              className="rounded border-slate-700 text-blue-600"
                            />
                            <span>Spam / Trash ({wpAdminOverview?.database?.spamComments || 18})</span>
                          </label>

                          <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={dbOptions.optimizeTables}
                              onChange={(e) => setDbOptions({ ...dbOptions, optimizeTables: e.target.checked })}
                              className="rounded border-slate-700 text-blue-600"
                            />
                            <span>Defrag Tables ({wpAdminOverview?.database?.tablesCount || 46})</span>
                          </label>
                        </div>

                        {dbResult && (
                          <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                            <span>{dbResult.message}</span>
                            <span className="font-bold">⚡ Reclaimed {dbResult.spaceReclaimedMb} MB</span>
                          </div>
                        )}

                        <div className="pt-2 flex justify-end">
                          <button
                            onClick={handleRunDbCleanup}
                            disabled={dbCleanupLoading}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{dbCleanupLoading ? "Optimizing Database..." : "Run DB Cleanup (1 Credit)"}</span>
                          </button>
                        </div>
                      </div>

                      {/* Remote Plugin Inventory */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Remote Plugin Inventory</h4>
                        <div className="border border-slate-800 rounded-xl overflow-hidden">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                              <tr>
                                <th className="py-2.5 px-3">Plugin Name</th>
                                <th className="py-2.5 px-3">Version</th>
                                <th className="py-2.5 px-3">Author</th>
                                <th className="py-2.5 px-3">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                              {(wpAdminOverview?.plugins || []).map((plugin: any) => (
                                <tr key={plugin.slug} className="hover:bg-slate-800/20">
                                  <td className="py-2 px-3 font-semibold text-slate-200">{plugin.name}</td>
                                  <td className="py-2 px-3 font-mono text-slate-400">v{plugin.version}</td>
                                  <td className="py-2 px-3 text-slate-500">{plugin.author}</td>
                                  <td className="py-2 px-3">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      plugin.active
                                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                        : "bg-slate-800 text-slate-400"
                                    }`}>
                                      {plugin.active ? "ACTIVE" : "INACTIVE"}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="p-8 text-center border border-slate-800 rounded-xl bg-slate-950/40 text-xs text-slate-500">
                      Connect remote WordPress host to access plugin inventory and database optimizer controls.
                    </div>
                  )}
                </div>
              )
  );
}
