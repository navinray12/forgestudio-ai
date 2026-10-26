import type { PageConfig } from "../types";

/**
 * Pure parts of the editor's WordPress page import listener (the "forgestudio:wp-page-imported" event;
 * the listener, its registration / cleanup and the state updates stay in WebsiteEditor), moved verbatim.
 */

/** The page an import event describes, and its id (forgePageId, else "wp_<wordpressPageId or Date.now()>"). */
export function wordpressImportedPage(data: any): { newPageId: string; importedPage: PageConfig } {
    const newPageId = data.forgePageId || `wp_${data.wordpressPageId || Date.now()}`;
    const importedPage: PageConfig = {
      id: newPageId,
      name: data.pageTitle || data.pageSettings?.title || "WordPress Page",
      slug: data.slug || data.pageSettings?.slug || `wp-${data.wordpressPageId}`,
      elements: data.elements,
      pageSettings: {
        title: data.pageTitle || data.pageSettings?.title || "WordPress Page",
        slug: data.slug || data.pageSettings?.slug || `wp-${data.wordpressPageId}`,
        status: data.status || "publish",
        wordpressPageId: data.wordpressPageId,
      },
    };
  return { newPageId, importedPage };
}

/** The page list with the imported page merged into the page with that id or WordPress id, else appended. */
export function upsertImportedPage(prev: any[], newPageId: string, importedPage: PageConfig, data: any): any[] {
    const existingIdx = prev.findIndex((p) => p.id === newPageId || (p.pageSettings as any)?.wordpressPageId === data.wordpressPageId);
    if (existingIdx !== -1) {
      const updated = [...prev];
      updated[existingIdx] = { ...updated[existingIdx], ...importedPage };
      return updated;
    }
    return [...prev, importedPage];
}
