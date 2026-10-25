import React from "react";
import type { ElementType } from "../../types";

/** What renderWidgetLibrarySearch reads: the editor values and callbacks the inline JSX used. */
export interface WidgetLibrarySearchDeps {
  disabledWidgets: ElementType[];
  setWidgetLibrarySearch: React.Dispatch<React.SetStateAction<string>>;
  widgetLibrarySearch: string;
}

/**
 * Left sidebar, Elements tab: the widget library search input (with clear button).
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 3453-3473 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderWidgetLibrarySearch({
  disabledWidgets,
  setWidgetLibrarySearch,
  widgetLibrarySearch,
}: WidgetLibrarySearchDeps): React.ReactNode {
  return (
                !disabledWidgets.includes("search-bar") && (
                  <div className="relative">
                    <input
                      type="text"
                      value={widgetLibrarySearch}
                      onChange={(e) => setWidgetLibrarySearch(e.target.value)}
                      placeholder="Search active widgets..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2 pl-8 pr-7 text-xs font-medium text-slate-700 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition shadow-xs"
                    />
                    <span className="absolute left-2.5 top-2 text-xs text-slate-400">🔍</span>
                    {widgetLibrarySearch && (
                      <button
                        type="button"
                        onClick={() => setWidgetLibrarySearch("")}
                        className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )
  );
}
