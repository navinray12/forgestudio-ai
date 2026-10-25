import {
  createDefaultHeaderElements,
  createDefaultSinglePostElements,
  createDefaultArchiveElements,
  createDefault404Elements,
  createDefaultSearchResultsElements,
} from "../navigation/navigationDefaults";
import type { EditorElement, PageConfig, SitePartsConfig, ThemeBuilderScope } from "../types";
import type { SitePartKey } from "./sitePartScopes";

/**
 * Pure parts of WebsiteEditor's handleSwitchCanvasMode (which stays in the editor and makes the same
 * state updates in the same order).
 */

/**
 * The page list with the canvas stored into the active page when leaving page scope: elements and page
 * settings only. Unlike buildCanonicalPages it does not update the page's name / slug from the settings,
 * so the two are intentionally separate.
 */
export function storeCanvasIntoActivePage(pages: PageConfig[], activePageId: string, elements: EditorElement[], pageSettings: any): PageConfig[] {
  return pages.map((p) => (p.id === activePageId ? { ...p, elements, pageSettings } : p));
}

/** What entering a scope loads: its elements and, when it was empty, the defaults to store into its site part. */
export interface CanvasModeTarget {
  elements: EditorElement[];
  seed?: { part: SitePartKey; extra?: { isEnabled: true } };
}

/**
 * The elements a scope opens with: the active page's, or the site part's. An empty header gets the
 * default header (built from the site name and pages), empty single / archive / 404 / search-results
 * parts get their defaults and are enabled (isEnabled: true); an empty footer stays empty.
 */
export function canvasModeTarget(
  mode: ThemeBuilderScope,
  { pages, activePageId, siteParts, siteName }: { pages: PageConfig[]; activePageId: string; siteParts: SitePartsConfig; siteName: () => string }
): CanvasModeTarget | null {
  if (mode === "page") {
    const activePage = pages.find((p) => p.id === activePageId);
    return { elements: activePage?.elements || [] };
  } else if (mode === "header") {
    const current = siteParts.header?.elements || [];
    if (current.length === 0) return { elements: createDefaultHeaderElements(siteName(), pages), seed: { part: "header" } };
    return { elements: current };
  } else if (mode === "footer") {
    return { elements: siteParts.footer?.elements || [] };
  } else if (mode === "single") {
    const current = siteParts.single?.elements || [];
    if (current.length === 0) return { elements: createDefaultSinglePostElements(), seed: { part: "single", extra: { isEnabled: true } } };
    return { elements: current };
  } else if (mode === "archive") {
    const current = siteParts.archive?.elements || [];
    if (current.length === 0) return { elements: createDefaultArchiveElements(), seed: { part: "archive", extra: { isEnabled: true } } };
    return { elements: current };
  } else if (mode === "404") {
    const current = siteParts.notFound404?.elements || [];
    if (current.length === 0) return { elements: createDefault404Elements(), seed: { part: "notFound404", extra: { isEnabled: true } } };
    return { elements: current };
  } else if (mode === "search-results") {
    const current = siteParts.searchResults?.elements || [];
    if (current.length === 0) return { elements: createDefaultSearchResultsElements(), seed: { part: "searchResults", extra: { isEnabled: true } } };
    return { elements: current };
  }
  return null;
}
