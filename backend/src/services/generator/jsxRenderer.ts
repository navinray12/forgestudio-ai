/**
 * ForgeStudio shared ElementIR -> JSX renderer used by the React (Module 08)
 * and Next.js (Module 09) project generators.
 */

import type { ElementIR } from "../compiler/unifiedCompiler.service.js";
import { stylesToTailwindClasses } from "../codeGenerator.service.js";

export interface RenderContext {
  target: "react" | "next";
  /** Human-readable notices about content that could not be generated faithfully */
  warnings: string[];
  /** Media-query rules collected for the generated stylesheet */
  cssRules: string[];
  uses: { link: boolean; image: boolean; css: boolean };
  breakpoints: { tablet: number; mobile: number };
}

export function createRenderContext(
  target: "react" | "next",
  breakpoints?: Partial<{ tablet: number; mobile: number }>
): RenderContext {
  return {
    target,
    warnings: [],
    cssRules: [],
    uses: { link: false, image: false, css: false },
    breakpoints: {
      tablet: Number(breakpoints?.tablet) > 0 ? Number(breakpoints?.tablet) : 1024,
      mobile: Number(breakpoints?.mobile) > 0 ? Number(breakpoints?.mobile) : 767,
    },
  };
}

export function escapeJsxText(text: string): string {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;");
}

export function escapeAttrValue(val: string): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;")
    .replace(/\r?\n/g, " ");
}

/** Escape a value for use inside a single-quoted JS string literal */
export function escapeJsString(val: string): string {
  return String(val ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, " ")
    .replace(/\u2028|\u2029/g, " ")
    .replace(/<\/(script)/gi, "<\\/$1");
}

const RESERVED_IDENTIFIERS = new Set([
  "Break", "Case", "Catch", "Class", "Const", "Continue", "Debugger", "Default", "Delete",
  "Do", "Else", "Export", "Extends", "False", "Finally", "For", "Function", "If", "Import",
  "In", "Instanceof", "New", "Null", "Return", "Super", "Switch", "This", "Throw", "True",
  "Try", "Typeof", "Var", "Void", "While", "With", "Yield",
  "Object", "Boolean", "Symbol", "Error", "Number", "BigInt", "Math", "Date", "String",
  "RegExp", "Array", "Map", "Set", "Promise", "Proxy", "Reflect", "JSON", "Intl",
]);

/** Build a valid PascalCase JS identifier from arbitrary user text */
export function toComponentIdentifier(raw: string, fallback = "Page"): string {
  const words = String(raw ?? "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);
  let id = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
  if (!id) id = fallback;
  if (/^[0-9]/.test(id)) id = `${fallback}${id}`;
  if (RESERVED_IDENTIFIERS.has(id)) id = `${fallback}${id}`;
  return id;
}

/**
 * Only navigational schemes are allowed in generated links.
 * Script-capable schemes (javascript:, data:, vbscript:) are neutralised.
 */
export function sanitizeHref(raw: unknown): { href: string; blocked: boolean } {
  const href = String(raw ?? "").trim();
  if (!href) return { href: "", blocked: false };
  const compact = href.replace(/[\u0000- ]/g, "").toLowerCase();
  const scheme = compact.match(/^([a-z][a-z0-9+.-]*):/);
  if (scheme && !["http", "https", "mailto", "tel"].includes(scheme[1])) {
    return { href: "#", blocked: true };
  }
  return { href, blocked: false };
}

export function isInternalHref(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

// CSS properties that may be emitted as inline styles. Editor-only style keys
// (backgroundType, backgroundSlideshowUrls, ...) are intentionally excluded.
const CSS_PROPERTIES = new Set(
  (
    "alignContent alignItems alignSelf aspectRatio backdropFilter background backgroundAttachment backgroundBlendMode " +
    "backgroundClip backgroundColor backgroundImage backgroundPosition backgroundRepeat backgroundSize border " +
    "borderBottom borderBottomColor borderBottomLeftRadius borderBottomRightRadius borderBottomStyle borderBottomWidth " +
    "borderCollapse borderColor borderLeft borderLeftColor borderLeftStyle borderLeftWidth borderRadius borderRight " +
    "borderRightColor borderRightStyle borderRightWidth borderSpacing borderStyle borderTop borderTopColor " +
    "borderTopLeftRadius borderTopRightRadius borderTopStyle borderTopWidth borderWidth bottom boxShadow boxSizing " +
    "clipPath color columnCount columnGap cursor display filter flex flexBasis flexDirection flexFlow flexGrow flexShrink flexWrap " +
    "float fontFamily fontSize fontStyle fontVariant fontWeight gap gridArea gridAutoColumns gridAutoFlow gridAutoRows " +
    "gridColumn gridColumnEnd gridColumnStart gridRow gridRowEnd gridRowStart gridTemplateAreas gridTemplateColumns " +
    "gridTemplateRows height inset justifyContent justifyItems justifySelf left letterSpacing lineHeight listStyle " +
    "listStyleType margin marginBottom marginLeft marginRight marginTop maxHeight maxWidth minHeight minWidth " +
    "mixBlendMode objectFit objectPosition opacity order outline outlineColor outlineOffset outlineStyle outlineWidth " +
    "overflow overflowWrap overflowX overflowY padding paddingBottom paddingLeft paddingRight paddingTop placeContent " +
    "placeItems placeSelf pointerEvents position right rotate rowGap scale textAlign textDecoration textDecorationColor " +
    "textIndent textOverflow textShadow textTransform top transform transformOrigin transition translate userSelect " +
    "verticalAlign visibility whiteSpace width wordBreak wordSpacing zIndex"
  ).split(" ")
);

export const UNITLESS = new Set(["opacity", "zIndex", "flexGrow", "flexShrink", "order", "lineHeight", "fontWeight", "flex", "aspectRatio", "scale", "columnCount"]);
const TAILWIND_BREAKPOINTS = new Set(["sm", "md", "lg", "xl", "2xl"]);

function isUsableStyleValue(value: unknown): value is string | number {
  if (typeof value === "number") return Number.isFinite(value);
  return typeof value === "string" && value.trim() !== "";
}

/** Values that could break out of a CSS declaration are never written to a stylesheet */
function isSafeCssValue(value: string): boolean {
  return !/[{}<>;\\]|\/\*|\*\//.test(value) && !/\r|\n/.test(value);
}

function toKebab(prop: string): string {
  return prop.replace(/([A-Z])/g, "-$1").toLowerCase();
}

function cssValue(prop: string, value: string | number): string {
  if (typeof value === "number") return UNITLESS.has(prop) ? String(value) : `${value}px`;
  return value.trim();
}

/**
 * Split editor styles into Tailwind utilities (exact named matches only) and
 * inline styles (everything else), so no supported style is silently lost.
 */
export function splitStyles(styles: Record<string, unknown> | undefined): {
  classes: string[];
  inline: Record<string, string | number>;
} {
  const classes: string[] = [];
  const inline: Record<string, string | number> = {};

  for (const [prop, value] of Object.entries(styles || {})) {
    if (!CSS_PROPERTIES.has(prop) || !isUsableStyleValue(value)) continue;
    const tw = typeof value === "string" ? stylesToTailwindClasses({ [prop]: value }) : [];
    if (tw.length > 0 && tw.every((c) => /^[a-z0-9-]+$/.test(c))) {
      classes.push(...tw);
    } else {
      inline[prop] = typeof value === "number" && !UNITLESS.has(prop) ? `${value}px` : value;
    }
  }

  return { classes, inline };
}

function responsiveToCss(el: ElementIR, forgeId: string, ctx: RenderContext, classes: string[]): boolean {
  let emitted = false;

  for (const [bp, bpStyles] of Object.entries(el.responsiveStyles || {})) {
    if (!bpStyles || typeof bpStyles !== "object" || bp === "desktop") continue;

    if (TAILWIND_BREAKPOINTS.has(bp)) {
      const split = splitStyles(bpStyles);
      classes.push(...split.classes.map((c) => `${bp}:${c}`));
      if (Object.keys(split.inline).length > 0) {
        ctx.warnings.push(
          `Element '${el.id}': some '${bp}' responsive styles have no Tailwind utility and were not generated.`
        );
      }
      continue;
    }

    const maxWidth = bp === "tablet" ? ctx.breakpoints.tablet : bp === "mobile" ? ctx.breakpoints.mobile : null;
    if (maxWidth === null) {
      ctx.warnings.push(`Element '${el.id}': unknown responsive breakpoint '${bp}' was not generated.`);
      continue;
    }

    const decls: string[] = [];
    for (const [prop, value] of Object.entries(bpStyles)) {
      if (!CSS_PROPERTIES.has(prop) || !isUsableStyleValue(value)) continue;
      const rendered = cssValue(prop, value);
      if (!isSafeCssValue(rendered)) {
        ctx.warnings.push(`Element '${el.id}': unsafe '${bp}' value for '${prop}' was not generated.`);
        continue;
      }
      // !important is required to win over the element's inline base styles
      decls.push(`    ${toKebab(prop)}: ${rendered} !important;`);
    }
    if (decls.length > 0) {
      ctx.cssRules.push(`@media (max-width: ${maxWidth}px) {\n  [data-forge-id="${forgeId}"] {\n${decls.join("\n")}\n  }\n}`);
      emitted = true;
    }
  }

  return emitted;
}

function renderText(raw: string, indent: string): string {
  return raw
    .split(/\r?\n/)
    .map((line) => escapeJsxText(line))
    .join(`<br />\n${indent}`);
}

/**
 * Convert an ElementIR node to JSX for the given target framework.
 */
export function renderElementToJsx(el: ElementIR, ctx: RenderContext, indent = "        "): string {
  if (!el) {
    return `${indent}{/* Empty page canvas */}`;
  }
  const { classes: twClasses, inline } = splitStyles(el.styles);
  const classes = [...(el.classes || []).filter((c) => typeof c === "string" && c.trim()), ...twClasses];
  const forgeId = String(el.id || "").replace(/[^a-zA-Z0-9_-]/g, "_");
  const hasResponsiveCss = forgeId ? responsiveToCss(el, forgeId, ctx, classes) : false;

  let tag = el.tag || "div";
  if (!/^[a-z][a-z0-9]*$/.test(tag)) tag = "div";

  let attrs = "";
  if (classes.length > 0) attrs += ` className="${escapeAttrValue(classes.join(" "))}"`;
  if (Object.keys(inline).length > 0) {
    ctx.uses.css = true;
    const body = Object.entries(inline)
      .map(([k, v]) => `${k}: ${typeof v === "number" ? v : JSON.stringify(v)}`)
      .join(", ");
    attrs += ` style={css({ ${body} })}`;
  }
  if (forgeId) attrs += ` data-forge-id="${forgeId}"`;
  if (el.attributes?.["aria-label"]) attrs += ` aria-label="${escapeAttrValue(el.attributes["aria-label"])}"`;
  if (el.attributes?.role) attrs += ` role="${escapeAttrValue(el.attributes.role)}"`;

  const label = el.name || el.type || "element";

  // Images
  if (tag === "img") {
    const src = String(el.props?.src || el.attributes?.src || "").trim();
    const safeSrc = src.startsWith("data:image/") ? src : sanitizeHref(src).href;
    if (!safeSrc || safeSrc === "#") {
      ctx.warnings.push(`Image '${el.id}' has no usable source and was omitted from the generated page.`);
      return `${indent}{/* Image "${escapeJsxText(label).replace(/\*\//g, "")}" has no source set in the editor */}`;
    }
    if (!/^https:\/\//i.test(safeSrc) && !safeSrc.startsWith("data:")) {
      ctx.warnings.push(
        `Image '${el.id}' uses '${safeSrc.slice(0, 80)}', which is not bundled with the export; copy the file into the project's public folder.`
      );
    }
    const alt = String(el.props?.alt || el.attributes?.alt || "");
    if (ctx.target === "next" && /^https:\/\//i.test(safeSrc)) {
      ctx.uses.image = true;
      return `${indent}<Image src="${escapeAttrValue(safeSrc)}" alt="${escapeAttrValue(alt)}" width={800} height={500}${attrs} />`;
    }
    return `${indent}<img src="${escapeAttrValue(safeSrc)}" alt="${escapeAttrValue(alt)}"${attrs} />`;
  }

  if (tag === "video") {
    const src = sanitizeHref(el.props?.src || el.attributes?.src).href;
    if (!src || src === "#") {
      ctx.warnings.push(`Video '${el.id}' has no usable source and was omitted from the generated page.`);
      return `${indent}{/* Video "${escapeJsxText(label).replace(/\*\//g, "")}" has no source set in the editor */}`;
    }
    return `${indent}<video src="${escapeAttrValue(src)}" controls${attrs} />`;
  }

  if (tag === "hr" || tag === "br") {
    return `${indent}<${tag}${attrs} />`;
  }

  if (tag === "input") {
    const type = el.attributes?.type || el.props?.type || "text";
    const placeholder = el.props?.placeholder || el.attributes?.placeholder;
    return `${indent}<input type="${escapeAttrValue(type)}"${placeholder ? ` placeholder="${escapeAttrValue(placeholder)}"` : ""}${attrs} />`;
  }

  // Links (anchors, and buttons that navigate)
  const rawHref = el.props?.href || el.attributes?.href;
  const { href, blocked } = sanitizeHref(rawHref);
  if (blocked) {
    ctx.warnings.push(`Element '${el.id}': link target with an unsafe URL scheme was replaced with '#'.`);
  }

  let open = tag;
  let close = tag;
  if (tag === "a" || (tag === "button" && href && href !== "#")) {
    const target = String(el.props?.target || "");
    const targetAttr = target === "_blank" ? ` target="_blank" rel="noopener noreferrer"` : "";
    if (href && isInternalHref(href)) {
      ctx.uses.link = true;
      open = `Link ${ctx.target === "react" ? "to" : "href"}="${escapeAttrValue(href)}"${targetAttr}`;
      close = "Link";
    } else {
      open = `a href="${escapeAttrValue(href || "#")}"${targetAttr}`;
      close = "a";
    }
  } else if (tag === "button") {
    open = `button type="${escapeAttrValue(el.props?.type || el.attributes?.type || "button")}"`;
  }

  const rawText = el.textContent ?? el.props?.content ?? el.props?.buttonText ?? "";
  const hasText = typeof rawText === "string" && rawText.trim() !== "";
  const hasChildren = Array.isArray(el.children) && el.children.length > 0;

  if (!hasChildren) {
    return `${indent}<${open}${attrs}>${hasText ? renderText(rawText, indent) : ""}</${close}>`;
  }

  const childJsx = el.children.map((c) => renderElementToJsx(c, ctx, indent + "  ")).join("\n");
  return `${indent}<${open}${attrs}>\n${hasText ? `${indent}  ${renderText(rawText, indent + "  ")}\n` : ""}${childJsx}\n${indent}</${close}>`;
}

/** Stylesheet holding design tokens, responsive overrides and user custom CSS */
export function buildForgeStylesheet(
  designTokens: Record<string, any> | undefined,
  cssRules: string[],
  customCss: string | undefined
): string {
  const lines: string[] = ["/* Generated by ForgeStudio: design tokens, responsive overrides and custom CSS */"];

  const vars: string[] = [];
  for (const group of ["colors", "spacing", "radius", "shadows"]) {
    const tokens = designTokens?.[group];
    if (!tokens || typeof tokens !== "object") continue;
    for (const [name, value] of Object.entries(tokens)) {
      if (typeof value !== "string" || !isSafeCssValue(value)) continue;
      const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "-");
      if (safeName) vars.push(`  --forge-${group}-${safeName}: ${value.trim()};`);
    }
  }
  if (vars.length > 0) lines.push(`:root {\n${vars.join("\n")}\n}`);

  lines.push(...cssRules);

  if (customCss && customCss.trim()) {
    lines.push(`/* Custom CSS from the visual editor */\n${customCss.replace(/<\/style/gi, "")}`);
  }

  return lines.join("\n\n") + "\n";
}

export const FORGE_CSS_HELPER_SOURCE = `import type { CSSProperties } from 'react';

/** Typed pass-through for inline styles exported from the ForgeStudio visual editor */
export function css(styles: Record<string, string | number>): CSSProperties {
  return styles as CSSProperties;
}
`;
