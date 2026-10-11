/**
 * Page registry: the single mapping between a website's visual pages, their
 * routes and the source files generated for them. It is derived from the
 * canonical visual document by the same compiler the generators use, so the
 * Visual Editor, Code Workspace and export share this mapping. Callers must
 * still validate source ownership and route collisions before committing changes.
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

// Keep the existing import surface; pure recognition/preflight is independently testable.
export {
  classifyPageEntry,
  isRecognizedPageEntry,
  normalizePageSourcePath,
  pageRouteIdentity,
  resolvePageSourceTarget,
} from "./pageRecognition.js";
export type { RecognizedPageInfo, PageRecognitionResult } from "./pageRecognition.js";
