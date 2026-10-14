import { createHash } from "node:crypto";
import { load } from "cheerio";
import postcss from "postcss";
import tailwindPostcss from "@tailwindcss/postcss";
import type { AnyNode, Element } from "domhandler";
import { AppError } from "../../../utils/app-error.js";
import type { JsonObject } from "../../../services/websites/document-policy.js";
import type { DesignConverter } from "./contracts.js";

const properties = new Set(`display position top right bottom left z-index width min-width max-width height min-height max-height padding padding-top padding-right padding-bottom padding-left margin margin-top margin-right margin-bottom margin-left gap row-gap column-gap flex flex-direction flex-wrap flex-grow flex-shrink flex-basis align-items align-self justify-content justify-self grid-template-columns grid-template-rows grid-column grid-row color background background-color background-image font-family font-size font-weight font-style line-height letter-spacing text-align text-decoration text-transform white-space overflow-wrap word-break border border-width border-style border-color border-top border-right border-bottom border-left border-top-width border-right-width border-bottom-width border-left-width border-top-style border-right-style border-bottom-style border-left-style border-top-color border-right-color border-bottom-color border-left-color border-radius box-shadow opacity overflow overflow-x overflow-y box-sizing object-fit list-style list-style-type -webkit-font-smoothing -moz-osx-font-smoothing`.split(" "));
export class ConversionError extends AppError {
  constructor(readonly issues: string[]) { super("The design uses unsupported structure or styling", 422, "AI_CONVERSION_UNSUPPORTED"); }
}
export function safeDesignStyles(styles: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(styles)) {
    const css = key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
    if (!properties.has(css) || value.length > 300 || /url\s*\(|expression\s*\(|javascript|[<>;{}\\]/i.test(value)) {
      continue;
    }
    result[css.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())] = value;
  }
  return result;
}
/** No DOM browser, network, eval or imported code. CSS is resolved at editor
 * breakpoints and stored on individual, stable native nodes. */
export class HtmlDesignConverter implements DesignConverter {
  async convert(html: string, namespace: string): Promise<JsonObject[]> {
    if (Buffer.byteLength(html) > 1024 * 1024) throw new ConversionError(["HTML_SIZE_LIMIT"]);
    if (!/<(?:html|body|header|main|footer|section|article|div|h[1-6]|p|span|a)(?:\s|>)/i.test(html)) throw new ConversionError(["HTML_PAGE_REQUIRED"]);
    const $ = load(html);
    // Unsafe provider exports must fail closed. Silently stripping active content
    // can conceal an incomplete or unsafe conversion from the editor.
    if ($("script,iframe,object,embed").length) throw new ConversionError(["ACTIVE_CONTENT_UNSUPPORTED"]);
    if ($("link[href],style").toArray().some(element => {
      const item = $(element);
      return element.type === "tag" && element.name === "link"
        ? Boolean(item.attr("href"))
        : /url\s*\(|@import\b|expression\s*\(/i.test(item.html() || "");
    })) throw new ConversionError(["EXTERNAL_STYLES_UNSUPPORTED"]);
    if ($("*").toArray().some(element => {
      if (element.type !== "tag") return false;
      return Object.entries(element.attribs).some(([name, value]) =>
        /^on/i.test(name) || /url\s*\(|expression\s*\(|javascript\s*:/i.test(value)
      );
    })) throw new ConversionError(["UNSAFE_ATTRIBUTE"]);
    if ($("*").length > 1800) throw new ConversionError(["ELEMENT_LIMIT"]);

    // Strip scripts, external links, and unsupported media elements cleanly
    $("script").remove();
    $("link[rel=stylesheet]").remove();
    $("iframe,object,embed,canvas,video,audio").remove();

    // Transform SVG elements into styled inline containers
    $("svg").each((_index: number, el: AnyNode) => {
      $(el).replaceWith('<div style="display:inline-block;width:24px;height:24px;background-color:currentColor;opacity:0.3;border-radius:4px;"></div>');
    });

    // Transform images into native responsive containers
    $("img").each((_index: number, el: AnyNode) => {
      const w = $(el).attr("width") || "100%";
      const h = $(el).attr("height") || "240px";
      const styleW = w.includes("%") || w.includes("px") ? w : `${w}px`;
      const styleH = h.includes("%") || h.includes("px") ? h : `${h}px`;
      $(el).replaceWith(`<div style="display:block;width:${styleW};height:${styleH};background-color:#e2e8f0;border-radius:8px;"></div>`);
    });

    // Transform form controls into editable container representations
    $("form").each((_index: number, el: AnyNode) => {
      $(el).replaceWith(`<div>${$(el).html()}</div>`);
    });
    $("input,textarea,select").each((_index: number, el: AnyNode) => {
      $(el).replaceWith('<div style="display:inline-block;padding:8px 16px;border:1px solid #cbd5e1;border-radius:6px;background-color:#f8fafc;color:#94a3b8;font-size:14px;">Input field</div>');
    });

    const styleTexts = $("style").toArray().map((el: AnyNode) => $(el).text());
    if (Buffer.byteLength(styleTexts.join("")) > 200_000) throw new ConversionError(["CSS_SIZE_LIMIT"]);
    const utilityClasses = $("[class]").toArray().map((el: AnyNode) => $(el).attr("class") || "").join(" ");
    // Compile only explicitly imported utility classes; never scan local files.
    const classNames = [...new Set(utilityClasses.split(/\s+/).filter(value =>
      value.length > 0 && value.length <= 120 && !/[{};"\\]/.test(value)
    ))].slice(0, 300);
    const inlineSources = classNames.map(value => `@source inline("${value}");`).join("\n");
    const compiled = await postcss([tailwindPostcss()]).process(
      `@import "tailwindcss" source(none);\n${inlineSources}`,
      { from: undefined }
    );
    const generated = postcss.parse(compiled.css);
    // Do not apply Tailwind preflight rules to editable native nodes.
    generated.walkAtRules("layer", layer => {
      if (layer.params === "base") layer.remove();
    });
    const css = postcss.parse([...styleTexts, generated.toString()].join("\n"));
    const rules: Array<{ selector: string; widthMin: number; widthMax: number; weight: number; styles: Record<string, string> }> = [];
    css.walkAtRules(() => { /* Decorative at-rules ignored */ });
    css.walkRules(rule => {
      if (rules.length > 5000) throw new ConversionError(["CSS_RULE_LIMIT"]);
      let min = 0, max = Infinity;
      let parent = rule.parent;
      while (parent && parent.type !== "root") {
        if (parent.type === "atrule" && parent.name === "media") {
          const matches = [...parent.params.matchAll(/\((min|max)-width:\s*([\d.]+)(px|rem)\)/g)];
          if (!matches.length || /prefers|orientation|print/.test(parent.params)) { return; }
          for (const match of matches) { const width = Number(match[2]) * (match[3] === "rem" ? 16 : 1); if (match[1] === "min") min = Math.max(min, width); else max = Math.min(max, width); }
        }
        parent = parent.parent;
      }
      const styles: Record<string, string> = {};
      rule.walkDecls(decl => {
        if (decl.important) decl.important = false;
        if (decl.prop.startsWith("--")) { styles[decl.prop] = decl.value; return; }
        if (!properties.has(decl.prop)) return;
        if (/url\s*\(|expression\s*\(|javascript|[<>;{}\\]/i.test(decl.value)) return;
        styles[decl.prop] = decl.value;
      });
      for (const selector of rule.selectors) {
        if (/(?<!\\):/.test(selector) && selector !== ":root") continue;
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
      const el = node as Element;
      let tag = el.name.toLowerCase();
      if (["style", "script", "link", "meta", "title", "noscript"].includes(tag)) return null;
      if (tag === "b") tag = "strong";
      else if (tag === "i") tag = "em";
      else if (["small", "time", "label", "code", "kbd"].includes(tag)) tag = "span";
      else if (["aside", "figure", "figcaption"].includes(tag)) tag = "div";
      else if (!/^(body|header|nav|main|footer|section|article|div|h[1-6]|p|span|strong|em|ul|ol|li|a|button|br)$/.test(tag)) {
        tag = "div";
      }

      const computed = [1440, 768, 390].map((width, index) => {
        const resolved = { ...inherited[index] };
        for (const rule of rules) if (width >= rule.widthMin && width <= rule.widthMax) {
          try { if (rule.selector === ":root") Object.assign(resolved, Object.fromEntries(Object.entries(rule.styles).filter(([key]) => inheritedKeys.has(key) || key.startsWith("--")))); else if ($(el).is(rule.selector)) Object.assign(resolved, rule.styles); }
          catch {}
        }
        try { postcss.parse(`a{${el.attribs.style || ""}}`).walkDecls(decl => { resolved[decl.prop] = decl.value; }); }
        catch {}
        return resolved;
      });
      const styles = computed.map(style => {
        const output: Record<string, string> = {};
        for (const [key, original] of Object.entries(style)) {
          if (key.startsWith("--")) continue;
          let value = original;
          for (let i = 0; i < 8 && value.includes("var("); i++) value = value.replace(/var\((--[\w-]+)(?:,\s*([^()]*))?\)/g, (_match, variable: string, fallback: string) => style[variable] ?? fallback ?? "");
          if (value.includes("var(")) continue;
          const camel = key.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
          Object.assign(output, safeDesignStyles({ [camel]: value }));
        }
        if (output.opacity) output.opacity = String(Number(output.opacity) * 100);
        if (output.backgroundImage) {
          if (/^(?:linear|radial|conic|repeating-linear|repeating-radial)-gradient\(/.test(output.backgroundImage)) output.background = output.backgroundImage;
          delete output.backgroundImage;
        }
        for (const kind of ["padding", "margin"]) {
          const parts = (output[kind] || "0px").trim().split(/\s+(?![^()]*\))/);
          if (parts.length > 4) continue;
          const sides = [parts[0], parts[1] || parts[0], parts[2] || parts[0], parts[3] || parts[1] || parts[0]];
          ["Top", "Right", "Bottom", "Left"].forEach((side, index) => { output[kind + side] ??= sides[index]!; });
          delete output[kind];
        }
        return { boxSizing: "border-box", color: tag === "body" ? "#172033" : "inherit", fontFamily: tag === "body" ? "system-ui, sans-serif" : "inherit", ...output };
      });
      const childrenInherited = computed.map(style => Object.fromEntries(Object.entries(style).filter(([key]) => inheritedKeys.has(key) || key.startsWith("--"))));
      const children = el.children.map((child, index) => walk(child, `${path}.${index}`, childrenInherited, depth + 1)).filter((child): child is JsonObject => child !== null);
      const id = createHash("sha256").update(`${namespace}:${path}`).digest("hex").slice(0, 24);

      const hasChildTags = el.children.some(child => child.type === "tag");
      let type: string;
      if (tag === "li" && hasChildTags) type = "container";
      else if (/^h[1-6]$/.test(tag)) type = hasChildTags ? "container" : "heading";
      else if (["a", "button"].includes(tag)) type = hasChildTags ? "container" : "button";
      else if (["p", "span", "strong", "em", "li", "br"].includes(tag)) type = hasChildTags ? "container" : "text";
      else type = "container";

      let href = el.attribs.href;
      if (href) {
        href = /^\/(?!\/)[a-z0-9/-]*$/.test(href) ? href : "/";
      } else if (type === "button") {
        href = "/";
      }

      const layout = (style: Record<string, string>) => ({ layoutType: style.display === "grid" ? "grid" : "flex", direction: style.display?.includes("flex") ? style.flexDirection || "row" : "column", flexWrap: style.flexWrap || "nowrap", alignItems: style.alignItems || "stretch", justifyContent: style.justifyContent || "flex-start", gap: style.gap && /^\d+(?:\.\d+)?px$/.test(style.gap) ? parseFloat(style.gap) : 0, ...(style.gridTemplateColumns ? { gridTemplateColumns: style.gridTemplateColumns } : {}) });
      return { id, type, content: type === "container" ? tag : $(el).text().trim(), ...(href ? { href } : {}),
        ...(type === "heading" ? { headingLevel: tag } : {}),
        styles: styles[0]!, responsiveStyles: { tablet: styles[1]!, mobile: styles[2]! },
        ...(type === "container" ? { children, layout: layout(styles[0]!), responsiveLayout: { tablet: layout(styles[1]!), mobile: layout(styles[2]!) } } : {}),
      };
    };
    const body = $("body").get(0) || $("main").get(0) || $("div").get(0);
    if (!body) throw new ConversionError(["HTML_PAGE_REQUIRED"]);
    const result = walk(body, "root", [{}, {}, {}], 0);
    if (!result) throw new ConversionError(["EMPTY_DOCUMENT"]);
    return [result];
  }
}
