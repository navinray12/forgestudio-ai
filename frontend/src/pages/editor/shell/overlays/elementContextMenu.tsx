import React from "react";
import type { DeviceMode, ElementStyles } from "../../types";

/** What renderElementContextMenu reads: the editor values and callbacks the inline JSX used. */
export interface ElementContextMenuDeps {
  contextMenu: { x: number; y: number; elementId: string; } | null;
  copiedStyles: { styles?: ElementStyles | undefined; responsiveStyles?: Partial<Record<DeviceMode, Partial<ElementStyles>>> | undefined; hoverStyles?: Partial<ElementStyles> | undefined; responsiveHoverStyles?: Partial<Record<DeviceMode, Partial<ElementStyles>>> | undefined; } | null;
  handleCopyElement: (idToCopy?: string | null | undefined, e?: React.MouseEvent<Element, MouseEvent> | undefined) => void;
  handleCopyStyle: (idToCopy?: string | null | undefined, e?: React.MouseEvent<Element, MouseEvent> | undefined) => void;
  handleDeleteElement: (id: string, e?: React.MouseEvent<Element, MouseEvent> | undefined) => void;
  handleDuplicateElement: (idToDuplicate?: string | null | undefined, e?: React.MouseEvent<Element, MouseEvent> | undefined) => void;
  handlePasteStyle: (idToPaste?: string | null | undefined, e?: React.MouseEvent<Element, MouseEvent> | undefined) => void;
  handleReorderElement: (id: string, direction: "up" | "down") => void;
  handleSaveAsComponent: (elementId: string) => void;
  isPreview: boolean;
  setContextMenu: React.Dispatch<React.SetStateAction<{ x: number; y: number; elementId: string; } | null>>;
}

/**
 * Canvas element context menu (right click): positioned at the pointer, actions on the target element.
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 14174-14271 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderElementContextMenu({
  contextMenu,
  copiedStyles,
  handleCopyElement,
  handleCopyStyle,
  handleDeleteElement,
  handleDuplicateElement,
  handlePasteStyle,
  handleReorderElement,
  handleSaveAsComponent,
  isPreview,
  setContextMenu,
}: ElementContextMenuDeps): React.ReactNode {
  return (
      contextMenu && !isPreview && (
        <div
          style={{
            top: `${Math.min(contextMenu.y, window.innerHeight - 260)}px`,
            left: `${Math.min(contextMenu.x, window.innerWidth - 190)}px`,
          }}
          className="fixed z-50 min-w-[170px] rounded-xl border border-slate-200 bg-white/95 backdrop-blur-md p-1.5 shadow-xl text-xs font-semibold text-slate-700 animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
            Element Actions
          </div>
          <button
            onClick={() => {
              handleReorderElement(contextMenu.elementId, "up");
              setContextMenu(null);
            }}
            className="w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left hover:bg-slate-100 hover:text-blue-600 transition"
          >
            <span>Move Up</span>
            <span className="text-[10px] text-slate-400">▲</span>
          </button>
          <button
            onClick={() => {
              handleReorderElement(contextMenu.elementId, "down");
              setContextMenu(null);
            }}
            className="w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left hover:bg-slate-100 hover:text-blue-600 transition"
          >
            <span>Move Down</span>
            <span className="text-[10px] text-slate-400">▼</span>
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button
            onClick={(e) => {
              handleCopyElement(contextMenu.elementId, e);
              setContextMenu(null);
            }}
            className="w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left hover:bg-slate-100 hover:text-blue-600 transition"
          >
            <span>Copy</span>
            <span className="text-[10px] text-slate-400">Ctrl+C</span>
          </button>
          <button
            onClick={(e) => {
              handleCopyStyle(contextMenu.elementId, e);
              setContextMenu(null);
            }}
            className="w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left hover:bg-slate-100 hover:text-blue-600 transition"
          >
            <span>Copy Style</span>
            <span className="text-[10px]">🎨</span>
          </button>
          {copiedStyles && (
            <button
              onClick={(e) => {
                handlePasteStyle(contextMenu.elementId, e);
                setContextMenu(null);
              }}
              className="w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left hover:bg-emerald-50 text-emerald-600 font-bold transition"
            >
              <span>Paste Style</span>
              <span className="text-[10px]">🖌️</span>
            </button>
          )}
          <button
            onClick={(e) => {
              handleDuplicateElement(contextMenu.elementId, e);
              setContextMenu(null);
            }}
            className="w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left hover:bg-slate-100 hover:text-blue-600 transition"
          >
            <span>Duplicate</span>
            <span className="text-[10px] text-slate-400">Ctrl+D</span>
          </button>
          <button
            onClick={() => {
              handleSaveAsComponent(contextMenu.elementId);
              setContextMenu(null);
            }}
            className="w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left hover:bg-purple-50 text-purple-700 transition"
          >
            <span>Save as Comp</span>
            <span className="text-[10px]">🧩</span>
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button
            onClick={(e) => {
              handleDeleteElement(contextMenu.elementId, e);
              setContextMenu(null);
            }}
            className="w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left hover:bg-red-50 text-red-600 transition"
          >
            <span>Delete</span>
            <span className="text-[10px] text-red-400">✕</span>
          </button>
        </div>
      )
  );
}
