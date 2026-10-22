import React from "react";
import type { TabType } from "../types";
import { AlertCircle, Check, CheckCircle2, Copy, HardDrive, RefreshCw, Server, Sliders } from "lucide-react";

/** What renderServerConfigTab reads: the ManagedSiteModal values and callbacks the inline JSX used. */
export interface ServerConfigTabDeps {
  activeTab: TabType;
  copiedKey: string | null;
  fetchServerConfig: () => Promise<void>;
  fetchSftpDetails: () => Promise<void>;
  handleCopy: (text: string, key: string) => void;
  handleSaveServerConfig: (e: React.FormEvent<Element>) => Promise<void>;
  handleTestSftp: () => Promise<void>;
  serverConfig: { phpMemoryLimit: string; phpMaxExecutionTime: number; };
  serverConfigLoading: boolean;
  serverConfigSaving: boolean;
  setServerConfig: React.Dispatch<React.SetStateAction<{ phpMemoryLimit: string; phpMaxExecutionTime: number; }>>;
  sftpDetails: any;
  sftpLoading: boolean;
  sftpTestResult: { success: boolean; message: string; } | null;
  sftpTesting: boolean;
  website: { id: string; name: string; slug: string; status: string; wpConnection?: { id: string; siteUrl: string; wpSiteName?: string | null | undefined; status: string; lastVerifiedAt?: string | null | undefined; } | null | undefined; };
}

/**
 * Server & SFTP configuration tab.
 * Moved verbatim from ManagedSiteModal.tsx's JSX return (lines 3637-3847 before the move). A plain
 * function, not a component: ManagedSiteModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderServerConfigTab({
  activeTab,
  copiedKey,
  fetchServerConfig,
  fetchSftpDetails,
  handleCopy,
  handleSaveServerConfig,
  handleTestSftp,
  serverConfig,
  serverConfigLoading,
  serverConfigSaving,
  setServerConfig,
  sftpDetails,
  sftpLoading,
  sftpTestResult,
  sftpTesting,
  website,
}: ServerConfigTabDeps): React.ReactNode {
  return (
              activeTab === "server-config" && (
                <div className="space-y-6">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Server className="w-5 h-5 text-indigo-400" />
                        Server Resources & SFTP Access
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Configure runtime memory quotas, execution limits, and direct SFTP file synchronization.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          fetchServerConfig();
                          fetchSftpDetails();
                        }}
                        disabled={serverConfigLoading || sftpLoading}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                        title="Refresh Server Configuration"
                      >
                        <RefreshCw className={`w-4 h-4 ${(serverConfigLoading || sftpLoading) ? "animate-spin" : ""}`} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* SFTP Access Card */}
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            <HardDrive className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider">SFTP Access Profile</h4>
                            <p className="text-[11px] text-slate-400">Direct encrypted file synchronization</p>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          sftpDetails?.status === "CONNECTED"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-slate-800 text-slate-400 border border-slate-700"
                        }`}>
                          {sftpDetails?.status === "CONNECTED" ? "Verified" : "Ready"}
                        </span>
                      </div>

                      <div className="space-y-3 font-mono text-xs">
                        <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60 flex items-center justify-between">
                          <div>
                            <div className="text-[10px] font-sans uppercase font-bold text-slate-400">SFTP Host</div>
                            <div className="text-slate-200 mt-0.5">{sftpDetails?.host || "sftp.forgestudio.app"}</div>
                          </div>
                          <button
                            onClick={() => handleCopy(sftpDetails?.host || "sftp.forgestudio.app", "sftp_host")}
                            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                            title="Copy Host"
                          >
                            {copiedKey === "sftp_host" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60">
                            <div className="text-[10px] font-sans uppercase font-bold text-slate-400">Port</div>
                            <div className="text-slate-200 mt-0.5">{sftpDetails?.port || 22}</div>
                          </div>
                          <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60">
                            <div className="text-[10px] font-sans uppercase font-bold text-slate-400">Protocol</div>
                            <div className="text-slate-200 mt-0.5">SFTP (SSH)</div>
                          </div>
                        </div>

                        <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60 flex items-center justify-between">
                          <div>
                            <div className="text-[10px] font-sans uppercase font-bold text-slate-400">Username</div>
                            <div className="text-slate-200 mt-0.5">{sftpDetails?.username || `site_${website.slug}`}</div>
                          </div>
                          <button
                            onClick={() => handleCopy(sftpDetails?.username || `site_${website.slug}`, "sftp_user")}
                            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                            title="Copy Username"
                          >
                            {copiedKey === "sftp_user" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60 flex items-center justify-between">
                          <div>
                            <div className="text-[10px] font-sans uppercase font-bold text-slate-400">Remote Root Path</div>
                            <div className="text-slate-200 mt-0.5">{sftpDetails?.remotePath || "/var/www/html"}</div>
                          </div>
                          <button
                            onClick={() => handleCopy(sftpDetails?.remotePath || "/var/www/html", "sftp_path")}
                            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                            title="Copy Remote Path"
                          >
                            {copiedKey === "sftp_path" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {sftpTestResult && (
                        <div className={`p-3 rounded-lg text-xs flex items-start gap-2 border ${
                          sftpTestResult.success
                            ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                            : "bg-red-500/10 text-red-300 border-red-500/20"
                        }`}>
                          {sftpTestResult.success ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                          )}
                          <span>{sftpTestResult.message}</span>
                        </div>
                      )}

                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={handleTestSftp}
                          disabled={sftpTesting}
                          className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-200 transition disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${sftpTesting ? "animate-spin" : ""}`} />
                          <span>{sftpTesting ? "Testing SFTP Connection..." : "Test SFTP Connection"}</span>
                        </button>
                      </div>
                    </div>

                    {/* PHP Runtime & Resource Quotas Card */}
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <Sliders className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider">PHP Runtime & Resources</h4>
                            <p className="text-[11px] text-slate-400">Compute limits & timeout governance</p>
                          </div>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">PHP 8.2</span>
                      </div>

                      <form onSubmit={handleSaveServerConfig} className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                            PHP Memory Limit
                          </label>
                          <select
                            value={serverConfig.phpMemoryLimit}
                            onChange={(e) => setServerConfig({ ...serverConfig, phpMemoryLimit: e.target.value })}
                            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                          >
                            <option value="128M">128 MB (Lightweight Landing Pages)</option>
                            <option value="256M">256 MB (Recommended Standard)</option>
                            <option value="512M">512 MB (High-Traffic Commerce Sites)</option>
                            <option value="1024M">1024 MB (Enterprise Compute Workloads)</option>
                          </select>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Maximum heap memory allocated to PHP execution threads per request.
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                            Max Execution Time
                          </label>
                          <select
                            value={serverConfig.phpMaxExecutionTime}
                            onChange={(e) => setServerConfig({ ...serverConfig, phpMaxExecutionTime: parseInt(e.target.value) || 60 })}
                            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                          >
                            <option value={30}>30 seconds (Standard Scripts)</option>
                            <option value={60}>60 seconds (Default Recommended)</option>
                            <option value={120}>120 seconds (Large Catalog & Importers)</option>
                            <option value={300}>300 seconds (Heavy Batch Processing)</option>
                          </select>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Maximum elapsed time in seconds a script is allowed to run before termination.
                          </p>
                        </div>

                        <div className="pt-3">
                          <button
                            type="submit"
                            disabled={serverConfigSaving}
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/20 transition disabled:opacity-50"
                          >
                            {serverConfigSaving ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                Saving Server Settings...
                              </>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                Save Server Settings
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              )
  );
}
