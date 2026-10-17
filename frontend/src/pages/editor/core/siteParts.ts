import type { SitePartSection, SitePartsConfig } from "../types";

/**
 * A site part (header, footer, theme template) is shown unless explicitly disabled. Draft documents
 * use `enabled`; published snapshots and older documents use `isEnabled`. When both are present
 * `enabled` wins, which is how the editor canvas has always resolved them.
 */
export const isSitePartEnabled = (part?: Partial<SitePartSection> | null): boolean =>
  part?.enabled ?? part?.isEnabled ?? true;

/**
 * The declared site-part metadata the editor does not edit but must carry through load, save and
 * publish unchanged: `conditions` (display rules, see matchesThemeCondition) and `customCss`.
 * Only keys present on the part are copied, so documents without them serialise as before.
 */
export function sitePartMetadata(part?: Partial<SitePartSection> | null): Pick<SitePartSection, "conditions" | "customCss"> {
  const metadata: Pick<SitePartSection, "conditions" | "customCss"> = {};
  if (part?.conditions !== undefined) metadata.conditions = part.conditions;
  if (part?.customCss !== undefined) metadata.customCss = part.customCss;
  return metadata;
}

const THEME_TEMPLATE_PARTS = ["single", "archive", "notFound404", "searchResults"] as const;

/**
 * The site parts the editor holds after loading a stored document: header and footer always, the
 * theme templates when the document has them, each as { enabled, elements } with the flag resolved,
 * plus their declared metadata (conditions, customCss) when present.
 */
export function loadSiteParts(stored: Record<string, any>): SitePartsConfig {
  const load = (part: any): SitePartSection => ({
    enabled: isSitePartEnabled(part),
    elements: Array.isArray(part?.elements) ? part.elements : [],
    ...sitePartMetadata(part),
  });
  const parts: SitePartsConfig = { header: load(stored.header), footer: load(stored.footer) };
  for (const name of THEME_TEMPLATE_PARTS) if (stored[name]) parts[name] = load(stored[name]);
  return parts;
}
