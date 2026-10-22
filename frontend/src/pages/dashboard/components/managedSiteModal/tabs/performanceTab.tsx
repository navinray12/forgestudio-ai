import React from "react";
import type { TabType } from "../types";
import { RefreshCw } from "lucide-react";

/** What renderPerformanceTab reads: the ManagedSiteModal values and callbacks the inline JSX used. */
export interface PerformanceTabDeps {
  activeTab: TabType;
  handleRunAudit: () => Promise<void>;
  perfAuditing: boolean;
  perfSummary: any;
}

/**
 * Performance monitoring tab.
 * Moved verbatim from ManagedSiteModal.tsx's JSX return (lines 1978-2085 before the move). A plain
 * function, not a component: ManagedSiteModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderPerformanceTab({
  activeTab,
  handleRunAudit,
  perfAuditing,
  perfSummary,
}: PerformanceTabDeps): React.ReactNode {
  return (
              activeTab === "performance" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">Live Synthetic Performance & Latency Audit</h3>
                      <p className="text-xs text-slate-400">Automated TTFB, server latency, and Core Web Vitals checks</p>
                    </div>
                    <button
                      onClick={handleRunAudit}
                      disabled={perfAuditing}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white transition flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${perfAuditing ? "animate-spin" : ""}`} />
                      <span>{perfAuditing ? "Auditing Latency..." : "Run Performance Audit Now"}</span>
                    </button>
                  </div>

                  {/* Metrics Gauges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 text-center">
                      <div className="text-[10px] font-bold uppercase text-slate-400">Performance Score</div>
                      <div className="text-3xl font-black text-emerald-400 mt-1">
                        {perfSummary?.latestScore ?? 98}<span className="text-sm text-slate-500">/100</span>
                      </div>
                      <div className="text-[10px] text-emerald-500 font-bold mt-1">Grade A (Optimal)</div>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 text-center">
                      <div className="text-[10px] font-bold uppercase text-slate-400">Avg Response Time</div>
                      <div className="text-2xl font-black text-white mt-1">
                        {perfSummary?.avgResponseTimeMs ?? 120} <span className="text-xs text-slate-500">ms</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">Total HTTP roundtrip</div>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 text-center">
                      <div className="text-[10px] font-bold uppercase text-slate-400">Avg TTFB</div>
                      <div className="text-2xl font-black text-blue-400 mt-1">
                        {perfSummary?.avgTtfbMs ?? 45} <span className="text-xs text-slate-500">ms</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">Server initial byte</div>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 text-center">
                      <div className="text-[10px] font-bold uppercase text-slate-400">Uptime SLA</div>
                      <div className="text-2xl font-black text-emerald-400 mt-1">
                        {perfSummary?.uptimePercentage ?? 99.9}%
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">Successful pings</div>
                    </div>
                  </div>

                  {/* Core Web Vitals Breakdown */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Estimated Core Web Vitals</h4>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                        <div className="text-[10px] text-slate-500 font-bold uppercase">LCP (Largest Contentful Paint)</div>
                        <div className="text-lg font-bold text-emerald-400 mt-1">330 ms</div>
                        <div className="text-[9px] text-emerald-500">Good (&lt; 2.5s)</div>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                        <div className="text-[10px] text-slate-500 font-bold uppercase">FID (First Input Delay)</div>
                        <div className="text-lg font-bold text-emerald-400 mt-1">9 ms</div>
                        <div className="text-[9px] text-emerald-500">Good (&lt; 100ms)</div>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                        <div className="text-[10px] text-slate-500 font-bold uppercase">CLS (Cumulative Layout Shift)</div>
                        <div className="text-lg font-bold text-emerald-400 mt-1">0.012</div>
                        <div className="text-[9px] text-emerald-500">Good (&lt; 0.1)</div>
                      </div>
                    </div>
                  </div>

                  {/* Historical Latency Audits Table */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recent Audit History</h4>
                    <div className="border border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3">Checked At</th>
                            <th className="py-2.5 px-3">TTFB</th>
                            <th className="py-2.5 px-3">Response Time</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">Score</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {(perfSummary?.metrics || []).slice(0, 8).map((m: any) => (
                            <tr key={m.id} className="hover:bg-slate-800/20">
                              <td className="py-2 px-3 text-slate-400">{new Date(m.checkedAt).toLocaleString()}</td>
                              <td className="py-2 px-3 font-mono text-blue-400">{m.ttfbMs} ms</td>
                              <td className="py-2 px-3 font-mono text-slate-200">{m.responseTimeMs} ms</td>
                              <td className="py-2 px-3">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                                  {m.statusCode} OK
                                </span>
                              </td>
                              <td className="py-2 px-3 font-bold text-emerald-400">{m.score}/100</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )
  );
}
