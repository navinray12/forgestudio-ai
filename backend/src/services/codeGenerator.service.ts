/**
 * ForgeStudio Universal Canonical Code Generator & Multi-Format Exporter Engine
 * F-745 -> F-755: Production AST Normalization, React/Tailwind/Next.js Generators,
 * Component-Level Export, Asset Bundling, and ZIP Packaging Engine.
 */
import * as archiverModule from "archiver";
import { Writable } from "stream";

function createArchiverInstance(options: any = { zlib: { level: 9 } }) {
  const a = (archiverModule as any).default || archiverModule;
  if (typeof a === "function") {
    return a("zip", options);
  }
  if (a?.create) {
    return a.create("zip", options);
  }
  if (a?.ZipArchive) {
    return new a.ZipArchive(options);
  }
  throw new Error("Unable to instantiate archiver");
}

// ---------------------------------------------------------------------------
// 1. Strongly-Typed Canonical AST Model
// ---------------------------------------------------------------------------

export interface ASTNodeProps {
  label?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  src?: string;
  alt?: string;
  href?: string;
  variant?: string;
  placeholder?: string;
  disabled?: boolean;
  autoplay?: boolean;
  controls?: boolean;
  value?: string;
  icon?: string;
  [key: string]: any;
}

export interface ASTNodeAccessibility {
  role?: string;
  ariaLabel?: string;
  ariaExpanded?: boolean;
  tabIndex?: number;
}

export interface ASTNodeAsset {
  type: "image" | "font" | "svg" | "video";
  url: string;
  localPath: string;
  downloadable: boolean;
}

export interface ASTNode {
  id: string;
  type: string;
  tag: string;
  name?: string;
  classes: string[];
  styles: Record<string, string>;
  responsiveStyles?: Record<string, Record<string, string>>;
  props?: ASTNodeProps;
  attributes: Record<string, string>;
  textContent?: string;
  children: ASTNode[];
  states?: Record<string, any>;
  events?: Record<string, string>;
  accessibility?: ASTNodeAccessibility;
  animations?: Record<string, any>;
  dynamicData?: {
    source?: "cpt" | "post" | "user" | "site" | "api";
    field?: string;
    fallback?: string;
  };
  assets?: ASTNodeAsset[];
  dependencies?: string[];
  metadata?: Record<string, any>;
  interaction?: {
    type: "modal" | "accordion" | "tab" | "slider" | "menu" | "form" | "popup" | "dropdown";
    targetId?: string;
    options?: Record<string, any>;
  };
}

export interface CanonicalDocument {
  title: string;
  slug: string;
  metaDescription?: string;
  rootNodes: ASTNode[];
  globalStyles?: Record<string, any>;
  designTokens?: Record<string, any>;
  customCss?: string;
  customJs?: string;
  breakpoints?: Record<string, number>;
  assetsCatalog: ASTNodeAsset[];
}

export interface CodeGeneratorOptions {
  optimizeDom?: boolean;
  semanticMapping?: boolean;
  scope?: "full" | "component";
  componentId?: string;
  targetFormat?: "html" | "react" | "tailwind" | "nextjs";
}

export interface ComponentExportPackage {
  componentName: string;
  tsxCode: string;
  typesCode: string;
  cssCode: string;
  tailwindJsx: string;
  indexTs: string;
  readmeMd: string;
  dependencies: string[];
}

export interface GeneratedCodeResult {
  html: string;
  css: string;
  js: string;
  optimizedDomHtml?: string;
  semanticHtml?: string;
  reactCode?: {
    appTsx: string;
    components: Record<string, string>;
    packageJson: string;
  };
  tailwindCode?: {
    html: string;
    tailwindConfig: string;
  };
  nextJsCode?: {
    pageTsx: string;
    layoutTsx: string;
    nextConfig: string;
    packageJson: string;
  };
  componentExport?: ComponentExportPackage;
  stats: {
    totalNodes: number;
    optimizedNodes: number;
    cssRuleCount: number;
    jsInteractionCount: number;
    assetCount: number;
    estimatedSizeKb: number;
  };
}

// ---------------------------------------------------------------------------
// 2. Security XSS Sanitization & Utility Functions
// ---------------------------------------------------------------------------

export function escapeHtml(str: string): string {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeAttribute(str: string): string {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function sanitizeIdentifier(str: string): string {
  const clean = (str || "Component").replace(/[^a-zA-Z0-9]/g, "");
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : "Component";
}

// ---------------------------------------------------------------------------
// 3. F-749: Semantic Tag Mapping & Accessibility Pass
// ---------------------------------------------------------------------------

export function mapSemanticTag(node: ASTNode): string {
  const typeLower = (node.type || "").toLowerCase();

  if (typeLower === "header" || (typeLower.includes("header") && !typeLower.includes("navbar"))) return "header";
  if (typeLower.includes("nav") || typeLower.includes("menu")) return "nav";
  if (typeLower.includes("footer")) return "footer";
  if (typeLower.includes("hero") || typeLower.includes("section")) return "section";
  if (typeLower.includes("article") || typeLower.includes("card")) return "article";
  if (typeLower.includes("main")) return "main";
  if (typeLower.includes("heading") || typeLower.includes("title")) {
    return node.tag && /^h[1-6]$/i.test(node.tag) ? node.tag.toLowerCase() : "h2";
  }
  if (typeLower.includes("button")) return "button";
  if (typeLower.includes("link")) return "a";
  if (typeLower.includes("form")) return "form";
  if (typeLower.includes("input")) return "input";
  if (typeLower.includes("image")) return "img";

  return node.tag || "div";
}

export function applySemanticPass(node: ASTNode): ASTNode {
  const semanticTag = mapSemanticTag(node);
  const attributes = { ...node.attributes };
  const accessibility: ASTNodeAccessibility = { ...node.accessibility };

  if (semanticTag === "button" && !attributes.type) {
    attributes.type = "button";
  }
  if (semanticTag === "a" && !attributes.href) {
    attributes.href = "#";
  }
  if (semanticTag === "nav" && !accessibility.ariaLabel) {
    accessibility.ariaLabel = "Main Navigation";
  }
  if (semanticTag === "img" && !attributes.alt) {
    attributes.alt = node.props?.alt || node.textContent || "Site Image";
  }

  return {
    ...node,
    tag: semanticTag,
    attributes,
    accessibility,
    children: node.children.map(applySemanticPass),
  };
}

// ---------------------------------------------------------------------------
// 4. F-748: DOM AST Optimization Pass
// ---------------------------------------------------------------------------

export function countASTNodes(nodes: ASTNode[]): number {
  let count = 0;
  for (const n of nodes) {
    count += 1 + countASTNodes(n.children);
  }
  return count;
}

export function optimizeASTNode(node: ASTNode): ASTNode | null {
  if (node.type === "text" && (!node.textContent || !node.textContent.trim())) {
    return null;
  }

  const optimizedChildren: ASTNode[] = [];
  for (const child of node.children) {
    const optChild = optimizeASTNode(child);
    if (optChild) optimizedChildren.push(optChild);
  }

  // Unwrap redundant wrapper divs (div with 1 child div, no classes, no styles, no props)
  if (
    node.tag === "div" &&
    optimizedChildren.length === 1 &&
    optimizedChildren[0].tag === "div" &&
    (!node.classes || node.classes.length === 0) &&
    (!node.styles || Object.keys(node.styles).length === 0) &&
    (!node.attributes || Object.keys(node.attributes).length === 0) &&
    !node.interaction
  ) {
    return optimizedChildren[0];
  }

  return {
    ...node,
    children: optimizedChildren,
  };
}

export function optimizeAST(nodes: ASTNode[]): ASTNode[] {
  const result: ASTNode[] = [];
  for (const n of nodes) {
    const opt = optimizeASTNode(n);
    if (opt) result.push(opt);
  }
  return result;
}

// ---------------------------------------------------------------------------
// 5. AST Parser & SSRF Safe Asset Harvester
// ---------------------------------------------------------------------------

import path from "path";

export function isSafeAssetUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== "string") return false;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname.toLowerCase();

    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname === "169.254.169.254" ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".local")
    ) {
      return false;
    }

    // Check IPv4 private ranges
    const ipMatch = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipMatch) {
      const [, p1, p2] = ipMatch.map(Number);
      if (p1 === 10) return false;
      if (p1 === 172 && p2 >= 16 && p2 <= 31) return false;
      if (p1 === 192 && p2 === 168) return false;
      if (p1 === 127) return false;
      if (p1 === 169 && p2 === 254) return false;
      if (p1 === 0) return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function mapElementTypeToDefaultTag(type: string): { tag: string; role?: string } {
  const t = (type || "").toLowerCase();
  switch (t) {
    case "container": case "div-block": case "off-canvas": case "template": case "div":
      return { tag: "div" };
    case "heading": case "animated-headline": case "wc-product-title":
      return { tag: "h2" };
    case "text": case "paragraph": case "blockquote": case "wc-short-description": case "wc-product-content":
      return { tag: "p" };
    case "image": case "custom-svg": case "wc-product-images":
      return { tag: "img", role: "img" };
    case "video": case "soundcloud": case "lottie": case "facebook-embed":
      return { tag: "iframe" };
    case "button": case "facebook-button": case "paypal-button": case "stripe-button": case "wc-add-to-cart": case "wc-custom-add-to-cart": case "facebook-like-button": case "paypal": case "stripe":
      return { tag: "button", role: "button" };
    case "divider": case "spacer":
      return { tag: "hr", role: "separator" };
    case "icon": case "social-icons": case "icon-library":
      return { tag: "span", role: "img" };
    case "nav-menu": case "wp-menu": case "menu-widget": case "mega-menu": case "off-canvas-nav":
      return { tag: "nav", role: "navigation" };
    case "form": case "login": case "search-bar": case "site-search": case "search-form": case "crm-integration": case "webhook-integration":
      return { tag: "form", role: "form" };
    case "price-table": case "price-list": case "table-of-contents": case "icon-list":
      return { tag: "ul" };
    case "wc-product": case "card": case "flip-box": case "call-to-action": case "image-box": case "icon-box":
      return { tag: "article" };
    case "posts": case "portfolio": case "gallery": case "reviews": case "basic-gallery": case "wc-products": case "wc-product-archive":
      return { tag: "section" };
    case "slides": case "media-carousel": case "testimonial-carousel": case "nested-carousel": case "loop-carousel": case "basic-media-carousel": case "image-carousel":
      return { tag: "section", role: "region" };
    case "alert": case "wc-notices":
      return { tag: "div", role: "alert" };
    case "breadcrumbs": case "post-nav":
      return { tag: "nav", role: "navigation" };
    default:
      return { tag: "div" };
  }
}

export function parseRawElementToAST(el: any, assetsCatalog: ASTNodeAsset[] = []): ASTNode {
  const id = el.id || `el_${Math.random().toString(36).slice(2, 9)}`;
  const type = el.type || el.elementType || "container";
  const typeMapping = mapElementTypeToDefaultTag(type);
  const tag = el.tag || el.htmlTag || typeMapping.tag || "div";
  const name = el.name || el.label || undefined;

  const styles = typeof el.styles === "object" ? { ...el.styles } : {};
  const classes = Array.isArray(el.classes)
    ? [...el.classes]
    : typeof el.className === "string"
    ? el.className.split(" ").filter(Boolean)
    : [];

  const props: ASTNodeProps = { ...el.props };
  const attributes: Record<string, string> = typeof el.attributes === "object" ? { ...el.attributes } : {};

  if (el.href) attributes.href = el.href;
  if (el.src) attributes.src = el.src;
  if (el.alt) attributes.alt = el.alt;
  if (el.placeholder) attributes.placeholder = el.placeholder;

  const accessibility: ASTNodeAccessibility = {
    ...el.accessibility,
    role: el.accessibility?.role || typeMapping.role,
  };

  // SSRF Protection & Safe Media Asset Harvester
  const assets: ASTNodeAsset[] = [];
  if (attributes.src && /^https?:\/\//i.test(attributes.src)) {
    if (isSafeAssetUrl(attributes.src)) {
      const filename = path.basename(attributes.src.split("?")[0]) || `asset_${id}.webp`;
      const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const localPath = `./assets/${safeFilename}`;

      const assetRecord: ASTNodeAsset = {
        type: "image",
        url: attributes.src,
        localPath,
        downloadable: true,
      };

      assets.push(assetRecord);
      assetsCatalog.push(assetRecord);
      attributes.src = localPath; // Rewrite to local relative asset path
    } else {
      // Unsafe private/SSRF URL -> Block asset downloading & keep unrewritten or blanked
      assets.push({
        type: "image",
        url: attributes.src,
        localPath: attributes.src,
        downloadable: false,
      });
    }
  }

  const children: ASTNode[] = [];
  const rawChildren = Array.isArray(el.children)
    ? el.children
    : Array.isArray(el.elements)
    ? el.elements
    : [];

  for (const child of rawChildren) {
    children.push(parseRawElementToAST(child, assetsCatalog));
  }

  return {
    id,
    type,
    tag,
    name,
    classes,
    styles,
    responsiveStyles: el.responsiveStyles || undefined,
    props,
    attributes,
    textContent: el.textContent || el.content || el.text || undefined,
    children,
    states: el.states || undefined,
    events: el.events || undefined,
    accessibility,
    animations: el.animations || undefined,
    dynamicData: el.dynamicData || undefined,
    assets: assets.length > 0 ? assets : undefined,
    dependencies: el.dependencies || undefined,
    metadata: el.metadata || undefined,
    interaction: el.interaction || undefined,
  };
}

export function parseEditorDataToCanonicalDoc(editorData: any): CanonicalDocument {
  const rawPages = Array.isArray(editorData?.pages)
    ? editorData.pages.filter((p: any) => p && typeof p === "object")
    : [];

  const homePageId = editorData?.homePageId;
  const homePage =
    (homePageId ? rawPages.find((p: any) => p.id === homePageId) : null) ||
    rawPages.find((p: any) => p.isHome) ||
    rawPages.find((p: any) => p.path === "/" || p.slug === "/" || p.slug === "home" || p.slug === "index") ||
    rawPages[0] ||
    {};

  const title =
    homePage.title ||
    homePage.name ||
    homePage.pageSettings?.title ||
    editorData?.siteSettings?.siteName ||
    editorData?.siteSettings?.title ||
    "ForgeStudio Site";
  const slug = homePage.slug || homePage.path || "index";
  const metaDescription =
    homePage.metaDescription ||
    homePage.pageSettings?.metaDescription ||
    editorData?.siteSettings?.metaDescription;

  const pageElements = Array.isArray(homePage.elements)
    ? homePage.elements
    : Array.isArray(homePage.children)
    ? homePage.children
    : Array.isArray(editorData?.elements)
    ? editorData.elements
    : Array.isArray(editorData?.canvasData?.elements)
    ? editorData.canvasData.elements
    : [];

  // Combine site header + page elements + site footer if defined in siteParts
  const combinedElements: any[] = [];
  if (editorData?.siteParts?.header?.enabled && Array.isArray(editorData.siteParts.header.elements)) {
    combinedElements.push(...editorData.siteParts.header.elements);
  }
  combinedElements.push(...pageElements);
  if (editorData?.siteParts?.footer?.enabled && Array.isArray(editorData.siteParts.footer.elements)) {
    combinedElements.push(...editorData.siteParts.footer.elements);
  }

  const elementsToParse = combinedElements.filter((el: any) => el && typeof el === "object");

  const assetsCatalog: ASTNodeAsset[] = [];
  const rootNodes: ASTNode[] = elementsToParse.map((el: any) => parseRawElementToAST(el, assetsCatalog));

  return {
    title,
    slug,
    metaDescription,
    rootNodes,
    globalStyles: editorData?.globalStyles || editorData?.globalSettings?.globalStyles,
    designTokens: editorData?.designTokens,
    customCss: editorData?.customCss || editorData?.pageCss,
    customJs: editorData?.customJs,
    breakpoints: editorData?.breakpoints || { desktop: 1280, tablet: 768, mobile: 480 },
    assetsCatalog,
  };
}

// ---------------------------------------------------------------------------
// 6. F-745: HTML Generator
// ---------------------------------------------------------------------------

export function renderASTNodeToHtml(node: ASTNode, indentLevel = 0): string {
  const indent = "  ".repeat(indentLevel);
  const tag = escapeHtml(node.tag || "div");

  const classAttr = node.classes.length > 0 ? ` class="${escapeAttribute(node.classes.join(" "))}"` : "";

  const inlineStyles = Object.entries(node.styles)
    .map(([k, v]) => `${k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v}`)
    .join("; ");
  const styleAttr = inlineStyles ? ` style="${escapeAttribute(inlineStyles)}"` : "";

  const otherAttrs = Object.entries(node.attributes)
    .map(([k, v]) => `${escapeHtml(k)}="${escapeAttribute(v)}"`)
    .join(" ");

  const attrString = [classAttr, styleAttr, otherAttrs ? ` ${otherAttrs}` : ""].join("");

  const VOID_TAGS = new Set(["img", "input", "br", "hr", "meta", "link"]);
  if (VOID_TAGS.has(tag.toLowerCase())) {
    return `${indent}<${tag}${attrString} />\n`;
  }

  const text = node.textContent ? escapeHtml(node.textContent) : "";

  if (node.children.length === 0) {
    return `${indent}<${tag}${attrString}>${text}</${tag}>\n`;
  }

  const childrenHtml = node.children
    .map((child) => renderASTNodeToHtml(child, indentLevel + 1))
    .join("");

  return `${indent}<${tag}${attrString}>\n${text ? `${indent}  ${text}\n` : ""}${childrenHtml}${indent}</${tag}>\n`;
}

export function generateHtmlOutput(doc: CanonicalDocument, options: CodeGeneratorOptions = {}): string {
  let nodes = doc.rootNodes;

  if (options.semanticMapping !== false) {
    nodes = nodes.map(applySemanticPass);
  }

  if (options.optimizeDom) {
    nodes = optimizeAST(nodes);
  }

  const bodyHtml = nodes.map((n) => renderASTNodeToHtml(n, 2)).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(doc.title)}</title>
  ${doc.metaDescription ? `<meta name="description" content="${escapeAttribute(doc.metaDescription)}">` : ""}
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
${bodyHtml}
  <script src="js/app.js"></script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// 7. F-746: CSS Generator
// ---------------------------------------------------------------------------

export function generateCssOutput(doc: CanonicalDocument): string {
  const cssRules: string[] = [
    `/* ForgeStudio Production CSS Output — Generated for ${escapeHtml(doc.title)} */`,
    `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }`,
    `body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.5; color: #111827; background-color: #ffffff; }`,
    `img { max-width: 100%; height: auto; display: block; }`,
  ];

  function extractNodeStyles(nodes: ASTNode[]) {
    for (const node of nodes) {
      if (node.classes.length > 0 && Object.keys(node.styles).length > 0) {
        const selector = "." + node.classes.map((c) => c.replace(/[^a-zA-Z0-9_-]/g, "")).join(".");
        const decls = Object.entries(node.styles)
          .map(([k, v]) => `  ${k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v};`)
          .join("\n");
        cssRules.push(`${selector} {\n${decls}\n}`);
      }
      if (node.children) {
        extractNodeStyles(node.children);
      }
    }
  }

  extractNodeStyles(doc.rootNodes);

  if (doc.customCss) {
    cssRules.push(`/* Custom User CSS */\n${doc.customCss}`);
  }

  return cssRules.join("\n\n");
}

// ---------------------------------------------------------------------------
// 8. F-747: JavaScript Generator
// ---------------------------------------------------------------------------

export function generateJsOutput(doc: CanonicalDocument): string {
  const jsLines: string[] = [
    `/** ForgeStudio Production JS Output — Interaction Controller */`,
    `document.addEventListener("DOMContentLoaded", function() {`,
    `  console.log("ForgeStudio site interactive scripts loaded.");`,
  ];

  function processInteractions(nodes: ASTNode[]) {
    for (const node of nodes) {
      if (node.interaction) {
        if (node.interaction.type === "modal") {
          const varName = `modalBtn_${node.id.replace(/[^a-zA-Z0-9]/g, "_")}`;
          jsLines.push(
            `  // Modal Trigger: ${node.id}`,
            `  const ${varName} = document.getElementById("${node.id}");`,
            `  if (${varName}) {`,
            `    ${varName}.addEventListener("click", function() {`,
            `      const target = document.getElementById("${node.interaction.targetId || ""}");`,
            `      if (target) target.classList.toggle("is-active");`,
            `    });`,
            `  }`
          );
        }
      }
      if (node.children) {
        processInteractions(node.children);
      }
    }
  }

  processInteractions(doc.rootNodes);

  if (doc.customJs) {
    jsLines.push(`  // Custom User Script`, doc.customJs);
  }

  jsLines.push(`});`);

  return jsLines.join("\n");
}

// ---------------------------------------------------------------------------
// 9. F-754: Native Tailwind Utility Translator
// ---------------------------------------------------------------------------

export function stylesToTailwindClasses(styles: Record<string, string>): string[] {
  const twClasses: string[] = [];

  for (const [k, v] of Object.entries(styles)) {
    const val = String(v).trim();
    if (k === "display") {
      if (val === "flex") twClasses.push("flex");
      else if (val === "grid") twClasses.push("grid");
      else if (val === "block") twClasses.push("block");
      else if (val === "inline-block") twClasses.push("inline-block");
      else if (val === "none") twClasses.push("hidden");
    } else if (k === "flexDirection") {
      if (val === "column") twClasses.push("flex-col");
      else if (val === "row") twClasses.push("flex-row");
    } else if (k === "alignItems") {
      if (val === "center") twClasses.push("items-center");
      else if (val === "flex-start") twClasses.push("items-start");
      else if (val === "flex-end") twClasses.push("items-end");
    } else if (k === "justifyContent") {
      if (val === "center") twClasses.push("justify-center");
      else if (val === "space-between") twClasses.push("justify-between");
      else if (val === "flex-start") twClasses.push("justify-start");
      else if (val === "flex-end") twClasses.push("justify-end");
    } else if (k === "padding") {
      if (val === "16px" || val === "1rem") twClasses.push("p-4");
      else if (val === "24px" || val === "1.5rem") twClasses.push("p-6");
      else if (val === "32px" || val === "2rem") twClasses.push("p-8");
      else if (val === "8px" || val === "0.5rem") twClasses.push("p-2");
      else if (val === "0" || val === "0px") twClasses.push("p-0");
      else twClasses.push(`p-[${val}]`);
    } else if (k === "margin") {
      if (val === "0 auto" || val === "auto") twClasses.push("mx-auto");
      else if (val === "16px" || val === "1rem") twClasses.push("m-4");
      else if (val === "24px") twClasses.push("m-6");
      else if (val === "0" || val === "0px") twClasses.push("m-0");
      else twClasses.push(`m-[${val}]`);
    } else if (k === "fontSize") {
      if (val === "36px" || val === "2.25rem") twClasses.push("text-4xl");
      else if (val === "30px" || val === "1.875rem") twClasses.push("text-3xl");
      else if (val === "24px" || val === "1.5rem") twClasses.push("text-2xl");
      else if (val === "20px" || val === "1.25rem") twClasses.push("text-xl");
      else if (val === "18px" || val === "1.125rem") twClasses.push("text-lg");
      else if (val === "14px" || val === "0.875rem") twClasses.push("text-sm");
      else if (val === "12px" || val === "0.75rem") twClasses.push("text-xs");
      else twClasses.push(`text-[${val}]`);
    } else if (k === "fontWeight") {
      if (val === "700" || val === "bold") twClasses.push("font-bold");
      else if (val === "600" || val === "semibold") twClasses.push("font-semibold");
      else if (val === "500" || val === "medium") twClasses.push("font-medium");
      else if (val === "800" || val === "extrabold") twClasses.push("font-extrabold");
      else if (val === "400" || val === "normal") twClasses.push("font-normal");
    } else if (k === "textAlign") {
      if (val === "center") twClasses.push("text-center");
      else if (val === "right") twClasses.push("text-right");
      else if (val === "left") twClasses.push("text-left");
    } else if (k === "borderRadius") {
      if (val === "4px") twClasses.push("rounded");
      else if (val === "8px" || val === "0.5rem") twClasses.push("rounded-lg");
      else if (val === "12px" || val === "0.75rem") twClasses.push("rounded-xl");
      else if (val === "16px" || val === "1rem") twClasses.push("rounded-2xl");
      else if (val === "9999px" || val === "50%") twClasses.push("rounded-full");
      else twClasses.push(`rounded-[${val}]`);
    } else if (k === "gap") {
      if (val === "8px") twClasses.push("gap-2");
      else if (val === "16px" || val === "1rem") twClasses.push("gap-4");
      else if (val === "24px" || val === "1.5rem") twClasses.push("gap-6");
      else if (val === "32px") twClasses.push("gap-8");
      else twClasses.push(`gap-[${val}]`);
    } else if (k === "width") {
      if (val === "100%") twClasses.push("w-full");
      else if (val === "auto") twClasses.push("w-auto");
      else twClasses.push(`w-[${val}]`);
    } else if (k === "backgroundColor") {
      if (val === "#ffffff" || val === "white") twClasses.push("bg-white");
      else if (val === "#111827" || val === "#0f172a") twClasses.push("bg-slate-900");
      else if (val === "transparent") twClasses.push("bg-transparent");
      else twClasses.push(`bg-[${val}]`);
    } else if (k === "color") {
      if (val === "#ffffff" || val === "white") twClasses.push("text-white");
      else if (val === "#111827" || val === "#0f172a") twClasses.push("text-slate-900");
      else if (val === "#6b7280" || val === "#64748b") twClasses.push("text-slate-500");
      else twClasses.push(`text-[${val}]`);
    }
  }

  return twClasses;
}

export function renderASTNodeToTailwindHtml(node: ASTNode, indentLevel = 0): string {
  const indent = "  ".repeat(indentLevel);
  const tag = escapeHtml(node.tag || "div");

  const twClasses = [
    ...node.classes,
    ...stylesToTailwindClasses(node.styles || {}),
  ];

  if (node.responsiveStyles) {
    for (const [bp, bpStyles] of Object.entries(node.responsiveStyles)) {
      const bpTw = stylesToTailwindClasses(bpStyles).map((c) => `${bp}:${c}`);
      twClasses.push(...bpTw);
    }
  }

  const classAttr = twClasses.length > 0 ? ` class="${escapeAttribute(twClasses.join(" "))}"` : "";
  const ariaLabel = node.attributes?.["aria-label"] || node.props?.alt ? ` aria-label="${escapeAttribute(node.attributes?.["aria-label"] || node.props?.alt || "")}"` : "";
  const roleAttr = node.attributes?.role ? ` role="${escapeAttribute(node.attributes.role)}"` : "";
  const hrefAttr = node.props?.href || node.attributes?.href ? ` href="${escapeAttribute(node.props?.href || node.attributes?.href || "")}"` : "";

  const VOID_TAGS = new Set(["img", "input", "br", "hr"]);
  if (VOID_TAGS.has(tag.toLowerCase())) {
    const srcAttr = node.attributes?.src || node.props?.src ? ` src="${escapeAttribute(node.attributes?.src || node.props?.src || "")}"` : "";
    const altAttr = node.props?.alt || node.attributes?.alt ? ` alt="${escapeAttribute(node.props?.alt || node.attributes?.alt || "")}"` : "";
    return `${indent}<${tag}${classAttr}${srcAttr}${altAttr}${hrefAttr}${ariaLabel}${roleAttr} />\n`;
  }

  const text = node.textContent || node.props?.content || node.props?.buttonText || "";
  const escapedText = escapeHtml(text);

  if (node.children.length === 0) {
    return `${indent}<${tag}${classAttr}${hrefAttr}${ariaLabel}${roleAttr}>${escapedText}</${tag}>\n`;
  }

  const childrenHtml = node.children
    .map((child) => renderASTNodeToTailwindHtml(child, indentLevel + 1))
    .join("");

  return `${indent}<${tag}${classAttr}${hrefAttr}${ariaLabel}${roleAttr}>\n${escapedText ? `${indent}  ${escapedText}\n` : ""}${childrenHtml}${indent}</${tag}>\n`;
}

export function generateTailwindOutput(doc: CanonicalDocument): GeneratedCodeResult["tailwindCode"] {
  const contentHtml = doc.rootNodes.length > 0
    ? doc.rootNodes.map((n) => renderASTNodeToTailwindHtml(n, 2)).join("\n")
    : `    <div class="text-center py-12">\n      <h1 class="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">${escapeHtml(doc.title)}</h1>\n    </div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(doc.title)}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 text-gray-900 font-sans antialiased">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
${contentHtml}
  </div>
</body>
</html>`;

  const tailwindConfig = `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,html}"],
  theme: {
    extend: {
      colors: {
        brand: "#3b82f6",
      },
    },
  },
  plugins: [],
};`;

  return {
    html,
    tailwindConfig,
  };
}

// ---------------------------------------------------------------------------
// 10. F-753 & Component-Level Export (React TSX Generator)
// ---------------------------------------------------------------------------

export function generateReactComponentPackage(node: ASTNode): ComponentExportPackage {
  const compName = sanitizeIdentifier(node.name || node.type || "Component");

  const typesCode = `export interface ${compName}Props {
  title?: string;
  subtitle?: string;
  content?: string;
  className?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}`;

  const tsxCode = `import React from 'react';
import type { ${compName}Props } from './${compName}.types';
import './${compName}.css';

export const ${compName}: React.FC<${compName}Props> = ({
  title = "${escapeHtml(node.props?.title || node.textContent || compName)}",
  subtitle = "${escapeHtml(node.props?.subtitle || "")}",
  className = "",
  onClick,
  children,
}) => {
  return (
    <div className={\`${compName.toLowerCase()}-container \${className}\`} onClick={onClick}>
      {title && <h2 className="${compName.toLowerCase()}-title">{title}</h2>}
      {subtitle && <p className="${compName.toLowerCase()}-subtitle">{subtitle}</p>}
      {children}
    </div>
  );
};

export default ${compName};`;

  const cssCode = `.${compName.toLowerCase()}-container {
  padding: 1.5rem;
  border-radius: 0.5rem;
  background-color: #ffffff;
  border: 1px solid #e5e7eb;
}
.${compName.toLowerCase()}-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
}
.${compName.toLowerCase()}-subtitle {
  font-size: 1rem;
  color: #6b7280;
}`;

  const tailwindJsx = `import React from 'react';
import type { ${compName}Props } from './${compName}.types';

export const ${compName}: React.FC<${compName}Props> = ({
  title = "${escapeHtml(node.props?.title || node.textContent || compName)}",
  subtitle = "${escapeHtml(node.props?.subtitle || "")}",
  className = "",
  onClick,
}) => {
  return (
    <div className={\`p-6 bg-white rounded-xl border border-gray-200 shadow-sm \${className}\`} onClick={onClick}>
      {title && <h2 className="text-2xl font-bold text-gray-900">{title}</h2>}
      {subtitle && <p className="mt-2 text-base text-gray-500">{subtitle}</p>}
    </div>
  );
};`;

  const indexTs = `export * from './${compName}';
export * from './${compName}.types';`;

  const readmeMd = `# ${compName} Component

Exported reusable component from ForgeStudio.

## Usage

\`\`\`tsx
import { ${compName} } from './${compName}';

<${compName} title="Hello World" />
\`\`\`
`;

  return {
    componentName: compName,
    tsxCode,
    typesCode,
    cssCode,
    tailwindJsx,
    indexTs,
    readmeMd,
    dependencies: ["react", "react-dom"],
  };
}

export function renderASTNodeToJSX(node: ASTNode, indentLevel = 0, isNextJs = false): string {
  const indent = "  ".repeat(indentLevel);
  const tag = escapeHtml(node.tag || "div");

  const twClasses = [
    ...node.classes,
    ...stylesToTailwindClasses(node.styles || {}),
  ];

  if (node.responsiveStyles) {
    for (const [bp, bpStyles] of Object.entries(node.responsiveStyles)) {
      const bpTw = stylesToTailwindClasses(bpStyles).map((c) => `${bp}:${c}`);
      twClasses.push(...bpTw);
    }
  }

  const classAttr = twClasses.length > 0 ? ` className="${escapeAttribute(twClasses.join(" "))}"` : "";

  // Aria and accessibility
  const ariaLabel = node.attributes?.["aria-label"] || node.props?.alt ? ` aria-label="${escapeAttribute(node.attributes?.["aria-label"] || node.props?.alt || "")}"` : "";
  const roleAttr = node.attributes?.role ? ` role="${escapeAttribute(node.attributes.role)}"` : "";
  const hrefAttr = node.props?.href || node.attributes?.href ? ` href="${escapeAttribute(node.props?.href || node.attributes?.href || "")}"` : "";

  // Next.js Image optimization
  if (isNextJs && (tag.toLowerCase() === "img" || node.type === "image")) {
    const src = node.attributes?.src || node.props?.src || "/placeholder.webp";
    const alt = node.props?.alt || node.attributes?.alt || node.name || "Optimized Image";
    return `${indent}<Image src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" width={800} height={500}${classAttr}${ariaLabel}${roleAttr} />\n`;
  }

  const VOID_TAGS = new Set(["img", "input", "br", "hr"]);
  if (VOID_TAGS.has(tag.toLowerCase())) {
    const srcAttr = node.attributes?.src || node.props?.src ? ` src="${escapeAttribute(node.attributes?.src || node.props?.src || "")}"` : "";
    const altAttr = node.props?.alt || node.attributes?.alt ? ` alt="${escapeAttribute(node.props?.alt || node.attributes?.alt || "")}"` : "";
    return `${indent}<${tag}${classAttr}${srcAttr}${altAttr}${hrefAttr}${ariaLabel}${roleAttr} />\n`;
  }

  const text = node.textContent || node.props?.content || node.props?.buttonText || "";
  const escapedText = escapeHtml(text);

  if (node.children.length === 0) {
    return `${indent}<${tag}${classAttr}${hrefAttr}${ariaLabel}${roleAttr}>${escapedText}</${tag}>\n`;
  }

  const childrenJsx = node.children
    .map((child) => renderASTNodeToJSX(child, indentLevel + 1, isNextJs))
    .join("");

  return `${indent}<${tag}${classAttr}${hrefAttr}${ariaLabel}${roleAttr}>\n${escapedText ? `${indent}  ${escapedText}\n` : ""}${childrenJsx}${indent}</${tag}>\n`;
}

export function generateReactOutput(doc: CanonicalDocument): GeneratedCodeResult["reactCode"] {
  const renderedJsx = doc.rootNodes.length > 0
    ? doc.rootNodes.map((n) => renderASTNodeToJSX(n, 4, false)).join("")
    : `      <div className="p-8 text-center">\n        <h1 className="text-3xl font-bold">${escapeHtml(doc.title)}</h1>\n      </div>\n`;

  const appTsx = `import React from 'react';
import './styles.css';

export default function App() {
  return (
    <div className="forgestudio-app-container min-h-screen bg-white">
${renderedJsx}    </div>
  );
}`;

  const packageJson = JSON.stringify(
    {
      name: doc.slug || "forgestudio-react-export",
      version: "1.0.0",
      private: true,
      scripts: {
        dev: "vite",
        build: "tsc && vite build",
        preview: "vite preview",
      },
      dependencies: {
        react: "^19.0.0",
        "react-dom": "^19.0.0",
        "lucide-react": "^1.40.0",
      },
      devDependencies: {
        "@types/react": "^19.0.0",
        "@types/react-dom": "^19.0.0",
        "@vitejs/plugin-react": "^4.3.4",
        typescript: "^5.7.0",
        vite: "^6.0.0",
        tailwindcss: "^3.4.17",
        autoprefixer: "^10.4.20",
        postcss: "^8.4.49",
      },
    },
    null,
    2
  );

  return {
    appTsx,
    components: {
      "App.tsx": appTsx,
    },
    packageJson,
  };
}

// ---------------------------------------------------------------------------
// 11. F-755: Next.js App Router Generator
// ---------------------------------------------------------------------------

function hasInteractiveNodes(nodes: ASTNode[]): boolean {
  for (const n of nodes) {
    if (n.interaction) return true;
    if (n.children && hasInteractiveNodes(n.children)) return true;
  }
  return false;
}

export function generateNextJsOutput(doc: CanonicalDocument): GeneratedCodeResult["nextJsCode"] {
  const hasInteractiveInteractions = hasInteractiveNodes(doc.rootNodes);
  const isClient = hasInteractiveInteractions;

  const renderedJsx = doc.rootNodes.length > 0
    ? doc.rootNodes.map((n) => renderASTNodeToJSX(n, 4, true)).join("")
    : `      <div className="p-8 text-center">\n        <h1 className="text-3xl font-bold">${escapeHtml(doc.title)}</h1>\n      </div>\n`;

  const pageTsx = `${isClient ? "'use client';\n\n" : ""}import React from 'react';
import Image from 'next/image';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
${renderedJsx}    </main>
  );
}`;

  const layoutTsx = `import React from 'react';
import './globals.css';

export const metadata = {
  title: '${escapeHtml(doc.title)}',
  description: '${escapeHtml(doc.metaDescription || "ForgeStudio Site")}',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}`;

  const nextConfig = `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
};

module.exports = nextConfig;`;

  const packageJson = JSON.stringify(
    {
      name: doc.slug || "forgestudio-nextjs-export",
      version: "1.0.0",
      private: true,
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
      },
      dependencies: {
        next: "15.1.0",
        react: "^19.0.0",
        "react-dom": "^19.0.0",
        "lucide-react": "^1.40.0",
      },
      devDependencies: {
        typescript: "^5.7.0",
        "@types/react": "^19.0.0",
        "@types/react-dom": "^19.0.0",
        "@types/node": "^20.0.0",
        tailwindcss: "^3.4.17",
        autoprefixer: "^10.4.20",
        postcss: "^8.4.49",
      },
    },
    null,
    2
  );

  return {
    pageTsx,
    layoutTsx,
    nextConfig,
    packageJson,
  };
}

// ---------------------------------------------------------------------------
// 12. Main Code Generation Orchestrator
// ---------------------------------------------------------------------------

export function generateAllCodeOutputs(
  editorData: any,
  options: CodeGeneratorOptions = {}
): GeneratedCodeResult {
  const doc = parseEditorDataToCanonicalDoc(editorData);
  const totalNodes = countASTNodes(doc.rootNodes);

  const optimizedNodes = optimizeAST(doc.rootNodes);
  const optimizedCount = countASTNodes(optimizedNodes);

  const html = generateHtmlOutput(doc, { ...options, optimizeDom: false });
  const optimizedDomHtml = generateHtmlOutput(doc, { ...options, optimizeDom: true });
  const semanticHtml = generateHtmlOutput(doc, { ...options, semanticMapping: true });

  const css = generateCssOutput(doc);
  const js = generateJsOutput(doc);

  const reactCode = generateReactOutput(doc);
  const tailwindCode = generateTailwindOutput(doc);
  const nextJsCode = generateNextJsOutput(doc);

  let componentExport: ComponentExportPackage | undefined = undefined;
  if (options.scope === "component" && doc.rootNodes.length > 0) {
    const targetNode = options.componentId
      ? doc.rootNodes.find((n) => n.id === options.componentId) || doc.rootNodes[0]
      : doc.rootNodes[0];
    componentExport = generateReactComponentPackage(targetNode);
  }

  const estimatedSizeKb = Math.round(Buffer.byteLength(html + css + js, "utf8") / 1024);

  return {
    html,
    css,
    js,
    optimizedDomHtml,
    semanticHtml,
    reactCode,
    tailwindCode,
    nextJsCode,
    componentExport,
    stats: {
      totalNodes,
      optimizedNodes: optimizedCount,
      cssRuleCount: (css.match(/\{/g) || []).length,
      jsInteractionCount: (js.match(/\/\/ Modal Trigger/g) || []).length,
      assetCount: doc.assetsCatalog.length,
      estimatedSizeKb,
    },
  };
}

// ---------------------------------------------------------------------------
// 13. F-752: Full Project & Component-Level ZIP Exporter
// ---------------------------------------------------------------------------

export const EXPORT_TYPES = ["static", "react", "tailwind", "nextjs"] as const;
export type ExportType = (typeof EXPORT_TYPES)[number];

/** npm-safe package name derived from arbitrary user text */
export function toPackageName(raw: string): string {
  const name = String(raw || "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "")
    .slice(0, 100);
  return name || "forgestudio-app";
}

// Files that must never leave the platform inside a downloadable archive
function isSecretFilePath(filePath: string): boolean {
  const base = filePath.split("/").pop() || "";
  if (/^\.env(\..+)?$/.test(base)) return !/^\.env\.(example|sample|template)$/.test(base);
  return /\.(pem|key|p12|pfx)$/i.test(base) || base === "id_rsa" || base === ".npmrc";
}

/**
 * Build a ZIP archive from a flat list of project files.
 * Entry names are validated so an archive can never write outside its extraction folder.
 */
export async function buildZipFromFiles(
  files: Array<{ path: string; content?: string | null; encoding?: string | null }>
): Promise<Buffer> {
  const entries: Array<{ name: string; data: Buffer }> = [];
  const seen = new Set<string>();

  for (const file of files) {
    const name = String(file.path || "").replace(/\\/g, "/").replace(/^\/+/, "");
    if (!name || name.endsWith("/")) continue;
    if (name.split("/").some((part) => part === ".." || part === "." || part === "") || /^[a-zA-Z]:/.test(name) || name.includes("\0")) {
      throw new Error(`Refusing to archive unsafe path '${file.path}'`);
    }
    if (name.split("/").includes("node_modules") || isSecretFilePath(name) || seen.has(name)) continue;
    seen.add(name);
    entries.push({
      name,
      data: Buffer.from(file.content ?? "", file.encoding === "base64" ? "base64" : "utf-8"),
    });
  }

  if (entries.length === 0) {
    throw new Error("There are no files to export");
  }

  return new Promise((resolve, reject) => {
    const archive = createArchiverInstance({ zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    const sink = new Writable({
      write(chunk, encoding, next) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
        next();
      },
    });

    archive.on("error", (err: any) => reject(err));
    sink.on("error", (err) => reject(err));
    sink.on("finish", () => resolve(Buffer.concat(chunks)));
    archive.pipe(sink);
    for (const entry of entries) archive.append(entry.data, { name: entry.name });
    archive.finalize();
  });
}

export async function buildProjectZipStream(
  editorData: any,
  exportType: ExportType = "static",
  scope: "full" | "component" = "full",
  componentId?: string,
  options: { projectName?: string; projectSlug?: string; projectId?: string } = {}
): Promise<Buffer> {
  if (!EXPORT_TYPES.includes(exportType)) {
    throw new Error(`Unsupported export type '${String(exportType)}'`);
  }

  const codeRes = generateAllCodeOutputs(editorData, { scope, componentId });
  const doc = parseEditorDataToCanonicalDoc(editorData);

  // Full React / Next.js exports are the same multi-page project the Code Workspace generates.
  // A generator failure rejects the export: falling back to a single-page stub would hand
  // the user an archive that silently lacks their pages.
  if (scope === "full" && (exportType === "react" || exportType === "nextjs")) {
    const targetProjectId = (options as any)?.projectId;
    if (targetProjectId) {
      try {
        const { listFiles } = await import("./project/forgeFilesystem.service.js");
        const persisted = (await listFiles(targetProjectId)).filter((f: any) => !f.isDirectory);
        if (persisted.length > 0) {
          return buildZipFromFiles(persisted.map((f: any) => ({ path: f.path, content: f.content })));
        }
      } catch {}
    }
    const { visualDocumentToIR } = await import("./compiler/unifiedCompiler.service.js");
    const projectIR = visualDocumentToIR(editorData, {
      id: `export_${exportType}_${Date.now()}`,
      name: options.projectName || doc.title,
      slug: toPackageName(options.projectSlug || options.projectName || doc.slug || doc.title),
      framework: exportType,
    });
    const plan =
      exportType === "react"
        ? await (await import("./generator/reactGenerator.service.js")).buildReactGenerationPlan(projectIR, [], {
            scope: { type: "full" },
          })
        : await (await import("./generator/nextjsGenerator.service.js")).buildNextJsGenerationPlan(projectIR, [], {
            scope: { type: "full" },
          });
    if (!plan || !Array.isArray(plan.files) || plan.files.length === 0) {
      throw new Error(`The ${exportType} generator produced no files`);
    }
    return buildZipFromFiles(plan.files.map((f) => ({ path: f.path, content: f.content })));
  }

  return new Promise((resolve, reject) => {
    const archive = createArchiverInstance({ zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    const bufferStream = new Writable({
      write(chunk, encoding, next) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
        next();
      },
    });

    archive.on("error", (err: any) => reject(err));
    bufferStream.on("finish", () => resolve(Buffer.concat(chunks)));

    archive.pipe(bufferStream);

    if (scope === "component" && codeRes.componentExport) {
      const comp = codeRes.componentExport;
      archive.append(comp.tsxCode, { name: `${comp.componentName}.tsx` });
      archive.append(comp.typesCode, { name: `${comp.componentName}.types.ts` });
      archive.append(comp.cssCode, { name: `${comp.componentName}.css` });
      archive.append(comp.indexTs, { name: "index.ts" });
      archive.append(comp.readmeMd, { name: "README.md" });
    } else if (exportType === "static") {
      archive.append(codeRes.html, { name: "index.html" });
      archive.append(codeRes.css, { name: "css/styles.css" });
      archive.append(codeRes.js, { name: "js/app.js" });
      archive.append(`# ${doc.title}\n\nGenerated Static Web Project by ForgeStudio Code Engine.`, { name: "README.md" });
    } else if (exportType === "react") {
      archive.append(codeRes.reactCode?.packageJson || "{}", { name: "package.json" });
      archive.append(codeRes.reactCode?.appTsx || "", { name: "src/App.tsx" });
      archive.append(codeRes.css, { name: "src/styles.css" });
      archive.append(`import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\nimport './styles.css';\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);\n`, { name: "src/main.tsx" });
      archive.append(`<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>${escapeHtml(doc.title)}</title>\n</head>\n<body>\n  <div id="root"></div>\n  <script type="module" src="/src/main.tsx"></script>\n</body>\n</html>\n`, { name: "index.html" });
      archive.append(`import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({\n  plugins: [react()],\n});\n`, { name: "vite.config.ts" });
      archive.append(JSON.stringify({ compilerOptions: { target: "ES2022", useDefineForClassFields: true, lib: ["ES2022", "DOM", "DOM.Iterable"], module: "ESNext", skipLibCheck: true, moduleResolution: "bundler", allowImportingTsExtensions: false, resolveJsonModule: true, isolatedModules: true, noEmit: true, jsx: "react-jsx", strict: true }, include: ["src"] }, null, 2), { name: "tsconfig.json" });
      archive.append(`# ${doc.title} — React TSX Export\n\nRun \`npm install\` then \`npm run build\` or \`npm run dev\`.`, { name: "README.md" });
    } else if (exportType === "tailwind") {
      archive.append(codeRes.tailwindCode?.html || "", { name: "index.html" });
      archive.append(codeRes.tailwindCode?.tailwindConfig || "", { name: "tailwind.config.js" });
      archive.append(`# ${doc.title} — Tailwind CSS Export`, { name: "README.md" });
    } else if (exportType === "nextjs") {
      archive.append(codeRes.nextJsCode?.packageJson || "{}", { name: "package.json" });
      archive.append(codeRes.nextJsCode?.pageTsx || "", { name: "app/page.tsx" });
      archive.append(codeRes.nextJsCode?.layoutTsx || "", { name: "app/layout.tsx" });
      archive.append(codeRes.nextJsCode?.nextConfig || "", { name: "next.config.mjs" });
      archive.append(codeRes.css, { name: "app/globals.css" });
      archive.append(JSON.stringify({ compilerOptions: { target: "ES2022", lib: ["dom", "dom.iterable", "esnext"], allowJs: true, skipLibCheck: true, strict: true, noEmit: true, esModuleInterop: true, module: "esnext", moduleResolution: "bundler", resolveJsonModule: true, isolatedModules: true, jsx: "preserve", incremental: true, plugins: [{ name: "next" }], paths: { "@/*": ["./*"] } }, include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"], exclude: ["node_modules"] }, null, 2), { name: "tsconfig.json" });
      archive.append(`# ${doc.title} — Next.js App Router Export\n\nRun \`npm install\` then \`npm run dev\`.`, { name: "README.md" });
    }

    archive.finalize();
  });
}
