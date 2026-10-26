import React from "react";
import type { TabType } from "../types";
import { Sparkles } from "lucide-react";

/** What renderImageOptimizationTab reads: the ManagedSiteModal values and callbacks the inline JSX used. */
export interface ImageOptimizationTabDeps {
  activeTab: TabType;
  handleRunOptimization: () => Promise<void>;
  optCompressing: boolean;
  optStats: any;
}

/**
 * Image optimization & credits tab.
 * Moved verbatim from ManagedSiteModal.tsx's JSX return (lines 2087-2160 before the move). A plain
 * function, not a component: ManagedSiteModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderImageOptimizationTab({
  activeTab,
  handleRunOptimization,
  optCompressing,
  optStats,
}: ImageOptimizationTabDeps): React.ReactNode {
  return (
              activeTab === "image-optimization" && (
                <div className="space-y-6">
                  {/* Credits & Disk Savings Header */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40">
                      <div className="text-[11px] font-bold text-slate-400 uppercase">Total Images Processed</div>
                      <div className="text-2xl font-black text-white mt-1">{optStats?.totalImagesOptimized ?? 0}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Converted to next-gen WebP</div>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40">
                      <div className="text-[11px] font-bold text-slate-400 uppercase">Disk Bandwidth Saved</div>
                      <div className="text-2xl font-black text-emerald-400 mt-1">{optStats?.totalMbSaved ?? 0.0} MB</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Avg savings: {optStats?.avgCompressionRatio ?? "45%"}</div>
                    </div>

                    <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-950/20 flex flex-col justify-between">
                      <div>
                        <div className="text-[11px] font-bold text-indigo-400 uppercase">Optimization Balance</div>
                        <div className="text-2xl font-black text-white mt-1">
                          ⚡ {optStats?.remainingCredits ?? 250} <span className="text-xs text-indigo-300 font-normal">Credits</span>
                        </div>
                      </div>
                      <button
                        onClick={handleRunOptimization}
                        disabled={optCompressing}
                        className="mt-2 py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{optCompressing ? "Compressing WebP..." : "Optimize Sample Asset (1 Credit)"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Asset History Table */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Optimized Media Assets</h4>
                    {(optStats?.recentAssets || []).length === 0 ? (
                      <div className="p-8 text-center border border-slate-800 rounded-xl bg-slate-950/40 text-xs text-slate-500">
                        No optimized assets generated yet. Click "Optimize Sample Asset" to run WebP compression.
                      </div>
                    ) : (
                      <div className="border border-slate-800 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                            <tr>
                              <th className="py-2.5 px-3">Original Asset</th>
                              <th className="py-2.5 px-3">Original Size</th>
                              <th className="py-2.5 px-3">WebP Size</th>
                              <th className="py-2.5 px-3">Savings</th>
                              <th className="py-2.5 px-3">Format</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {(optStats?.recentAssets || []).map((asset: any) => (
                              <tr key={asset.id} className="hover:bg-slate-800/20">
                                <td className="py-2 px-3 font-mono text-slate-300 truncate max-w-[200px]">{asset.originalUrl}</td>
                                <td className="py-2 px-3 text-slate-400">{Math.round((asset.originalBytes || 0) / 1024)} KB</td>
                                <td className="py-2 px-3 font-bold text-emerald-400">{Math.round((asset.optimizedBytes || 0) / 1024)} KB</td>
                                <td className="py-2 px-3">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                                    {Math.round((asset.bytesSaved || 0) / 1024)} KB saved
                                  </span>
                                </td>
                                <td className="py-2 px-3 uppercase text-[10px] font-bold text-slate-400">{asset.format}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )
  );
}
