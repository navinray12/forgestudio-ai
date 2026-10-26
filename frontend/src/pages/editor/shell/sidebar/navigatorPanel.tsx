import React from "react";
import { flattenAndSearchElements } from "../../core/elementTree";
import type { EditorElement } from "../../types";

/** What renderNavigatorPanel reads: the editor values and callbacks the inline JSX used. */
export interface NavigatorPanelDeps {
  elements: EditorElement[];
  handleSelectElement: (id: string | null, e?: React.MouseEvent<Element, MouseEvent> | undefined) => void;
  renderNavigatorTreeItem: (el: EditorElement, depth?: number, isLast?: boolean) => React.ReactNode;
  selectedId: string | null;
  selectedIds: string[];
  setStructureSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  structureSearchQuery: string;
}

/**
 * Left sidebar, Navigator tab: structure search, filtered results and the full navigator tree.
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 4705-4789 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderNavigatorPanel({
  elements,
  handleSelectElement,
  renderNavigatorTreeItem,
  selectedId,
  selectedIds,
  setStructureSearchQuery,
  structureSearchQuery,
}: NavigatorPanelDeps): React.ReactNode {
  return (
              <div className="space-y-3">
                {/* Structure Search Input (F-030) */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-slate-400 text-xs">
                    🔍
                  </span>
                  <input
                    type="text"
                    value={structureSearchQuery}
                    onChange={(e) => setStructureSearchQuery(e.target.value)}
                    placeholder="Search structure layers..."
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-7 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition shadow-sm"
                  />
                  {structureSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setStructureSearchQuery("")}
                      className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600 text-xs"
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {structureSearchQuery.trim() !== "" ? (
                  /* Filtered Search Results */
                  <div className="space-y-1">
                    {flattenAndSearchElements(elements, structureSearchQuery).length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400 italic">
                        No structure elements matching "{structureSearchQuery}"
                      </div>
                    ) : (
                      flattenAndSearchElements(elements, structureSearchQuery).map(({ element, path }) => (
                        <div
                          key={element.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectElement(element.id, e);
                          }}
                          className={`flex items-center justify-between rounded-lg p-2 text-xs transition cursor-pointer border ${selectedId === element.id || selectedIds.includes(element.id)
                            ? "bg-blue-600 font-bold text-white border-blue-600 shadow-sm"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-blue-300"
                            }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs">
                              {element.type === "container" && "📦"}
                              {element.type === "heading" && "🔤"}
                              {element.type === "text" && "📝"}
                              {element.type === "image" && "🖼️"}
                              {element.type === "button" && "🔘"}
                            </span>
                            <div className="flex flex-col min-w-0">
                              <span className="truncate font-semibold capitalize">
                                {element.type === "heading" ? (element.content ? `"${element.content.slice(0, 15)}"` : "Heading") :
                                  element.type === "text" ? (element.content ? `"${element.content.slice(0, 15)}"` : "Text") :
                                    element.type === "button" ? (element.content ? `"${element.content.slice(0, 15)}"` : "Button") :
                                      element.type === "image" ? (element.alt ? `Image (${element.alt})` : "Image") :
                                        element.type === "container" ? "Container" : element.type}
                              </span>
                              <span className={`text-[9px] truncate ${selectedId === element.id || selectedIds.includes(element.id) ? "text-blue-200" : "text-slate-400"}`}>
                                {path}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  /* Full Tree Hierarchy View */
                  <div className="space-y-1">
                    {elements.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400">
                        No elements on canvas.
                      </div>
                    ) : (
                      elements.map((el, idx) =>
                        renderNavigatorTreeItem(el, 0, idx === elements.length - 1)
                      )
                    )}
                  </div>
                )}
              </div>
  );
}
