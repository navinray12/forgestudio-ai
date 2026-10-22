import React from "react";
import type { DeviceMode, ElementStyles } from "../../types";

/** What renderElementTypeHeader reads: the editor values and callbacks the inline JSX used. */
export interface ElementTypeHeaderDeps {
  copiedStyles: { styles?: ElementStyles | undefined; responsiveStyles?: Partial<Record<DeviceMode, Partial<ElementStyles>>> | undefined; hoverStyles?: Partial<ElementStyles> | undefined; responsiveHoverStyles?: Partial<Record<DeviceMode, Partial<ElementStyles>>> | undefined; } | null;
  handleCopyStyle: (idToCopy?: string | null | undefined, e?: React.MouseEvent<Element, MouseEvent> | undefined) => void;
  handleDeleteElement: (id: string, e?: React.MouseEvent<Element, MouseEvent> | undefined) => void;
  handleDuplicateElement: (idToDuplicate?: string | null | undefined, e?: React.MouseEvent<Element, MouseEvent> | undefined) => void;
  handlePasteStyle: (idToPaste?: string | null | undefined, e?: React.MouseEvent<Element, MouseEvent> | undefined) => void;
  selectedElementAny: any;
}

/**
 * Selected-element inspector: element type header and quick actions (copy / paste style, duplicate, delete).
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 4119-4154 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderElementTypeHeader({
  copiedStyles,
  handleCopyStyle,
  handleDeleteElement,
  handleDuplicateElement,
  handlePasteStyle,
  selectedElementAny,
}: ElementTypeHeaderDeps): React.ReactNode {
  return (
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <span className="text-xs font-bold uppercase tracking-wide text-blue-600">
                        {selectedElementAny.type}
                      </span>

                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <button
                          onClick={(e) => handleCopyStyle(selectedElementAny.id, e)}
                          className="text-slate-600 hover:text-blue-600 hover:underline"
                          title="Copy Element Style"
                        >
                          Copy Style
                        </button>
                        {copiedStyles && (
                          <button
                            onClick={(e) => handlePasteStyle(selectedElementAny.id, e)}
                            className="text-emerald-600 hover:underline"
                            title="Paste Copied Style"
                          >
                            Paste Style
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDuplicateElement(selectedElementAny.id, e)}
                          className="text-blue-600 hover:underline"
                        >
                          Duplicate
                        </button>
                        <button
                          onClick={(e) => handleDeleteElement(selectedElementAny.id, e)}
                          className="text-red-500 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
  );
}
