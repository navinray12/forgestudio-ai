import React from "react";

/** What renderSiteHealthPanel reads: the PublishModal values and callbacks the inline JSX used. */
export interface SiteHealthPanelDeps {
  handleFetchSiteHealth: () => Promise<void>;
  isLoadingSiteHealth: boolean;
  showSiteHealthPanel: boolean;
  siteHealth: any;
}

/**
 * WordPress site health diagnostics panel.
 * Moved verbatim from PublishModal.tsx's JSX return (lines 1462-1651 before the move). A plain
 * function, not a component: PublishModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderSiteHealthPanel({
  handleFetchSiteHealth,
  isLoadingSiteHealth,
  showSiteHealthPanel,
  siteHealth,
}: SiteHealthPanelDeps): React.ReactNode {
  return (
                  showSiteHealthPanel && siteHealth && (
                    <div className="rounded-xl border border-emerald-900/60 bg-slate-900/95 p-4 space-y-4 shadow-xl">
                      {/* Health Header & Score */}
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-3">
                          <div className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                            siteHealth.overallStatus === 'HEALTHY' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                            siteHealth.overallStatus === 'WARNING' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                            'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}>
                            {siteHealth.overallStatus}
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-white tracking-wide uppercase flex items-center gap-1.5">
                              <span>🩺</span> Site Health & Compatibility
                            </h4>
                            <span className="text-[10px] text-slate-400">
                              Checked: {siteHealth.checkedAt ? new Date(siteHealth.checkedAt).toLocaleTimeString() : 'Just now'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-base font-black text-emerald-400 font-mono">{siteHealth.score}%</div>
                            <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Health Score</div>
                          </div>
                          <button
                            type="button"
                            onClick={handleFetchSiteHealth}
                            disabled={isLoadingSiteHealth}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600/50 text-slate-200 text-[11px] font-bold transition disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                          >
                            {isLoadingSiteHealth ? "Refreshing..." : "🔄 Refresh Health"}
                          </button>
                        </div>
                      </div>

                      {/* Section 1: CONNECTIVITY & AUTHENTICATION */}
                      <div className="space-y-1.5">
                        <h5 className="text-[10px] font-black uppercase tracking-wider text-emerald-400">1. Connectivity & Authentication</h5>
                        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">Latency</span>
                            <span className="text-emerald-400 font-mono font-bold">{siteHealth.responseTimeMs} ms</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">REST API Reachability</span>
                            <span className="text-emerald-400 font-bold">✓ Active</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">HMAC Signature</span>
                            <span className="text-emerald-400 font-bold">✓ Verified</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">User Permission</span>
                            <span className="text-slate-200 font-semibold">{siteHealth.authentication?.permissions || 'ADMINISTRATOR'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Section 2: COMPATIBILITY */}
                      <div className="space-y-1.5">
                        <h5 className="text-[10px] font-black uppercase tracking-wider text-emerald-400">2. WordPress Compatibility</h5>
                        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">WordPress Version</span>
                            <span className="text-slate-100 font-bold">{siteHealth.compatibility?.wordpressVersion} (Min: {siteHealth.compatibility?.minimumSupportedVersion})</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">Compatibility Status</span>
                            <span className={`font-bold ${siteHealth.compatibility?.status === 'SUPPORTED' ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {siteHealth.compatibility?.status}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">Plugin Version</span>
                            <span className="text-slate-300 font-mono">v{siteHealth.compatibility?.connectorVersion}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">API Namespace</span>
                            <span className="text-slate-300 font-mono">{siteHealth.compatibility?.apiVersion}</span>
                          </div>
                        </div>
                      </div>

                      {/* Section 3: PUBLISHING READINESS */}
                      <div className="space-y-1.5">
                        <h5 className="text-[10px] font-black uppercase tracking-wider text-emerald-400">3. Publishing Readiness</h5>
                        <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-300">Publishing Status:</span>
                            <span className={`px-2.5 py-0.5 rounded text-xs font-black uppercase ${
                              siteHealth.publishingReadiness?.status === 'READY' ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' :
                              siteHealth.publishingReadiness?.status === 'READY_WITH_WARNINGS' ? 'bg-amber-950 text-amber-300 border border-amber-700' :
                              'bg-rose-950 text-rose-300 border border-rose-700'
                            }`}>
                              {siteHealth.publishingReadiness?.status}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 text-[11px] pt-1 border-t border-slate-800/80">
                            <div className="flex items-center gap-1.5">
                              <span className={siteHealth.publishingReadiness?.canPublishPages ? "text-emerald-400" : "text-rose-400"}>
                                {siteHealth.publishingReadiness?.canPublishPages ? "✓" : "✗"}
                              </span>
                              <span className="text-slate-300">Page Publishing</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className={siteHealth.publishingReadiness?.canUploadMedia ? "text-emerald-400" : "text-rose-400"}>
                                {siteHealth.publishingReadiness?.canUploadMedia ? "✓" : "✗"}
                              </span>
                              <span className="text-slate-300">Media Uploads</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className={siteHealth.publishingReadiness?.canUseGutenberg ? "text-emerald-400" : "text-amber-400"}>
                                {siteHealth.publishingReadiness?.canUseGutenberg ? "✓" : "!"}
                              </span>
                              <span className="text-slate-300">Gutenberg Blocks</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className={siteHealth.publishingReadiness?.canUpdateContent ? "text-emerald-400" : "text-rose-400"}>
                                {siteHealth.publishingReadiness?.canUpdateContent ? "✓" : "✗"}
                              </span>
                              <span className="text-slate-300">Content Updates</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Section 4: CAPABILITY MATRIX */}
                      <div className="space-y-1.5">
                        <h5 className="text-[10px] font-black uppercase tracking-wider text-emerald-400">4. Capabilities Grid</h5>
                        <div className="grid grid-cols-4 gap-1.5 bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-[11px]">
                          {Object.entries(siteHealth.capabilities || {})
                            .filter(([key]) => key !== 'status')
                            .map(([capKey, enabled]) => (
                              <div key={capKey} className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                                <span className={enabled ? "text-emerald-400 font-bold" : "text-slate-500"}>{enabled ? "✓" : "✗"}</span>
                                <span className="text-slate-300 font-medium capitalize">{capKey}</span>
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Section 5: SECURITY & DIAGNOSTIC MESSAGES */}
                      <div className="space-y-1.5">
                        <h5 className="text-[10px] font-black uppercase tracking-wider text-emerald-400">5. Security & Diagnostics</h5>
                        <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 font-bold">HTTPS Connection</span>
                            <span className={siteHealth.security?.https ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                              {siteHealth.security?.https ? "✓ Enabled (Secure)" : "⚠️ HTTP Only (Insecure)"}
                            </span>
                          </div>

                          {siteHealth.errors && siteHealth.errors.length > 0 && (
                            <div className="space-y-1 pt-1 border-t border-slate-800">
                              <span className="text-[10px] font-extrabold text-rose-400 uppercase">Errors:</span>
                              {siteHealth.errors.map((err: any, idx: number) => (
                                <div key={idx} className="p-2 rounded bg-rose-950/40 border border-rose-800/40 text-rose-300 text-[11px] font-mono">
                                  [{err.code}] {err.message}
                                </div>
                              ))}
                            </div>
                          )}

                          {siteHealth.warnings && siteHealth.warnings.length > 0 && (
                            <div className="space-y-1 pt-1 border-t border-slate-800">
                              <span className="text-[10px] font-extrabold text-amber-400 uppercase">Warnings:</span>
                              {siteHealth.warnings.map((warn: any, idx: number) => (
                                <div key={idx} className="p-2 rounded bg-amber-950/40 border border-amber-800/40 text-amber-300 text-[11px]">
                                  [{warn.code}] {warn.message}
                                </div>
                              ))}
                            </div>
                          )}

                          {siteHealth.recommendations && siteHealth.recommendations.length > 0 && (
                            <div className="space-y-1 pt-1 border-t border-slate-800">
                              <span className="text-[10px] font-extrabold text-blue-400 uppercase">Recommendations:</span>
                              <ul className="list-disc list-inside text-[11px] text-slate-300 space-y-0.5">
                                {siteHealth.recommendations.map((rec: string, idx: number) => (
                                  <li key={idx}>{rec}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
  );
}
