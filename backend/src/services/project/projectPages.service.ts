/**
 * Page workflow for the Code Workspace.
 *
 * A page is an entry of the website's visual document, not a file: creating,
 * renaming or deleting one changes the document, and the page's source file,
 * route registration and Visual Editor page list all follow from it. A plain
 * component file therefore never becomes a page by accident.
 */
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import {
  buildPageRegistry,
  documentPages,
  parseEditorDocument,
  toProjectFramework,
  ProjectFramework,
  RegisteredPage,
  SINGLE_PAGE_KEY,
} from "../compiler/pageRegistry.js";
import { normalizeRoutePath } from "../compiler/unifiedCompiler.service.js";
import { importPageElements, SyncDiagnostic } from "../compiler/pageSourceSync.js";
import { saveDocumentFromCode } from "../websites/documentGateway.js";
import { ForgeProjectEntity, VisualSyncResult, syncProjectFromWebsite } from "./forgeProject.service.js";
import { moveOrRenameFile, readFile, sanitizeAndNormalizePath } from "./forgeFilesystem.service.js";

const db = prisma as any;

export interface ProjectPageInfo extends RegisteredPage {
  fileExists: boolean;
  /** "generated": follows the visual document; "code": hand-written code held back from regeneration */
  ownership: "generated" | "code" | "missing";
  sync: { status: string; message?: string; diagnostics?: SyncDiagnostic[]; updatedAt?: string } | null;
}

export interface PageMutationResult {
  page: RegisteredPage | null;
  pages: ProjectPageInfo[];
  visualSync: VisualSyncResult;
  documentVersion: number;
  /** A hand-written file that was deliberately left in place */
  preservedFile?: string;
}

export class PageImportError extends AppError {
  diagnostics: SyncDiagnostic[];
  constructor(message: string, diagnostics: SyncDiagnostic[]) {
    super(message, 422, "PAGE_SOURCE_UNSUPPORTED");
    this.diagnostics = diagnostics;
  }
}

interface PageContext {
  site: any;
  editorData: any;
  framework: ProjectFramework;
}

async function loadContext(project: ForgeProjectEntity): Promise<PageContext> {
  let websiteId = project.websiteId;
  if (!websiteId && project.metadata) {
    if (typeof project.metadata === "object") {
      websiteId = (project.metadata as any).websiteId;
    } else if (typeof project.metadata === "string") {
      try {
        const parsed = JSON.parse(project.metadata);
        websiteId = parsed?.websiteId;
      } catch {}
    }
  }
  let site = websiteId ? await db.website.findUnique({ where: { id: websiteId } }) : null;
  if (!site) {
    site = await db.website.findFirst({
      where: {
        OR: [
          { id: project.id },
          ...(project.name ? [{ name: project.name }] : [])
        ]
      }
    });
    if (site) {
      websiteId = site.id;
      try {
        await db.forgeProject.update({
          where: { id: project.id },
          data: { websiteId: site.id },
        });
      } catch {}
    }
  }

  if (!site) {
    throw new AppError("This project is not linked to a visual website, so it has no visual pages", 400, "NO_VISUAL_WEBSITE");
  }
  return { site, editorData: parseEditorDocument(site.editorData), framework: toProjectFramework(project.framework) };
}

function cloneDocument(editorData: any): any {
  return JSON.parse(JSON.stringify(editorData ?? {}));
}

/** A single-page document becomes a `pages` document the first time a second page is needed */
function ensurePagesArray(doc: any): void {
  if (documentPages(doc).length > 0) return;
  const title = String(doc.pageSettings?.title || doc.title || doc.name || "Home");
  doc.pages = [
    {
      id: "home",
      name: title,
      slug: "/",
      elements: Array.isArray(doc.elements) ? doc.elements : [],
      pageSettings: { ...(doc.pageSettings || {}), title, path: "/" },
      isHome: true,
    },
  ];
  doc.homePageId = "home";
}

function validatePageName(raw: unknown): string {
  const name = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (!name) throw new AppError("A page name is required", 400, "VALIDATION_ERROR");
  if (name.length > 80) throw new AppError("A page name may be at most 80 characters", 400, "VALIDATION_ERROR");
  return name;
}

function validateRoute(raw: string): string {
  const route = normalizeRoutePath(raw);
  if (route === "/") throw new AppError("The route '/' belongs to the home page", 409, "ROUTE_CONFLICT");
  if (route === "/api" || route.startsWith("/api/")) {
    throw new AppError("Routes under /api are reserved for API handlers", 400, "ROUTE_RESERVED");
  }
  if (route.length > 200) throw new AppError("The route is too long", 400, "VALIDATION_ERROR");
  return route;
}

function assertUnique(registry: RegisteredPage[], name: string, route: string, exceptKey?: string) {
  for (const page of registry) {
    if (page.key === exceptKey) continue;
    if (page.routePath.toLowerCase() === route.toLowerCase()) {
      throw new AppError(`Route '${route}' is already used by page "${page.name}"`, 409, "ROUTE_CONFLICT");
    }
    if (page.name.trim().toLowerCase() === name.toLowerCase()) {
      throw new AppError(`A page named "${page.name}" already exists`, 409, "PAGE_NAME_CONFLICT");
    }
  }
}

export async function listProjectPages(project: ForgeProjectEntity): Promise<ProjectPageInfo[]> {
  const { editorData, framework } = await loadContext(project);
  const fresh = await db.forgeProject.findUnique({ where: { id: project.id } });
  const metadata = (fresh?.metadata && typeof fresh.metadata === "object" ? fresh.metadata : {}) as Record<string, any>;
  const files: any[] = await db.forgeProjectFile.findMany({ where: { projectId: project.id, deletedAt: null } });
  const byPath = new Map(files.map((f) => [f.path, f]));

  return buildPageRegistry(editorData, framework).map((page) => {
    const file = byPath.get(page.filePath);
    return {
      ...page,
      fileExists: !!file,
      ownership: !file ? "missing" : file.isGenerated ? "generated" : "code",
      sync: metadata.codeSync?.[page.filePath] ?? null,
    };
  });
}

async function persistAndRegenerate(
  project: ForgeProjectEntity,
  context: PageContext,
  user: { id: string },
  nextDocument: any,
  options: { snapshot?: boolean; beforeRegenerate?: () => Promise<void> } = {}
): Promise<{ visualSync: VisualSyncResult; documentVersion: number; editorData: any }> {
  const saved = await saveDocumentFromCode(
    project.websiteId as string,
    user.id,
    nextDocument,
    context.site.documentVersion ?? 1
  );
  if (options.beforeRegenerate) await options.beforeRegenerate();

  const site = await db.website.findUnique({ where: { id: project.websiteId } });
  const current = (await db.forgeProject.findUnique({ where: { id: project.id } })) || project;
  let visualSync: VisualSyncResult;
  try {
    visualSync = await syncProjectFromWebsite(current, site, user, { snapshot: options.snapshot ?? false });
  } catch (err: any) {
    visualSync = { synced: false, stale: true, error: err?.message || "Source generation failed" };
  }
  return { visualSync, documentVersion: saved.documentVersion, editorData: parseEditorDocument(site?.editorData) };
}

/**
 * Create a page: registers it in the visual document, then generates its
 * source file and route. With `sourcePath`, an existing hand-written component
 * file is converted into the page instead of starting from an empty canvas.
 */
export async function createProjectPage(
  project: ForgeProjectEntity,
  user: { id: string },
  input: { name?: unknown; route?: unknown; sourcePath?: unknown }
): Promise<PageMutationResult> {
  const context = await loadContext(project);
  const name = validatePageName(input.name);
  const route = validateRoute(typeof input.route === "string" && input.route.trim() ? input.route : name);

  const next = cloneDocument(context.editorData);
  ensurePagesArray(next);
  assertUnique(buildPageRegistry(next, context.framework), name, route);

  let elements: any[] = [];
  let sourcePath: string | null = null;
  if (typeof input.sourcePath === "string" && input.sourcePath.trim()) {
    sourcePath = sanitizeAndNormalizePath(input.sourcePath);
    if (buildPageRegistry(next, context.framework).some((p) => p.filePath === sourcePath)) {
      throw new AppError(`${sourcePath} already belongs to a registered page`, 409, "PAGE_ALREADY_REGISTERED");
    }
    const file = await readFile(project.id, sourcePath);
    const imported = importPageElements(file.content || "", sourcePath, next, context.framework);
    if (!imported.ok) {
      throw new PageImportError(
        `${sourcePath} cannot be registered as a visual page: ${
          imported.diagnostics.find((d) => d.severity === "error")?.message || "unsupported code"
        }`,
        imported.diagnostics
      );
    }
    elements = imported.elements;
  }

  const pageId = `page_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  next.pages.push({
    id: pageId,
    name,
    slug: route,
    elements,
    pageSettings: {
      title: name,
      path: route,
      description: "",
      backgroundColor: "#ffffff",
      isMaintenanceMode: false,
      siteLanguage: "en",
    },
    isHome: false,
  });

  const target = buildPageRegistry(next, context.framework).find((p) => p.pageId === pageId);
  if (!target) throw new AppError("The page could not be registered", 500, "PAGE_REGISTRATION_FAILED");
  if (target.routePath !== route) {
    throw new AppError(`Route '${route}' is not available`, 409, "ROUTE_CONFLICT");
  }

  const existingTarget = await db.forgeProjectFile.findFirst({
    where: { projectId: project.id, path: target.filePath, deletedAt: null },
  });
  if (existingTarget && target.filePath !== sourcePath) {
    throw new AppError(
      `${target.filePath} already exists. Rename or remove it, or register that file as the page.`,
      409,
      "PAGE_FILE_EXISTS"
    );
  }

  const outcome = await persistAndRegenerate(project, context, user, next, {
    // The imported file becomes the page's file; its content was verified to be
    // fully representable, so regenerating it loses nothing
    beforeRegenerate: sourcePath
      ? async () => {
          if (sourcePath !== target.filePath) await moveOrRenameFile(project.id, sourcePath as string, target.filePath, user.id);
          const file = await db.forgeProjectFile.findFirst({
            where: { projectId: project.id, path: target.filePath, deletedAt: null },
          });
          if (file) await db.forgeProjectFile.update({ where: { id: file.id }, data: { isGenerated: true, isProtected: false } });
        }
      : undefined,
  });

  return {
    page: buildPageRegistry(outcome.editorData, context.framework).find((p) => p.pageId === pageId) || target,
    pages: await listProjectPages(project),
    visualSync: outcome.visualSync,
    documentVersion: outcome.documentVersion,
  };
}

function resolvePage(doc: any, pageKey: string): any {
  if (pageKey === SINGLE_PAGE_KEY) {
    ensurePagesArray(doc);
    return doc.pages[0];
  }
  const page = documentPages(doc).find((p) => String(p.id) === pageKey);
  if (!page) throw new AppError("Page not found", 404, "PAGE_NOT_FOUND");
  return page;
}

/** Rename a page and/or change its route. The page's file follows, keeping its custom code. */
export async function updateProjectPage(
  project: ForgeProjectEntity,
  user: { id: string },
  pageKey: string,
  input: { name?: unknown; route?: unknown }
): Promise<PageMutationResult> {
  const context = await loadContext(project);
  const before = buildPageRegistry(context.editorData, context.framework).find((p) => p.key === pageKey);
  if (!before) throw new AppError("Page not found", 404, "PAGE_NOT_FOUND");

  const next = cloneDocument(context.editorData);
  const page = resolvePage(next, pageKey);
  const key = String(page.id);

  const name = input.name !== undefined ? validatePageName(input.name) : before.name;
  let route = before.routePath;
  if (typeof input.route === "string" && input.route.trim() && normalizeRoutePath(input.route) !== before.routePath) {
    if (before.isHome) throw new AppError("The home page always uses the route '/'", 400, "HOME_ROUTE_FIXED");
    route = validateRoute(input.route);
  }
  assertUnique(
    buildPageRegistry(next, context.framework).filter((p) => p.key !== key && p.key !== pageKey),
    name,
    route
  );

  if (name !== before.name) {
    const previousName = page.name;
    page.name = name;
    if (typeof page.title === "string") page.title = name;
    if (!page.pageSettings || page.pageSettings.title === undefined || page.pageSettings.title === previousName) {
      page.pageSettings = { ...(page.pageSettings || {}), title: name };
    }
  }
  if (route !== before.routePath) {
    page.slug = route;
    if (typeof page.path === "string") page.path = route;
    page.pageSettings = { ...(page.pageSettings || {}), path: route };
  }

  const after = buildPageRegistry(next, context.framework).find((p) => p.key === key);
  if (!after || after.routePath !== route) throw new AppError(`Route '${route}' is not available`, 409, "ROUTE_CONFLICT");

  const outcome = await persistAndRegenerate(project, context, user, next);
  return {
    page: buildPageRegistry(outcome.editorData, context.framework).find((p) => p.key === key) || after,
    pages: await listProjectPages(project),
    visualSync: outcome.visualSync,
    documentVersion: outcome.documentVersion,
  };
}

/** Delete a page: its route and generated file go with it. Hand-written code is never deleted. */
export async function deleteProjectPage(
  project: ForgeProjectEntity,
  user: { id: string },
  pageKey: string
): Promise<PageMutationResult> {
  const context = await loadContext(project);
  const registry = buildPageRegistry(context.editorData, context.framework);
  const target = registry.find((p) => p.key === pageKey);
  if (!target || !target.pageId) {
    if (target) throw new AppError("The only page of a website cannot be deleted", 400, "LAST_PAGE");
    throw new AppError("Page not found", 404, "PAGE_NOT_FOUND");
  }
  if (registry.length <= 1) throw new AppError("The only page of a website cannot be deleted", 400, "LAST_PAGE");
  if (target.isHome) throw new AppError("The home page cannot be deleted. Make another page the home page first.", 400, "HOME_PAGE");

  const next = cloneDocument(context.editorData);
  next.pages = next.pages.filter((p: any) => !(p && typeof p === "object" && String(p.id) === pageKey));

  // Page deletion removes a generated file: keep a checkpoint to recover from
  const outcome = await persistAndRegenerate(project, context, user, next, { snapshot: true });
  const leftover = await db.forgeProjectFile.findFirst({
    where: { projectId: project.id, path: target.filePath, deletedAt: null },
  });

  return {
    page: null,
    pages: await listProjectPages(project),
    visualSync: outcome.visualSync,
    documentVersion: outcome.documentVersion,
    ...(leftover ? { preservedFile: target.filePath } : {}),
  };
}

export const projectPagesService = {
  listProjectPages,
  createProjectPage,
  updateProjectPage,
  deleteProjectPage,
};
