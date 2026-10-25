import React from "react";
import type { DeviceMode, EditorElement, ElementStyles } from "../types";

/** What renderLeafElementChrome reads: the editor values and callbacks the inline JSX used. */
export interface LeafElementChromeDeps {
  copiedStyles: { styles?: ElementStyles | undefined; responsiveStyles?: Partial<Record<DeviceMode, Partial<ElementStyles>>> | undefined; hoverStyles?: Partial<ElementStyles> | undefined; responsiveHoverStyles?: Partial<Record<DeviceMode, Partial<ElementStyles>>> | undefined; } | null;
  dropPosition: "before" | "after" | "inside" | null;
  el: EditorElement;
  handleCopyElement: (idToCopy?: string | null | undefined, e?: React.MouseEvent<Element, MouseEvent> | undefined) => void;
  handleCopyStyle: (idToCopy?: string | null | undefined, e?: React.MouseEvent<Element, MouseEvent> | undefined) => void;
  handleDeleteElement: (id: string, e?: React.MouseEvent<Element, MouseEvent> | undefined) => void;
  handleDuplicateElement: (idToDuplicate?: string | null | undefined, e?: React.MouseEvent<Element, MouseEvent> | undefined) => void;
  handlePasteStyle: (idToPaste?: string | null | undefined, e?: React.MouseEvent<Element, MouseEvent> | undefined) => void;
  handleReorderElement: (id: string, direction: "up" | "down") => void;
  isDropTarget: boolean;
  isHovered: boolean;
  isPreview: boolean;
  isSelected: boolean;
  path: EditorElement[] | null;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
}

/**
 * Canvas leaf element chrome (non-container elements): the before / after drop indicators, the hover badge and the selection toolbar (breadcrumb, move, copy / paste style, duplicate, delete), in their original order.
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 2907-3006 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderLeafElementChrome({
  copiedStyles,
  dropPosition,
  el,
  handleCopyElement,
  handleCopyStyle,
  handleDeleteElement,
  handleDuplicateElement,
  handlePasteStyle,
  handleReorderElement,
  isDropTarget,
  isHovered,
  isPreview,
  isSelected,
  path,
  setSelectedId,
}: LeafElementChromeDeps): React.ReactNode {
  return (
        <>
        {isDropTarget && dropPosition === "before" && (
          <div className="absolute -top-1.5 left-0 right-0 h-1.5 bg-blue-600 rounded-full z-50 pointer-events-none shadow-md animate-pulse" />
        )}
        {isDropTarget && dropPosition === "after" && (
          <div className="absolute -bottom-1.5 left-0 right-0 h-1.5 bg-blue-600 rounded-full z-50 pointer-events-none shadow-md animate-pulse" />
        )}

        {isHovered && !isSelected && !isPreview && (
          <span className="absolute -top-3 left-3 z-30 rounded-full bg-blue-500/90 text-white px-2 py-0.5 text-[9px] font-bold shadow-sm pointer-events-none uppercase tracking-wider">
            {el.type}
          </span>
        )}

        {isSelected && (
          <div className="absolute -top-3.5 right-3 z-30 flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-0.5 text-[11px] font-semibold text-white shadow">
            {path && path.length > 1 ? (
              <span className="flex items-center gap-1">
                {path.map((item, idx) => (
                  <span key={item.id} className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(item.id);
                      }}
                      className={`capitalize hover:underline ${item.id === el.id ? "font-bold text-white" : "text-blue-200"
                        }`}
                    >
                      {item.type}
                    </button>
                    {idx < path.length - 1 && <span>›</span>}
                  </span>
                ))}
              </span>
            ) : (
              <span className="capitalize">{el.type}</span>
            )}
            <span>•</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleReorderElement(el.id, "up");
              }}
              className="hover:underline"
              title="Move Element Up"
            >
              ▲
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleReorderElement(el.id, "down");
              }}
              className="hover:underline"
              title="Move Element Down"
            >
              ▼
            </button>
            <span>•</span>
            <button
              onClick={(e) => handleCopyElement(el.id, e)}
              className="hover:underline"
            >
              Copy
            </button>
            <span>•</span>
            <button
              onClick={(e) => handleCopyStyle(el.id, e)}
              className="hover:underline"
              title="Copy Element Style"
            >
              Copy Style
            </button>
            {copiedStyles && (
              <>
                <span>•</span>
                <button
                  onClick={(e) => handlePasteStyle(el.id, e)}
                  className="hover:underline text-emerald-200 hover:text-white"
                  title="Paste Copied Style"
                >
                  Paste Style
                </button>
              </>
            )}
            <span>•</span>
            <button
              onClick={(e) => handleDuplicateElement(el.id, e)}
              className="hover:underline"
            >
              Duplicate
            </button>
            <span>•</span>
            <button
              onClick={(e) => handleDeleteElement(el.id, e)}
              className="hover:underline text-red-200 hover:text-white"
            >
              Delete
            </button>
          </div>
        )}
        </>
  );
}
