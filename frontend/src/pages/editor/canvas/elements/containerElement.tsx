import React from "react";
import { compilePositioningStyles } from "../../core/styleCompilers";
import { getElementBreadcrumbPath, getMergedLayout } from "../../utils";
import type { DeviceMode, EditorElement, ElementStyles } from "../../types";

/** What renderContainerElement reads: renderElementTree's per-element values, then the editor values it closed over. */
export interface ContainerElementContext {
  customAttrProps: any;
  el: EditorElement;
  isSelected: boolean;
  mergedStyles: ElementStyles;
  motionAttrs: Record<string, string>;
  stickyStyles: React.CSSProperties;
  activeDevice: DeviceMode;
  compileBackgroundAndBorderStyles: (mergedStyles: ElementStyles) => React.CSSProperties;
  copiedStyles: { styles?: ElementStyles | undefined; responsiveStyles?: Partial<Record<DeviceMode, Partial<ElementStyles>>> | undefined; hoverStyles?: Partial<ElementStyles> | undefined; responsiveHoverStyles?: Partial<Record<DeviceMode, Partial<ElementStyles>>> | undefined; } | null;
  draggingId: string | null;
  dropPosition: "before" | "after" | "inside" | null;
  dropTargetId: string | null;
  elements: EditorElement[];
  handleCanvasAutoScroll: (e: React.DragEvent<Element>) => void;
  handleCopyElement: (idToCopy?: string | null | undefined, e?: React.MouseEvent<Element, MouseEvent> | undefined) => void;
  handleCopyStyle: (idToCopy?: string | null | undefined, e?: React.MouseEvent<Element, MouseEvent> | undefined) => void;
  handleDeleteElement: (id: string, e?: React.MouseEvent<Element, MouseEvent> | undefined) => void;
  handleDragOverElement: (e: React.DragEvent<Element>, elId: string, isContainer: boolean) => void;
  handleDropElement: (e: React.DragEvent<Element>, targetId?: string | null, position?: "before" | "after" | "inside" | null) => void;
  handleDuplicateElement: (idToDuplicate?: string | null | undefined, e?: React.MouseEvent<Element, MouseEvent> | undefined) => void;
  handlePasteStyle: (idToPaste?: string | null | undefined, e?: React.MouseEvent<Element, MouseEvent> | undefined) => void;
  handleReorderElement: (id: string, direction: "up" | "down") => void;
  handleSaveAsComponent: (elementId: string) => void;
  handleSelectElement: (id: string | null, e?: React.MouseEvent<Element, MouseEvent> | undefined) => void;
  hoveredId: string | null;
  isPreview: boolean;
  renderElementTree: (el: EditorElement) => React.ReactNode;
  setContextMenu: React.Dispatch<React.SetStateAction<{ x: number; y: number; elementId: string; } | null>>;
  setDraggingId: React.Dispatch<React.SetStateAction<string | null>>;
  setDropPosition: React.Dispatch<React.SetStateAction<"before" | "after" | "inside" | null>>;
  setDropTargetId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
}

/**
 * Canvas renderer for container elements (layout, drag and drop, drop indicators, hover / selection
 * chrome and toolbar, recursion into children through renderElementTree), moved verbatim from the
 * `if (el.type === "container")` block of renderElementTree in WebsiteEditor.tsx. A plain function called
 * during the editor's render; the editor returns its result, as the block returned its JSX.
 */
export function renderContainerElement({
  customAttrProps,
  el,
  isSelected,
  mergedStyles,
  motionAttrs,
  stickyStyles,
  activeDevice,
  compileBackgroundAndBorderStyles,
  copiedStyles,
  draggingId,
  dropPosition,
  dropTargetId,
  elements,
  handleCanvasAutoScroll,
  handleCopyElement,
  handleCopyStyle,
  handleDeleteElement,
  handleDragOverElement,
  handleDropElement,
  handleDuplicateElement,
  handlePasteStyle,
  handleReorderElement,
  handleSaveAsComponent,
  handleSelectElement,
  hoveredId,
  isPreview,
  renderElementTree,
  setContextMenu,
  setDraggingId,
  setDropPosition,
  setDropTargetId,
  setSelectedId,
}: ContainerElementContext): React.ReactNode {
      const mergedLayout = getMergedLayout(el, activeDevice);
      const isHovered = hoveredId === el.id && !isSelected && !isPreview;
      const path = isSelected ? getElementBreadcrumbPath(elements, el.id) : null;

      const isDropTarget = dropTargetId === el.id && !isPreview;

      return (
        <div
          key={el.id}
          id={el.customId || undefined}
          {...customAttrProps}
          {...(isPreview ? motionAttrs : {})}
          data-el-id={el.id}
          draggable={!isPreview}
          onDragStart={(e) => {
            e.stopPropagation();
            e.dataTransfer.setData("application/json", JSON.stringify({ type: "move", id: el.id }));
            e.dataTransfer.effectAllowed = "move";
            if (!isPreview) handleSelectElement(el.id, e);
            setDraggingId(el.id);
          }}
          onDragOver={(e) => {
            handleCanvasAutoScroll(e);
            handleDragOverElement(e, el.id, true);
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            if (dropTargetId === el.id) {
              setDropTargetId(null);
              setDropPosition(null);
            }
          }}
          onDrop={(e) => {
            handleDropElement(e, el.id, dropPosition);
          }}
          onDragEnd={(e) => {
            e.stopPropagation();
            setDraggingId(null);
            setDropTargetId(null);
            setDropPosition(null);
          }}
          {...customAttrProps}
          onClick={(e) => {
            e.stopPropagation();
            if (!isPreview) handleSelectElement(el.id, e);
          }}
          className={`relative transition-all duration-150 ${el.id} ${el.customClass || ""} ${draggingId === el.id ? "opacity-40 scale-[0.99]" : ""
            } ${isPreview ? "" : "cursor-grab active:cursor-grabbing hover:outline hover:outline-1 hover:outline-blue-400/60"
            } ${isSelected ? "border-2 border-blue-500 shadow-sm" : isPreview ? "" : "border border-dashed border-slate-300"}`}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isPreview) {
              handleSelectElement(el.id, e);
              setContextMenu({ x: e.clientX, y: e.clientY, elementId: el.id });
            }
          }}
          style={{
            ...stickyStyles,
            boxSizing: "border-box",
            display: mergedLayout.layoutType === "masonry" ? "block" : (mergedLayout.layoutType === "grid" ? "grid" : "flex"),
            columnCount: mergedLayout.layoutType === "masonry" ? (mergedLayout.masonryColumns || 3) : undefined,
            columnGap: mergedLayout.layoutType === "masonry"
              ? `${mergedLayout.masonryGap || mergedLayout.gap || 16}px`
              : (mergedLayout.layoutType === "grid"
                ? (mergedLayout.columnGap !== undefined ? (typeof mergedLayout.columnGap === "number" ? `${mergedLayout.columnGap}px` : mergedLayout.columnGap) : `${mergedLayout.gap ?? 10}px`)
                : undefined),
            flexDirection: (mergedLayout.layoutType === "grid" || mergedLayout.layoutType === "masonry") ? undefined : (mergedLayout.direction || "column"),
            flexWrap: (mergedLayout.layoutType === "grid" || mergedLayout.layoutType === "masonry") ? undefined : (mergedLayout.flexWrap || mergedStyles.flexWrap || (mergedLayout.direction === "row" ? "wrap" : "nowrap")) as any,
            justifyContent: (mergedLayout.layoutType === "grid" || mergedLayout.layoutType === "masonry") ? undefined : (mergedLayout.justifyContent || "flex-start"),
            gridTemplateColumns: mergedLayout.layoutType === "grid" ? (mergedLayout.gridTemplateColumns || "repeat(2, minmax(0, 1fr))") : undefined,
            gridTemplateRows: mergedLayout.layoutType === "grid" ? mergedLayout.gridTemplateRows : undefined,
            gridAutoFlow: mergedLayout.layoutType === "grid" ? (mergedLayout.gridAutoFlow || "row") : undefined,
            justifyItems: mergedLayout.layoutType === "grid" ? mergedLayout.justifyItems : undefined,
            alignItems: mergedLayout.layoutType === "masonry" ? undefined : (mergedLayout.alignItems || "stretch"),
            gap: mergedLayout.layoutType === "masonry" ? undefined : `${mergedLayout.gap ?? 10}px`,
            rowGap: mergedLayout.rowGap !== undefined && mergedLayout.layoutType !== "masonry" ? (typeof mergedLayout.rowGap === "number" ? `${mergedLayout.rowGap}px` : mergedLayout.rowGap) : undefined,
            width: mergedStyles.width || "100%",
            maxWidth: mergedStyles.maxWidth || "100%",
            minWidth: mergedStyles.minWidth || "0px",
            flex: mergedStyles.flex || undefined,
            height: mergedStyles.height || "auto",
            paddingTop: mergedStyles.paddingTop ?? (mergedStyles.padding || "16px"),
            paddingRight: mergedStyles.paddingRight ?? (mergedStyles.padding || "16px"),
            paddingBottom: mergedStyles.paddingBottom ?? (mergedStyles.padding || "16px"),
            paddingLeft: mergedStyles.paddingLeft ?? (mergedStyles.padding || "16px"),
            marginTop: mergedStyles.marginTop ?? "8px",
            marginRight: mergedStyles.marginRight ?? "0px",
            marginBottom: mergedStyles.marginBottom ?? "8px",
            marginLeft: mergedStyles.marginLeft ?? "0px",
            ...compileBackgroundAndBorderStyles(mergedStyles),
            ...compilePositioningStyles(mergedStyles),
            ...Object.fromEntries(["display", "gap", "rowGap", "columnGap", "minHeight", "maxHeight", "flexGrow", "flexShrink", "flexBasis", "gridColumn", "gridRow", "overflow", "overflowX", "overflowY", "color", "fontFamily", "fontSize", "lineHeight"].filter(key => mergedStyles[key] !== undefined).map(key => [key, mergedStyles[key]])),
          }}
        >
          {/* Drop Indicators for Container */}
          {isDropTarget && dropPosition === "before" && (
            <div className="absolute -top-1.5 left-0 right-0 h-1.5 bg-blue-600 rounded-full z-50 pointer-events-none shadow-md animate-pulse" />
          )}
          {isDropTarget && dropPosition === "after" && (
            <div className="absolute -bottom-1.5 left-0 right-0 h-1.5 bg-blue-600 rounded-full z-50 pointer-events-none shadow-md animate-pulse" />
          )}
          {isDropTarget && dropPosition === "inside" && (
            <div className="absolute inset-0 border-2 border-blue-500 border-dashed bg-blue-500/10 z-40 pointer-events-none rounded-lg flex items-center justify-center">
              <span className="bg-blue-600 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full shadow pointer-events-none tracking-wide uppercase">
                Drop Inside Container
              </span>
            </div>
          )}

          {/* F-217: Background Video Layer */}
          {(el.containerBgType === "video" || el.containerVideoUrl) && (
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
              <video
                src={el.containerVideoUrl || "https://assets.mixkit.co/videos/preview/mixkit-set-of-plateaus-seen-from-the-sky-in-a-sunset-26070-large.mp4"}
                autoPlay={el.containerVideoAutoplay ?? true}
                loop={el.containerVideoLoop ?? true}
                muted={el.containerVideoMuted ?? true}
                playsInline
                className="w-full h-full object-cover"
                style={{
                  objectFit: el.containerVideoFit || "cover",
                  objectPosition: el.containerVideoPosition || "center",
                }}
              />
              {el.containerVideoOverlay && (
                <div className="absolute inset-0" style={{ backgroundColor: el.containerVideoOverlay }} />
              )}
            </div>
          )}

          {/* F-218: Background Slideshow Layer */}
          {(el.containerBgType === "slideshow" || (el.containerSlideshowImages && el.containerSlideshowImages.length > 0)) && (
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
              {el.containerSlideshowImages?.map((img, idx) => (
                <img
                  key={img.id || idx}
                  src={img.url}
                  alt="Background Slide"
                  className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
                  style={{ opacity: 1 }}
                />
              )) || (
                  <img
                    src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&auto=format&fit=crop&q=80"
                    alt="Background Slide"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
              {el.containerSlideshowOverlay && (
                <div className="absolute inset-0 z-1" style={{ backgroundColor: el.containerSlideshowOverlay }} />
              )}
            </div>
          )}

          {!isSelected && !isPreview && (
            <span className="absolute top-1 left-2 text-[9px] font-bold text-slate-300 uppercase pointer-events-none select-none z-10">
              Container
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
                <span>Container</span>
              )}
              <span>•</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleReorderElement(el.id, "up");
                }}
                className="hover:underline"
                title="Move Section Up"
              >
                ▲
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleReorderElement(el.id, "down");
                }}
                className="hover:underline"
                title="Move Section Down"
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
                onClick={(e) => {
                  e.stopPropagation();
                  handleSaveAsComponent(el.id);
                }}
                className={`hover:underline ${el.isComponent ? "text-purple-200 font-bold" : "text-blue-100"
                  }`}
                title={el.isComponent ? `Component: ${el.componentName}` : "Save as Reusable Component"}
              >
                {el.isComponent ? "Component 🧩" : "Save Comp"}
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

          {(!el.children || el.children.length === 0) && !isPreview ? (
            <div className="flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 py-6 text-center">
              <span className="text-xs font-bold text-slate-500">Empty Container</span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                Click an element on the left panel to add inside
              </span>
            </div>
          ) : (
            el.children?.map((child) => renderElementTree(child))
          )}
        </div>
      );
}
