/**
 * Project controller: Pages (visual page registry) & source preview.
 * Moved verbatim from project.controller.ts, which re-exports every handler for compatibility.
 */
import { Request, Response, NextFunction } from "express";
import { getForgeProjectById } from "../../services/project/forgeProject.service.js";
import { prisma } from "../../config/prisma.js";
import { buildPageRegistry, parseEditorDocument, toProjectFramework } from "../../services/compiler/pageRegistry.js";
import { listProjectPages, createProjectPage, updateProjectPage, deleteProjectPage, PageImportError } from "../../services/project/projectPages.service.js";
import { buildSourcePreview } from "../../services/preview/sourcePreview.service.js";
import { getAuthUser } from "./shared.js";

// Same alias as project.controller.ts: `prisma` is the shared client instance, so `db` is the same object.
const db = prisma as any;

// ---------------------------------------------------------------------------
// Pages (visual page registry) & source preview
// ---------------------------------------------------------------------------

function sendPageMutation(res: Response, status: number, result: any) {
  // The page change is saved either way; a failed source generation is not a success
  if (result.visualSync?.stale) {
    return res.status(422).json({
      success: false,
      message: `The page was saved, but its source could not be generated: ${result.visualSync.error || "generation failed"}`,
      ...result,
    });
  }
  return res.status(status).json({ success: true, ...result });
}

export async function listPagesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const project = await getForgeProjectById(String(req.params.id), user);
    const pages = await listProjectPages(project);
    res.status(200).json({ success: true, pages });
  } catch (err) {
    next(err);
  }
}

export async function createPageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const project = await getForgeProjectById(String(req.params.id), user);
    const result = await createProjectPage(project, user, req.body || {});
    sendPageMutation(res, 201, result);
  } catch (err) {
    if (err instanceof PageImportError) {
      return res.status(422).json({ success: false, message: err.message, code: err.code, diagnostics: err.diagnostics });
    }
    next(err);
  }
}

export async function updatePageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const project = await getForgeProjectById(String(req.params.id), user);
    const result = await updateProjectPage(project, user, String(req.params.pageId), req.body || {});
    sendPageMutation(res, 200, result);
  } catch (err) {
    next(err);
  }
}

export async function deletePageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const project = await getForgeProjectById(String(req.params.id), user);
    const result = await deleteProjectPage(project, user, String(req.params.pageId));
    sendPageMutation(res, 200, result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/projects/:id/preview/source?route=/about
 * A runnable document built from the project's persisted source files.
 */
export async function getSourcePreviewHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    const project = await getForgeProjectById(projectId, user);
    const preview = await buildSourcePreview(projectId, project.framework, req.query.route);

    let routes = preview.routes;
    if (project.websiteId) {
      const site = await db.website.findUnique({ where: { id: project.websiteId } });
      try {
        routes = buildPageRegistry(parseEditorDocument(site?.editorData), toProjectFramework(project.framework)).map(
          (page) => page.routePath
        );
      } catch {
        // An unreadable document does not prevent previewing the source that exists
      }
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ success: true, preview: { ...preview, routes } });
  } catch (err) {
    next(err);
  }
}
