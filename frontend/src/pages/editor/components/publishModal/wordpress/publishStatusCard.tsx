import React from "react";

/** What renderPublishStatusCard reads: the PublishModal values and callbacks the inline JSX used. */
export interface PublishStatusCardDeps {
  handleConnectWordPress: (e: React.FormEvent<Element>) => Promise<void>;
  handlePublishWpPageAction: (statusOverride?: "publish" | "draft" | "private" | undefined) => Promise<void>;
  isLoadingWpPublishStatus: boolean;
  isPublishingWpPage: boolean;
  loadWpPagePublishStatus: (pageId?: string | undefined) => Promise<void>;
  wpPagePublishStatus: any;
}

/**
 * WordPress publish status card (F-496): status badge, detail grid, contextual actions.
 * Moved verbatim from PublishModal.tsx's JSX return (lines 1770-1923 before the move). A plain
 * function, not a component: PublishModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderPublishStatusCard({
  handleConnectWordPress,
  handlePublishWpPageAction,
  isLoadingWpPublishStatus,
  isPublishingWpPage,
  loadWpPagePublishStatus,
  wpPagePublishStatus,
}: PublishStatusCardDeps): React.ReactNode {
  return (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-3 shadow-lg">
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">📌</span>
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider">
                            WordPress Publish Status (F-496)
                          </h4>
                          <p className="text-[10px] text-slate-400">
                            Authoritative publishing state, content freshness, & remote page verification.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Status Badge */}
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5 ${
                          wpPagePublishStatus?.state === "PUBLISHED"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : wpPagePublishStatus?.state === "STALE"
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            : wpPagePublishStatus?.state === "REMOTE_MISSING"
                            ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                            : wpPagePublishStatus?.state === "FAILED"
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : wpPagePublishStatus?.state === "DISCONNECTED"
                            ? "bg-slate-700/50 text-slate-400 border border-slate-600/30"
                            : wpPagePublishStatus?.state === "PUBLISHING"
                            ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                            : "bg-slate-800 text-slate-400 border border-slate-700"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            wpPagePublishStatus?.state === "PUBLISHED" ? "bg-emerald-400" :
                            wpPagePublishStatus?.state === "STALE" ? "bg-amber-400 animate-pulse" :
                            wpPagePublishStatus?.state === "REMOTE_MISSING" ? "bg-rose-400 animate-ping" :
                            wpPagePublishStatus?.state === "FAILED" ? "bg-red-400" : "bg-slate-400"
                          }`} />
                          {wpPagePublishStatus?.state === "PUBLISHED" && "Published"}
                          {wpPagePublishStatus?.state === "STALE" && "Changes Pending"}
                          {wpPagePublishStatus?.state === "REMOTE_MISSING" && "Remote Missing"}
                          {wpPagePublishStatus?.state === "FAILED" && "Publish Failed"}
                          {wpPagePublishStatus?.state === "DISCONNECTED" && "Disconnected"}
                          {wpPagePublishStatus?.state === "PUBLISHING" && "Publishing..."}
                          {wpPagePublishStatus?.state === "NEVER_PUBLISHED" && "Not Published"}
                          {(!wpPagePublishStatus || wpPagePublishStatus?.state === "UNKNOWN") && "Status Unknown"}
                        </span>

                        <button
                          type="button"
                          onClick={() => loadWpPagePublishStatus()}
                          disabled={isLoadingWpPublishStatus}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold border border-slate-700 transition cursor-pointer flex items-center gap-1 disabled:opacity-50"
                        >
                          <span className={isLoadingWpPublishStatus ? "animate-spin" : ""}>🔄</span> Refresh
                        </button>
                      </div>
                    </div>

                    {/* Status Detail Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">WordPress URL</span>
                        {wpPagePublishStatus?.wordpressUrl ? (
                          <a
                            href={wpPagePublishStatus.wordpressUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-blue-400 hover:underline truncate block"
                          >
                            {wpPagePublishStatus.wordpressUrl}
                          </a>
                        ) : (
                          <span className="text-slate-500 italic">Not available</span>
                        )}
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Last Synced</span>
                        <span className="font-medium text-slate-200 block">
                          {wpPagePublishStatus?.lastPublishedAt
                            ? new Date(wpPagePublishStatus.lastPublishedAt).toLocaleTimeString()
                            : "Never"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Content Freshness</span>
                        <span className={`font-bold block ${
                          wpPagePublishStatus?.contentState === "CURRENT" ? "text-emerald-400" :
                          wpPagePublishStatus?.contentState === "CHANGES_PENDING" ? "text-amber-400" : "text-slate-400"
                        }`}>
                          {wpPagePublishStatus?.contentState === "CURRENT" && "✓ Up to date"}
                          {wpPagePublishStatus?.contentState === "CHANGES_PENDING" && "⚠️ Changes pending"}
                          {wpPagePublishStatus?.contentState === "UNKNOWN" && "Unknown"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Remote Page</span>
                        <span className={`font-bold block ${
                          wpPagePublishStatus?.remoteState === "EXISTS" ? "text-emerald-400" :
                          wpPagePublishStatus?.remoteState === "MISSING" ? "text-rose-400" : "text-slate-400"
                        }`}>
                          {wpPagePublishStatus?.remoteState === "EXISTS" && "✓ Verified"}
                          {wpPagePublishStatus?.remoteState === "MISSING" && "❌ Missing (404)"}
                          {wpPagePublishStatus?.remoteState === "UNKNOWN" && "Unknown"}
                        </span>
                      </div>
                    </div>

                    {/* Contextual Action Banners */}
                    {wpPagePublishStatus?.state === "STALE" && (
                      <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/40 text-amber-300 text-xs flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span>⚠️</span> ForgeStudio page content has been edited since last publish.
                        </span>
                        <button
                          type="button"
                          onClick={() => handlePublishWpPageAction("publish")}
                          disabled={isPublishingWpPage}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded text-[10px] transition cursor-pointer shrink-0 ml-2"
                        >
                          Publish Changes
                        </button>
                      </div>
                    )}

                    {wpPagePublishStatus?.state === "REMOTE_MISSING" && (
                      <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span>🚨</span> Mapped remote page ID {wpPagePublishStatus.wordpressPageId} no longer exists.
                        </span>
                        <button
                          type="button"
                          onClick={() => handlePublishWpPageAction("publish")}
                          disabled={isPublishingWpPage}
                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded text-[10px] transition cursor-pointer shrink-0 ml-2"
                        >
                          Publish Again
                        </button>
                      </div>
                    )}

                    {wpPagePublishStatus?.state === "DISCONNECTED" && (
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 text-xs flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span>🔌</span> WordPress site is disconnected or integration key was revoked.
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleConnectWordPress(e as any)}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded text-[10px] transition cursor-pointer shrink-0 ml-2"
                        >
                          Reconnect WordPress
                        </button>
                      </div>
                    )}
                  </div>
  );
}
