import React from "react";
import type { EditorElement, SitePartsConfig, ThemeBuilderScope } from "../types";

/** What renderPageCanvasContent reads: the editor values and callbacks the inline JSX used. */
export interface PageCanvasContentDeps {
  canvasMode: ThemeBuilderScope;
  elements: EditorElement[];
  handleSwitchCanvasMode: (mode: ThemeBuilderScope) => void;
  renderElementTree: (el: EditorElement) => React.ReactNode;
  siteParts: SitePartsConfig;
}

/**
 * Edit canvas in page scope: the shared global header (when enabled), the page elements (or the empty-canvas drop zone) and the shared global footer (when enabled).
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 3968-4058 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderPageCanvasContent({
  canvasMode,
  elements,
  handleSwitchCanvasMode,
  renderElementTree,
  siteParts,
}: PageCanvasContentDeps): React.ReactNode {
  return (
                <>
                {canvasMode === "page" && (
                  <>
                    {/* Shared Global Header & Navigation in Page Mode Canvas (Only rendered if custom header elements exist) */}
                    {(siteParts.header?.enabled ?? siteParts.header?.isEnabled ?? true) && siteParts.header?.elements && siteParts.header.elements.length > 0 && (
                      <div className="mb-6 rounded-2xl border border-dashed border-purple-300/80 bg-purple-50/20 p-2.5 transition hover:border-purple-400">
                        <div className="flex items-center justify-between pb-2 border-b border-purple-200/50 mb-2 px-1">
                          <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
                            <span>🌐</span>
                            <span>Website Header & Navigation (Shared Across Pages)</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSwitchCanvasMode("header")}
                            className="text-[11px] font-semibold text-purple-700 hover:text-purple-900 bg-white hover:bg-purple-100 px-2.5 py-1 rounded-md border border-purple-300 transition shadow-2xs flex items-center gap-1 cursor-pointer"
                            title="Customize Header & Navigation"
                          >
                            <span>✏️</span>
                            <span>Edit Header</span>
                          </button>
                        </div>
                        <div className="space-y-3">
                          {siteParts.header.elements.map((el) => renderElementTree(el))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Elements Tree Rendering */}
                {elements.length === 0 ? (
                  <div className="flex h-96 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 text-center p-8">
                    <p className="text-sm font-bold text-slate-700">
                      {canvasMode === "header"
                        ? "Global Header is Empty"
                        : canvasMode === "footer"
                          ? "Global Footer is Empty"
                          : canvasMode === "single"
                            ? "Single Post Template is Empty"
                            : canvasMode === "archive"
                              ? "Archive Template is Empty"
                              : canvasMode === "404"
                                ? "404 Not Found Template is Empty"
                                : canvasMode === "search-results"
                                  ? "Search Results Template is Empty"
                                  : "Your Page Canvas is Empty"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {canvasMode === "header"
                        ? "Add navigation menu, logo, buttons, or links from the left panel."
                        : canvasMode === "footer"
                          ? "Add footer links, copyright text, or social icons from the left panel."
                          : canvasMode === "single"
                            ? "Add post title, breadcrumbs, excerpt, or post navigation."
                            : canvasMode === "archive"
                              ? "Add taxonomy filter, archive title, or post cards."
                              : canvasMode === "404"
                                ? "Add 404 message, homepage link, or search bar."
                                : canvasMode === "search-results"
                                  ? "Add search input, results layout, or query heading."
                                  : "Click any element from the left panel to start building."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 w-full max-w-full box-border overflow-x-hidden">
                    {elements.map((el) => renderElementTree(el))}
                  </div>
                )}

                {/* Shared Global Footer in Page Mode Canvas (Only rendered if custom footer elements exist) */}
                {canvasMode === "page" && (siteParts.footer?.enabled ?? siteParts.footer?.isEnabled ?? true) && siteParts.footer?.elements && siteParts.footer.elements.length > 0 && (
                  <div className="mt-8 rounded-2xl border border-dashed border-purple-300/80 bg-purple-50/20 p-2.5 transition hover:border-purple-400">
                    <div className="flex items-center justify-between pb-2 border-b border-purple-200/50 mb-2 px-1">
                      <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
                        <span>🌐</span>
                        <span>Website Footer (Shared Across Pages)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSwitchCanvasMode("footer")}
                        className="text-[11px] font-semibold text-purple-700 hover:text-purple-900 bg-white hover:bg-purple-100 px-2.5 py-1 rounded-md border border-purple-300 transition shadow-2xs flex items-center gap-1 cursor-pointer"
                        title="Customize Footer"
                      >
                        <span>✏️</span>
                        <span>Edit Footer</span>
                      </button>
                    </div>
                    <div className="space-y-3">
                      {siteParts.footer.elements.map((el) => renderElementTree(el))}
                    </div>
                  </div>
                )}
                </>
  );
}
