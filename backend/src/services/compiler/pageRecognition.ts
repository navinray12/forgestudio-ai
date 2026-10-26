/**
 * Pure page-entry discovery and registration preflight. No filesystem writes,
 * customer-code execution or database access occur here. A recognized path is
 * not a claim that the current compiler can losslessly import its implementation.
 * Blueprint v2.1: sections 35-37, FS21-AT-PAG-01..06/11/14.
 */
export type PageFramework = "react" | "nextjs";
export type PageRouter = "next-app" | "next-pages" | "react-forge";
export interface RouteParameter {
  name: string;
  kind: "single" | "catch-all" | "optional-catch-all";
}
export interface RecognizedPageInfo {
  isPage: true;
  pageName: string;
  pageTitle: string;
  routePath: string;
  /** Suggested generated symbol, NOT an inferred source export. */
  componentName: string;
  targetFilePath: string;
  router?: PageRouter;
  parameters?: RouteParameter[];
}
export type PageRecognitionResult = RecognizedPageInfo | { isPage: false };
export type PageEntryClassification =
  | { status: "recognized"; page: RecognizedPageInfo }
  | { status: "not-a-page" }
  | { status: "invalid"; code: string; message: string }
  | { status: "unsupported"; code: string; message: string };

/** Accept only project-relative paths; never erase traversal or absolute roots. */
export function normalizePageSourcePath(filePath: string): string | null {
  if (typeof filePath !== "string" || !filePath || /[\x00-\x1f\x7f]/.test(filePath)) return null;
  if (/^[\\/]|^[A-Za-z]:/.test(filePath)) return null;
  const clean = filePath.replace(/\\/g, "/").replace(/^(?:\.\/)+/, "");
  if (!clean || clean.split("/").some((part) => !part || part === "." || part === ".." || part.trim() !== part)) return null;
  // Reserved filename/URL delimiters are outside this portable source profile.
  if (/[?:*<>|"#]/.test(clean)) return null;
  return clean;
}

function unsupported(code: string, message: string): PageEntryClassification {
  return { status: "unsupported", code, message };
}

function words(value: string): string[] {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/).filter(Boolean);
}

// Naming suffix only, not an identity, security check, or uniqueness guarantee.
function nameSuffix(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function symbolFor(parts: string[], sourcePath: string): string {
  const tokens = parts.flatMap(words);
  let name = tokens.map((part) => part[0]!.toUpperCase() + part.slice(1)).join("");
  if (!name) name = `Page${nameSuffix(sourcePath)}`;
  if (/^[0-9]/.test(name)) name = `Page${name}`;
  if (name.length > 100) name = `${name.slice(0, 88)}${nameSuffix(sourcePath)}`;
  return name.endsWith("Page") ? name : `${name}Page`;
}

function titleFor(segment: string): string {
  const title = segment.replace(/^\[\[?\.{0,3}/, "").replace(/\]\]?$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ").trim();
  return title ? title.split(/\s+/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ") : "Home";
}

function describe(
  sourcePath: string, router: PageRouter, parts: string[], parameters: RouteParameter[] = [],
): PageEntryClassification {
  const title = parts.length ? titleFor(parts[parts.length - 1]!) : "Home";
  return { status: "recognized", page: {
    isPage: true, pageName: title, pageTitle: title,
    routePath: `/${parts.join("/")}`,
    componentName: parts.length ? symbolFor(parts, sourcePath) : "HomePage",
    targetFilePath: sourcePath, router, parameters,
  } };
}

function parameter(segment: string): RouteParameter | null {
  const optional = segment.match(/^\[\[\.\.\.([A-Za-z_][A-Za-z0-9_]*)\]\]$/);
  if (optional) return { name: optional[1]!, kind: "optional-catch-all" };
  const catchAll = segment.match(/^\[\.\.\.([A-Za-z_][A-Za-z0-9_]*)\]$/);
  if (catchAll) return { name: catchAll[1]!, kind: "catch-all" };
  const single = segment.match(/^\[([A-Za-z_][A-Za-z0-9_]*)\]$/);
  return single ? { name: single[1]!, kind: "single" } : null;
}

function nextRoute(sourcePath: string, router: "next-app" | "next-pages", parts: string[]): PageEntryClassification {
  const params: RouteParameter[] = [];
  for (let i = 0; i < parts.length; i++) {
    const segment = parts[i]!;
    const param = parameter(segment);
    if (param) {
      if (params.some((p) => p.name === param.name)) return unsupported("DUPLICATE_ROUTE_PARAMETER", "Route parameter names must be unique within a path.");
      if (param.kind !== "single" && i !== parts.length - 1) return unsupported("NONTERMINAL_CATCH_ALL", "Catch-all parameters must be the final route segment.");
      params.push(param);
    } else if (/[\[\]()]/.test(segment)) {
      return unsupported("UNSUPPORTED_ROUTE_SEGMENT", "This segment is outside the supported route grammar; source is preserved.");
    }
    // Keep percent-encoded segments opaque rather than decoding filesystem paths.
    if (/%(?![0-9A-Fa-f]{2})/.test(segment)) return unsupported("INVALID_ROUTE_ENCODING", "Malformed URL encoding in the route segment.");
  }
  return describe(sourcePath, router, parts, params);
}

/**
 * Path classification only. Root selection, actual exports/layouts, and lossless
 * import must be qualified by the caller against the whole project/compiler.
 * React's src/pages convention is Forge-specific, not React Router auto-routing.
 */
export function classifyPageEntry(filePath: string, framework: PageFramework = "react"): PageEntryClassification {
  const clean = normalizePageSourcePath(filePath);
  if (!clean) return { status: "invalid", code: "INVALID_PAGE_SOURCE_PATH", message: "Expected a safe project-relative source path." };
  if (framework !== "react" && framework !== "nextjs") return unsupported("UNSUPPORTED_PAGE_FRAMEWORK", "Select an explicitly supported framework.");
  if (!/\.(tsx|jsx)$/.test(clean)) return { status: "not-a-page" };
  const allParts = clean.split("/");
  if (allParts.some((p) => ["node_modules", "__tests__", "__mocks__", "__fixtures__"].includes(p)) || /\.(test|spec|stories|story)\.(tsx|jsx)$/.test(clean)) return { status: "not-a-page" };

  if (framework === "nextjs") {
    const app = clean.match(/^(?:src\/)?app\/(.+)$/);
    if (app) {
      const parts = app[1]!.split("/");
      // An exact leaf check prevents homepage.tsx/not-a-page.tsx false positives.
      if (!/^page\.(tsx|jsx)$/.test(parts.pop()!)) return { status: "not-a-page" };
      if (parts.some((p) => p.startsWith("_"))) return { status: "not-a-page" };
      if (parts.some((p) => p.startsWith("@") || /^\(\.{1,3}\)/.test(p))) {
        return unsupported("ADVANCED_NEXT_ROUTE", "Parallel/intercepted routes require a qualified visual adapter; source is preserved.");
      }
      const routeParts = parts.filter((p) => !/^\([^()]+\)$/.test(p));
      return nextRoute(clean, "next-app", routeParts);
    }
    const pages = clean.match(/^(?:src\/)?pages\/(.+)\.(tsx|jsx)$/);
    if (pages) {
      const parts = pages[1]!.split("/");
      if (parts[0] === "api" || (parts.length === 1 && ["_app", "_document", "_error", "404", "500"].includes(parts[0]!))) return { status: "not-a-page" };
      // Pages Router does not share App Router's underscore-private convention.
      if (parts[parts.length - 1] === "index") parts.pop();
      return nextRoute(clean, "next-pages", parts);
    }
    return { status: "not-a-page" };
  }

  const react = clean.match(/^src\/pages\/(.+)\.(tsx|jsx)$/);
  if (!react) return { status: "not-a-page" };
  const parts = react[1]!.split("/");
  if (parts.some((p) => p.startsWith("_"))) return { status: "not-a-page" };
  if (parts.some((p) => /[\[\]()@]/.test(p))) return unsupported("UNSUPPORTED_REACT_ROUTE", "Dynamic React routes require an explicit router contract; filename syntax alone is insufficient.");
  const last = parts.pop()!.replace(/Page$/, "");
  if (!last) return unsupported("EMPTY_PAGE_NAME", "The page filename must contain a meaningful name.");
  if (last.toLowerCase() !== "index" && !(parts.length === 0 && last.toLowerCase() === "home")) parts.push(last);
  const slugs = parts.map((p) => p.replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/_/g, "-").toLowerCase());
  return describe(clean, "react-forge", slugs);
}

/** Compatibility facade for existing callers. Detailed callers use classifyPageEntry. */
export function isRecognizedPageEntry(filePath: string, framework: PageFramework = "react"): PageRecognitionResult {
  const result = classifyPageEntry(filePath, framework);
  return result.status === "recognized" ? result.page : { isPage: false };
}

/** Normalize only the supported internal :param alias, retaining URL/parameter case. */
export function pageRouteIdentity(route: string): string {
  return route.split("/").map((p) => /^:[A-Za-z_][A-Za-z0-9_]*$/.test(p) ? `[${p.slice(1)}]` : p).join("/");
}

function routeShape(route: string): string {
  return pageRouteIdentity(route).split("/").map((segment) => {
    const p = parameter(segment);
    return p ? `{${p.kind}}` : segment.toLowerCase();
  }).join("/");
}

function routesConflict(a: string, b: string, framework: PageFramework): boolean {
  // Case-folded conflict prevention is deliberately conservative while the
  // legacy compiler canonicalizes static paths to lowercase.
  if (routeShape(a) === routeShape(b)) return true;
  const x = pageRouteIdentity(a).split("/").filter(Boolean);
  const y = pageRouteIdentity(b).split("/").filter(Boolean);
  const lastX = parameter(x[x.length - 1] || "");
  const lastY = parameter(y[y.length - 1] || "");
  if (lastX?.kind === "optional-catch-all" && routeShape(`/${x.slice(0, -1).join("/")}`) === routeShape(b)) return true;
  if (lastY?.kind === "optional-catch-all" && routeShape(`/${y.slice(0, -1).join("/")}`) === routeShape(a)) return true;
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    if (x[i]!.toLowerCase() === y[i]!.toLowerCase() && !parameter(x[i]!)) continue;
    if (x[i] === y[i]) continue;
    const px = parameter(x[i]!);
    const py = parameter(y[i]!);
    if (px && py) {
      if (framework === "nextjs" && px.name !== py.name) return true;
      if (px.kind !== "single" && py.kind !== "single") return true;
      if (px.kind === py.kind) continue;
    }
    return false; // Static vs dynamic siblings have legitimate router precedence.
  }
  return false;
}

export interface PageSourceIdentity {
  key: string;
  filePath: string;
  routePath: string;
}
export type PageSourceTarget<T extends PageSourceIdentity> =
  | { status: "existing"; page: T }
  | { status: "new"; entry: RecognizedPageInfo }
  | { status: "not-a-page" }
  | { status: "invalid"; code: string; message: string }
  | { status: "unsupported"; code: string; message: string }
  | { status: "conflict"; code: string; message: string; conflictingPages: T[] };

/**
 * Select existing pages by exact source identity ONLY. A shared title or URL
 * never authorizes writing another page. This function is intentionally pure.
 */
export function resolvePageSourceTarget<T extends PageSourceIdentity>(
  pages: readonly T[], filePath: string, framework: PageFramework,
): PageSourceTarget<T> {
  const clean = normalizePageSourcePath(filePath);
  if (!clean) return { status: "invalid", code: "INVALID_PAGE_SOURCE_PATH", message: "Expected a safe project-relative source path." };
  const exact = pages.filter((p) => normalizePageSourcePath(p.filePath) === clean);
  if (exact.length > 1) return { status: "conflict", code: "DUPLICATE_PAGE_SOURCE", message: "Multiple pages claim the same source file; resolve registry ownership first.", conflictingPages: exact };
  if (exact.length === 1) return { status: "existing", page: exact[0]! };
  const classified = classifyPageEntry(clean, framework);
  if (classified.status !== "recognized") return classified;
  const entry = classified.page;
  const conflicts = pages.filter((p) => normalizePageSourcePath(p.filePath)?.toLowerCase() === clean.toLowerCase() || routesConflict(p.routePath, entry.routePath, framework));
  if (conflicts.length) return { status: "conflict", code: "PAGE_ROUTE_CONFLICT", message: "Another source file owns this route or a conflicting route pattern. No page was overwritten.", conflictingPages: conflicts };
  return { status: "new", entry };
}
