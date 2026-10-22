import type { StaticElementContext } from "../elementContext.js";
import { escapeHtml } from "../htmlSafety.js";
import { resolveStaticHtmlHref } from "../links.js";

// Navigation elements: nav menu, mega menu, menu anchor, search form, taxonomy filter, post navigation
// and breadcrumbs.
// Each function is one case of renderElementToHtml (staticHtml/renderElement.ts), moved verbatim from
// staticCompiler.ts.

// case "nav-menu"
export function renderNavMenuElement({ el, allPages, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const navItems = Array.isArray(el.navMenuItems) ? el.navMenuItems : (Array.isArray(el.items) ? el.items : []);
  const itemsHtml = navItems.map((item: any) => {
    const itemHref = resolveStaticHtmlHref(item.url || item.href || (item.pageId ? `page:${item.pageId}` : ""), allPages);
    const subItems = Array.isArray(item.submenu) ? item.submenu : [];
    let subHtml = "";
    if (subItems.length > 0) {
      subHtml = `\n<ul class="sub-menu">\n${subItems.map((s: any) => {
        const sHref = resolveStaticHtmlHref(s.url || s.href || (s.pageId ? `page:${s.pageId}` : ""), allPages);
        return `<li><a href="${escapeHtml(sHref)}">${escapeHtml(s.label || s.title || "Link")}</a></li>`;
      }).join("\n")}\n</ul>`;
    }
    return `<li><a href="${escapeHtml(itemHref)}">${escapeHtml(item.label || item.title || "Link")}</a>${subHtml}</li>`;
  }).join("\n");
  return `<nav class="nav-menu"${idAttr}${classAttr}${styleAttr}>\n<ul>\n${itemsHtml}\n</ul>\n</nav>`;
}

// case "mega-menu"
export function renderMegaMenuElement({ el, allPages, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  let megaCategories: any[] = [];
  if (Array.isArray(el.megaMenuItems) && el.megaMenuItems.length > 0) {
    megaCategories = el.megaMenuItems;
  } else if (Array.isArray(el.columns) && el.columns.length > 0) {
    megaCategories = [{ title: el.title || "Menu", columns: el.columns }];
  } else if (typeof el.content === "string" && el.content.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(el.content);
      if (Array.isArray(parsed)) {
        if (parsed.length > 0 && parsed[0].links) {
          megaCategories = [{ title: el.title || "Menu", columns: parsed }];
        } else {
          megaCategories = parsed;
        }
      }
    } catch {
      // ignore JSON parse error
    }
  }

  const categoriesHtml = megaCategories.map((cat: any) => {
    const catHref = cat.href ? resolveStaticHtmlHref(cat.href || (cat.pageId ? `page:${cat.pageId}` : ""), allPages) : "";
    const catTitle = catHref
      ? `<a href="${escapeHtml(catHref)}" class="fs-mega-category-title">${escapeHtml(cat.title || "")}</a>`
      : `<span class="fs-mega-category-title">${escapeHtml(cat.title || "")}</span>`;
    const cols = Array.isArray(cat.columns) ? cat.columns : [];
    const colsHtml = cols.map((col: any) => {
      const links = Array.isArray(col.links) ? col.links : [];
      const linksHtml = links.map((link: any) => {
        const lHref = resolveStaticHtmlHref(link.href || link.url || (link.pageId ? `page:${link.pageId}` : ""), allPages);
        const badgeHtml = link.badge ? ` <span class="fs-mega-badge">${escapeHtml(link.badge)}</span>` : "";
        const descHtml = link.description ? `<span class="fs-mega-desc">${escapeHtml(link.description)}</span>` : "";
        return `<li><a href="${escapeHtml(lHref)}">${escapeHtml(link.label || link.title || "Link")}${badgeHtml}</a>${descHtml}</li>`;
      }).join("\n");
      return `<div class="fs-mega-col">
            ${col.title ? `<h4 class="fs-mega-col-title">${escapeHtml(col.title)}</h4>` : ""}
            <ul class="fs-mega-links">\n${linksHtml}\n</ul>
          </div>`;
    }).join("\n");

    return `<div class="fs-mega-category">
          ${catTitle}
          <div class="fs-mega-dropdown">\n${colsHtml}\n</div>
        </div>`;
  }).join("\n");

  let promoHtml = "";
  const showPromo = el.megaMenuPromoEnabled === true || el.megaMenuPromoEnabled === "true" || el.styles?.megaMenuPromoEnabled === "true";
  if (showPromo || el.megaMenuPromoTitle || el.styles?.megaMenuPromoTitle) {
    const pTitle = el.megaMenuPromoTitle || el.styles?.megaMenuPromoTitle || "Special Offer";
    const pText = el.megaMenuPromoText || el.styles?.megaMenuPromoText || "";
    const pBtn = el.megaMenuPromoButtonText || el.styles?.megaMenuPromoButtonText || "Learn More";
    const pUrl = resolveStaticHtmlHref(el.megaMenuPromoButtonUrl || el.styles?.megaMenuPromoButtonUrl || "#", allPages);
    promoHtml = `\n<div class="fs-mega-promo">
          <h4>${escapeHtml(pTitle)}</h4>
          ${pText ? `<p>${escapeHtml(pText)}</p>` : ""}
          <a href="${escapeHtml(pUrl)}" class="btn fs-mega-promo-btn">${escapeHtml(pBtn)}</a>
        </div>`;
  }

  return `<nav class="fs-mega-menu"${idAttr}${classAttr}${styleAttr}>\n<div class="fs-mega-categories">\n${categoriesHtml}\n</div>${promoHtml}\n</nav>`;
}

// case "menu-anchor"
export function renderMenuAnchorElement({ el, classAttr }: StaticElementContext): string {
  const anchorRaw = el.anchorId || el.styles?.anchorId || el.content || el.id || "anchor";
  const anchorTarget = String(anchorRaw).replace(/^#/, "");
  const offsetRaw = el.anchorOffset || el.styles?.anchorScrollOffset || 80;
  const offsetNum = typeof offsetRaw === "number" ? offsetRaw : (parseInt(String(offsetRaw), 10) || 80);
  return `<div id="${escapeHtml(anchorTarget)}" class="fs-menu-anchor"${classAttr} style="scroll-margin-top: ${offsetNum}px; height: 0;"></div>`;
}

// case "search-bar", "search-form", "site-search"
export function renderSearchBarElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const actionUrl = el.searchRedirectUrl || el.formActionUrl || el.styles?.formActionUrl || "/search";
  const method = el.formMethod || el.styles?.formMethod || "GET";
  const paramName = el.formParamName || el.styles?.formParamName || "q";
  const placeholder = el.searchPlaceholder || el.styles?.searchPlaceholder || el.formPlaceholder || el.styles?.formPlaceholder || el.content || "Search...";
  const buttonText = el.searchButtonText || el.styles?.searchButtonText || el.formButtonText || el.styles?.formButtonText || el.buttonText || "Search";
  return `<form action="${escapeHtml(actionUrl)}" method="${escapeHtml(method)}" class="fs-search-form"${idAttr}${classAttr}${styleAttr}>\n<input type="search" name="${escapeHtml(paramName)}" placeholder="${escapeHtml(placeholder)}" class="fs-search-input" />\n<button type="submit" class="fs-search-btn">${escapeHtml(buttonText)}</button>\n</form>`;
}

// case "taxonomy-filter"
export function renderTaxonomyFilterElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  let taxItems = Array.isArray(el.taxonomyItems) ? el.taxonomyItems : [];
  if (taxItems.length === 0 && typeof el.content === "string" && el.content.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(el.content);
      if (Array.isArray(parsed)) taxItems = parsed;
    } catch {
      // ignore JSON parse error
    }
  }
  const targetGrid = el.targetGridId || el.styles?.targetGridId || "";
  const buttonsHtml = taxItems.map((item: any) => {
    const slug = item.slug || item.id || "";
    const label = item.label || item.name || item.title || "Topic";
    const count = item.count !== undefined ? item.count : 0;
    return `<button class="fs-tax-btn" data-slug="${escapeHtml(slug)}">${escapeHtml(label)} (${count})</button>`;
  }).join("");
  return `<div class="fs-taxonomy-filter"${idAttr}${classAttr}${styleAttr} data-target-grid="${escapeHtml(targetGrid)}">${buttonsHtml}</div>`;
}

// case "post-nav"
export function renderPostNavElement({ el, allPages, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const prevUrl = resolveStaticHtmlHref(el.prevUrl || el.styles?.postNavPrevUrl || "#", allPages);
  const prevTitle = el.prevTitle || el.styles?.postNavPrevTitle || el.postNavPrevLabel || "Previous";
  const nextUrl = resolveStaticHtmlHref(el.nextUrl || el.styles?.postNavNextUrl || "#", allPages);
  const nextTitle = el.nextTitle || el.styles?.postNavNextTitle || el.postNavNextLabel || "Next";
  return `<nav class="fs-post-navigation"${idAttr}${classAttr}${styleAttr} aria-label="Post Navigation">\n<div class="fs-post-prev"><a href="${escapeHtml(prevUrl)}">← ${escapeHtml(prevTitle)}</a></div>\n<div class="fs-post-next"><a href="${escapeHtml(nextUrl)}">${escapeHtml(nextTitle)} →</a></div>\n</nav>`;
}

// case "breadcrumbs"
export function renderBreadcrumbsElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  return `<nav aria-label="Breadcrumb" class="fs-breadcrumbs"${idAttr}${classAttr}${styleAttr}>
        <ol>
          <li><a href="index.html">Home</a></li>
          <li><span>›</span></li>
          <li aria-current="page">${escapeHtml(el.currentLabel || el.content || "Page")}</li>
        </ol>
      </nav>`;
}
