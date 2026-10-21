import React from "react";
import { getMergedStyles } from "../utils";
import { WcAddToCartWidgetRenderer, WcProductImagesWidgetRenderer, WcProductPriceWidgetRenderer, WcProductRatingWidgetRenderer, WcProductTitleWidgetRenderer } from "../widgets";
import type { DeviceMode, EditorElement, ElementType } from "../types";
import type { Dispatch, SetStateAction } from "react";

/** What buildNavigatorTreeItem reads: the editor values and callbacks the inline helper closed over. */
export interface NavigatorTreeItemDeps {
  activeDevice: DeviceMode;
  collapsedContainers: Record<string, boolean>;
  handleCopyElement: (idToCopy?: string | null, e?: React.MouseEvent) => void;
  handleDeleteElement: (id: string, e?: React.MouseEvent) => void;
  handleDuplicateElement: (idToDuplicate?: string | null, e?: React.MouseEvent) => void;
  handleReorderElement: (id: string, direction: "up" | "down") => void;
  handleSelectElement: (id: string | null, e?: React.MouseEvent) => void;
  hoveredId: string | null;
  renderNavigatorTreeItem: (el: EditorElement, depth?: number, isLast?: boolean) => React.ReactNode;
  selectedId: string | null;
  selectedIds: string[];
  setHoveredId: Dispatch<SetStateAction<string | null>>;
  toggleContainerCollapse: (id: string) => void;
}

/**
 * One item of the Navigator tree (label, icon, connectors, collapse toggle, Copy / Duplicate / Move / Delete), recursing into a container's children through deps.renderNavigatorTreeItem (the editor's wrapper), exactly as the inline helper recursed through its own closure.
 * Moved verbatim from WebsiteEditor.tsx (renderNavigatorTreeItem). A plain function, not a component: the editor
 * calls it during its own render through a same-named wrapper, so the output is part of the editor's
 * element tree exactly as before (no extra component boundary, no remounting, same input focus).
 */
export function buildNavigatorTreeItem({
  activeDevice,
  collapsedContainers,
  handleCopyElement,
  handleDeleteElement,
  handleDuplicateElement,
  handleReorderElement,
  handleSelectElement,
  hoveredId,
  renderNavigatorTreeItem,
  selectedId,
  selectedIds,
  setHoveredId,
  toggleContainerCollapse,
}: NavigatorTreeItemDeps, el: EditorElement, depth: number = 0, isLast: boolean = true): React.ReactNode {
    if (!el || !el.id) return null;
    const isSelected = selectedIds.includes(el.id) || selectedId === el.id;
    const isContainer = el.type === "container";
    const isCollapsed = isContainer && !!collapsedContainers[el.id];

    const getElementIcon = (type: ElementType) => {
      if (!type) return "📄";
      switch (type) {
        case "container":
          return "📦";
        case "heading":
          return "🔤";
        case "text":
          return "📝";
        case "image":
          return "🖼️";
        case "button":
          return "🔘";
        case "posts":
          return "📰";
        case "loop-grid":
          return "➿";
        case "wc-product-title":
          return <WcProductTitleWidgetRenderer el={el} getMergedStyles={getMergedStyles} activeDevice={activeDevice} />;
        case "wc-product-price":
          return <WcProductPriceWidgetRenderer el={el} getMergedStyles={getMergedStyles} activeDevice={activeDevice} />;
        case "wc-product-images":
          return <WcProductImagesWidgetRenderer el={el} getMergedStyles={getMergedStyles} activeDevice={activeDevice} />;
        case "wc-add-to-cart":
          return <WcAddToCartWidgetRenderer el={el} getMergedStyles={getMergedStyles} activeDevice={activeDevice} />;
        case "wc-product-rating":
          return <WcProductRatingWidgetRenderer el={el} getMergedStyles={getMergedStyles} activeDevice={activeDevice} />;
        case "share-buttons":
          return "🔗";
        case "portfolio":
          return "💼";
        case "slides":
          return "🎠";
        default:
          return "📄";
      }
    };

    const getElementLabel = (item: EditorElement) => {
      if (!item || !item.type) return "Element";
      if (item.type === "heading") return item.content ? `"${item.content.slice(0, 15)}"` : "Heading";
      if (item.type === "text") return item.content ? `"${item.content.slice(0, 15)}"` : "Text";
      if (item.type === "button") return item.content ? `"${item.content.slice(0, 15)}"` : "Button";
      if (item.type === "image") return item.alt ? `Image (${item.alt})` : "Image";
      if (item.type === "container") return "Container";
      if (item.type === "posts") return item.posts ? `Posts (${item.posts.length})` : "Posts Widget";
      if (item.type === "loop-grid") return "Loop Grid";
      if (item.type === "share-buttons") return item.shareNetworks ? `Share (${item.shareNetworks.length})` : "Share Buttons";
      if (item.type === "portfolio") return item.portfolioItems ? `Portfolio (${item.portfolioItems.length})` : "Portfolio Widget";
      if (item.type === "slides") return item.slidesItems ? `Slides (${item.slidesItems.length})` : "Slides Widget";
      return item.type || "Element";
    };

    return (
      <div key={el.id} className="select-none">
        <div
          onClick={(e) => {
            e.stopPropagation();
            handleSelectElement(el.id, e);
          }}
          onMouseEnter={(e) => {
            e.stopPropagation();
            setHoveredId(el.id);
          }}
          onMouseLeave={(e) => {
            e.stopPropagation();
            if (hoveredId === el.id) setHoveredId(null);
          }}
          style={{ paddingLeft: `${depth * 14 + 4}px` }}
          className={`group flex items-center justify-between rounded-lg py-1.5 pr-2 text-xs transition cursor-pointer mb-0.5 ${isSelected
            ? "bg-blue-600 font-bold text-white shadow-sm"
            : hoveredId === el.id
              ? "bg-blue-50 text-blue-700 font-semibold"
              : "text-slate-700 hover:bg-slate-100"
            }`}
        >
          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
            {/* Visual Tree Branch Connectors (F-021) */}
            {depth > 0 && (
              <span className="font-mono text-slate-400 text-[10px] shrink-0 select-none">
                {isLast ? "└──" : "├──"}
              </span>
            )}

            {isContainer ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleContainerCollapse(el.id);
                }}
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px] transition ${isSelected ? "text-white hover:bg-blue-700" : "text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                  }`}
              >
                {isCollapsed ? "▶" : "▼"}
              </button>
            ) : (
              <span className="w-2 shrink-0" />
            )}

            <span className="shrink-0 text-[11px]">{getElementIcon(el.type)}</span>
            <span className="truncate text-[11px] font-medium capitalize">{getElementLabel(el)}</span>
          </div>

          <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 shrink-0">
            <button
              type="button"
              title="Copy"
              onClick={(e) => handleCopyElement(el.id, e)}
              className={`px-1 py-0.5 text-[9px] rounded hover:bg-black/10 ${isSelected ? "text-white" : "text-slate-500"
                }`}
            >
              📋
            </button>
            <button
              type="button"
              title="Duplicate"
              onClick={(e) => handleDuplicateElement(el.id, e)}
              className={`px-1 py-0.5 text-[9px] rounded hover:bg-black/10 ${isSelected ? "text-white" : "text-slate-500"
                }`}
            >
              ⧉
            </button>
            <button
              type="button"
              title="Move Up"
              onClick={(e) => {
                e.stopPropagation();
                handleReorderElement(el.id, "up");
              }}
              className={`px-1 py-0.5 text-[9px] rounded hover:bg-black/10 ${isSelected ? "text-white" : "text-slate-500"
                }`}
            >
              ▲
            </button>
            <button
              type="button"
              title="Move Down"
              onClick={(e) => {
                e.stopPropagation();
                handleReorderElement(el.id, "down");
              }}
              className={`px-1 py-0.5 text-[9px] rounded hover:bg-black/10 ${isSelected ? "text-white" : "text-slate-500"
                }`}
            >
              ▼
            </button>
            <button
              type="button"
              title="Delete"
              onClick={(e) => handleDeleteElement(el.id, e)}
              className={`px-1 py-0.5 text-[9px] rounded hover:bg-red-500 hover:text-white ${isSelected ? "text-red-200" : "text-red-500"
                }`}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Render Nested Children if container is expanded */}
        {isContainer && !isCollapsed && el.children && el.children.length > 0 && (
          <div className="space-y-0.5">
            {el.children.map((child, idx) =>
              renderNavigatorTreeItem(
                child,
                depth + 1,
                idx === (el.children?.length ?? 0) - 1
              )
            )}
          </div>
        )}
      </div>
    );
}
