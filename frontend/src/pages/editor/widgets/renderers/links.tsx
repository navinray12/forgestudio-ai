/**
 * links. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import type { PageConfig } from "../../types";

export interface ResolveForgeLinkOptions {
  pages?: PageConfig[];
  homePageId?: string;
  websiteId?: string;
  isPublicSite?: boolean;
}

export interface ResolvedForgeLink {
  resolvedUrl: string;
  targetPage?: PageConfig;
  isAnchor: boolean;
  isExternal: boolean;
  isUnsafe: boolean;
}

/**
 * Universal canonical link resolver for ForgeStudio.
 * Resolves Page links, Custom URLs, Anchors, and External URLs consistently.
 */
export function resolveForgeLink(
  rawLink: string | undefined,
  pageId: string | undefined,
  destinationType: string | undefined,
  options: ResolveForgeLinkOptions = {}
): ResolvedForgeLink {
  const { pages = [], homePageId, websiteId, isPublicSite } = options;
  const raw = (rawLink || "").trim();

  // Security: block unsafe protocols (javascript:, data:, vbscript:)
  const isUnsafe = /^(javascript|data|vbscript):/i.test(raw);
  if (isUnsafe) {
    return { resolvedUrl: "#", isAnchor: true, isExternal: false, isUnsafe: true };
  }

  // Anchor check: #pricing
  const isAnchor = raw.startsWith("#");
  if (isAnchor) {
    return { resolvedUrl: raw, isAnchor: true, isExternal: false, isUnsafe: false };
  }

  // External URL check: http://, https://, mailto:, tel:
  const isExternal = /^(https?:\/\/|mailto:|tel:)/i.test(raw);
  if (isExternal) {
    return { resolvedUrl: raw, isAnchor: false, isExternal: true, isUnsafe: false };
  }

  // Internal Page resolution by pageId, page: prefix, or matching slug/path
  let targetPage: PageConfig | undefined;
  if (pageId && pages.length > 0) {
    targetPage = pages.find((p) => p.id === pageId);
  }
  if (!targetPage && raw.startsWith("page:")) {
    const pId = raw.replace("page:", "").trim();
    targetPage = pages.find((p) => p.id === pId);
  }
  if (!targetPage && raw && pages.length > 0) {
    const withoutHash = raw.split("#")[0];
    const pathOnly = withoutHash.split("?")[0];
    const clean = pathOnly.replace(/^\//, "").trim();

    targetPage = pages.find(
      (p) =>
        p.slug === pathOnly ||
        p.slug === `/${clean}` ||
        p.slug.replace(/^\//, "") === clean ||
        p.id === clean ||
        p.name.toLowerCase() === clean.toLowerCase() ||
        (clean === "" && (p.isHome || p.id === homePageId || p.id === "home"))
    );
  }

  if (targetPage) {
    const isHome = targetPage.isHome || targetPage.slug === "/" || targetPage.id === homePageId || targetPage.id === "home";
    const cleanSlug = targetPage.slug.replace(/^\//, "");
    const queryAndHash = raw.includes("?") || raw.includes("#")
      ? raw.substring(raw.indexOf(raw.includes("?") ? "?" : "#"))
      : "";

    if (isPublicSite && websiteId) {
      const publicPath = isHome
        ? `/site/${websiteId}${queryAndHash}`
        : `/site/${websiteId}/${cleanSlug}${queryAndHash}`;
      return { resolvedUrl: publicPath, targetPage, isAnchor: false, isExternal: false, isUnsafe: false };
    }

    const standardPath = isHome ? `/${queryAndHash}` : `/${cleanSlug}${queryAndHash}`;
    return { resolvedUrl: standardPath, targetPage, isAnchor: false, isExternal: false, isUnsafe: false };
  }

  // Fallback: custom URL that does not match an existing internal page
  return {
    resolvedUrl: raw || "#",
    isAnchor: false,
    isExternal: false,
    isUnsafe: false,
  };
}
