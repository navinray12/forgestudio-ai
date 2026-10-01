import { createHash } from "node:crypto";
import { load } from "cheerio";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import type { AnyNode, Element } from "domhandler";
import { AppError } from "../../../utils/app-error.js";
import type { JsonObject } from "../../../services/websites/document-policy.js";
import type { DesignConverter } from "./contracts.js";

const properties = new Set(`display position top right bottom left z-index width min-width max-width height min-height max-height padding padding-top padding-right padding-bottom padding-left margin margin-top margin-right margin-bottom margin-left gap row-gap column-gap flex flex-direction flex-wrap flex-grow flex-shrink flex-basis align-items align-self justify-content justify-self grid-template-columns grid-template-rows grid-column grid-row color background background-color background-image font-family font-size font-weight font-style line-height letter-spacing text-align text-decoration text-transform white-space overflow-wrap word-break border border-width border-style border-color border-top border-right border-bottom border-left border-radius box-shadow opacity overflow overflow-x overflow-y box-sizing object-fit list-style list-style-type`.split(" "));
export class ConversionError extends AppError {
  constructor(readonly issues: string[]) { super("The design uses unsupported structure or styling", 422, "AI_CONVERSION_UNSUPPORTED"); }
}
export function safeDesignStyles(styles: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(styles)) {
    const css = key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
    if (!properties.has(css) || value.length > 300 || /url\s*\(|expression\s*\(|javascript|[<>;{}\\]/i.test(value)) throw new ConversionError(["UNSAFE_OR_UNSUPPORTED_STYLE"]);
    result[css.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())] = value;
  }
  return result;
}
/** No DOM browser, network, eval or imported code. CSS is resolved at editor
 * breakpoints and stored on individual, stable native nodes. */
export class HtmlDesignConverter implements DesignConverter {
  async convert(html: string, namespace: string): Promise<JsonObject[]> {
    if (Buffer.byteLength(html) > 1024 * 1024) throw new ConversionError(["HTML_SIZE_LIMIT"]);
    const $ = load(html);
    const issues = new Set<string>();
    if ($("*").length > 1800) throw new ConversionError(["ELEMENT_LIMIT"]);
    $("script").each((_index, el) => {
      // Tailwind CDN is replaced with a pinned, offline compiler; never executed.
      if (!/^https:\/\/cdn\.tailwindcss\.com(?:[/?]|$)/.test($(el).attr("src") || "") || $(el).text().trim()) issues.add("SCRIPT_OR_CUSTOM_TAILWIND_CONFIG");
    });
    if ($("iframe,object,embed,canvas,svg,img,video,audio,form,input,textarea,select").length) issues.add("UNSUPPORTED_ASSET_OR_FUNCTIONAL_WIDGET");
    if ($("link[rel=stylesheet]").length) issues.add("EXTERNAL_STYLESHEET");
    const styleTexts = $("style").toArray().map(el => $(el).text());
    if (Buffer.byteLength(styleTexts.join("")) > 200_000) throw new ConversionError(["CSS_SIZE_LIMIT"]);
    const compiled = await postcss([tailwindcss({ content: [{ raw: html, extension: "html" }], corePlugins: { preflight: false }, theme: {}, plugins: [] })]).process("@tailwind utilities;", { from: undefined });
    const css = postcss.parse([...styleTexts, compiled.css].join("\n"));
    const rules: Array<{ selector: string; widthMin: number; widthMax: number; weight: number; styles: Record<string, string> }> = [];
    css.walkAtRules(at => { if (!["media"].includes(at.name)) issues.add("UNSUPPORTED_CSS_AT_RULE"); });
    css.walkRules(rule => {
      if (rules.length > 5000) throw new ConversionError(["CSS_RULE_LIMIT"]);
      let min = 0, max = Infinity;
      let parent = rule.parent;
      while (parent && parent.type !== "root") {
        if (parent.type === "atrule" && parent.name === "media") {
          const matches = [...parent.params.matchAll(/\((min|max)-width:\s*([\d.]+)(px|rem)\)/g)];
          if (!matches.length || /prefers|orientation|print/.test(parent.params)) { issues.add("UNSUPPORTED_MEDIA_QUERY"); return; }
          for (const match of matches) { const width = Number(match[2]) * (match[3] === "rem" ? 16 : 1); if (match[1] === "min") min = Math.max(min, width); else max = Math.min(max, width); }
        }
        parent = parent.parent;
      }
      const styles: Record<string, string> = {};
      rule.walkDecls(decl => {
        if (decl.important) issues.add("UNSUPPORTED_CSS_IMPORTANT");
        if (decl.prop.startsWith("--")) { styles[decl.prop] = decl.value; return; }
        if (!properties.has(decl.prop)) { issues.add("UNSUPPORTED_CSS_PROPERTY"); return; }
        if (/url\s*\(|expression\s*\(|javascript|[<>;{}\\]/i.test(decl.value)) { issues.add("UNSAFE_CSS_VALUE"); return; }
        styles[decl.prop] = decl.value;
      });
      for (const selector of rule.selectors) {
        if (/(?<!\\):/.test(selector) && selector !== ":root") { issues.add("UNSUPPORTED_PSEUDO_SELECTOR"); continue; }
        const weight = (selector.match(/#/g)?.length ?? 0) * 100 + (selector.match(/[.\[]/g)?.length ?? 0) * 10 + (selector.match(/(?:^|\s|>)\w/g)?.length ?? 0);
        rules.push({ selector, widthMin: min, widthMax: max, weight, styles });
      }
    });
    rules.sort((a, b) => a.weight - b.weight);
    const inheritedKeys = new Set(["color", "font-family", "font-size", "font-weight", "line-height", "letter-spacing", "text-align"]);
    let count = 0;
    const walk = (node: AnyNode, path: string, inherited: Record<string, string>[], depth: number): JsonObject | null => {
      if (depth > 22 || ++count > 1800) throw new ConversionError(["ELEMENT_COMPLEXITY_LIMIT"]);
      if (node.type === "text") {
        const text = node.data.replace(/\s+/g, " ").trim();
        return text ? { id: createHash("sha256").update(`${namespace}:${path}`).digest("hex").slice(0, 24), type: "text", content: text, styles: { color: "inherit", fontSize: "inherit", margin: "0" } } : null;
      }
      if (node.type !== "tag") return null;
      const el = node as Element, tag = el.name;
      if (["style", "script", "link", "meta", "title"].includes(tag)) return null;
      if (!/^(body|header|nav|main|footer|section|article|div|h[1-6]|p|span|strong|em|ul|ol|li|a|button|br)$/.test(tag)) { issues.add("UNSUPPORTED_HTML_TAG"); return null; }
      if (Object.keys(el.attribs).some(key => /^on/i.test(key))) issues.add("EVENT_HANDLER");
      const computed = [1440, 768, 390].map((width, index) => {
        const resolved = { ...inherited[index] };
        for (const rule of rules) if (width >= rule.widthMin && width <= rule.widthMax) {
          try { if (rule.selector === ":root") Object.assign(resolved, Object.fromEntries(Object.entries(rule.styles).filter(([key]) => inheritedKeys.has(key) || key.startsWith("--")))); else if ($(el).is(rule.selector)) Object.assign(resolved, rule.styles); }
          catch { issues.add("UNSUPPORTED_CSS_SELECTOR"); }
        }
        try { postcss.parse(`a{${el.attribs.style || ""}}`).walkDecls(decl => { if (decl.important) issues.add("UNSUPPORTED_CSS_IMPORTANT"); resolved[decl.prop] = decl.value; }); }
        catch { issues.add("INVALID_INLINE_CSS"); }
        return resolved;
      });
      const styles = computed.map(style => {
        const output: Record<string, string> = {};
        for (const [key, original] of Object.entries(style)) {
          if (key.startsWith("--")) continue;
          let value = original;
          for (let i = 0; i < 8 && value.includes("var("); i++) value = value.replace(/var\((--[\w-]+)(?:,\s*([^()]*))?\)/g, (_match, variable: string, fallback: string) => style[variable] ?? fallback ?? "");
          if (value.includes("var(")) { issues.add("UNRESOLVED_CSS_VARIABLE"); continue; }
          const camel = key.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
          try { Object.assign(output, safeDesignStyles({ [camel]: value })); } catch { issues.add("UNSAFE_OR_UNSUPPORTED_STYLE"); }
        }
        // The canonical editor stores opacity as a percentage and spacing on
        // four sides. Expand shorthand so inspector edits retain CSS semantics.
        if (output.opacity) output.opacity = String(Number(output.opacity) * 100);
        if (output.backgroundImage) {
          if (/^(?:linear|radial|conic|repeating-linear|repeating-radial)-gradient\(/.test(output.backgroundImage)) output.background = output.backgroundImage;
          else if (output.backgroundImage !== "none") issues.add("UNSUPPORTED_BACKGROUND_IMAGE");
          delete output.backgroundImage;
        }
        for (const kind of ["padding", "margin"]) {
          const parts = (output[kind] || "0px").trim().split(/\s+(?![^()]*\))/);
          if (parts.length > 4) { issues.add("INVALID_SPACING"); continue; }
          const sides = [parts[0], parts[1] || parts[0], parts[2] || parts[0], parts[3] || parts[1] || parts[0]];
          ["Top", "Right", "Bottom", "Left"].forEach((side, index) => { output[kind + side] ??= sides[index]!; });
          delete output[kind];
        }
        return { boxSizing: "border-box", color: tag === "body" ? "#172033" : "inherit", fontFamily: tag === "body" ? "system-ui, sans-serif" : "inherit", ...output };
      });
      const childrenInherited = computed.map(style => Object.fromEntries(Object.entries(style).filter(([key]) => inheritedKeys.has(key) || key.startsWith("--"))));
      const children = el.children.map((child, index) => walk(child, `${path}.${index}`, childrenInherited, depth + 1)).filter((child): child is JsonObject => child !== null);
      const id = createHash("sha256").update(`${namespace}:${path}`).digest("hex").slice(0, 24);
      const type = /^h[1-6]$/.test(tag) ? "heading" : ["a", "button"].includes(tag) ? "button" : ["p", "span", "strong", "em", "li", "br"].includes(tag) ? "text" : "container";
      const href = el.attribs.href;
      if (type === "button" && (!href || !/^\/(?!\/)[a-z0-9/-]*$/.test(href))) issues.add("UNRESOLVED_LINK");
      if (type !== "container" && children.some(child => child.type === "container" || child.type === "button")) issues.add("COMPLEX_INLINE_CONTENT");
      if (type !== "container" && el.children.some(child => child.type === "tag")) issues.add("RICH_INLINE_CONTENT_REQUIRES_REPAIR");
      const layout = (style: Record<string, string>) => ({ layoutType: style.display === "grid" ? "grid" : "flex", direction: style.display?.includes("flex") ? style.flexDirection || "row" : "column", flexWrap: style.flexWrap || "nowrap", alignItems: style.alignItems || "stretch", justifyContent: style.justifyContent || "flex-start", gap: style.gap && /^\d+(?:\.\d+)?px$/.test(style.gap) ? parseFloat(style.gap) : 0, ...(style.gridTemplateColumns ? { gridTemplateColumns: style.gridTemplateColumns } : {}) });
      return { id, type, content: type === "container" ? tag : $(el).text().trim(), ...(href ? { href } : {}),
        ...(type === "heading" ? { headingLevel: tag } : {}),
        styles: styles[0]!, responsiveStyles: { tablet: styles[1]!, mobile: styles[2]! },
        ...(type === "container" ? { children, layout: layout(styles[0]!), responsiveLayout: { tablet: layout(styles[1]!), mobile: layout(styles[2]!) } } : {}),
      };
    };
    const body = $("body").get(0)!;
    const result = walk(body, "root", [{}, {}, {}], 0);
    if (issues.size) throw new ConversionError([...issues].sort());
    if (!result) throw new ConversionError(["EMPTY_DOCUMENT"]);
    return [result];
  }
}
