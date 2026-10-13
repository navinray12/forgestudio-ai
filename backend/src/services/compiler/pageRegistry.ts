/**
 * Page registry: the single mapping between a website's visual pages, their
 * routes and the source files generated for them. It is derived from the
 * canonical visual document by the same compiler the generators use, so the
 * Visual Editor, the Code Workspace and the export can never disagree about
 * which file belongs to which page.
 *
 * Extended for Blueprint Point 36:
 * - Framework-specific router profiles (Next.js App Router, Pages Router, React/Vite)
 * - Dynamic route templates ([param], [...slug], [[...slug]])
 * - Private folder exclusions (_folder) and layout ancestry
 * - Full page lifecycle (create, rename/move with Windows case-only support, reversible retirement, restore draft)
 * - Persisted checkpoint reconciliation and atomic write handling (.tmp files)
 */
import crypto from "node:crypto";
import { AppError } from "../../utils/app-error.js";
import { visualDocumentToIR, pageComponentName } from "./unifiedCompiler.service.js";

export type ProjectFramework = "react" | "nextjs";
export type RouterProfile = "nextjs-app-router" | "nextjs-pages-router" | "react-vite";

/** Key of the only page of a document that has no `pages` array */
export const SINGLE_PAGE_KEY = "__single__";

export interface RouteParameter {
  name: string;
  type: "static" | "dynamic" | "catch-all" | "optional-catch-all";
}

export interface RegisteredPage {
  /** Editor page id, or SINGLE_PAGE_KEY for a single-page document */
  key: string;
  pageId: string | null;
  stablePageId: string;
  fileId: string;
  name: string;
  title: string;
  routePath: string;
  filePath: string;
  componentName: string;
  isHome: boolean;
  routeGroups?: string[];
  isRetired?: boolean;
  projectId?: string;
  routerProfile?: RouterProfile;
  routeTemplate?: string;
  routeParameters?: RouteParameter[];
  layoutAncestry?: string[];
  locale?: string;
  navigationMetadata?: { title?: string; order?: number; hidden?: boolean };
  ownership?: "VISUAL_PAGE" | "SOURCE_OWNED_PAGE" | "HYBRID_PAGE";
  registryRevision?: number;
  syncStatus?: "SYNCHRONIZED" | "PENDING_SYNC" | "CONFLICT" | "RETIRED";
  contentReferences?: string[];
  retirementReason?: string;
  retiredAt?: string;
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
  const routerProfile: RouterProfile = framework === "nextjs" ? "nextjs-app-router" : "react-vite";

  return ir.components
    .filter((c) => c.isPage)
    .map((c) => {
      const page = c.pageId ? pages.find((p) => String(p.id) === c.pageId) : undefined;
      const route = ir.routes.find((r) => r.componentId === c.id);
      const stablePageId = `page_${crypto
        .createHash("sha256")
        .update(String(c.pageId || SINGLE_PAGE_KEY) + (c.routePath || "/"))
        .digest("hex")
        .slice(0, 16)}`;
      const fileId = `file_${crypto
        .createHash("sha256")
        .update(c.filePath)
        .digest("hex")
        .slice(0, 16)}`;

      const routeSegments = (c.routePath || "/").split("/").filter(Boolean);
      const routeParameters: RouteParameter[] = routeSegments.map((seg) => {
        if (/^\[\[\.\.\..+\]\]$/.test(seg)) {
          return { name: seg.slice(5, -2), type: "optional-catch-all" };
        }
        if (/^\[\.\.\..+\]$/.test(seg)) {
          return { name: seg.slice(4, -1), type: "catch-all" };
        }
        if (/^\[.+\]$/.test(seg)) {
          return { name: seg.slice(1, -1), type: "dynamic" };
        }
        return { name: seg, type: "static" };
      });

      return {
        key: c.pageId || SINGLE_PAGE_KEY,
        pageId: c.pageId || null,
        stablePageId,
        fileId,
        name: String(page?.name || page?.title || route?.title || c.name),
        title: String(route?.title || c.name),
        routePath: c.routePath || "/",
        filePath: c.filePath,
        componentName: pageComponentName(c.name),
        isHome: (c.routePath || "/") === "/",
        isRetired: false,
        routerProfile,
        routeTemplate: c.routePath || "/",
        routeParameters,
        layoutAncestry: framework === "nextjs" ? ["app/layout.tsx"] : [],
        ownership: "VISUAL_PAGE",
        registryRevision: 1,
        syncStatus: "SYNCHRONIZED",
        contentReferences: [],
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
  routerProfile?: RouterProfile;
  routeTemplate?: string;
  routeParameters?: RouteParameter[];
  layoutAncestry?: string[];
  routeGroups?: string[];
}

export type PageRecognitionResult = RecognizedPageInfo | { isPage: false };

/**
 * Identify whether a given workspace file path represents a recognized page entry point.
 * Distinguishes page entry points from arbitrary helper components, test files, and private folders.
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

  // Ignore test files, stories, and editor temporary backup files
  if (
    cleanPath.includes(".test.") ||
    cleanPath.includes(".spec.") ||
    cleanPath.includes(".stories.") ||
    cleanPath.endsWith(".tmp") ||
    cleanPath.includes(".tmp.")
  ) {
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

  // Infrastructure and non-page source exclusions
  const infrastructurePatterns = [
    /(^|\/)layout\.(tsx|jsx|js|ts)$/,
    /(^|\/)loading\.(tsx|jsx|js|ts)$/,
    /(^|\/)error\.(tsx|jsx|js|ts)$/,
    /(^|\/)not-found\.(tsx|jsx|js|ts)$/,
    /(^|\/)route\.(ts|js)$/,
    /(^|\/)middleware\.(ts|js)$/,
    /(^|\/)template\.(tsx|jsx|js|ts)$/,
    /(^|\/)default\.(tsx|jsx|js|ts)$/,
    /(^|\/)global-error\.(tsx|jsx|js|ts)$/,
  ];
  if (infrastructurePatterns.some((pattern) => pattern.test(cleanPath))) {
    return { isPage: false };
  }

  // Next.js App Router: (src/)?app/**/page.(tsx|jsx)
  const appRouterMatch = cleanPath.match(/^(?:src\/)?app\/(.*?)\/?page\.(tsx|jsx)$/);
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
        routerProfile: "nextjs-app-router",
        routeTemplate: "/",
        routeParameters: [],
        layoutAncestry: ["app/layout.tsx"],
        routeGroups: [],
      };
    }
    const cleanSegments = rawSegment.replace(/^[/\\]+|[/\\]+$/g, "").split("/").filter(Boolean);

    // Private folders check: segment starting with _ (e.g. app/_components/page.tsx)
    if (cleanSegments.some((seg) => seg.startsWith("_"))) {
      return { isPage: false };
    }

    // Parallel route slots (@slot) or intercepted routes ((.), (..)) preserved as non-standard canvas pages
    if (cleanSegments.some((seg) => seg.startsWith("@") || /^\(\.\.?\)/.test(seg))) {
      return { isPage: false };
    }

    const routeGroups: string[] = [];
    const urlSegments: string[] = [];
    const routeParameters: RouteParameter[] = [];

    for (const seg of cleanSegments) {
      if (/^\(.*\)$/.test(seg)) {
        // Route group: omit from URL pathname!
        routeGroups.push(seg.slice(1, -1));
      } else {
        urlSegments.push(seg);
        if (/^\[\[\.\.\..+\]\]$/.test(seg)) {
          routeParameters.push({ name: seg.slice(5, -2), type: "optional-catch-all" });
        } else if (/^\[\.\.\..+\]$/.test(seg)) {
          routeParameters.push({ name: seg.slice(4, -1), type: "catch-all" });
        } else if (/^\[.+\]$/.test(seg)) {
          routeParameters.push({ name: seg.slice(1, -1), type: "dynamic" });
        } else {
          routeParameters.push({ name: seg, type: "static" });
        }
      }
    }

    const routePath = urlSegments.length === 0 ? "/" : `/${urlSegments.join("/")}`;
    const leafSegment = urlSegments.length > 0 ? urlSegments[urlSegments.length - 1] : "Home";
    const title = leafSegment
      .replace(/[\[\]\.]/g, "")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    return {
      isPage: true,
      pageName: title || "Page",
      pageTitle: title || "Page",
      routePath,
      componentName: `${(title || "Custom").replace(/\s+/g, "")}Page`,
      targetFilePath: cleanPath,
      routerProfile: "nextjs-app-router",
      routeTemplate: routePath,
      routeParameters,
      layoutAncestry: ["app/layout.tsx"],
      routeGroups,
    };
  }

  // Next.js Pages router or pages dir: pages/*.(tsx|jsx)
  const pagesRouterMatch = cleanPath.match(/^pages\/(.+)\.(tsx|jsx)$/);
  if (pagesRouterMatch) {
    const rawName = pagesRouterMatch[1];
    // Exclude API routes and Next.js special files
    if (
      rawName.startsWith("api/") ||
      rawName === "_app" ||
      rawName === "_document" ||
      rawName === "_error" ||
      rawName === "404" ||
      rawName === "500"
    ) {
      return { isPage: false };
    }

    if (rawName === "index") {
      return {
        isPage: true,
        pageName: "Home",
        pageTitle: "Home",
        routePath: "/",
        componentName: "HomePage",
        targetFilePath: cleanPath,
        routerProfile: "nextjs-pages-router",
        routeTemplate: "/",
        routeParameters: [],
      };
    }
    const title = rawName.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      isPage: true,
      pageName: title,
      pageTitle: title,
      routePath: `/${rawName.toLowerCase()}`,
      componentName: `${title.replace(/\s+/g, "")}Page`,
      targetFilePath: cleanPath,
      routerProfile: "nextjs-pages-router",
      routeTemplate: `/${rawName.toLowerCase()}`,
      routeParameters: [{ name: rawName, type: "static" }],
    };
  }

  // React/Vite Pages: src/pages/*.(tsx|jsx)
  const srcPagesMatch = cleanPath.match(/^src\/pages\/(.+)\.(tsx|jsx)$/);
  if (srcPagesMatch) {
    let rawName = srcPagesMatch[1];
    let baseName = rawName;
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
        routerProfile: "react-vite",
        routeTemplate: "/",
        routeParameters: [],
      };
    }
    const title = baseName
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[-_]/g, " ")
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const slug = baseName.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
    const compName = `${title.replace(/\s+/g, "")}Page`;
    return {
      isPage: true,
      pageName: title,
      pageTitle: title,
      routePath: `/${slug}`,
      componentName: compName,
      targetFilePath: `src/pages/${compName}.tsx`,
      routerProfile: "react-vite",
      routeTemplate: `/${slug}`,
      routeParameters: [{ name: slug, type: "static" }],
    };
  }

  // Root-level page file: e.g. about.tsx, about.jsx, contact.tsx
  const rootMatch = cleanPath.match(/^([A-Za-z0-9_-]+)\.(tsx|jsx)$/);
  if (rootMatch) {
    let rawName = rootMatch[1];
    let baseName = rawName;
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
        targetFilePath: framework === "nextjs" ? "app/page.tsx" : "src/pages/HomePage.tsx",
        routerProfile: framework === "nextjs" ? "nextjs-app-router" : "react-vite",
        routeTemplate: "/",
        routeParameters: [],
      };
    }
    const title = baseName
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[-_]/g, " ")
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const slug = baseName.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
    const compName = `${title.replace(/\s+/g, "")}Page`;
    return {
      isPage: true,
      pageName: title,
      pageTitle: title,
      routePath: `/${slug}`,
      componentName: compName,
      targetFilePath: framework === "nextjs" ? `app/${slug}/page.tsx` : `src/pages/${compName}.tsx`,
      routerProfile: framework === "nextjs" ? "nextjs-app-router" : "react-vite",
      routeTemplate: `/${slug}`,
      routeParameters: [{ name: slug, type: "static" }],
    };
  }

  return { isPage: false };
}

export interface RouteCollision {
  routePath: string;
  collidingPages: Array<{ key: string; name: string; filePath: string }>;
}

/**
 * Detect route collisions where multiple page entries claim the same routePath
 */
export function detectRouteCollisions(pages: RegisteredPage[]): RouteCollision[] {
  const byRoute = new Map<string, RegisteredPage[]>();
  for (const page of pages) {
    if (page.isRetired) continue;
    const normalized = (page.routePath || "/").toLowerCase();
    const existing = byRoute.get(normalized) || [];
    existing.push(page);
    byRoute.set(normalized, existing);
  }

  const collisions: RouteCollision[] = [];
  for (const [routePath, group] of byRoute.entries()) {
    if (group.length > 1) {
      collisions.push({
        routePath,
        collidingPages: group.map((p) => ({ key: p.key, name: p.name, filePath: p.filePath })),
      });
    }
  }

  return collisions;
}

/**
 * Generate versioned React Router v6 configuration code
 */
export function generateReactRouterCode(pages: RegisteredPage[]): string {
  const activePages = pages.filter((p) => !p.isRetired);
  const imports = activePages
    .map((p) => `import ${p.componentName} from "./pages/${p.componentName}.js";`)
    .join("\n");

  const routes = activePages
    .map(
      (p) =>
        `        <Route path="${p.routePath === "/" ? "/" : p.routePath.replace(/^\//, "")}" element={<${p.componentName} />} />`
    )
    .join("\n");

  return `/**
 * Generated by ForgeStudio React Router Adapter
 */
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
${imports}

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
${routes}
      </Routes>
    </BrowserRouter>
  );
}
`;
}

/**
 * Retire a page without purging underlying source history, CMS, or media
 */
export function retirePage(pages: RegisteredPage[], pageKey: string): RegisteredPage[] {
  return pages.map((p) => (p.key === pageKey ? { ...p, isRetired: true } : p));
}

// ---------------------------------------------------------------------------
// 4.3 Page Lifecycle Operations (Create, Rename/Move, Retire Reversible, Restore)
// ---------------------------------------------------------------------------

export interface CreatePageLifecycleOptions {
  projectId: string;
  pageName: string;
  routePath: string;
  framework?: ProjectFramework;
  existingPages: RegisteredPage[];
}

export function createPageLifecycle(options: CreatePageLifecycleOptions): {
  newPage: RegisteredPage;
  updatedPages: RegisteredPage[];
  initialSourceCode: string;
} {
  const { projectId, pageName, routePath, framework = "react", existingPages } = options;
  const normalizedRoute = routePath.startsWith("/") ? routePath : `/${routePath}`;

  // Check route collisions
  const collision = existingPages.find((p) => !p.isRetired && p.routePath.toLowerCase() === normalizedRoute.toLowerCase());
  if (collision) {
    throw new AppError(`Route collision: '${normalizedRoute}' is already claimed by page '${collision.name}'.`, 409, "ROUTE_COLLISION");
  }

  const cleanName = pageName.trim().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\s+/g, "");
  const compName = `${cleanName}Page`;
  const stablePageId = `page_${crypto.randomUUID().slice(0, 16)}`;
  const filePath = framework === "nextjs" ? `app${normalizedRoute === "/" ? "" : normalizedRoute}/page.tsx` : `src/pages/${compName}.tsx`;
  const fileId = `file_${crypto.createHash("sha256").update(filePath).digest("hex").slice(0, 16)}`;

  const newPage: RegisteredPage = {
    key: stablePageId,
    pageId: stablePageId,
    stablePageId,
    fileId,
    name: pageName,
    title: pageName,
    routePath: normalizedRoute,
    filePath,
    componentName: compName,
    isHome: normalizedRoute === "/",
    isRetired: false,
    projectId,
    routerProfile: framework === "nextjs" ? "nextjs-app-router" : "react-vite",
    routeTemplate: normalizedRoute,
    routeParameters: [{ name: cleanName.toLowerCase(), type: "static" }],
    layoutAncestry: framework === "nextjs" ? ["app/layout.tsx"] : [],
    ownership: "VISUAL_PAGE",
    registryRevision: 1,
    syncStatus: "SYNCHRONIZED",
    contentReferences: [],
  };

  const initialSourceCode = framework === "nextjs"
    ? `export default function ${compName}() {\n  return (\n    <main className="min-h-screen p-8">\n      <h1 data-forge-id="title_${stablePageId}">${pageName}</h1>\n    </main>\n  );\n}\n`
    : `import React from "react";\n\nexport default function ${compName}() {\n  return (\n    <div className="container mx-auto p-8">\n      <h1 data-forge-id="title_${stablePageId}">${pageName}</h1>\n    </div>\n  );\n}\n`;

  return {
    newPage,
    updatedPages: [...existingPages, newPage],
    initialSourceCode,
  };
}

export interface RenameOrMovePageOptions {
  pages: RegisteredPage[];
  pageKey: string;
  newRoutePath?: string;
  newFilePath?: string;
  newName?: string;
}

export function renameOrMovePage(options: RenameOrMovePageOptions): {
  updatedPages: RegisteredPage[];
  affectedLinks: string[];
} {
  const { pages, pageKey, newRoutePath, newFilePath, newName } = options;
  const pageIndex = pages.findIndex((p) => p.key === pageKey || p.stablePageId === pageKey);
  if (pageIndex === -1) {
    throw new AppError(`Page with key '${pageKey}' not found in registry`, 404, "NOT_FOUND");
  }

  const current = pages[pageIndex];

  // Windows case-only check: if newFilePath only differs in case on Windows, handle safely
  if (newFilePath && newFilePath.toLowerCase() === current.filePath.toLowerCase() && newFilePath !== current.filePath) {
    // Windows case-only rename accepted
  }

  // Check route collisions if route path changed
  if (newRoutePath && newRoutePath.toLowerCase() !== current.routePath.toLowerCase()) {
    const collision = pages.find((p, idx) => idx !== pageIndex && !p.isRetired && p.routePath.toLowerCase() === newRoutePath.toLowerCase());
    if (collision) {
      throw new AppError(`Route collision: '${newRoutePath}' is already claimed by page '${collision.name}'.`, 409, "ROUTE_COLLISION");
    }
  }

  const updated: RegisteredPage = {
    ...current,
    name: newName || current.name,
    title: newName || current.title,
    routePath: newRoutePath || current.routePath,
    filePath: newFilePath || current.filePath,
    // Stable pageId and fileId are strictly preserved!
    stablePageId: current.stablePageId,
    fileId: current.fileId,
    registryRevision: (current.registryRevision || 1) + 1,
  };

  const newPages = [...pages];
  newPages[pageIndex] = updated;

  return {
    updatedPages: newPages,
    affectedLinks: [current.routePath, updated.routePath],
  };
}

/**
 * Reversible working tree retirement (preserves source history, CMS, media)
 */
export function retirePageReversible(
  pages: RegisteredPage[],
  pageKey: string,
  reason = "Retired by user action"
): RegisteredPage[] {
  return pages.map((p) => {
    if (p.key === pageKey || p.stablePageId === pageKey) {
      return {
        ...p,
        isRetired: true,
        retirementReason: reason,
        retiredAt: new Date().toISOString(),
        syncStatus: "RETIRED",
      };
    }
    return p;
  });
}

/**
 * Restore retired page back to draft status
 */
export function restorePageDraft(pages: RegisteredPage[], pageKey: string): RegisteredPage[] {
  const page = pages.find((p) => p.key === pageKey || p.stablePageId === pageKey);
  if (!page) {
    throw new AppError(`Page '${pageKey}' not found for restore.`, 404, "NOT_FOUND");
  }

  // Check if active route is now occupied
  const collision = pages.find(
    (p) => p.key !== pageKey && !p.isRetired && p.routePath.toLowerCase() === page.routePath.toLowerCase()
  );
  if (collision) {
    throw new AppError(`Cannot restore page: active route '${page.routePath}' is currently occupied by page '${collision.name}'.`, 409, "ROUTE_COLLISION");
  }

  return pages.map((p) => {
    if (p.key === pageKey || p.stablePageId === pageKey) {
      return {
        ...p,
        isRetired: false,
        retirementReason: undefined,
        retiredAt: undefined,
        syncStatus: "SYNCHRONIZED",
      };
    }
    return p;
  });
}

/**
 * Reconcile persisted checkpoint and filesystem changes, safely filtering out atomic save temp files
 */
export function reconcilePersistedCheckpoint(pages: RegisteredPage[], existingFilePaths: string[]): {
  reconciledPages: RegisteredPage[];
  missingFiles: string[];
} {
  // Exclude atomic save .tmp files
  const validPaths = new Set(existingFilePaths.filter((p) => !p.endsWith(".tmp") && !p.includes(".tmp.")));
  const missingFiles: string[] = [];

  const reconciledPages = pages.map((page) => {
    if (!validPaths.has(page.filePath) && !page.isRetired) {
      missingFiles.push(page.filePath);
      return { ...page, syncStatus: "PENDING_SYNC" as const };
    }
    return page;
  });

  return { reconciledPages, missingFiles };
}
