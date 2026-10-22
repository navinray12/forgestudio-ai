import type { EditorElement, PageConfig, ThemeBuilderScope } from "../types";

/** The editor state the canonical page list is built from. */
export interface CanonicalPagesInput {
  pages: PageConfig[];
  activePageId: string;
  canvasMode: ThemeBuilderScope;
  elements: EditorElement[];
  pageSettings: { title?: string; path?: string; [key: string]: any };
}

/**
 * The page list with the page being edited brought up to date: in page canvas mode, every page whose
 * id is the active page id gets the canvas elements and page settings (by reference) and takes its
 * name / slug from the settings title / path when those are set. Other pages are returned as the same
 * objects; outside page mode nothing is merged. Moved verbatim from WebsiteEditor's canonicalPages
 * useMemo, which still memoises it with the same dependency list.
 */
export function buildCanonicalPages({ pages, activePageId, canvasMode, elements, pageSettings }: CanonicalPagesInput) {
  return pages.map((p) =>
    p.id === activePageId && canvasMode === "page"
      ? {
        ...p,
        elements,
        pageSettings,
        name: pageSettings.title || p.name,
        slug: pageSettings.path || p.slug,
      }
      : p
  );
}
