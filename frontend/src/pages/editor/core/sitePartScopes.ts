import type { EditorElement, SitePartsConfig, ThemeBuilderScope } from "../types";

/**
 * Theme Builder canvas scopes and the site part each one edits, moved from WebsiteEditor.tsx (the
 * canvas-mode switch and the Theme Builder sync effect wrote the same mapping inline). "page" edits the
 * active page, not a site part.
 */
export const SITE_PART_KEY_BY_SCOPE = {
  header: "header",
  footer: "footer",
  single: "single",
  archive: "archive",
  "404": "notFound404",
  "search-results": "searchResults",
} as const satisfies Partial<Record<ThemeBuilderScope, keyof SitePartsConfig>>;

export type SitePartScope = keyof typeof SITE_PART_KEY_BY_SCOPE;
export type SitePartKey = (typeof SITE_PART_KEY_BY_SCOPE)[SitePartScope];

/** The site part a canvas scope edits, or undefined for "page" (and anything else). */
export function sitePartKeyForScope(scope: ThemeBuilderScope): SitePartKey | undefined {
  return Object.prototype.hasOwnProperty.call(SITE_PART_KEY_BY_SCOPE, scope) ? SITE_PART_KEY_BY_SCOPE[scope as SitePartScope] : undefined;
}

/**
 * The site parts with one part's elements replaced (and any extra fields set after them). Everything
 * else on the part is kept as it was: enabled / isEnabled, conditions, customCss, other fields.
 */
export function withSitePartElements(prev: SitePartsConfig, part: SitePartKey, elements: EditorElement[], extra?: { isEnabled: true }): SitePartsConfig {
  return {
    ...prev,
    [part]: extra ? { ...prev[part], elements, ...extra } : { ...prev[part], elements },
  };
}
