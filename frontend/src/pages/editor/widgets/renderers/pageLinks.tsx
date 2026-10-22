/**
 * pageLinks. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import type { EditorElement, PageConfig } from "../../types";

export interface LinkedPageStatus {
  isLinkedToPage: boolean;
  pageExists: boolean;
  pageName?: string;
  pageSlug?: string;
}

/**
 * Resolves destination URL for buttons & link elements dynamically.
 * Prioritizes stable pageId matching over static hrefs.
 */
export const resolveButtonHref = (el: EditorElement, pages?: PageConfig[]): string => {
  const isCustomUrl = el.destinationType === "url" || el.linkType === "url";
  const rawUrl = el.href || el.linkUrl;

  // 1. Explicit Custom URL mode with non-empty URL
  if (isCustomUrl && rawUrl && rawUrl.trim() !== "") {
    return rawUrl.trim();
  }

  // 2. Bound to internal page by pageId
  if (el.pageId && pages && pages.length > 0) {
    const page = pages.find((p) => p.id === el.pageId);
    if (page) {
      return page.slug === "home" || page.isHome ? "/" : (page.slug.startsWith("/") ? page.slug : `/${page.slug}`);
    }
  }

  // 3. Fallback raw URL if available
  if (rawUrl && rawUrl.trim() !== "") {
    const trimmed = rawUrl.trim();
    if (pages && pages.length > 0) {
      const pageBySlug = pages.find((p) => p.slug === trimmed || (trimmed.startsWith("/") && p.slug === trimmed));
      if (pageBySlug) {
        return pageBySlug.slug === "home" || pageBySlug.isHome ? "/" : (pageBySlug.slug.startsWith("/") ? pageBySlug.slug : `/${pageBySlug.slug}`);
      }
    }
    return trimmed;
  }

  // 4. Default Home page route fallback
  const homePage = pages?.find((p) => p.isHome || p.id === "home") || pages?.[0];
  if (homePage) {
    return homePage.slug === "home" || homePage.isHome ? "/" : (homePage.slug.startsWith("/") ? homePage.slug : `/${homePage.slug}`);
  }

  return "/";
};

/**
 * Evaluates whether a button or link points to a valid internal page.
 */
export const getLinkedPageStatus = (el: EditorElement, pages?: PageConfig[]): LinkedPageStatus => {
  const isPageLink = el.destinationType === "page" || el.linkType === "page" || Boolean(el.pageId);
  if (!isPageLink) {
    return { isLinkedToPage: false, pageExists: true };
  }

  if (el.pageId) {
    const page = pages?.find((p) => p.id === el.pageId);
    if (page) {
      return { isLinkedToPage: true, pageExists: true, pageName: page.name, pageSlug: page.slug };
    }
    return { isLinkedToPage: true, pageExists: false };
  }

  const rawUrl = el.href || el.linkUrl;
  if (rawUrl && pages) {
    const page = pages.find((p) => p.slug === rawUrl || (rawUrl.startsWith("/") && p.slug === rawUrl));
    if (page) {
      return { isLinkedToPage: true, pageExists: true, pageName: page.name, pageSlug: page.slug };
    }
  }

  return { isLinkedToPage: true, pageExists: false };
};
