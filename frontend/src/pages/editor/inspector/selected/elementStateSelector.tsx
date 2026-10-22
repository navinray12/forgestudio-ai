import React from "react";
import type { ElementState } from "../../types";

/** What renderElementStateSelector reads: the editor values and callbacks the inline JSX used. */
export interface ElementStateSelectorDeps {
  activeElementState: ElementState;
  setActiveElementState: React.Dispatch<React.SetStateAction<ElementState>>;
}

/**
 * Selected-element inspector: element state selector (Normal / Hover) (F-036).
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 4156-4189 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderElementStateSelector({
  activeElementState,
  setActiveElementState,
}: ElementStateSelectorDeps): React.ReactNode {
  return (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 space-y-2 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Element State
                        </span>
                        {activeElementState === "hover" && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                            Editing :hover State
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-200/70 p-1">
                        <button
                          type="button"
                          onClick={() => setActiveElementState("normal")}
                          className={`rounded-md px-3 py-1 text-xs font-semibold transition ${activeElementState === "normal"
                            ? "bg-white text-blue-600 shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                          Normal
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveElementState("hover")}
                          className={`rounded-md px-3 py-1 text-xs font-semibold transition ${activeElementState === "hover"
                            ? "bg-white text-blue-600 shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                          Hover (:hover)
                        </button>
                      </div>
                    </div>
  );
}
