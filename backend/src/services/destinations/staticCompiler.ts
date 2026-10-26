import type { StaticBundle, GeneratedFile } from "./types.js";
export type CanonicalSite = any;
import { resolveTokensInTree } from "../website.service.js";
import { generatePageHtml } from "./staticHtml/pageHtml.js";
import { generateGlobalCss } from "./staticHtml/globalCss.js";
import { generateRuntimeJs } from "./staticHtml/runtimeJs.js";

// Static HTML compiler entry point: compileCanonicalToStaticBundle builds the static bundle (styles.css,
// runtime.js, one HTML file per page, 404 / archive / search templates, site-manifest.json). The rendering
// code lives in ./staticHtml/ (element renderers by family, page document, global CSS, runtime JS, escaping
// and link resolution); the exported helpers are re-exported here unchanged.
export { sanitizeCustomHead } from "./staticHtml/htmlSafety.js";
export { resolveStaticHtmlHref } from "./staticHtml/links.js";

/**
 * Compiles CanonicalWebsiteData into a complete static website bundle.
 * Pure deterministic generation: produces exact file lists, sizes, and content.
 */
export function compileCanonicalToStaticBundle(
  websiteId: string,
  version: number,
  websiteData: any
): StaticBundle {
  const files: GeneratedFile[] = [];

  // 1. Compile CSS
  const compiledCss = generateGlobalCss(websiteData);
  files.push({
    path: "styles.css",
    content: compiledCss,
    size: Buffer.byteLength(compiledCss, "utf8"),
    contentType: "text/css",
  });

  // 2. Compile Runtime JS
  const runtimeJs = generateRuntimeJs();
  files.push({
    path: "runtime.js",
    content: runtimeJs,
    size: Buffer.byteLength(runtimeJs, "utf8"),
    contentType: "application/javascript",
  });

  // 3. Resolve pages
  const rawPages = Array.isArray(websiteData.pages) && websiteData.pages.length > 0
    ? websiteData.pages
    : [
        {
          id: websiteData.homePageId || "home",
          title: "Home",
          slug: "",
          isHome: true,
          elements: Array.isArray(websiteData.elements) ? websiteData.elements : [],
        },
      ];

  const homePageExists = websiteData.homePageId && rawPages.some((p: any) => p.id === websiteData.homePageId);
  const homePageId = homePageExists ? websiteData.homePageId : undefined;
  const hasExplicitHome = rawPages.some((p: any) => p.id === homePageId || p.isHome === true);

  const normalizedPages = rawPages.map((p: any, idx: number) => {
    const isHome = p.id === homePageId || p.isHome === true || (!hasExplicitHome && p.isHome !== false && idx === 0);
    return {
      ...p,
      isHome,
      slug: p.slug !== undefined ? p.slug : (isHome ? "" : p.id),
    };
  });

  // Site context for dynamic token resolution
  const siteContext = {
    site: {
      id: websiteId,
      name: websiteData.siteSettings?.siteName || websiteData.name || "ForgeStudio Site",
      slug: websiteData.slug,
      siteSettings: websiteData.siteSettings,
    },
  };

  // 4. Compile HTML for each page
  for (const rawPage of normalizedPages) {
    const pageContext = {
      ...siteContext,
      page: {
        id: rawPage.id,
        name: rawPage.name,
        title: rawPage.title,
        slug: rawPage.slug,
        isHome: rawPage.isHome,
      },
    };

    const resolvedPage = resolveTokensInTree(rawPage, pageContext);
    const resolvedWebsiteData = {
      ...websiteData,
      id: websiteId || websiteData.id,
      websiteId: websiteId || websiteData.websiteId,
      siteParts: websiteData.siteParts ? resolveTokensInTree(websiteData.siteParts, siteContext) : undefined,
    };

    const cleanSlug = (resolvedPage.slug || resolvedPage.id || "page").replace(/^\/+/, "");
    const fileName = resolvedPage.isHome ? "index.html" : `${cleanSlug}.html`;
    const pageHtml = generatePageHtml(resolvedPage, resolvedWebsiteData, normalizedPages, compiledCss);

    files.push({
      path: fileName,
      content: pageHtml,
      size: Buffer.byteLength(pageHtml, "utf8"),
      contentType: "text/html",
    });
  }

  // Compile Specialized Theme Parts (404, archive, search)
  const siteParts = websiteData.siteParts || {};
  const resolvedWebsiteData = {
    ...websiteData,
    id: websiteId || websiteData.id,
    websiteId: websiteId || websiteData.websiteId,
    siteParts: websiteData.siteParts ? resolveTokensInTree(websiteData.siteParts, siteContext) : undefined,
  };

  // 4a. 404 Error Page Template (F-239)
  if (
    siteParts.notFound404 &&
    Array.isArray(siteParts.notFound404.elements) &&
    siteParts.notFound404.elements.length > 0 &&
    (siteParts.notFound404.enabled ?? siteParts.notFound404.isEnabled ?? true)
  ) {
    const page404 = {
      id: "404",
      name: "404 - Page Not Found",
      title: "404 - Page Not Found",
      slug: "404",
      isHome: false,
      elements: siteParts.notFound404.elements,
    };
    const resolved404 = resolveTokensInTree(page404, siteContext);
    const html404 = generatePageHtml(resolved404, resolvedWebsiteData, normalizedPages, compiledCss);
    files.push({
      path: "404.html",
      content: html404,
      size: Buffer.byteLength(html404, "utf8"),
      contentType: "text/html",
    });
  }

  // 4b. Archive Template (F-238)
  if (
    siteParts.archive &&
    Array.isArray(siteParts.archive.elements) &&
    siteParts.archive.elements.length > 0 &&
    (siteParts.archive.enabled ?? siteParts.archive.isEnabled ?? true)
  ) {
    const pageArchive = {
      id: "archive",
      name: "Archive",
      title: "Archive",
      slug: "archive",
      isHome: false,
      elements: siteParts.archive.elements,
    };
    const resolvedArchive = resolveTokensInTree(pageArchive, siteContext);
    const htmlArchive = generatePageHtml(resolvedArchive, resolvedWebsiteData, normalizedPages, compiledCss);
    files.push({
      path: "archive.html",
      content: htmlArchive,
      size: Buffer.byteLength(htmlArchive, "utf8"),
      contentType: "text/html",
    });
  }

  // 4c. Search Results Template (F-240)
  if (
    siteParts.searchResults &&
    Array.isArray(siteParts.searchResults.elements) &&
    siteParts.searchResults.elements.length > 0 &&
    (siteParts.searchResults.enabled ?? siteParts.searchResults.isEnabled ?? true)
  ) {
    const pageSearch = {
      id: "search",
      name: "Search Results",
      title: "Search Results",
      slug: "search",
      isHome: false,
      elements: siteParts.searchResults.elements,
    };
    const resolvedSearch = resolveTokensInTree(pageSearch, siteContext);
    const htmlSearch = generatePageHtml(resolvedSearch, resolvedWebsiteData, normalizedPages, compiledCss);
    files.push({
      path: "search.html",
      content: htmlSearch,
      size: Buffer.byteLength(htmlSearch, "utf8"),
      contentType: "text/html",
    });
  }

  // 5. Compile site-manifest.json
  const manifest = {
    generator: "ForgeStudio v1.0",
    websiteId,
    version,
    generatedAt: new Date().toISOString(),
    pages: normalizedPages.map((p: any) => ({
      id: p.id,
      title: p.title,
      file: p.isHome ? "index.html" : `${p.slug || p.id}.html`,
    })),
    totalFiles: files.length + 1,
  };
  const manifestStr = JSON.stringify(manifest, null, 2);
  files.push({
    path: "site-manifest.json",
    content: manifestStr,
    size: Buffer.byteLength(manifestStr, "utf8"),
    contentType: "application/json",
  });

  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);

  return {
    websiteId,
    version,
    files,
    totalBytes,
    pageCount: normalizedPages.length,
    assetCount: files.length - normalizedPages.length,
    generatedAt: manifest.generatedAt,
  };
}
