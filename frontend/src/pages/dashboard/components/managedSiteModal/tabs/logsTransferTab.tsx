import React from "react";
import type { TabType } from "../types";
import { ArrowRightLeft, RefreshCw } from "lucide-react";

/** What renderLogsTransferTab reads: the ManagedSiteModal values and callbacks the inline JSX used. */
export interface LogsTransferTabDeps {
  activeTab: TabType;
  fetchHostingLogs: () => Promise<void>;
  hostingLogs: any[];
  hostingLogsLoading: boolean;
  setTransferConfirmName: React.Dispatch<React.SetStateAction<string>>;
  setTransferEmail: React.Dispatch<React.SetStateAction<string>>;
  setTransferModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  transferEmail: string;
}

/**
 * Logs & transfer tab: hosting logs and ownership transfer.
 * Moved verbatim from ManagedSiteModal.tsx's JSX return (lines 4179-4314 before the move). A plain
 * function, not a component: ManagedSiteModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderLogsTransferTab({
  activeTab,
  fetchHostingLogs,
  hostingLogs,
  hostingLogsLoading,
  setTransferConfirmName,
  setTransferEmail,
  setTransferModalOpen,
  transferEmail,
}: LogsTransferTabDeps): React.ReactNode {
  return (
              activeTab === "logs-transfer" && (
                <div className="space-y-6">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <ArrowRightLeft className="w-5 h-5 text-indigo-400" />
                        Operational Logs & Account Delegation
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Inspect network telemetry events and safely transfer website ownership to another ForgeStudio user.
                      </p>
                    </div>
                    <button
                      onClick={fetchHostingLogs}
                      disabled={hostingLogsLoading}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition self-start sm:self-auto"
                      title="Refresh Operational Logs"
                    >
                      <RefreshCw className={`w-4 h-4 ${hostingLogsLoading ? "animate-spin" : ""}`} />
                    </button>
                  </div>

                  {/* Operational Hosting Logs Table */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Operational Event Stream
                      </h4>
                      <span className="text-[11px] text-slate-500 font-mono">Real-time edge telemetry</span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 max-h-[360px] overflow-y-auto">
                      <table className="w-full text-left text-xs text-slate-300 font-mono">
                        <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 tracking-wider sticky top-0 border-b border-slate-800">
                          <tr>
                            <th className="px-3.5 py-2.5">Time</th>
                            <th className="px-3.5 py-2.5">Type</th>
                            <th className="px-3.5 py-2.5">Action / Target</th>
                            <th className="px-3.5 py-2.5">Status</th>
                            <th className="px-3.5 py-2.5 text-right">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-[11px]">
                          {hostingLogs.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-4 py-8 text-center text-slate-500 font-sans">
                                {hostingLogsLoading ? "Loading operational stream..." : "No operational logs recorded yet."}
                              </td>
                            </tr>
                          ) : (
                            hostingLogs.map((log: any) => (
                              <tr key={log.id} className="hover:bg-slate-900/40 transition">
                                <td className="px-3.5 py-2 text-slate-400 whitespace-nowrap">
                                  {new Date(log.timestamp).toLocaleTimeString()}
                                </td>
                                <td className="px-3.5 py-2 whitespace-nowrap">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    log.type === "HTTP"
                                      ? "bg-blue-500/10 text-blue-400"
                                      : log.type === "DEPLOY"
                                      ? "bg-emerald-500/10 text-emerald-400"
                                      : log.type === "CACHE"
                                      ? "bg-orange-500/10 text-orange-400"
                                      : "bg-indigo-500/10 text-indigo-400"
                                  }`}>
                                    {log.type}
                                  </span>
                                </td>
                                <td className="px-3.5 py-2 text-slate-200 truncate max-w-[260px]">
                                  {log.method ? <span className="text-slate-400 mr-1.5">{log.method}</span> : null}
                                  <span>{log.path || log.action}</span>
                                </td>
                                <td className="px-3.5 py-2 whitespace-nowrap">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    log.statusCode === 200 || log.statusCode === 304
                                      ? "text-emerald-400"
                                      : "text-amber-400"
                                  }`}>
                                    {log.statusCode}
                                  </span>
                                </td>
                                <td className="px-3.5 py-2 text-right text-slate-400 text-[10px] whitespace-nowrap">
                                  {log.latencyMs ? `${log.latencyMs} ms • ` : ""}{log.ipAddress || "system"}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Transfer Website Ownership (Danger Zone) */}
                  <div className="rounded-xl border border-red-500/20 bg-red-950/10 p-5 space-y-4">
                    <div className="flex items-center gap-3 border-b border-red-500/20 pb-3">
                      <div className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                        <ArrowRightLeft className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider">Transfer Website Ownership</h4>
                        <p className="text-[11px] text-slate-400">Irrevocably transfer control to another registered ForgeStudio account</p>
                      </div>
                    </div>

                    <div className="space-y-3 text-xs">
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Transferring website ownership reassigns all pages, custom domains, hosting sandbox environments, and live deployment slots to the recipient. You will forfeit administrative control.
                      </p>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <input
                          type="email"
                          required
                          value={transferEmail}
                          onChange={(e) => setTransferEmail(e.target.value)}
                          placeholder="recipient@example.com"
                          className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!transferEmail.trim()) return;
                            setTransferConfirmName("");
                            setTransferModalOpen(true);
                          }}
                          disabled={!transferEmail.trim()}
                          className="rounded-xl bg-red-600 hover:bg-red-500 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-red-500/20 transition disabled:opacity-50 whitespace-nowrap"
                        >
                          Transfer Ownership...
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
  );
}
