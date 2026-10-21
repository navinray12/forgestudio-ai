import React from "react";

/** What renderSiteInfoPanel reads: the PublishModal values and callbacks the inline JSX used. */
export interface SiteInfoPanelDeps {
  handleFetchSiteInfo: () => Promise<void>;
  isLoadingSiteInfo: boolean;
  showSiteInfoPanel: boolean;
  siteInfo: any;
}

/**
 * WordPress site information panel.
 * Moved verbatim from PublishModal.tsx's JSX return (lines 1652-1768 before the move). A plain
 * function, not a component: PublishModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderSiteInfoPanel({
  handleFetchSiteInfo,
  isLoadingSiteInfo,
  showSiteInfoPanel,
  siteInfo,
}: SiteInfoPanelDeps): React.ReactNode {
  return (
                  showSiteInfoPanel && siteInfo && (
                    <div className="rounded-xl border border-slate-700/80 bg-slate-900/90 p-4 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base">🌐</span>
                          <h4 className="text-xs font-extrabold text-white tracking-wide uppercase">
                            WordPress Site Information
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={handleFetchSiteInfo}
                          disabled={isLoadingSiteInfo}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600/50 text-slate-200 text-[11px] font-bold transition disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                        >
                          {isLoadingSiteInfo ? "Refreshing..." : "🔄 Refresh Information"}
                        </button>
                      </div>

                      {/* Section 1: GENERAL */}
                      <div className="space-y-2">
                        <h5 className="text-[10px] font-extrabold uppercase tracking-wider text-blue-400">General</h5>
                        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">Site URL</span>
                            <span className="text-slate-200 font-mono text-[11px]">{siteInfo.general?.siteUrl}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">Home URL</span>
                            <span className="text-slate-200 font-mono text-[11px]">{siteInfo.general?.homeUrl}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">WordPress Version</span>
                            <span className="text-emerald-400 font-bold">{siteInfo.general?.wordpressVersion}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">Locale / Language</span>
                            <span className="text-slate-200">{siteInfo.general?.locale} ({siteInfo.general?.language})</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">Timezone</span>
                            <span className="text-slate-200 font-mono text-[11px]">{siteInfo.general?.timezone}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">REST API</span>
                            <span className="text-emerald-400 font-bold">✓ {siteInfo.general?.restApiStatus}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">Multisite</span>
                            <span className="text-slate-200">{siteInfo.general?.multisiteStatus === "MULTISITE" ? "Multisite Enabled" : "Single Site"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Section 2: FORGESTUDIO CONNECTOR */}
                      <div className="space-y-2">
                        <h5 className="text-[10px] font-extrabold uppercase tracking-wider text-blue-400">ForgeStudio Connector</h5>
                        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">Connector Version</span>
                            <span className="text-slate-200 font-mono">v{siteInfo.connector?.connectorVersion}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">API Version</span>
                            <span className="text-slate-200 font-mono">{siteInfo.connector?.apiVersion}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">Connection Status</span>
                            <span className="text-emerald-400 font-bold">CONNECTED</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">Response Latency</span>
                            <span className="text-emerald-400 font-mono font-bold">{siteInfo.connector?.responseTimeMs} ms</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-[10px] text-slate-400 block font-bold">Last Verified</span>
                            <span className="text-slate-300 text-[11px]">{siteInfo.connector?.lastVerifiedAt ? new Date(siteInfo.connector.lastVerifiedAt).toLocaleString() : "Just now"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Section 3: ACTIVE THEME */}
                      <div className="space-y-2">
                        <h5 className="text-[10px] font-extrabold uppercase tracking-wider text-blue-400">Active Theme</h5>
                        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">Theme Name</span>
                            <span className="text-slate-200 font-bold">{siteInfo.theme?.name}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">Theme Version</span>
                            <span className="text-slate-200 font-mono">v{siteInfo.theme?.version}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">Theme Architecture</span>
                            <span className="text-blue-300 font-semibold">{siteInfo.theme?.themeType === "BLOCK" ? "Block Theme (FSE)" : "Classic Theme"}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">Parent Theme</span>
                            <span className="text-slate-400">{siteInfo.theme?.parentTheme || "None (Standalone)"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Section 4: CAPABILITIES */}
                      <div className="space-y-2">
                        <h5 className="text-[10px] font-extrabold uppercase tracking-wider text-blue-400">Capabilities</h5>
                        <div className="flex flex-wrap gap-1.5 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                          {(siteInfo.capabilities || []).map((cap: string) => (
                            <span key={cap} className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-emerald-300 text-xs font-bold flex items-center gap-1">
                              <span>✓</span> {cap.charAt(0).toUpperCase() + cap.slice(1)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
  );
}
