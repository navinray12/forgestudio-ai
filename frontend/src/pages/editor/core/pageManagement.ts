import type { PageConfig } from "../types";

/**
 * Pure pieces of the editor's page-management handlers (create, quick-create, switch, preview
 * navigation), moved verbatim from WebsiteEditor.tsx. The handlers themselves stay in the editor:
 * they read and set its state, and keeping them there keeps their identity and timing unchanged.
 */

/** The slug the editor derives from a page name: "/" + lower-case name, runs of other characters as "-", trimmed. */
export function slugFromName(name: string): string {
  return `/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
}

/** A new page id: "page_<Date.now()>_<up to 4 base-36 characters>". */
export function newPageId(): string {
  return `page_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
}

/** The starter page a new page takes its content from: same slug (case-insensitive), or a starter name containing the page name. */
export function findStarterPage(starters: PageConfig[], slug: string, name: string): PageConfig | undefined {
  return starters.find(
    (s) => s.slug.toLowerCase() === slug.toLowerCase() || s.name.toLowerCase().includes(name.toLowerCase())
  );
}

/** The starter's elements when it has any, otherwise an empty canvas. */
export function starterElementsOf(starter: PageConfig | undefined) {
  return starter?.elements && starter.elements.length > 0 ? starter.elements : [];
}

/** A page created from the Add Page modal or the quick-add presets (same fields, same key order). */
export function buildNewPage({ id, name, slug, elements, description, isHome }: {
  id: string;
  name: string;
  slug: string;
  elements: PageConfig["elements"];
  description: string;
  isHome: boolean;
}): PageConfig {
  return {
    id,
    name,
    slug,
    elements,
    pageSettings: {
      title: name,
      path: slug,
      description,
      backgroundColor: "#ffffff",
      isMaintenanceMode: false,
      siteLanguage: "en",
    },
    isHome,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/** A page's settings, or the minimal settings derived from its name and slug. */
export function pageSettingsOf(page: PageConfig) {
  return (
    page.pageSettings || {
      title: page.name,
      path: page.slug,
    }
  );
}

/** The preview's ?page= value: "home" for the home page (by id or "/" slug), otherwise the slug without its leading "/". */
export function previewPageParam(page: PageConfig, homePageId: string): string {
  return page.id === homePageId || page.slug === "/"
    ? "home"
    : page.slug.replace(/^\//, "");
}
