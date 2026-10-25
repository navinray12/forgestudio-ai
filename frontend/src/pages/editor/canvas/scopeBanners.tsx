import React from "react";
import type { PageConfig, ThemeBuilderScope } from "../types";

/** What renderScopeBanners reads: the editor values and callbacks the inline JSX used. */
export interface ScopeBannersDeps {
  activePageId: string;
  canvasMode: ThemeBuilderScope;
  handleSwitchCanvasMode: (mode: ThemeBuilderScope) => void;
  pages: PageConfig[];
}

/**
 * Edit canvas: the Theme Builder scope banner shown above the canvas for header / footer / single / archive / 404 / search-results scopes.
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 3819-3966 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderScopeBanners({
  activePageId,
  canvasMode,
  handleSwitchCanvasMode,
  pages,
}: ScopeBannersDeps): React.ReactNode {
  return (
                <>
                {canvasMode === "header" && (
                  <div className="flex items-center justify-between border-b-2 border-purple-500 bg-purple-50/90 rounded-xl px-4 py-3 mb-6 shadow-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">🌐</span>
                      <div>
                        <span className="text-xs font-bold text-purple-900 block">
                          Editing Shared Global Header
                        </span>
                        <span className="text-[10px] text-purple-600 block">
                          Changes made here appear across all pages in the website.
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSwitchCanvasMode("page")}
                      className="text-xs font-bold text-purple-700 hover:text-purple-900 bg-white hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-300 transition shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <span>←</span>
                      <span>Back to Page ({pages.find((p) => p.id === activePageId)?.name || "Page"})</span>
                    </button>
                  </div>
                )}

                {/* Canvas Target Banner: Footer Mode */}
                {canvasMode === "footer" && (
                  <div className="flex items-center justify-between border-b-2 border-purple-500 bg-purple-50/90 rounded-xl px-4 py-3 mb-6 shadow-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">🌐</span>
                      <div>
                        <span className="text-xs font-bold text-purple-900 block">
                          Editing Shared Global Footer
                        </span>
                        <span className="text-[10px] text-purple-600 block">
                          Changes made here appear across all pages in the website.
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSwitchCanvasMode("page")}
                      className="text-xs font-bold text-purple-700 hover:text-purple-900 bg-white hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-300 transition shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <span>←</span>
                      <span>Back to Page ({pages.find((p) => p.id === activePageId)?.name || "Page"})</span>
                    </button>
                  </div>
                )}

                {/* Canvas Target Banner: Single Post Template Mode */}
                {canvasMode === "single" && (
                  <div className="flex items-center justify-between border-b-2 border-indigo-500 bg-indigo-50/90 rounded-xl px-4 py-3 mb-6 shadow-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">📰</span>
                      <div>
                        <span className="text-xs font-bold text-indigo-900 block">
                          Editing Single Post Template (F-237)
                        </span>
                        <span className="text-[10px] text-indigo-600 block">
                          Dynamic layout applied when viewing individual blog posts or articles (/post/:slug).
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSwitchCanvasMode("page")}
                      className="text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-300 transition shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <span>←</span>
                      <span>Back to Page</span>
                    </button>
                  </div>
                )}

                {/* Canvas Target Banner: Archive Template Mode */}
                {canvasMode === "archive" && (
                  <div className="flex items-center justify-between border-b-2 border-emerald-500 bg-emerald-50/90 rounded-xl px-4 py-3 mb-6 shadow-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">📚</span>
                      <div>
                        <span className="text-xs font-bold text-emerald-900 block">
                          Editing Archive Template (F-238)
                        </span>
                        <span className="text-[10px] text-emerald-600 block">
                          Layout applied to category listings, taxonomy archives, and blog indexes (/archive.html).
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSwitchCanvasMode("page")}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-white hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-300 transition shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <span>←</span>
                      <span>Back to Page</span>
                    </button>
                  </div>
                )}

                {/* Canvas Target Banner: 404 Template Mode */}
                {canvasMode === "404" && (
                  <div className="flex items-center justify-between border-b-2 border-amber-500 bg-amber-50/90 rounded-xl px-4 py-3 mb-6 shadow-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">⚠️</span>
                      <div>
                        <span className="text-xs font-bold text-amber-900 block">
                          Editing 404 Error Template (F-239)
                        </span>
                        <span className="text-[10px] text-amber-600 block">
                          Layout displayed when visitors navigate to invalid URLs or unlisted routes (/404.html).
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSwitchCanvasMode("page")}
                      className="text-xs font-bold text-amber-700 hover:text-amber-900 bg-white hover:bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-300 transition shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <span>←</span>
                      <span>Back to Page</span>
                    </button>
                  </div>
                )}

                {/* Canvas Target Banner: Search Results Template Mode */}
                {canvasMode === "search-results" && (
                  <div className="flex items-center justify-between border-b-2 border-blue-500 bg-blue-50/90 rounded-xl px-4 py-3 mb-6 shadow-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">🔍</span>
                      <div>
                        <span className="text-xs font-bold text-blue-900 block">
                          Editing Search Results Template (F-240)
                        </span>
                        <span className="text-[10px] text-blue-600 block">
                          Layout presented when visitors search site content (/search.html?q=...).
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSwitchCanvasMode("page")}
                      className="text-xs font-bold text-blue-700 hover:text-blue-900 bg-white hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-300 transition shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <span>←</span>
                      <span>Back to Page</span>
                    </button>
                  </div>
                )}
                </>
  );
}
