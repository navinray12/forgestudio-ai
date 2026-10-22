import React from "react";
import { updateTreeElement } from "../../utils";
import { MegaMenuWidgetRenderer, OffCanvasWidgetRenderer } from "../../widgets";
import type { EditorElement, ElementStyles, PageConfig } from "../../types";

/** What renderMenuElements reads: renderElementTree's per-element values, then the editor values it closed over. */
export interface MenuElementsContext {
  el: EditorElement;
  mergedStyles: ElementStyles;
  handlePreviewPageNavigate: (targetPage: PageConfig) => void;
  isPreview: boolean;
  pages: PageConfig[];
  renderElementTree: (el: EditorElement) => React.ReactNode;
  setElements: React.Dispatch<React.SetStateAction<EditorElement[]>>;
}

/**
 * Canvas renderers: Mega menu and off-canvas panel.
 * Moved verbatim from renderElementTree's leaf wrapper in WebsiteEditor.tsx (the element-renderer
 * slots for mega-menu, off-canvas). A plain function, called in one slot of the wrapper during
 * the editor's render: it returns a fragment of the original slot expressions in their original order,
 * of which only the slot for el.type renders.
 */
export function renderMenuElements({
  el,
  mergedStyles,
  handlePreviewPageNavigate,
  isPreview,
  pages,
  renderElementTree,
  setElements,
}: MenuElementsContext) {
  return (
    <>
        {el.type === "mega-menu" && (
          <MegaMenuWidgetRenderer
            el={el}
            isPreview={isPreview}
            mergedStyles={mergedStyles}
            pages={pages}
            onUpdateElement={(updater) => {
              setElements((prev) => updateTreeElement(prev, el.id, updater));
            }}
            onNavigatePage={(targetIdOrSlug) => {
              const clean = targetIdOrSlug.replace(/^\//, "");
              const targetPage = pages.find(
                (p) =>
                  p.id === targetIdOrSlug ||
                  p.slug === targetIdOrSlug ||
                  p.slug === `/${clean}` ||
                  p.slug.replace(/^\//, "") === clean ||
                  p.name.toLowerCase() === targetIdOrSlug.toLowerCase() ||
                  (clean === "" && (p.isHome || p.id === "home"))
              );
              if (targetPage) {
                handlePreviewPageNavigate(targetPage);
              }
            }}
          />
        )}

        {el.type === "off-canvas" && (
          <OffCanvasWidgetRenderer
            el={el}
            isPreview={isPreview}
            mergedStyles={mergedStyles}
            renderChildren={(childElements) =>
              (childElements || []).map((child) => renderElementTree(child))
            }
          />
        )}
    </>
  );
}
