import type { StaticElementContext } from "../elementContext.js";
import { escapeHtml } from "../htmlSafety.js";

// Layout elements that render children recursively: containers / sections / divs (flex, grid,
// masonry), columns, and the fallback for unknown types.
// Each function is one case of renderElementToHtml (staticHtml/renderElement.ts), moved verbatim from
// staticCompiler.ts.

// case "container", "section", "div", "div-block"
export function renderContainerElement({ el, allPages, websiteId, styleObj, classAttr, idAttr, renderElementToHtml }: StaticElementContext): string {
  const children = Array.isArray(el.elements) ? el.elements : (Array.isArray(el.children) ? el.children : []);
  const childrenHtml = children.map((child: any) => renderElementToHtml(child, allPages, websiteId)).join("\n");

  const layout = el.layout || {};
  const isMasonry = layout.layoutType === "masonry";
  const isGrid = layout.layoutType === "grid";
  const containerStyles: Record<string, any> = {
    ...styleObj,
    display: isMasonry ? "block" : (isGrid ? "grid" : (styleObj.display || "flex")),
  };
  if (isMasonry) {
    containerStyles["column-count"] = layout.masonryColumns || 3;
    containerStyles["column-gap"] = layout.columnGap !== undefined
      ? (typeof layout.columnGap === "number" ? `${layout.columnGap}px` : layout.columnGap)
      : (layout.gap !== undefined ? `${layout.gap}px` : "16px");
  } else if (isGrid) {
    containerStyles["grid-template-columns"] = layout.gridTemplateColumns || "repeat(2, minmax(0, 1fr))";
    if (layout.gridTemplateRows) containerStyles["grid-template-rows"] = layout.gridTemplateRows;
    if (layout.gridAutoFlow) containerStyles["grid-auto-flow"] = layout.gridAutoFlow;
    if (layout.justifyItems) containerStyles["justify-items"] = layout.justifyItems;
    if (layout.alignItems) containerStyles["align-items"] = layout.alignItems;
    if (layout.gap !== undefined) containerStyles["gap"] = `${layout.gap}px`;
    if (layout.rowGap !== undefined) containerStyles["row-gap"] = typeof layout.rowGap === "number" ? `${layout.rowGap}px` : layout.rowGap;
    if (layout.columnGap !== undefined) containerStyles["column-gap"] = typeof layout.columnGap === "number" ? `${layout.columnGap}px` : layout.columnGap;
  } else {
    containerStyles["flex-direction"] = layout.direction || "column";
    containerStyles["justify-content"] = layout.justifyContent || "flex-start";
    containerStyles["align-items"] = layout.alignItems || "stretch";
    if (layout.gap !== undefined) containerStyles["gap"] = `${layout.gap}px`;
    if (layout.rowGap !== undefined) containerStyles["row-gap"] = typeof layout.rowGap === "number" ? `${layout.rowGap}px` : layout.rowGap;
    if (layout.columnGap !== undefined) containerStyles["column-gap"] = typeof layout.columnGap === "number" ? `${layout.columnGap}px` : layout.columnGap;
  }

  if (layout.scrollSnapType && layout.scrollSnapType !== "none") {
    containerStyles["scroll-snap-type"] = layout.scrollSnapType;
  }
  if (layout.overflowX) {
    containerStyles["overflow-x"] = layout.overflowX;
  }
  if (layout.overflowY) {
    containerStyles["overflow-y"] = layout.overflowY;
  }

  const containerCss = Object.entries(containerStyles)
    .filter(([_, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}: ${v}`)
    .join("; ");
  const containerStyleAttr = containerCss ? ` style="${escapeHtml(containerCss)}"` : "";

  return `<div${idAttr}${classAttr}${containerStyleAttr}>\n${childrenHtml}\n</div>`;
}

// case "columns"
export function renderColumnsElement({ el, allPages, websiteId, styleAttr, idAttr, renderElementToHtml }: StaticElementContext): string {
  const cols = Array.isArray(el.columns) ? el.columns : [];
  const colsHtml = cols
    .map((col: any) => {
      const colChildren = Array.isArray(col.elements) ? col.elements : (Array.isArray(col.children) ? col.children : []);
      const childrenHtml = colChildren.map((child: any) => renderElementToHtml(child, allPages, websiteId)).join("\n");
      return `<div class="col" style="flex: ${col.width || 1};">\n${childrenHtml}\n</div>`;
    })
    .join("\n");
  return `<div${idAttr} class="row ${escapeHtml(el.className || "")}"${styleAttr} style="display: flex; gap: 1rem;">\n${colsHtml}\n</div>`;
}

// case default
export function renderFallbackElement({ el, allPages, websiteId, styleAttr, classAttr, idAttr, renderElementToHtml }: StaticElementContext): string {
  const children = Array.isArray(el.elements) ? el.elements : (Array.isArray(el.children) ? el.children : []);
  const fallbackChildren = children.length > 0
    ? children.map((child: any) => renderElementToHtml(child, allPages, websiteId)).join("\n")
    : escapeHtml(el.content || "");
  return `<div${idAttr}${classAttr}${styleAttr}>${fallbackChildren}</div>`;
}
