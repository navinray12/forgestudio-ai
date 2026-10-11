/**
 * Page registry: the single mapping between a website's visual pages, their
 * routes and the source files generated for them. It is derived from the
 * canonical visual document by the same compiler the generators use, so the
 * Visual Editor, the Code Workspace and the export can never disagree about
 * which file belongs to which page.
 */
import crypto from "node:crypto";
import { AppError } from "../../utils/app-error.js";
import { visualDocumentToIR, pageComponentName } from "./unifiedCompiler.service.js";

export type ProjectFramework = "react" | "nextjs";

/** Key of the only page of a document that has no `pages` array */
export const SINGLE_PAGE_KEY = "__single__";

export interface RegisteredPage {
  /** Editor page id, or SINGLE_PAGE_KEY for a single-page document */
  key: string;
  pageId: string | null;
  name: string;
  title: string;
  routePath: string;
  filePath: string;
  componentName: string;
  isHome: boolean;
}

export interface SyncBaseline {
  /** Fingerprint of the whole visual document the source was generated from */
  sourceHash: string;
  syncedAt: string;
  framework: ProjectFramework;
  /** Per-page fingerprint and file, used to detect stale edits and page moves */
  pages: Record<string, { filePath: string; hash: string }>;
  /** Fingerprint of the header / footer shared by every page */
  sharedHash: string;
}

export function toProjectFramework(framework: unknown): ProjectFramework {
  return framework === "nextjs" ? "nextjs" : "react";
}

export function hashValue(value: unknown): string {
  const raw = typeof value === "string" ? value : JSON.stringify(value ?? {});
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/** Parse a website's stored editor document, which may be an object or a JSON string */
export function parseEditorDocument(raw: unknown): any {
  if (typeof raw !== "string") return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    throw new AppError("The website's saved editor data is not valid JSON", 422, "INVALID_EDITOR_DATA");
  }
}

export function documentPages(editorData: any): any[] {
  return Array.isArray(editorData?.pages)
    ? editorData.pages.filter((p: any) => p && typeof p === "object" && !Array.isArray(p))
    : [];
}

export function buildPageRegistry(editorData: any, framework: ProjectFramework): RegisteredPage[] {
  const ir = visualDocumentToIR(editorData, { id: "registry", name: "registry", slug: "registry", framework });
  const pages = documentPages(editorData);
  return ir.components
    .filter((c) => c.isPage)
    .map((c) => {
      const page = c.pageId ? pages.find((p) => String(p.id) === c.pageId) : undefined;
      const route = ir.routes.find((r) => r.componentId === c.id);
      return {
        key: c.pageId || SINGLE_PAGE_KEY,
        pageId: c.pageId || null,
        name: String(page?.name || page?.title || route?.title || c.name),
        title: String(route?.title || c.name),
        routePath: c.routePath || "/",
        filePath: c.filePath,
        componentName: pageComponentName(c.name),
        isHome: (c.routePath || "/") === "/",
      };
    });
}

function sharedParts(editorData: any) {
  return { header: editorData?.siteParts?.header ?? null, footer: editorData?.siteParts?.footer ?? null };
}

export function hashPage(editorData: any, key: string): string {
  if (key === SINGLE_PAGE_KEY) {
    return hashValue({ elements: editorData?.elements ?? [], pageSettings: editorData?.pageSettings ?? null });
  }
  return hashValue(documentPages(editorData).find((p) => String(p.id) === key) ?? null);
}

export function hashSharedParts(editorData: any): string {
  return hashValue(sharedParts(editorData));
}

/** Record of what the persisted source was generated from */
export function buildSyncBaseline(editorData: any, framework: ProjectFramework): SyncBaseline {
  const pages: SyncBaseline["pages"] = {};
  for (const page of buildPageRegistry(editorData, framework)) {
    pages[page.key] = { filePath: page.filePath, hash: hashPage(editorData, page.key) };
  }
  return {
    sourceHash: hashValue(editorData),
    syncedAt: new Date().toISOString(),
    framework,
    pages,
    sharedHash: hashSharedParts(editorData),
  };
}

export interface RecognizedPageInfo {
  isPage: true;
  pageName: string;
  pageTitle: string;
  routePath: string;
  componentName: string;
  targetFilePath: string;
}

export type PageRecognitionResult = RecognizedPageInfo | { isPage: false };

/**
 * Identify whether a given workspace file path represents a recognized page entry point.
 * Distinguishes page entry points from arbitrary helper components (e.g. Button.tsx).
 */
export function isRecognizedPageEntry(
  filePath: string,
  framework: ProjectFramework = "react"
): PageRecognitionResult {
  const cleanPath = filePath.replace(/^[/\\]+/, "").replace(/\\/g, "/");

  // Must be a JSX/TSX component file
  if (!/\.(tsx|jsx)$/.test(cleanPath)) {
    return { isPage: false };
  }

  // Non-page component directories (helpers, ui atoms, utils, etc.)
  const nonPageDirs = [
    "src/components/",
    "components/",
    "src/utils/",
    "utils/",
    "src/hooks/",
    "hooks/",
    "src/services/",
    "services/",
    "src/styles/",
    "styles/",
    "src/types/",
    "types/",
    "src/lib/",
    "lib/",
    "src/api/",
    "api/",
    "public/",
    "assets/",
    "src/assets/",
  ];
  if (nonPageDirs.some((dir) => cleanPath.startsWith(dir) || cleanPath.includes(`/${dir}`))) {
    return { isPage: false };
  }

  // Common infrastructure entry files
  const excludedFiles = [
    "src/main.tsx",
    "src/main.jsx",
    "src/App.tsx",
    "src/App.jsx",
    "src/index.tsx",
    "src/index.jsx",
    "src/routes/AppRoutes.tsx",
    "src/routes/AppRoutes.jsx",
    "main.tsx",
    "main.jsx",
    "App.tsx",
    "App.jsx",
    "index.tsx",
    "index.jsx",
  ];
  if (excludedFiles.includes(cleanPath)) {
    return { isPage: false };
  }

  // Next.js App Router: app/**/page.(tsx|jsx)
  const appRouterMatch = framework === "nextjs" ? cleanPath.match(/^(?:src\/)?app\/(.*?)\/?page\.(tsx|jsx)$/) : null;
  if (appRouterMatch) {
    const rawSegment = appRouterMatch[1];
    if (!rawSegment || rawSegment === "") {
      return {
        isPage: true,
        pageName: "Home",
        pageTitle: "Home",
        routePath: "/",
        componentName: "HomePage",
        targetFilePath: cleanPath,
      };
    }
    const cleanSegment = rawSegment.replace(/^[/\\]+|[/\\]+$/g, "");
    const segments = cleanSegment.split("/");
    if (segments.some((segment) => segment.startsWith("_") || segment.startsWith("@") || /^\(\.{1,3}\)/.test(segment))) return { isPage: false };
    const routeSegments = segments.filter((segment) => !/^\([^/]+\)$/.test(segment));
    if (routeSegments.some((segment) => segment === "." || segment === "..")) return { isPage: false };
    const routePath = `/${routeSegments.join("/")}`;
    const lastSegment = routeSegments[routeSegments.length - 1] || "home";
    if (routeSegments.length === 0) return { isPage: true, pageName: "Home", pageTitle: "Home", routePath: "/", componentName: "HomePage", targetFilePath: cleanPath };
    const title = lastSegment
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      isPage: true,
      pageName: title,
      pageTitle: title,
      routePath,
      componentName: `${title.replace(/\s+/g, "")}Page`,
      targetFilePath: cleanPath,
    };
  }

  // Next.js Pages router or pages dir: pages/*.(tsx|jsx)
  const pagesRouterMatch = framework === "nextjs" ? cleanPath.match(/^(?:src\/)?pages\/(.+)\.(tsx|jsx)$/) : null;
  if (pagesRouterMatch) {
    const rawName = pagesRouterMatch[1];
    if (rawName.split("/").some((segment) => segment.startsWith("_") || segment === "." || segment === "..")) return { isPage: false };
    if (rawName.startsWith("api/") || ["_app", "_document", "_error", "404", "500"].includes(rawName)) return { isPage: false };
    if (rawName === "index") {
      return {
        isPage: true,
        pageName: "Home",
        pageTitle: "Home",
        routePath: "/",
        componentName: "HomePage",
        targetFilePath: cleanPath,
      };
    }
    const title = rawName.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      isPage: true,
      pageName: title,
      pageTitle: title,
      routePath: `/${rawName.replace(/\/index$/, "").toLowerCase()}`,
      componentName: `${title.replace(/\s+/g, "")}Page`,
      targetFilePath: cleanPath,
    };
  }

  // React/Vite Pages: src/pages/*.(tsx|jsx)
  const srcPagesMatch = framework === "react" ? cleanPath.match(/^src\/pages\/(.+)\.(tsx|jsx)$/) : null;
  if (srcPagesMatch) {
    const rawName = srcPagesMatch[1];
    if (rawName.split("/").some((part) => part.startsWith("_") || part === "." || part === "..")) return { isPage: false };
    let baseName = rawName.split("/").pop()!;
    if (baseName.endsWith("Page") && baseName.length > 4) {
      baseName = baseName.slice(0, -4);
    }
    if (baseName.toLowerCase() === "home" || baseName.toLowerCase() === "index") {
      return {
        isPage: true,
        pageName: "Home",
        pageTitle: "Home",
        routePath: "/",
        componentName: "HomePage",
        targetFilePath: cleanPath,
      };
    }
    const title = baseName
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[-_]/g, " ")
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const slug = rawName.replace(/Page$/, "").replace(/([a-z])([A-Z])/g, "$1-$2").replace(/_/g, "-").toLowerCase();
    const compName = `${title.replace(/\s+/g, "")}Page`;
    return {
      isPage: true,
      pageName: title,
      pageTitle: title,
      routePath: `/${slug}`,
      componentName: compName,
      targetFilePath: cleanPath,
    };
  }

  // Root-level JSX is not automatically a route. Explicitly register it first.
  return { isPage: false };
}
