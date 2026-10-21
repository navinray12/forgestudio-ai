import React from "react";
import { ALL_WIDGET_REGISTRY } from "../../types";
import type { ElementType } from "../../types";

/** What renderElementManagerOverlay reads: the editor values and callbacks the inline JSX used. */
export interface ElementManagerOverlayDeps {
  disabledWidgets: ElementType[];
  enableAllWidgets: () => void;
  isElementManagerOpen: boolean;
  managerCategoryFilter: string;
  managerSearchQuery: string;
  resetWidgetsToDefault: () => void;
  setIsElementManagerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setManagerCategoryFilter: React.Dispatch<React.SetStateAction<string>>;
  setManagerSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  toggleWidgetAvailability: (type: ElementType) => void;
}

/**
 * Element Manager overlay (enable / disable widgets). Note: nothing in the editor currently sets isElementManagerOpen to true; moved unchanged.
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 14725-14889 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderElementManagerOverlay({
  disabledWidgets,
  enableAllWidgets,
  isElementManagerOpen,
  managerCategoryFilter,
  managerSearchQuery,
  resetWidgetsToDefault,
  setIsElementManagerOpen,
  setManagerCategoryFilter,
  setManagerSearchQuery,
  toggleWidgetAvailability,
}: ElementManagerOverlayDeps): React.ReactNode {
  return (
      isElementManagerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setIsElementManagerOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-3">
                <span className="text-xl">⚙️</span>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Manage Widgets & Visibility</h3>
                  <p className="text-[11px] text-slate-400">
                    Control which widgets appear in the main Widget Library. Hiding a widget preserves all canvas elements.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsElementManagerOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            {/* Top Toolbar: Search & Quick Action Buttons */}
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  value={managerSearchQuery}
                  onChange={(e) => setManagerSearchQuery(e.target.value)}
                  placeholder="Search all widgets..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-xs font-medium text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition shadow-xs"
                />
                <span className="absolute left-2.5 top-2 text-xs text-slate-400">🔍</span>
                {managerSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setManagerSearchQuery("")}
                    className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={enableAllWidgets}
                  className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 transition shadow-xs"
                >
                  Enable All ({ALL_WIDGET_REGISTRY.length})
                </button>
                <button
                  type="button"
                  onClick={resetWidgetsToDefault}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition shadow-xs"
                >
                  Reset Default (5 Core)
                </button>
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="px-6 py-2.5 border-b border-slate-100 bg-white flex items-center gap-1.5 overflow-x-auto">
              {["All", "Layout", "Basic", "Content", "Interactive", "Media", "Commerce", "Social"].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setManagerCategoryFilter(cat)}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold transition whitespace-nowrap ${managerCategoryFilter === cat
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Widget Toggles List */}
            <div className="p-6 overflow-y-auto space-y-2.5 max-h-[50vh]">
              {ALL_WIDGET_REGISTRY.filter((w) => {
                const matchesCat = managerCategoryFilter === "All" || w.category === managerCategoryFilter;
                if (!matchesCat) return false;
                if (!managerSearchQuery.trim()) return true;
                const q = managerSearchQuery.toLowerCase().trim();
                return (
                  w.name.toLowerCase().includes(q) ||
                  w.type.toLowerCase().includes(q) ||
                  w.description.toLowerCase().includes(q) ||
                  w.category.toLowerCase().includes(q)
                );
              }).map((w) => {
                const isDisabled = disabledWidgets.includes(w.type);
                return (
                  <div
                    key={w.type}
                    className={`flex items-center justify-between p-3 rounded-xl border transition ${isDisabled
                      ? "border-slate-200 bg-slate-50/60 opacity-80"
                      : "border-emerald-200 bg-emerald-50/20 shadow-xs"
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200 shadow-xs">
                        {w.icon}
                      </span>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                          <span>{w.name}</span>
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            {w.category}
                          </span>
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${isDisabled
                              ? "bg-slate-200 text-slate-600"
                              : "bg-emerald-100 text-emerald-700"
                              }`}
                          >
                            {isDisabled ? "Hidden" : "Visible"}
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">{w.description}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleWidgetAvailability(w.type)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isDisabled ? "bg-slate-300" : "bg-emerald-500"
                        }`}
                      title={isDisabled ? `Enable ${w.name} in Widget Library` : `Hide ${w.name} from Widget Library`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isDisabled ? "translate-x-0" : "translate-x-5"
                          }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 bg-slate-50 px-6 py-3 flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500">
                {ALL_WIDGET_REGISTRY.length - disabledWidgets.length} of {ALL_WIDGET_REGISTRY.length} widgets active in Main Library
              </span>
              <button
                type="button"
                onClick={() => setIsElementManagerOpen(false)}
                className="rounded-lg bg-blue-600 px-5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )
  );
}
