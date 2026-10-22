import React from "react";
import type { PageConfig } from "../../../types";

/** What renderPublishEnginePanel reads: the PublishModal values and callbacks the inline JSX used. */
export interface PublishEnginePanelDeps {
  activeWpJob: any;
  handleEnqueueWpPublishJob: (pageId?: string) => Promise<void>;
  handlePublishWpPageAction: (statusOverride?: "publish" | "draft" | "private" | undefined) => Promise<void>;
  htmlPreviewData: any;
  isCreatingJob: boolean;
  isLoadingHtmlPreview: boolean;
  isPublishingWpPage: boolean;
  loadHtmlPreview: () => Promise<void>;
  pages: PageConfig[];
  publishingFormat: "html" | "gutenberg";
  setPublishingFormat: React.Dispatch<React.SetStateAction<"html" | "gutenberg">>;
  setWpPublishStatusMode: React.Dispatch<React.SetStateAction<"publish" | "draft" | "private">>;
  wpPublishError: string | null;
  wpPublishResult: any;
  wpPublishStatusMode: "publish" | "draft" | "private";
  wpPublishStep: string;
  wpStatus: any;
}

/**
 * WordPress publish engine panel (F-495 / F-499): format selector, preview summary, progress, result and
 * publish actions.
 * Moved verbatim from PublishModal.tsx's JSX return (lines 1925-2184 before the move). A plain
 * function, not a component: PublishModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderPublishEnginePanel({
  activeWpJob,
  handleEnqueueWpPublishJob,
  handlePublishWpPageAction,
  htmlPreviewData,
  isCreatingJob,
  isLoadingHtmlPreview,
  isPublishingWpPage,
  loadHtmlPreview,
  pages,
  publishingFormat,
  setPublishingFormat,
  setWpPublishStatusMode,
  wpPublishError,
  wpPublishResult,
  wpPublishStatusMode,
  wpPublishStep,
  wpStatus,
}: PublishEnginePanelDeps): React.ReactNode {
  return (
                  <div className="rounded-xl border border-blue-900/50 bg-slate-900/90 p-4 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div>
                        <h4 className="text-xs font-black text-white uppercase tracking-wide flex items-center gap-1.5">
                          <span>🚀</span> WordPress Page Publish (F-495)
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Publish canonical page document to connected WordPress site with block transformation and durable mapping.
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-lg border border-slate-700">
                        <span className="text-[10px] text-slate-400 font-bold px-1.5">Status:</span>
                        <select
                          value={wpPublishStatusMode}
                          onChange={(e) => setWpPublishStatusMode(e.target.value as any)}
                          className="bg-slate-900 text-xs font-bold text-white rounded px-2 py-1 outline-none border border-slate-700 cursor-pointer"
                        >
                          <option value="publish">PUBLISH (Public)</option>
                          <option value="draft">DRAFT (Private Draft)</option>
                          <option value="private">PRIVATE (Authenticated Only)</option>
                        </select>
                      </div>
                    </div>

                    {/* F-499 Publishing Format Selector (HTML vs Gutenberg) */}
                    <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-white uppercase tracking-wide flex items-center gap-1.5">
                          <span>⚙️</span> Publishing Format (F-499 Engine)
                        </span>
                        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                          <button
                            type="button"
                            onClick={() => setPublishingFormat("html")}
                            className={`px-3 py-1 rounded text-xs font-black transition cursor-pointer ${
                              publishingFormat === "html"
                                ? "bg-cyan-600 text-white shadow shadow-cyan-600/30"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            🌐 HTML + CSS (Deterministic)
                          </button>
                          <button
                            type="button"
                            onClick={() => setPublishingFormat("gutenberg")}
                            className={`px-3 py-1 rounded text-xs font-black transition cursor-pointer ${
                              publishingFormat === "gutenberg"
                                ? "bg-indigo-600 text-white shadow shadow-indigo-600/30"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            🧱 Gutenberg Blocks
                          </button>
                        </div>
                      </div>

                      {publishingFormat === "html" && (
                        <div className="pt-2 border-t border-slate-800/80 space-y-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400 font-semibold">
                              HTML Engine: Semantic tags, responsive CSS breakpoints (desktop/tablet/mobile), & strict XSS sanitization.
                            </span>
                            <button
                              type="button"
                              onClick={() => loadHtmlPreview()}
                              disabled={isLoadingHtmlPreview}
                              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-[10px] transition cursor-pointer shrink-0"
                            >
                              {isLoadingHtmlPreview ? "Refreshing..." : "🔄 Preview HTML Stats"}
                            </button>
                          </div>

                          {htmlPreviewData && (
                            <div className="grid grid-cols-4 gap-2 text-[11px] bg-cyan-950/30 p-2.5 rounded-lg border border-cyan-800/40">
                              <div>
                                <span className="text-[9px] text-cyan-400 font-bold block uppercase">HTML Payload</span>
                                <span className="font-mono font-bold text-white">{(htmlPreviewData.stats?.htmlSizeBytes || 0).toLocaleString()} bytes</span>
                              </div>
                              <div>
                                <span className="text-[9px] text-cyan-400 font-bold block uppercase">Compiled CSS</span>
                                <span className="font-mono font-bold text-white">{(htmlPreviewData.stats?.cssSizeBytes || 0).toLocaleString()} bytes</span>
                              </div>
                              <div>
                                <span className="text-[9px] text-cyan-400 font-bold block uppercase">SHA-256 Hash</span>
                                <span className="font-mono font-bold text-cyan-300 truncate block" title={htmlPreviewData.htmlHash}>
                                  {htmlPreviewData.htmlHash ? htmlPreviewData.htmlHash.substring(0, 10) + "..." : "N/A"}
                                </span>
                              </div>
                              <div>
                                <span className="text-[9px] text-cyan-400 font-bold block uppercase">Media / Assets</span>
                                <span className="font-bold text-emerald-300">{htmlPreviewData.mediaCount || 0} referenced</span>
                              </div>
                            </div>
                          )}

                          {htmlPreviewData?.stats?.sanitizationWarnings?.length > 0 && (
                            <div className="p-2 rounded bg-amber-950/40 border border-amber-800/40 text-[10px] text-amber-300 font-medium">
                              ⚠️ Sanitization stripped {htmlPreviewData.stats.sanitizationWarnings.length} unsafe element(s) for security.
                            </div>
                          )}
                        </div>
                      )}

                      {publishingFormat === "gutenberg" && (
                        <div className="pt-2 border-t border-slate-800/80 space-y-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400 font-semibold">
                              Gutenberg Engine: Core Gutenberg blocks serialization (core/paragraph, core/heading, core/group, core/columns).
                            </span>
                            <button
                              type="button"
                              onClick={() => loadHtmlPreview()}
                              disabled={isLoadingHtmlPreview}
                              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold text-[10px] transition cursor-pointer shrink-0"
                            >
                              {isLoadingHtmlPreview ? "Refreshing..." : "🔄 Preview Block Stats"}
                            </button>
                          </div>

                          {htmlPreviewData && (
                            <div className="grid grid-cols-4 gap-2 text-[11px] bg-indigo-950/30 p-2.5 rounded-lg border border-indigo-800/40">
                              <div>
                                <span className="text-[9px] text-indigo-400 font-bold block uppercase">Block Count</span>
                                <span className="font-mono font-bold text-white">{(htmlPreviewData.blockStats?.blocksCount || 0).toLocaleString()} blocks</span>
                              </div>
                              <div>
                                <span className="text-[9px] text-indigo-400 font-bold block uppercase">Nested Blocks</span>
                                <span className="font-mono font-bold text-white">{(htmlPreviewData.blockStats?.nestedBlocksCount || 0).toLocaleString()} nested</span>
                              </div>
                              <div>
                                <span className="text-[9px] text-indigo-400 font-bold block uppercase">Gutenberg Hash</span>
                                <span className="font-mono font-bold text-indigo-300 truncate block" title={htmlPreviewData.gutenbergHash}>
                                  {htmlPreviewData.gutenbergHash ? htmlPreviewData.gutenbergHash.substring(0, 10) + "..." : "N/A"}
                                </span>
                              </div>
                              <div>
                                <span className="text-[9px] text-indigo-400 font-bold block uppercase">Markup Size</span>
                                <span className="font-bold text-emerald-300">{(htmlPreviewData.blockStats?.markupSizeBytes || 0).toLocaleString()} bytes</span>
                              </div>
                            </div>
                          )}

                          {htmlPreviewData?.blockStats?.sanitizationWarnings?.length > 0 && (
                            <div className="p-2 rounded bg-amber-950/40 border border-amber-800/40 text-[10px] text-amber-300 font-medium">
                              ⚠️ Sanitization stripped {htmlPreviewData.blockStats.sanitizationWarnings.length} unsafe element(s) for security.
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Pre-Publish Review Summary */}
                    <div className="grid grid-cols-4 gap-2 text-xs bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Target Site</span>
                        <span className="font-bold text-blue-400 truncate block">{wpStatus?.connection?.siteUrl || "WordPress Site"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Page Count</span>
                        <span className="font-bold text-white">{pages?.length || 1} page(s)</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Health Status</span>
                        <span className="font-bold text-emerald-400">READY</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Mapping Strategy</span>
                        <span className="font-bold text-indigo-300">Durable Upsert</span>
                      </div>
                    </div>

                    {/* Progress Indicator */}
                    {isPublishingWpPage && (
                      <div className="p-3 rounded-lg bg-blue-950/40 border border-blue-800/40 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-blue-300">
                          <span className="flex items-center gap-2">
                            <span className="animate-spin text-sm">⏳</span> {wpPublishStep}
                          </span>
                          <span className="font-mono text-[11px] animate-pulse">PUBLISHING...</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-blue-500 h-full rounded-full transition-all duration-300 animate-pulse w-3/4"></div>
                        </div>
                      </div>
                    )}

                    {/* Publish Error Display */}
                    {wpPublishError && (
                      <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/50 text-rose-300 text-xs space-y-1">
                        <div className="font-extrabold text-rose-200 flex items-center gap-1">
                          <span>❌ Publish Failed:</span>
                        </div>
                        <div className="font-mono text-[11px] text-rose-300">{wpPublishError}</div>
                      </div>
                    )}

                    {/* Publish Success Display */}
                    {wpPublishResult && (
                      <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-extrabold text-emerald-200 flex items-center gap-1.5">
                            <span>✅ Published Successfully!</span>
                            <span className="px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 text-[10px] font-mono uppercase">
                              {wpPublishResult.action} (WP ID: {wpPublishResult.wordpressPageId})
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(wpPublishResult.publishedAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between bg-slate-900 p-2 rounded border border-slate-800">
                          <span className="text-[11px] font-mono text-slate-300 truncate">URL: {wpPublishResult.url}</span>
                          <a
                            href={wpPublishResult.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] transition shrink-0 ml-2"
                          >
                            View Published Page ↗
                          </a>
                        </div>
                        {wpPublishResult.warnings && wpPublishResult.warnings.length > 0 && (
                          <div className="text-[10px] text-amber-300 space-y-0.5 pt-1">
                            <span className="font-bold block">Advisory Notices:</span>
                            {wpPublishResult.warnings.map((w: any, i: number) => (
                              <div key={i}>• {w.message}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => handlePublishWpPageAction("draft")}
                        disabled={isPublishingWpPage}
                        className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                      >
                        Save Draft to WP
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEnqueueWpPublishJob("default")}
                        disabled={isCreatingJob || (activeWpJob && (activeWpJob.status === "QUEUED" || activeWpJob.status === "RUNNING"))}
                        className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black shadow-lg shadow-cyan-600/30 transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                      >
                        <span>⚡</span> {isCreatingJob ? "Queuing Job..." : "Queue Async Job"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePublishWpPageAction("publish")}
                        disabled={isPublishingWpPage}
                        className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-lg shadow-blue-600/30 transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                      >
                        <span>🚀</span> {wpStatus?.mappingsCount ? "Update Published Page" : "Publish to WordPress"}
                      </button>
                    </div>
                  </div>
  );
}
