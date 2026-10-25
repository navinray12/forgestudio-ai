import React from "react";

/** What renderConnectionStatusCard reads: the PublishModal values and callbacks the inline JSX used. */
export interface ConnectionStatusCardDeps {
  handleDisconnectWordPress: () => void;
  handleFetchSiteHealth: () => Promise<void>;
  handleFetchSiteInfo: () => Promise<void>;
  handleFetchWpMedia: (pageOverride?: number | undefined) => Promise<void>;
  handleFetchWpPages: (overrideFilter?: string | undefined) => Promise<void>;
  handleRevokeWordPress: () => Promise<void>;
  handleVerifyWordPress: () => Promise<void>;
  isLoadingSiteHealth: boolean;
  isLoadingSiteInfo: boolean;
  isLoadingWpMedia: boolean;
  isLoadingWpPages: boolean;
  isVerifyingWp: boolean;
  verificationDetails: any;
  wpStatus: any;
}

/**
 * WordPress connection status card: connection details, verification, capabilities and connection actions.
 * Moved verbatim from PublishModal.tsx's JSX return (lines 1299-1445 before the move). A plain
 * function, not a component: PublishModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderConnectionStatusCard({
  handleDisconnectWordPress,
  handleFetchSiteHealth,
  handleFetchSiteInfo,
  handleFetchWpMedia,
  handleFetchWpPages,
  handleRevokeWordPress,
  handleVerifyWordPress,
  isLoadingSiteHealth,
  isLoadingSiteInfo,
  isLoadingWpMedia,
  isLoadingWpPages,
  isVerifyingWp,
  verificationDetails,
  wpStatus,
}: ConnectionStatusCardDeps): React.ReactNode {
  return (
                  <div className="rounded-xl border border-blue-900/40 bg-blue-950/20 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="h-3 w-3 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400"></span>
                        <div>
                          <h4 className="text-xs font-extrabold text-white">
                            {wpStatus.connection?.wpSiteName || "WordPress Destination Connected"}
                          </h4>
                          <a
                            href={wpStatus.connection?.siteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:underline"
                          >
                            {wpStatus.connection?.siteUrl} ↗
                          </a>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {verificationDetails?.healthy === false ? (
                          <span className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                            VERIFICATION FAILED
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                            CONNECTED & HEALTHY
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-xs pt-2 border-t border-slate-800">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block">Mapped Pages</span>
                        <span className="font-extrabold text-white">{wpStatus.mappingsCount || 0} pages</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block">Plugin Version</span>
                        <span className="font-mono text-slate-300">v{verificationDetails?.pluginVersion || wpStatus.connection?.pluginVersion || "1.0.0"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block">API Version</span>
                        <span className="font-mono text-slate-300">{verificationDetails?.apiVersion || wpStatus.connection?.apiVersion || "v1"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block">WordPress Core</span>
                        <span className="text-slate-300">{verificationDetails?.wordpressVersion || "WordPress 6.x"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block">Response Time</span>
                        <span className="font-mono text-emerald-400 font-bold">
                          {verificationDetails?.responseTimeMs ? `${verificationDetails.responseTimeMs} ms` : "Fast (< 200ms)"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block">Last Verified</span>
                        <span className="text-slate-300">
                          {wpStatus.connection?.lastVerifiedAt
                            ? new Date(wpStatus.connection.lastVerifiedAt).toLocaleTimeString()
                            : "Just now"}
                        </span>
                      </div>
                    </div>

                    {/* Verified Capabilities */}
                    <div className="pt-2 border-t border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold block">Verified Capabilities:</span>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {(verificationDetails?.capabilities || wpStatus.connection?.capabilities || ["pages", "media", "publishing", "gutenberg", "webhooks"]).map((cap: string) => (
                          <span key={cap} className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-blue-300 text-[10px] font-semibold flex items-center gap-1">
                            <span>✓</span> {cap.charAt(0).toUpperCase() + cap.slice(1)}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Diagnostic Errors or Warnings */}
                    {verificationDetails?.errors && verificationDetails.errors.length > 0 && (
                      <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs space-y-1">
                        <div className="font-bold text-[11px] text-rose-200 flex items-center gap-1">
                          <span>⚠️ Verification Diagnostic Warning:</span>
                        </div>
                        {verificationDetails.errors.map((err: any, idx: number) => (
                          <div key={idx} className="text-[10px] font-mono text-rose-300">
                            [{err.code}] {err.message}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={handleFetchSiteInfo}
                        disabled={isLoadingSiteInfo}
                        className="px-3 py-1.5 rounded-lg bg-blue-900/60 hover:bg-blue-800 border border-blue-700/50 text-blue-200 text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                      >
                        {isLoadingSiteInfo ? "Loading Info..." : "ℹ️ Site Information"}
                      </button>
                      <button
                        type="button"
                        onClick={handleFetchSiteHealth}
                        disabled={isLoadingSiteHealth}
                        className="px-3 py-1.5 rounded-lg bg-emerald-900/60 hover:bg-emerald-800 border border-emerald-700/50 text-emerald-200 text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                      >
                        {isLoadingSiteHealth ? "Checking Health..." : "🩺 Site Health"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFetchWpPages()}
                        disabled={isLoadingWpPages}
                        className="px-3 py-1.5 rounded-lg bg-indigo-900/60 hover:bg-indigo-800 border border-indigo-700/50 text-indigo-200 text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                      >
                        {isLoadingWpPages ? "Loading Pages..." : "📄 WordPress Pages"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFetchWpMedia()}
                        disabled={isLoadingWpMedia}
                        className="px-3 py-1.5 rounded-lg bg-emerald-900/60 hover:bg-emerald-800 border border-emerald-700/50 text-emerald-200 text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                      >
                        {isLoadingWpMedia ? "Loading Media..." : "🖼️ Media Library"}
                      </button>
                      <button
                        type="button"
                        onClick={handleVerifyWordPress}
                        disabled={isVerifyingWp}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                      >
                        {isVerifyingWp ? "Verifying..." : "⚡ Verify Connection"}
                      </button>
                      <button
                        type="button"
                        onClick={handleRevokeWordPress}
                        className="px-3 py-1.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/40 text-amber-300 text-xs font-bold transition cursor-pointer"
                      >
                        Revoke Token
                      </button>
                      <button
                        type="button"
                        onClick={handleDisconnectWordPress}
                        className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 text-rose-300 text-xs font-bold transition cursor-pointer"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
  );
}
