import { AppError } from "../../utils/app-error.js";
import { generateAllCodeOutputs } from "../codeGenerator.service.js";
import { writeFile, readFile, listFiles, deleteFile, ProjectFileEntity } from "../project/forgeFilesystem.service.js";

export const IR_SCHEMA_VERSION = "1.0.0";

export interface SourceRange {
  file: string;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

export interface ElementIR {
  id: string;
  type: string;
  tag: string;
  name?: string;
  classes: string[];
  styles: Record<string, string>;
  responsiveStyles?: Record<string, Record<string, string>>;
  props?: Record<string, any>;
  attributes?: Record<string, string>;
  textContent?: string;
  children: ElementIR[];
  isProtected?: boolean; // Protected manual code region
  sourceRange?: SourceRange;
  dynamicData?: {
    source?: string;
    field?: string;
    fallback?: string;
  };
}

export interface ComponentIR {
  id: string;
  name: string;
  filePath: string;
  isPage: boolean;
  routePath?: string;
  /** Id of the editor page this component was generated from (absent for a single-page document) */
  pageId?: string;
  rootElement: ElementIR;
  imports?: string[];
  customLogic?: string; // Hooks, state, manual helper functions
  props?: Record<string, any>;
  sourceRange?: SourceRange;
}

export interface RouteIR {
  path: string;
  componentId: string;
  title?: string;
  metaDescription?: string;
}

export interface DesignTokenIR {
  colors?: Record<string, string>;
  typography?: Record<string, any>;
  spacing?: Record<string, string>;
  radius?: Record<string, string>;
  shadows?: Record<string, string>;
  breakpoints?: Record<string, number>;
}

export interface ProjectIR {
  irVersion: string;
  schemaVersion?: string;
  projectId: string;
  name: string;
  slug: string;
  framework: string;
  components: ComponentIR[];
  routes: RouteIR[];
  designTokens: DesignTokenIR;
  globalStyles: Record<string, any>;
  customCss?: string;
  customJs?: string;
  metadata?: Record<string, any>;
}

export interface CompilerDiagnostic {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  file?: string;
  line?: number;
  col?: number;
  source?: string;
  suggestedAction?: string;
}

export interface CompilationResult {
  success: boolean;
  ir: ProjectIR;
  diagnostics: CompilerDiagnostic[];
  generatedFiles: Array<{ path: string; content: string; mimeType: string }>;
  /** Files that kept hand-written content instead of what the design now generates */
  heldBackPaths?: string[];
  filesCount?: number;
  incremental: boolean;
}

export interface CompiledSourceFile {
  path: string;
  content: string;
  mimeType: string;
  action?: "CREATE" | "UPDATE" | "MERGE" | "PRESERVE" | "DELETE";
  ownership?: string;
  isProtected?: boolean;
  /** Existing hand-written or locked file kept although the design generates different content */
  heldBack?: boolean;
}

// In-memory incremental compilation cache keyed by `${projectId}:${contentHash}`
const compilationCache = new Map<string, { timestamp: number; ir: ProjectIR }>();

// Editor widget types whose `content` field is a label for the layers panel, not visible text
const LABEL_ONLY_TYPES = new Set([
  "container", "div-block", "image", "video", "divider", "spacer", "icon", "nav-menu", "wp-menu", "menu-widget",
  "mega-menu", "off-canvas", "off-canvas-nav", "template", "form", "login", "slides", "gallery", "posts", "portfolio",
  "html", "shortcode", "custom-svg", "google-maps", "soundcloud", "lottie", "search-bar", "site-search", "search-form",
]);

// Element types the generators can reproduce from the editor's data model
const SUPPORTED_TYPES = new Set([
  "container", "div-block", "heading", "text", "paragraph", "blockquote", "button", "image", "video", "divider",
  "spacer", "nav-menu", "wp-menu", "menu-widget",
]);

// Every widget type the visual editor can produce (mirrors frontend ElementType)
const EDITOR_WIDGET_TYPES = new Set(
  (
    "container heading text image video button divider spacer icon rating progress-bar counter html shortcode alert " +
    "social-icons google-maps soundcloud div-block paragraph posts share-buttons portfolio slides form login nav-menu " +
    "animated-headline price-table price-list gallery flip-box call-to-action media-carousel testimonial-carousel " +
    "nested-carousel loop-carousel table-of-contents countdown facebook-page blockquote template reviews " +
    "facebook-button facebook-embed facebook-comments paypal-button stripe-button lottie code-highlight " +
    "video-playlist image-carousel mega-menu off-canvas search-bar import-asset favorite-widgets reusable-components " +
    "basic-media-carousel basic-gallery audio-playlist dynamic-lightbox custom-svg icon-library wp-menu menu-widget " +
    "breadcrumbs menu-anchor post-nav off-canvas-nav site-search search-form taxonomy-filter loop-grid " +
    "facebook-integration facebook-feed facebook-like-button google-calendar paypal stripe wordpress-shortcode " +
    "dynamic-data lms-compat crm-integration webhook-integration link-in-bio image-box icon-box icon-list " +
    "query-builder display-conditions nested-tabs nested-accordion"
  ).split(" ")
);

/** Sectioning tags a container may use instead of <div> (`htmlTag` on the element) */
export const SEMANTIC_CONTAINER_TAGS = new Set(["section", "header", "footer", "main", "article", "aside", "nav"]);

export interface IRBuildContext {
  /** editor page id -> generated route path, used to resolve page links */
  pageRoutes: Map<string, string>;
  warnings: string[];
  seq: { n: number };
}

function createIRBuildContext(): IRBuildContext {
  return { pageRoutes: new Map(), warnings: [], seq: { n: 0 } };
}

function resolveElementTag(element: any): string {
  const type = String(element.type || "").toLowerCase();
  const explicit =
    typeof element.tag === "string"
      ? element.tag.toLowerCase()
      : typeof element.htmlTag === "string"
      ? element.htmlTag.toLowerCase()
      : "";

  if (type === "heading") {
    const level = String(element.headingLevel || "").toLowerCase();
    if (/^h[1-6]$/.test(level)) return level;
    return /^h[1-6]$/.test(explicit) ? explicit : "h2";
  }

  const tagMap: Record<string, string> = {
    button: "button",
    text: "p",
    paragraph: "p",
    blockquote: "blockquote",
    image: "img",
    video: "video",
    container: "div",
    "div-block": "div",
    divider: "hr",
    spacer: "div",
    link: "a",
    "nav-menu": "nav",
    "wp-menu": "nav",
    "menu-widget": "nav",
    section: "section",
    hero: "section",
    form: "form",
    input: "input",
  };

  // A container may be rendered as a semantic sectioning element
  if ((type === "container" || type === "div-block") && SEMANTIC_CONTAINER_TAGS.has(String(element.htmlTag || "").toLowerCase())) {
    return String(element.htmlTag).toLowerCase();
  }

  // Editor widgets always use their mapped tag; free-form documents may name a tag explicitly
  if (tagMap[type] && EDITOR_WIDGET_TYPES.has(type)) return tagMap[type];
  if (explicit && /^[a-z][a-z0-9]*$/.test(explicit) && !["script", "style", "iframe", "object", "embed"].includes(explicit)) {
    return explicit;
  }
  return tagMap[type] || "div";
}

export function resolveElementText(element: any): string | undefined {
  if (typeof element.textContent === "string") return element.textContent;
  if (typeof element.text === "string") return element.text;

  const type = String(element.type || "").toLowerCase();
  if (type === "button") {
    if (typeof element.buttonText === "string" && element.buttonText) return element.buttonText;
    if (typeof element.props?.buttonText === "string" && element.props.buttonText) return element.props.buttonText;
  }

  const labelOnly = LABEL_ONLY_TYPES.has(type) || (EDITOR_WIDGET_TYPES.has(type) && !SUPPORTED_TYPES.has(type));
  if (labelOnly) return undefined;

  if (typeof element.content === "string") return element.content;
  if (typeof element.props?.content === "string") return element.props.content;
  if (typeof element.props?.buttonText === "string") return element.props.buttonText;
  return undefined;
}

function resolveElementHref(element: any, ctx: IRBuildContext): string | undefined {
  const linkType = element.linkType || element.destinationType || element.props?.linkType;
  const pageId = element.pageId || element.linkPageId || element.props?.pageId;
  if (linkType === "page" && pageId && ctx.pageRoutes.has(String(pageId))) {
    return ctx.pageRoutes.get(String(pageId));
  }
  const href = element.href || element.linkUrl || element.url || element.props?.href || element.attributes?.href;
  return typeof href === "string" && href.trim() ? href.trim() : undefined;
}

/** Merge the editor's container `layout` model, button/container fallbacks and desktop overrides into plain CSS styles */
export function resolveElementStyles(element: any): Record<string, any> {
  const styles: Record<string, any> = {};
  const type = String(element.type || "").toLowerCase();

  // 1. Base styles & responsive desktop overrides
  if (element.styles && typeof element.styles === "object") {
    Object.assign(styles, element.styles);
  }
  const desktop = element.responsiveStyles?.desktop;
  if (desktop && typeof desktop === "object") {
    Object.assign(styles, desktop);
  }

  // 2. Button specific style fallbacks
  if (type === "button") {
    if (!styles.backgroundColor && element.buttonBg) styles.backgroundColor = element.buttonBg;
    if (!styles.color && element.buttonColor) styles.color = element.buttonColor;
  }

  // 3. Container background fallback
  if (element.containerBg && !styles.backgroundColor) {
    styles.backgroundColor = element.containerBg;
  }

  // 4. Container layout model
  const layout = element.layout;
  if (layout && typeof layout === "object" && (type === "container" || type === "div-block")) {
    const layoutType = layout.layoutType || (layout.display === "grid" ? "grid" : "flex");
    if (layoutType === "grid") {
      styles.display = "grid";
      styles.gridTemplateColumns = layout.gridTemplateColumns || "repeat(2, minmax(0, 1fr))";
      if (layout.gridTemplateRows) styles.gridTemplateRows = layout.gridTemplateRows;
      if (layout.gridAutoFlow) styles.gridAutoFlow = layout.gridAutoFlow;
      if (layout.justifyItems) styles.justifyItems = layout.justifyItems;
      if (layout.alignItems) styles.alignItems = layout.alignItems;
      if (layout.columnGap !== undefined) styles.columnGap = typeof layout.columnGap === "number" ? `${layout.columnGap}px` : layout.columnGap;
      if (layout.rowGap !== undefined) styles.rowGap = typeof layout.rowGap === "number" ? `${layout.rowGap}px` : layout.rowGap;
      if (layout.gap !== undefined) styles.gap = typeof layout.gap === "number" ? `${layout.gap}px` : layout.gap;
    } else if (layoutType === "masonry") {
      styles.display = "block";
      styles.columnCount = layout.masonryColumns || 3;
      styles.columnGap = `${layout.masonryGap || layout.gap || 16}px`;
    } else {
      styles.display = "flex";
      styles.flexDirection = layout.direction === "row" ? "row" : "column";
      if (layout.flexWrap) styles.flexWrap = layout.flexWrap;
      else if (layout.wrap === true || layout.wrap === "wrap") styles.flexWrap = "wrap";
      if (layout.justifyContent) styles.justifyContent = layout.justifyContent;
      if (layout.alignItems) styles.alignItems = layout.alignItems;
      if (layout.gap !== undefined) {
        styles.gap = typeof layout.gap === "number" ? `${layout.gap}px` : layout.gap;
      }
    }
  }

  // 5. Border radius directional shortcuts
  if (
    styles.borderTopLeftRadius ||
    styles.borderTopRightRadius ||
    styles.borderBottomRightRadius ||
    styles.borderBottomLeftRadius
  ) {
    const baseRadius = styles.borderRadius || "0px";
    styles.borderTopLeftRadius = styles.borderTopLeftRadius || baseRadius;
    styles.borderTopRightRadius = styles.borderTopRightRadius || baseRadius;
    styles.borderBottomRightRadius = styles.borderBottomRightRadius || baseRadius;
    styles.borderBottomLeftRadius = styles.borderBottomLeftRadius || baseRadius;
  }

  return styles;
}

function navItemsToIR(element: any, ctx: IRBuildContext): ElementIR[] {
  const items = Array.isArray(element.navMenuItems) ? element.navMenuItems : [];
  const vertical = element.navLayout === "vertical";
  const baseId = String(element.id || "nav");

  const links: ElementIR[] = items
    .filter((item: any) => item && typeof item === "object" && typeof item.label === "string")
    .map((item: any, idx: number) => ({
      id: `${baseId}_item_${item.id ?? idx}`,
      type: "link",
      tag: "a",
      classes: [],
      styles: {
        ...(element.navItemColor ? { color: element.navItemColor } : {}),
        ...(element.navFontSize ? { fontSize: element.navFontSize } : {}),
        ...(element.navFontWeight ? { fontWeight: String(element.navFontWeight) } : {}),
        textDecoration: "none",
      },
      props: {
        href: resolveElementHref({ ...item, href: item.url }, ctx) || "#",
        target: item.target,
      },
      textContent: item.label,
      children: [],
    }));

  if (links.length === 0) return [];
  return [
    {
      id: `${baseId}_list`,
      type: "container",
      tag: "div",
      classes: [],
      styles: {
        display: "flex",
        flexDirection: vertical ? "column" : "row",
        flexWrap: "wrap",
        alignItems: vertical ? "flex-start" : "center",
        gap: `${typeof element.navGap === "number" ? element.navGap : 24}px`,
      },
      children: links,
    },
  ];
}

/**
 * Convert Visual Editor Element tree to canonical ElementIR
 */
export function visualElementToIR(
  element: any,
  filePath: string,
  parentLine = 1,
  ctx: IRBuildContext = createIRBuildContext()
): ElementIR {
  if (!element || typeof element !== "object" || Array.isArray(element)) {
    return {
      id: `el_auto_${++ctx.seq.n}`,
      type: "container",
      tag: "div",
      classes: [],
      styles: {},
      children: [],
    };
  }

  const type = String(element.type || element.elementType || "container");
  const typeLower = type.toLowerCase();
  const id = typeof element.id === "string" && element.id ? element.id : `el_auto_${++ctx.seq.n}`;

  const rawChildren = Array.isArray(element.children)
    ? element.children
    : Array.isArray(element.elements)
    ? element.elements
    : [];

  const children: ElementIR[] = rawChildren
    .filter((child: any) => child && typeof child === "object")
    .map((child: any, idx: number) => visualElementToIR(child, filePath, parentLine + idx + 1, ctx));

  if (typeLower === "nav-menu" || typeLower === "wp-menu" || typeLower === "menu-widget") {
    children.unshift(...navItemsToIR({ ...element, id }, ctx));
  }

  if (!SUPPORTED_TYPES.has(typeLower) && typeLower !== "section" && typeLower !== "link" && typeLower !== "hero") {
    ctx.warnings.push(
      `Widget '${type}' (${id}) is not supported by code generation yet; it was generated as a plain container.`
    );
  }

  const tag = resolveElementTag(element);
  const resolvedTextContent = resolveElementText(element);
  const href = resolveElementHref(element, ctx);

  const attributes: Record<string, string> = {};
  if (element.attributes && typeof element.attributes === "object" && !Array.isArray(element.attributes)) {
    for (const [k, v] of Object.entries(element.attributes)) {
      if (typeof v === "string" || typeof v === "number") attributes[k] = String(v);
    }
  }
  if (tag === "nav" && !attributes["aria-label"]) attributes["aria-label"] = "Main navigation";

  return {
    id,
    type,
    tag,
    name: element.name || element.label,
    classes: Array.isArray(element.classes) ? element.classes.filter((c: any) => typeof c === "string") : [],
    styles: resolveElementStyles(element),
    responsiveStyles:
      element.responsiveStyles && typeof element.responsiveStyles === "object" ? element.responsiveStyles : {},
    props: {
      ...(element.props && typeof element.props === "object" ? element.props : {}),
      content: resolvedTextContent,
      src: element.src || element.props?.src || element.attributes?.src,
      alt: element.alt || element.props?.alt || element.attributes?.alt,
      href,
      target: element.target || element.props?.target,
      placeholder: element.placeholder || element.props?.placeholder || element.attributes?.placeholder,
      buttonText: element.buttonText || element.props?.buttonText,
    },
    attributes,
    textContent: resolvedTextContent,
    children,
    isProtected: !!element.isProtected,
    sourceRange: {
      file: filePath,
      startLine: parentLine,
      startCol: 1,
      endLine: parentLine + 2,
      endCol: 1,
    },
    dynamicData: element.dynamicData,
  };
}

/**
 * Normalise a page path/slug into a URL-safe route path
 */
export function normalizeRoutePath(raw: string): string {
  const segments = String(raw || "")
    .trim()
    .split(/[\\/]+/)
    .map((segment) => {
      const dynamic = segment.match(/^(?::([A-Za-z_][A-Za-z0-9_]*)|\[([A-Za-z_][A-Za-z0-9_]*)\])$/);
      if (dynamic) return `:${dynamic[1] || dynamic[2]}`;
      return segment
        .normalize("NFKD")
        .replace(/[^\x00-\x7F]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9_~-]+/g, "-")
        .replace(/^-+|-+$/g, "");
    })
    .filter(Boolean);
  return `/${segments.join("/")}`;
}

const RESERVED_IDENTIFIERS = new Set([
  "Break", "Case", "Catch", "Class", "Const", "Continue", "Debugger", "Default", "Delete",
  "Do", "Else", "Export", "Extends", "False", "Finally", "For", "Function", "If", "Import",
  "In", "Instanceof", "New", "Null", "Return", "Super", "Switch", "This", "Throw", "True",
  "Try", "Typeof", "Var", "Void", "While", "With", "Yield",
  "Object", "Boolean", "Symbol", "Error", "Number", "BigInt", "Math", "Date", "String",
  "RegExp", "Array", "Map", "Set", "Promise", "Proxy", "Reflect", "JSON", "Intl",
]);

function toPageIdentifier(raw: string, fallback: string): string {
  const words = String(raw || "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);
  let id = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
  // `fallback` names a page whose title has no usable characters; a numeric or
  // reserved title keeps its text behind a neutral prefix ("404" -> "Page404")
  if (!id) return fallback;
  if (/^[0-9]/.test(id) || RESERVED_IDENTIFIERS.has(id)) id = `Page${id}`;
  return id;
}

/** Name of the exported page component (and, for React, of its file) */
export function pageComponentName(componentName: string): string {
  return componentName.endsWith("Page") ? componentName : `${componentName}Page`;
}

function uniqueValue(candidate: string, taken: Set<string>, join: string): string {
  let value = candidate;
  let n = 2;
  while (taken.has(value.toLowerCase())) {
    value = `${candidate}${join}${n++}`;
  }
  taken.add(value.toLowerCase());
  return value;
}

/**
 * File the generator for `framework` writes for a page component
 */
export function pageFilePathFor(framework: string, componentName: string, routePath: string): string {
  if (framework === "nextjs") {
    const relative = routePath
      .replace(/^\/+/, "")
      .split("/")
      .filter(Boolean)
      .map((s) => (s.startsWith(":") ? `[${s.slice(1)}]` : s))
      .join("/");
    return relative ? `app/${relative}/page.tsx` : "app/page.tsx";
  }
  return `src/pages/${pageComponentName(componentName)}.tsx`;
}

function resolveEditorBreakpoints(editorData: any): { tablet: number; mobile: number } {
  const result = { tablet: 1024, mobile: 767 };
  const list = editorData?.breakpoints;
  if (Array.isArray(list)) {
    for (const bp of list) {
      const max = Number(bp?.maxWidth);
      if ((bp?.id === "tablet" || bp?.id === "mobile") && Number.isFinite(max) && max > 0) {
        result[bp.id as "tablet" | "mobile"] = max;
      }
    }
  }
  return result;
}

/**
 * Convert Visual Document (editorData) to canonical ProjectIR
 */
export function visualDocumentToIR(
  editorData: any,
  projectInfo: { id: string; name: string; slug: string; framework?: string } = {
    id: "default_project",
    name: "ForgeProject",
    slug: "forge-project",
    framework: "react",
  }
): ProjectIR {
  const safeProjectInfo = {
    id: projectInfo?.id || "default_project",
    name: projectInfo?.name || "ForgeProject",
    slug: projectInfo?.slug || "forge-project",
    framework: projectInfo?.framework || "react",
  };

  if (typeof editorData === "string") {
    try {
      editorData = JSON.parse(editorData);
    } catch {
      editorData = {};
    }
  }
  if (!editorData || typeof editorData !== "object" || Array.isArray(editorData)) editorData = {};

  const ctx = createIRBuildContext();

  // Resolve elements and pages flexibly across document formats
  const rawElements = Array.isArray(editorData?.elements)
    ? editorData.elements
    : Array.isArray(editorData?.canvasData?.elements)
    ? editorData.canvasData.elements
    : [];

  const rawPages = Array.isArray(editorData?.pages)
    ? editorData.pages.filter((p: any) => p && typeof p === "object" && !Array.isArray(p))
    : [];
  const globalStyles = editorData?.globalStyles || editorData?.globalSettings?.globalStyles || {};
  const designTokens =
    editorData?.designTokens && typeof editorData.designTokens === "object" ? editorData.designTokens : {};

  const components: ComponentIR[] = [];
  const routes: RouteIR[] = [];
  const homePageId = editorData?.homePageId;

  const sitePartElements = (part: any): any[] =>
    part && part.enabled !== false && Array.isArray(part.elements)
      ? part.elements.filter((el: any) => el && typeof el === "object")
      : [];
  const headerElements = sitePartElements(editorData?.siteParts?.header);
  const footerElements = sitePartElements(editorData?.siteParts?.footer);

  // Multi-page document
  if (rawPages.length > 0) {
    const slugOf = (p: any) => String(p.slug || "").trim().toLowerCase();
    const pathOf = (p: any) => String(p.path || p.pageSettings?.path || "").trim();

    // Exactly one page is the home page, chosen by descending priority
    const homePage =
      (homePageId ? rawPages.find((p: any) => p.id === homePageId) : undefined) ||
      rawPages.find((p: any) => p.isHome === true) ||
      rawPages.find((p: any) => pathOf(p) === "/" || slugOf(p) === "/") ||
      rawPages.find((p: any) => ["home", "index"].includes(slugOf(p).replace(/^\/+/, ""))) ||
      rawPages[0];

    // Uniqueness is decided on the final component name, so "About" and
    // "About Page" can never both claim AboutPage.tsx
    const takenNames = new Set<string>(["notfoundpage"]);
    const takenRoutes = new Set<string>(["/"]);
    const uniquePageName = (candidate: string): string => {
      let name = candidate;
      for (let n = 2; takenNames.has(pageComponentName(name).toLowerCase()); n++) name = `${candidate}${n}`;
      takenNames.add(pageComponentName(name).toLowerCase());
      return name;
    };

    const planned = rawPages.map((page: any, i: number) => {
      const isHome = page === homePage;
      const pageTitle = String(
        page.title || page.name || page.pageSettings?.title || (isHome ? "Home" : `Page ${i + 1}`)
      );
      const compName = uniquePageName(toPageIdentifier(pageTitle, isHome ? "Home" : `Page${i + 1}`));

      let routePath = "/";
      if (!isHome) {
        const candidate = normalizeRoutePath(pathOf(page) || slugOf(page) || pageTitle);
        let base = candidate === "/" ? normalizeRoutePath(compName) : candidate;
        if (base === "/api" || base.startsWith("/api/")) base = `/page-${base.slice(1)}`;
        routePath = uniqueValue(base, takenRoutes, "-");
      }

      if (page.id) ctx.pageRoutes.set(String(page.id), routePath);
      return { page, pageTitle, compName, routePath };
    });

    for (const { page, pageTitle, compName, routePath } of planned) {
      const pageElements = Array.isArray(page.elements)
        ? page.elements
        : Array.isArray(page.children)
        ? page.children
        : [];

      const filePath = pageFilePathFor(safeProjectInfo.framework, compName, routePath);
      const allElements = [...headerElements, ...pageElements, ...footerElements].filter(
        (el: any) => el && typeof el === "object"
      );

      const rootEl: ElementIR = {
        id: `page_root_${page.id || compName.toLowerCase()}`,
        type: "container",
        tag: "div",
        classes: ["min-h-screen", "w-full"],
        styles: {},
        children: allElements.map((el: any, idx: number) => visualElementToIR(el, filePath, idx + 1, ctx)),
      };

      const compId = `comp_${page.id || compName.toLowerCase()}`;

      components.push({
        id: compId,
        name: compName,
        filePath,
        isPage: true,
        routePath,
        pageId: page.id ? String(page.id) : undefined,
        rootElement: rootEl,
        imports: ["import React from 'react';"],
      });

      routes.push({
        path: routePath,
        componentId: compId,
        title: pageTitle || safeProjectInfo.name,
        metaDescription: page.metaDescription || page.pageSettings?.metaDescription,
      });
    }
  } else {
    // Single page document
    const singlePageTitle = editorData?.pageSettings?.title || editorData?.title || editorData?.name || "Home";
    const compName = toPageIdentifier(singlePageTitle, "Home");
    const filePath = pageFilePathFor(safeProjectInfo.framework, compName, "/");
    const allElements = [...headerElements, ...rawElements, ...footerElements].filter(
      (el: any) => el && typeof el === "object"
    );
    const rootEl: ElementIR = {
      id: "root_main",
      type: "container",
      tag: "div",
      classes: ["min-h-screen", "w-full"],
      styles: {},
      children: allElements.map((el: any, idx: number) => visualElementToIR(el, filePath, idx + 1, ctx)),
    };

    components.push({
      id: "comp_main",
      name: compName,
      filePath,
      isPage: true,
      routePath: "/",
      rootElement: rootEl,
      imports: ["import React from 'react';"],
    });

    routes.push({
      path: "/",
      componentId: "comp_main",
      title: singlePageTitle || safeProjectInfo.name,
    });
  }

  return {
    irVersion: IR_SCHEMA_VERSION,
    schemaVersion: IR_SCHEMA_VERSION,
    projectId: safeProjectInfo.id,
    name: safeProjectInfo.name,
    slug: safeProjectInfo.slug,
    framework: safeProjectInfo.framework || "react",
    components,
    routes,
    designTokens: {
      colors: designTokens.colors || {},
      typography: designTokens.typography || {},
      spacing: designTokens.spacing || {},
      radius: designTokens.radius || {},
      shadows: designTokens.shadows || {},
      breakpoints: designTokens.breakpoints || { sm: 640, md: 768, lg: 1024, xl: 1280 },
    },
    globalStyles,
    customCss: [editorData?.customCss, editorData?.pageCss]
      .filter((c) => typeof c === "string" && c.trim())
      .join("\n\n"),
    customJs: typeof editorData?.customJs === "string" ? editorData.customJs : "",
    metadata: {
      generatedAt: new Date().toISOString(),
      editorBreakpoints: resolveEditorBreakpoints(editorData),
      warnings: Array.from(new Set(ctx.warnings)),
    },
  };
}

/**
 * Convert ElementIR back to Visual EditorElement
 */
export function irElementToVisual(ir: ElementIR): any {
  const elements = ir.children.map(irElementToVisual);

  return {
    id: ir.id,
    type: ir.type || "container",
    headingLevel: ir.tag.startsWith("h") ? ir.tag.toUpperCase() : undefined,
    name: ir.name,
    classes: ir.classes || [],
    styles: ir.styles || {},
    responsiveStyles: ir.responsiveStyles || {},
    content: ir.textContent || ir.props?.content || "",
    src: ir.props?.src,
    alt: ir.props?.alt,
    href: ir.props?.href,
    target: ir.props?.target,
    placeholder: ir.props?.placeholder,
    buttonText: ir.props?.buttonText,
    isProtected: ir.isProtected,
    elements,
  };
}

/**
 * Convert ProjectIR back to Visual editorData
 */
export function irToVisualDocument(ir: ProjectIR): any {
  if (ir.components.length === 1 && !ir.components[0].routePath) {
    const mainComp = ir.components[0];
    return {
      version: 1,
      elements: mainComp.rootElement.children.map(irElementToVisual),
      globalStyles: ir.globalStyles || {},
      designTokens: ir.designTokens || {},
      customCss: ir.customCss || "",
      customJs: ir.customJs || "",
    };
  }

  // Multi-page representation
  const pages = ir.components.map((c) => ({
    id: c.id.replace("comp_", ""),
    name: c.name,
    slug: c.routePath || `/${c.name.toLowerCase()}`,
    path: c.routePath || `/${c.name.toLowerCase()}`,
    elements: c.rootElement.children.map(irElementToVisual),
  }));

  return {
    version: 1,
    pages,
    elements: pages[0]?.elements || [],
    globalStyles: ir.globalStyles || {},
    designTokens: ir.designTokens || {},
    customCss: ir.customCss || "",
    customJs: ir.customJs || "",
  };
}

/**
 * Optimization pass: Dead node elimination and unused styling cleanup
 */
export function optimizeIR(ir: ProjectIR): { ir: ProjectIR; eliminatedNodesCount: number } {
  let eliminatedNodesCount = 0;

  function pruneElement(el: ElementIR): ElementIR | null {
    // If spacer or divider has zero dimensions and no children, prune
    if (el.type === "spacer" && el.styles.height === "0px" && (!el.children || el.children.length === 0)) {
      eliminatedNodesCount++;
      return null;
    }

    const prunedChildren: ElementIR[] = [];
    for (const child of el.children) {
      const res = pruneElement(child);
      if (res) prunedChildren.push(res);
    }

    return {
      ...el,
      children: prunedChildren,
    };
  }

  const optimizedComponents = ir.components.map((c) => {
    const optimizedRoot = pruneElement(c.rootElement) || c.rootElement;
    return {
      ...c,
      rootElement: optimizedRoot,
    };
  });

  return {
    ir: { ...ir, components: optimizedComponents },
    eliminatedNodesCount,
  };
}

/**
 * Generate full source file tree from ProjectIR
 */
export function compileIRToSourceFiles(ir: ProjectIR): Array<{ path: string; content: string; mimeType: string }> {
  const visualDoc = irToVisualDocument(ir);
  const codeOutputs = generateAllCodeOutputs(visualDoc, { scope: "full" });

  const files: Array<{ path: string; content: string; mimeType: string }> = [];

  // 1. package.json
  const packageJson = {
    name: ir.slug,
    version: "1.0.0",
    private: true,
    type: "module",
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
      typescript: "^5.7.0",
      "@types/react": "^19.0.0",
      "@types/react-dom": "^19.0.0",
      vite: "^6.0.0",
      tailwindcss: "^4.0.0",
    },
  };
  files.push({
    path: "package.json",
    content: JSON.stringify(packageJson, null, 2),
    mimeType: "application/json",
  });

  // 2. tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      useDefineForClassFields: true,
      lib: ["ES2022", "DOM", "DOM.Iterable"],
      module: "ESNext",
      skipLibCheck: true,
      moduleResolution: "bundler",
      allowImportingTsExtensions: true,
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      jsx: "react-jsx",
      strict: true,
      noUnusedLocals: false,
      noUnusedParameters: false,
      noFallthroughCasesInSwitch: true,
    },
    include: ["src"],
  };
  files.push({
    path: "tsconfig.json",
    content: JSON.stringify(tsconfig, null, 2),
    mimeType: "application/json",
  });

  // 3. index.html
  files.push({
    path: "index.html",
    content: codeOutputs.html || `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${ir.name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
    mimeType: "text/html",
  });

  // 4. src/main.tsx
  files.push({
    path: "src/main.tsx",
    content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
    mimeType: "text/typescript-jsx",
  });

  // 5. src/index.css
  files.push({
    path: "src/index.css",
    content: codeOutputs.css || `@import "tailwindcss";

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  color: #1e293b;
  background-color: #ffffff;
}`,
    mimeType: "text/css",
  });

  // 6. src/App.tsx
  const appTsx = codeOutputs.reactCode?.appTsx || `import React from 'react';

export default function App() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">${ir.name}</h1>
      </div>
    </main>
  );
}`;
  files.push({
    path: "src/App.tsx",
    content: appTsx,
    mimeType: "text/typescript-jsx",
  });

  // 7. Component files from reactCode.components
  if (codeOutputs.reactCode?.components) {
    for (const [name, code] of Object.entries(codeOutputs.reactCode.components)) {
      files.push({
        path: `src/components/${name}.tsx`,
        content: code,
        mimeType: "text/typescript-jsx",
      });
    }
  }

  // 8. Design tokens file
  files.push({
    path: "src/styles/tokens.json",
    content: JSON.stringify(ir.designTokens, null, 2),
    mimeType: "application/json",
  });

  return files;
}

/**
 * Generate full source file tree from ProjectIR using full generator plans (React or Next.js)
 */
export async function compileIRToSourceFilesAsync(
  ir: ProjectIR,
  existingFiles: Array<{
    id: string;
    path: string;
    content?: string | null;
    contentHash: string;
    isGenerated: boolean;
    isProtected: boolean;
  }> = [],
  heldPaths: Set<string> = new Set()
): Promise<CompiledSourceFile[]> {
  // A generator failure must surface to the caller: silently substituting a
  // placeholder project would replace the user's design with a stub.
  const plan =
    ir.framework === "nextjs"
      ? await (await import("../generator/nextjsGenerator.service.js")).buildNextJsGenerationPlan(
          ir,
          Array.isArray(existingFiles) ? existingFiles : [],
          { scope: { type: "full" } }
        )
      : await (await import("../generator/reactGenerator.service.js")).buildReactGenerationPlan(
          ir,
          Array.isArray(existingFiles) ? existingFiles : [],
          { scope: { type: "full" } }
        );

  if (!plan || !Array.isArray(plan.files) || plan.files.length === 0) {
    throw new AppError("Code generation produced no files", 500, "GENERATION_EMPTY");
  }

  const { holdBackPlannedFiles } = await import("../generator/sourcePreservation.service.js");
  const plannedFiles = holdBackPlannedFiles(plan.files, Array.isArray(existingFiles) ? existingFiles : [], heldPaths);

  const files: CompiledSourceFile[] = plannedFiles.map((f) => ({
    path: f.path,
    content: f.content,
    mimeType: f.mimeType || "text/typescript-jsx",
    action: f.action,
    ownership: f.ownership,
    isProtected: f.isProtected,
    heldBack: f.heldBack,
  }));
  Object.defineProperty(files, "warnings", { value: plan.warnings || [], enumerable: false });
  return files;
}

/**
 * Execute full compilation pipeline: Visual -> IR -> Optimize -> Persistent Filesystem
 */
export async function compileAndSyncProject(
  projectId: string,
  editorData: any,
  projectInfo: { id: string; name: string; slug: string; framework?: string },
  authorId?: string,
  options?: { unholdPaths?: Set<string> | Iterable<string> }
): Promise<CompilationResult> {
  const diagnostics: CompilerDiagnostic[] = [];

  // 1. Visual -> IR
  const rawIR = visualDocumentToIR(editorData, projectInfo);

  // 2. Optimization pass
  const { ir: optimizedIR } = optimizeIR(rawIR);

  // 3. IR -> Source files, reconciled against what the project already holds so
  //    user-authored files and protected regions survive recompilation
  const existingFiles = (await listFiles(projectId)).filter((f: any) => !f.isDirectory);
  const { heldCodePaths } = await import("../generator/sourcePreservation.service.js");
  const { prisma } = await import("../../config/prisma.js");
  const projectRow = await (prisma as any).forgeProject.findUnique({ where: { id: projectId } });
  const held = heldCodePaths(projectRow?.metadata);
  if (options?.unholdPaths) {
    for (const p of options.unholdPaths) {
      held.delete(p);
    }
  }
  const files = await compileIRToSourceFilesAsync(optimizedIR, existingFiles as any, held);

  for (const message of [
    ...((optimizedIR.metadata?.warnings as string[]) || []),
    ...(((files as any).warnings as string[]) || []),
  ]) {
    diagnostics.push({ severity: "warning", code: "GENERATION_NOTICE", message });
  }

  // 4. Write generated files to project filesystem
  for (const file of files) {
    if (file.action === "PRESERVE") continue;
    try {
      await writeFile(projectId, file.path, {
        content: file.content,
        encoding: "utf-8",
        isGenerated: true,
        authorId,
        reason: "Compiler IR sync",
      });
    } catch (err: any) {
      diagnostics.push({
        severity: "error",
        code: "FILE_WRITE_ERROR",
        message: `Failed to write generated file '${file.path}': ${err.message}`,
        file: file.path,
      });
    }
  }

  // 5. Remove generated files this compilation no longer produces (deleted pages,
  //    or the scaffold of a previously selected framework)
  const { findStaleGeneratedFiles } = await import("../generator/sourcePreservation.service.js");
  for (const stale of findStaleGeneratedFiles(existingFiles as any[], files.map((f) => f.path))) {
    try {
      await deleteFile(projectId, stale.path, authorId);
    } catch (err: any) {
      diagnostics.push({
        severity: "warning",
        code: "STALE_FILE_CLEANUP_FAILED",
        message: `Could not remove stale generated file '${stale.path}': ${err.message}`,
        file: stale.path,
      });
    }
  }

  const success = !diagnostics.some((d) => d.severity === "error");

  return {
    success,
    ir: optimizedIR,
    diagnostics,
    generatedFiles: files,
    heldBackPaths: files.filter((f) => f.heldBack).map((f) => f.path),
    filesCount: files.length,
    incremental: false,
  };
}

export const unifiedCompilerService = {
  visualDocumentToIR,
  optimizeIR,
  compileIRToSourceFiles,
  compileAndSyncProject,
  compileProject: async (
    projectId: string,
    editorData: any,
    projectInfo: { id: string; name: string; slug: string; framework?: string } = {
      id: projectId,
      name: "ForgeProject",
      slug: "forge-project",
      framework: "react",
    },
    authorId?: string
  ) => {
    return compileAndSyncProject(projectId, editorData, projectInfo, authorId);
  },
};

