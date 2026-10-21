import React from "react";

/** What renderConnectWordPressForm reads: the PublishModal values and callbacks the inline JSX used. */
export interface ConnectWordPressFormDeps {
  handleConnectWordPress: (e: React.FormEvent<Element>) => Promise<void>;
  handleDownloadPlugin: () => Promise<void>;
  isConnectingWp: boolean;
  isDownloadingPlugin: boolean;
  setWpApiKey: React.Dispatch<React.SetStateAction<string>>;
  setWpSiteName: React.Dispatch<React.SetStateAction<string>>;
  setWpSiteUrl: React.Dispatch<React.SetStateAction<string>>;
  wpApiKey: string;
  wpSiteName: string;
  wpSiteUrl: string;
}

/**
 * WordPress tab when not connected: connector plugin download and the connection form.
 * Moved verbatim from PublishModal.tsx's JSX return (lines 3269-3366 before the move). A plain
 * function, not a component: PublishModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderConnectWordPressForm({
  handleConnectWordPress,
  handleDownloadPlugin,
  isConnectingWp,
  isDownloadingPlugin,
  setWpApiKey,
  setWpSiteName,
  setWpSiteUrl,
  wpApiKey,
  wpSiteName,
  wpSiteUrl,
}: ConnectWordPressFormDeps): React.ReactNode {
  return (
                <div className="space-y-4">
                  {/* Download Plugin Banner */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-extrabold text-white flex items-center gap-1.5">
                          <span>📦</span> ForgeStudio Connector Plugin (v1.0.0)
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Download and install our official WordPress plugin to establish a secure bridge with your site.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleDownloadPlugin}
                        disabled={isDownloadingPlugin}
                        className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-blue-400 hover:text-blue-300 transition disabled:opacity-50 cursor-pointer shrink-0"
                      >
                        {isDownloadingPlugin ? "Downloading..." : "⬇ Download Plugin (.zip)"}
                      </button>
                    </div>

                    <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 space-y-1">
                      <p>1. Download <code className="text-blue-300">forgestudio-connector.zip</code> and upload via <strong>WP Admin → Plugins → Add New → Upload Plugin</strong>.</p>
                      <p>2. Activate the plugin and navigate to <strong>Settings → ForgeStudio Connector</strong> to copy your secret key.</p>
                      <p>3. Enter your Site URL and Key below to finalize connection.</p>
                    </div>
                  </div>

                  {/* Connect WordPress Form */}
                  <form onSubmit={handleConnectWordPress} className="rounded-xl border border-slate-800 bg-slate-800/30 p-4 space-y-3">
                    <div>
                      <h4 className="text-xs font-extrabold text-white">Connect WordPress Site</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Connect via the ForgeStudio WordPress Connector plugin using an API key. We never ask for admin passwords.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          WordPress Site URL *
                        </label>
                        <input
                          type="url"
                          required
                          placeholder="https://mybrand.com or https://wp.mydomain.com"
                          value={wpSiteUrl}
                          onChange={(e) => setWpSiteUrl(e.target.value)}
                          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-mono text-white outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Connector API Key / Secret Token *
                        </label>
                        <input
                          type="password"
                          required
                          placeholder="Paste connector token from WordPress plugin settings"
                          value={wpApiKey}
                          onChange={(e) => setWpApiKey(e.target.value)}
                          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-mono text-white outline-none focus:border-blue-500"
                        />
                        <span className="block text-[10px] text-slate-500 mt-0.5">
                          🔒 Hashed with SHA-256 on the server. Never exposed to browser or frontend storage.
                        </span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Site Name (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. My Production WordPress Site"
                          value={wpSiteName}
                          onChange={(e) => setWpSiteName(e.target.value)}
                          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                      <span className="text-[10px] text-slate-400">
                        ForgeStudio remains the brain; WordPress is the destination.
                      </span>
                      <button
                        type="submit"
                        disabled={isConnectingWp}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition disabled:opacity-50 cursor-pointer"
                      >
                        {isConnectingWp ? "Connecting..." : "Connect WordPress"}
                      </button>
                    </div>
                  </form>
                </div>
  );
}
