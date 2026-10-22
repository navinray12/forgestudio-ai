import { matchesThemeCondition } from "../../website.service.js";
import { isSitePartEnabled } from "../../../utils/site-part-visibility.js";
import { escapeJsonLd, generateStructuredData } from "../../seo/seoAnalyzer.service.js";
import { escapeHtml, sanitizeCustomHead } from "./htmlSafety.js";
import { renderElementToHtml } from "./renderElement.js";

// Full HTML document for one page: head (title, SEO / social metadata, structured data, sanitized custom
// head), site header and footer parts, page elements. Moved verbatim from staticCompiler.ts.

export function generatePageHtml(
  page: any,
  websiteData: any,
  allPages: any[],
  compiledCss: string
): string {
  const siteSettings = websiteData.siteSettings || {};
  const pSettings = page.pageSettings || {};
  const rawTitle = pSettings.title || page.title || page.name || "";
  const pageTitle = rawTitle
    ? `${rawTitle} | ${siteSettings.siteName || websiteData.name || "ForgeStudio"}`
    : siteSettings.siteName || websiteData.name || "ForgeStudio";
  const metaDesc = pSettings.description || page.metaDescription || siteSettings.metaDescription || "";
  const favicon = siteSettings.favicon || "/favicon.ico";

  // OpenGraph & Social Metadata with Site-wide Fallback Inheritance
  const ogTitle = pSettings.ogTitle || rawTitle || pageTitle;
  const ogDesc = pSettings.ogDescription || metaDesc;
  const ogImg = pSettings.ogImage || siteSettings.ogImage || siteSettings.logo || "";
  const canonicalUrl = pSettings.canonicalUrl || "";

  // Twitter Card Metadata
  const twitterCard = pSettings.twitterCard || siteSettings.twitterCard || (ogImg ? "summary_large_image" : "summary");
  const twitterTitle = pSettings.twitterTitle || ogTitle;
  const twitterDesc = pSettings.twitterDescription || ogDesc;
  const twitterImg = pSettings.twitterImage || ogImg;

  // Structured Data (Schema.org JSON-LD)
  let structuredDataScript = "";
  const structuredDataConfig = pSettings.structuredData || siteSettings.structuredData;
  const schemaType = pSettings.schemaType || siteSettings.schemaType;
  if (structuredDataConfig) {
    structuredDataScript = `<script type="application/ld+json">\n${escapeJsonLd(structuredDataConfig)}\n</script>`;
  } else if (schemaType) {
    const generated = generateStructuredData(schemaType, page, websiteData);
    structuredDataScript = `<script type="application/ld+json">\n${escapeJsonLd(generated)}\n</script>`;
  }

  // Robots Directives
  const robotsDirectives: string[] = [];
  if (pSettings.noindex) robotsDirectives.push("noindex");
  if (pSettings.nofollow) robotsDirectives.push("nofollow");

  // Site Header (enabled unless explicitly disabled, `enabled` wins over `isEnabled`; plus theme conditions)
  const currentWebsiteId = websiteData.id || websiteData.websiteId || "";
  let headerHtml = "";
  const headerPart = websiteData.siteParts?.header;
  const headerMatches = matchesThemeCondition(headerPart?.conditions, {
    pageId: page.id,
    isHome: page.isHome,
    slug: page.slug,
  });
  if (headerMatches && headerPart && isSitePartEnabled(headerPart) && Array.isArray(headerPart.elements) && headerPart.elements.length > 0) {
    headerHtml = `<header class="site-header">\n${headerPart.elements.map((el: any) => renderElementToHtml(el, allPages, currentWebsiteId)).join("\n")}\n</header>`;
  }

  // Page Elements
  const pageElements = Array.isArray(page.elements) ? page.elements : [];
  const mainContent = pageElements.map((el: any) => renderElementToHtml(el, allPages, currentWebsiteId)).join("\n");

  // Site Footer (enabled unless explicitly disabled, `enabled` wins over `isEnabled`; plus theme conditions)
  let footerHtml = "";
  const footerPart = websiteData.siteParts?.footer;
  const footerMatches = matchesThemeCondition(footerPart?.conditions, {
    pageId: page.id,
    isHome: page.isHome,
    slug: page.slug,
  });
  if (footerMatches && footerPart && isSitePartEnabled(footerPart) && Array.isArray(footerPart.elements) && footerPart.elements.length > 0) {
    footerHtml = `<footer class="site-footer">\n${footerPart.elements.map((el: any) => renderElementToHtml(el, allPages, currentWebsiteId)).join("\n")}\n</footer>`;
  }

  return `<!DOCTYPE html>
<html lang="${escapeHtml(siteSettings.siteLanguage || pSettings.siteLanguage || "en")}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(pageTitle)}</title>
  ${metaDesc ? `<meta name="description" content="${escapeHtml(metaDesc)}">` : ""}
  ${robotsDirectives.length > 0 ? `<meta name="robots" content="${escapeHtml(robotsDirectives.join(", "))}">` : ""}
  ${canonicalUrl ? `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">` : ""}
  <meta property="og:title" content="${escapeHtml(ogTitle)}">
  ${ogDesc ? `<meta property="og:description" content="${escapeHtml(ogDesc)}">` : ""}
  ${ogImg ? `<meta property="og:image" content="${escapeHtml(ogImg)}">` : ""}
  <meta name="twitter:card" content="${escapeHtml(twitterCard)}">
  <meta name="twitter:title" content="${escapeHtml(twitterTitle)}">
  ${twitterDesc ? `<meta name="twitter:description" content="${escapeHtml(twitterDesc)}">` : ""}
  ${twitterImg ? `<meta name="twitter:image" content="${escapeHtml(twitterImg)}">` : ""}
  <link rel="icon" href="${escapeHtml(favicon)}">
  <link rel="stylesheet" href="styles.css">
  ${structuredDataScript ? `${structuredDataScript}` : ""}
  ${sanitizeCustomHead(siteSettings.customHead)}
  ${sanitizeCustomHead(pSettings.customHead)}
</head>
<body>
  ${headerHtml}
  <main class="page-content">
    ${mainContent}
  </main>
  ${footerHtml}
  <script src="runtime.js"></script>
</body>
</html>`;
}
