import type { SitePartSection, SitePartsConfig } from "../types";

/**
 * A site part (header, footer, theme template) is shown unless explicitly disabled. Draft documents
 * use `enabled`; published snapshots and older documents use `isEnabled`. When both are present
 * `enabled` wins, which is how the editor canvas has always resolved them.
 */
export const isSitePartEnabled = (part?: Partial<SitePartSection> | null): boolean =>
  part?.enabled ?? part?.isEnabled ?? true;

const THEME_TEMPLATE_PARTS = ["single", "archive", "notFound404", "searchResults"] as const;

/**
 * The site parts the editor holds after loading a stored document: header and footer always, the
 * theme templates when the document has them, each as { enabled, elements } with the flag resolved.
 */
export function loadSiteParts(stored: Record<string, any>): SitePartsConfig {
  const load = (part: any): SitePartSection => ({
    enabled: isSitePartEnabled(part),
    elements: Array.isArray(part?.elements) ? part.elements : [],
  });
  const parts: SitePartsConfig = { header: load(stored.header), footer: load(stored.footer) };
  for (const name of THEME_TEMPLATE_PARTS) if (stored[name]) parts[name] = load(stored[name]);
  return parts;
}
