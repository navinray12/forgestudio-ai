import React from "react";
import type { TabType } from "../types";
import { RefreshCw } from "lucide-react";

/** What renderEmailLogsTab reads: the ManagedSiteModal values and callbacks the inline JSX used. */
export interface EmailLogsTabDeps {
  activeTab: TabType;
  deliveryLogs: any[];
  fetchManagedDetails: () => Promise<void>;
}

/**
 * Email delivery logs tab.
 * Moved verbatim from ManagedSiteModal.tsx's JSX return (lines 2274-2323 before the move). A plain
 * function, not a component: ManagedSiteModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderEmailLogsTab({
  activeTab,
  deliveryLogs,
  fetchManagedDetails,
}: EmailLogsTabDeps): React.ReactNode {
  return (
              activeTab === "email-logs" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">Outbound Email Delivery History</h3>
                    <button
                      onClick={fetchManagedDetails}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Refresh
                    </button>
                  </div>

                  {deliveryLogs.length === 0 ? (
                    <div className="p-8 text-center border border-slate-800 rounded-xl bg-slate-950/40 text-xs text-slate-500">
                      No transactional emails dispatched for this site yet.
                    </div>
                  ) : (
                    <div className="border border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3">Sent At</th>
                            <th className="py-2.5 px-3">Recipient</th>
                            <th className="py-2.5 px-3">Subject</th>
                            <th className="py-2.5 px-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {deliveryLogs.map((log: any) => (
                            <tr key={log.id} className="hover:bg-slate-800/20">
                              <td className="py-2 px-3 text-slate-400">{new Date(log.sentAt).toLocaleString()}</td>
                              <td className="py-2 px-3 font-semibold text-slate-200">{log.recipient}</td>
                              <td className="py-2 px-3 text-slate-300">{log.subject}</td>
                              <td className="py-2 px-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  log.status === "SENT"
                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                    : "bg-red-500/20 text-red-400 border border-red-500/30"
                                }`}>
                                  {log.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
  );
}
