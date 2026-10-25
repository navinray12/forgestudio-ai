import React from "react";
import type { EditorElement, ElementType } from "../../types";

/** What renderReusableComponentsSection reads: the editor values and callbacks the inline JSX used. */
export interface ReusableComponentsSectionDeps {
  components: Record<string, { name: string; element: EditorElement; isFavorite?: boolean | undefined; }>;
  disabledWidgets: ElementType[];
  handleAddInstanceFromComponent: (compId: string) => void;
  toggleFavoriteComponent: (compId: string, e?: React.MouseEvent<Element, MouseEvent> | undefined) => void;
  widgetLibrarySearch: string;
}

/**
 * Left sidebar, Elements tab: the Reusable Components section (saved components to insert).
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 4661-4703 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderReusableComponentsSection({
  components,
  disabledWidgets,
  handleAddInstanceFromComponent,
  toggleFavoriteComponent,
  widgetLibrarySearch,
}: ReusableComponentsSectionDeps): React.ReactNode {
  return (
                !disabledWidgets.includes("reusable-components") && (
                  <div className="col-span-2 pt-3 border-t border-slate-200 mt-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-purple-600 mb-2 flex items-center gap-1">
                      <span>🧩</span> Reusable Components
                    </h4>
                    {Object.keys(components).length === 0 ? (
                      <div className="rounded-lg border border-dashed border-purple-200 bg-purple-50/30 p-2.5 text-center text-[10px] text-purple-600/70">
                        Select any element & click "Save as Comp" to create reusable components.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {Object.entries(components)
                          .filter(([_id, comp]) => !widgetLibrarySearch || comp.name.toLowerCase().includes(widgetLibrarySearch.toLowerCase()))
                          .filter((entry, idx, arr) => arr.findIndex((([_, c]) => c.name.trim().toLowerCase() === entry[1].name.trim().toLowerCase())) === idx)
                          .map(([compId, comp]) => (
                            <div
                              key={compId}
                              className="w-full flex items-center justify-between gap-2 rounded-lg border border-purple-200 bg-purple-50/50 px-2.5 py-1.5 text-xs font-semibold text-purple-800 transition hover:bg-purple-100 hover:border-purple-300"
                            >
                              <button
                                type="button"
                                onClick={(e) => toggleFavoriteComponent(compId, e)}
                                className={`text-xs transition hover:scale-125 cursor-pointer ${comp.isFavorite ? "text-amber-500" : "text-slate-300 hover:text-amber-400"}`}
                                title={comp.isFavorite ? "Remove favorite" : "Mark favorite"}
                              >
                                {comp.isFavorite ? "★" : "☆"}
                              </button>
                              <span className="truncate flex-1 text-left cursor-pointer" onClick={() => handleAddInstanceFromComponent(compId)}>
                                {comp.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleAddInstanceFromComponent(compId)}
                                className="text-[10px] font-bold text-purple-600 bg-purple-200/60 hover:bg-purple-300/80 px-1.5 py-0.5 rounded cursor-pointer"
                              >
                                + Add Instance
                              </button>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )
  );
}
