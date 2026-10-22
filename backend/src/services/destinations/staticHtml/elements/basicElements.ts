import type { StaticElementContext } from "../elementContext.js";
import { escapeHtml } from "../htmlSafety.js";
import { resolveStaticHtmlHref } from "../links.js";

// Basic content elements: headings, text, buttons, images, dividers, spacers, icons, SVG, alerts,
// blockquotes, code and raw HTML.
// Each function is one case of renderElementToHtml (staticHtml/renderElement.ts), moved verbatim from
// staticCompiler.ts.

// case "heading"
export function renderHeadingElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const level = Math.min(Math.max(el.level || 2, 1), 6);
  return `<h${level}${idAttr}${classAttr}${styleAttr}>${escapeHtml(el.content || el.text || "")}</h${level}>`;
}

// case "text", "paragraph"
export function renderTextElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  return `<p${idAttr}${classAttr}${styleAttr}>${escapeHtml(el.content || el.text || "")}</p>`;
}

// case "button"
export function renderButtonElement({ el, allPages, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const rawHref = el.href || el.linkUrl || el.link || (el.pageId ? `page:${el.pageId}` : "") || "#";
  const href = resolveStaticHtmlHref(rawHref, allPages);
  return `<a href="${escapeHtml(href)}"${idAttr}${classAttr}${styleAttr}>${escapeHtml(el.content || el.text || "Click Here")}</a>`;
}

// case "image"
export function renderImageElement({ el, allPages, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const rawHref = el.href || el.linkUrl || (el.pageId ? `page:${el.pageId}` : "");
  const imgTag = `<img src="${escapeHtml(el.src || "")}" alt="${escapeHtml(el.alt || "")}"${idAttr}${classAttr}${styleAttr} />`;
  if (rawHref) {
    const href = resolveStaticHtmlHref(rawHref, allPages);
    const targetAttr = el.target ? ` target="${escapeHtml(el.target)}"` : "";
    return `<a href="${escapeHtml(href)}"${targetAttr}>${imgTag}</a>`;
  }
  return imgTag;
}

// case "divider"
export function renderDividerElement({ styleAttr, classAttr, idAttr }: StaticElementContext): string {
  return `<hr${idAttr}${classAttr}${styleAttr} />`;
}

// case "spacer"
export function renderSpacerElement({ styleAttr, classAttr, idAttr }: StaticElementContext): string {
  return `<div class="fs-spacer"${idAttr}${classAttr}${styleAttr}></div>`;
}

// case "icon", "icon-library"
export function renderIconElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const iconGlyph = el.iconName || el.icon || "★";
  return `<div class="fs-icon-box"${idAttr}${classAttr}${styleAttr}><span class="fs-icon">${escapeHtml(iconGlyph)}</span>${el.title ? `<h4 class="fs-icon-title">${escapeHtml(el.title)}</h4>` : ""}${el.content ? `<p class="fs-icon-desc">${escapeHtml(el.content)}</p>` : ""}</div>`;
}

// case "custom-svg"
export function renderCustomSvgElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  return `<div class="fs-custom-svg"${idAttr}${classAttr}${styleAttr}>${el.svgRawContent ? el.svgRawContent : (el.svgUrl ? `<img src="${escapeHtml(el.svgUrl)}" alt="SVG" />` : "")}</div>`;
}

// case "code-highlight", "code"
export function renderCodeHighlightElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const lang = el.codeLanguage || "javascript";
  const snippet = el.codeSnippet || el.content || "";
  return `<pre class="fs-code-block"${idAttr}${classAttr}${styleAttr}><code class="language-${escapeHtml(lang)}">${escapeHtml(snippet)}</code></pre>`;
}

// case "alert"
export function renderAlertElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const alertType = el.alertType || "info";
  const iconMap: Record<string, string> = { success: "✓", warning: "⚠", danger: "✕", info: "ℹ" };
  return `<div class="fs-alert fs-alert-${escapeHtml(alertType)}"${idAttr}${classAttr}${styleAttr} role="alert">
        <span class="fs-alert-icon">${iconMap[alertType] || "ℹ"}</span>
        <div class="fs-alert-msg">${escapeHtml(el.content || el.alertMessage || "Notice")}</div>
      </div>`;
}

// case "blockquote"
export function renderBlockquoteElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const author = el.quoteAuthor || el.author || "";
  return `<blockquote class="fs-blockquote"${idAttr}${classAttr}${styleAttr}>
        <p>${escapeHtml(el.quoteContent || el.content || "")}</p>
        ${author ? `<cite>— ${escapeHtml(author)}</cite>` : ""}
      </blockquote>`;
}

// case "customHtml", "rawHtml", "html", "shortcode"
export function renderCustomHtmlElement({ el }: StaticElementContext): string {
  return el.content || el.html || "";
}
