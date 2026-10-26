/**
 * Project controller: Unified Compiler & Visual ↔ Code Sync (compile, visual-to-code sync and plan).
 * Moved verbatim from project.controller.ts, which re-exports every handler for compatibility.
 */
import { Request, Response, NextFunction } from "express";
import { getForgeProjectById } from "../../services/project/forgeProject.service.js";
import { compileAndSyncProject } from "../../services/compiler/unifiedCompiler.service.js";
import { syncVisualElementToSource } from "../../services/compiler/visualCodeSync.service.js";
import { recordCheckpoint } from "../../services/workspace/workspaceCheckpoints.service.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { buildSyncBaseline, toProjectFramework } from "../../services/compiler/pageRegistry.js";
import { getAuthUser } from "./shared.js";

// Same alias as project.controller.ts: `prisma` is the shared client instance, so `db` is the same object.
const db = prisma as any;

// ---------------------------------------------------------------------------
// Unified Compiler & Visual ↔ Code Sync
// ---------------------------------------------------------------------------

export async function compileProjectHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    const project = await getForgeProjectById(projectId, user);

    let editorData = req.body.editorData;
    if (!editorData && project.websiteId) {
      const site = await db.website.findUnique({ where: { id: project.websiteId } });
      try {
        editorData = typeof site?.editorData === "string" ? JSON.parse(site.editorData) : site?.editorData;
      } catch {
        return res.status(422).json({ success: false, message: "The website's saved editor data is not valid JSON" });
      }
    }

    const result = await compileAndSyncProject(
      projectId,
      editorData || { elements: [] },
      { id: project.id, name: project.name, slug: project.slug, framework: project.framework },
      user.id
    );

    if (!result.success) {
      const firstError = result.diagnostics.find((d) => d.severity === "error");
      return res.status(422).json({
        success: false,
        message: firstError?.message || "Compilation failed",
        result,
      });
    }

    // Only source generated from the saved document counts as the sync baseline:
    // an ad-hoc document sent with the request is not what the website holds
    if (editorData && !req.body.editorData) {
      const fresh = await db.forgeProject.findUnique({ where: { id: projectId } });
      const metadata = (fresh?.metadata && typeof fresh.metadata === "object" ? fresh.metadata : {}) as Record<
        string,
        any
      >;
      await db.forgeProject.update({
        where: { id: projectId },
        data: {
          metadata: { ...metadata, visualSync: buildSyncBaseline(editorData, toProjectFramework(project.framework)) },
        },
      });
    }

    res.status(200).json({ success: true, result });
  } catch (err) {
    next(err);
  }
}

export async function syncVisualToCodeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { filePath, element, expectedRevision, mutation } = req.body ?? {};
    if (typeof filePath !== "string" || !filePath.trim()) {
      throw new AppError("filePath is required", 400, "MISSING_FILE_PATH");
    }
    if (mutation !== undefined && (mutation === null || typeof mutation !== "object" || Array.isArray(mutation))) {
      throw new AppError("mutation must be an object", 400, "INVALID_MUTATION");
    }
    const result = await syncVisualElementToSource(projectId, filePath, element, {
      authorId: user.id,
      expectedRevision: expectedRevision !== undefined ? Number(expectedRevision) : undefined,
      mutation,
    });
    // An applied edit is a committed workspace change: record it so that other clients of the
    // project are told (workspace sync gateway) and can resume from it after a disconnect.
    let checkpoint: { id: string; sequence: number; kind: string } | undefined;
    if (result.updated) {
      try {
        const project = await getForgeProjectById(projectId, user);
        const cp = await recordCheckpoint({
          projectId,
          websiteId: project.websiteId,
          origin: "VISUAL",
          kind: "SOURCE_ONLY",
          filePath,
          message: `Visual ${mutation?.type ?? "SET_TEXT"} on ${element?.id}`,
          actorId: user.id,
        });
        checkpoint = { id: cp.id, sequence: cp.sequence, kind: cp.kind };
      } catch (err: any) {
        result.diagnostics.push({ severity: "warning", code: "CHECKPOINT_NOT_RECORDED", message: "The edit was saved, but other clients could not be notified.", filePath });
      }
    }
    // A rejected edit is reported as such (422) with its diagnostics; the file is untouched.
    res.status(result.success ? 200 : 422).json({ ...result, ...(checkpoint ? { checkpoint } : {}) });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /:id/sync/visual-to-code/plan — the element edits that carry a canvas change (the visual
 * document before and after it) into the project's hand-written page files. Read-only: the edits
 * are applied one by one through POST /:id/sync/visual-to-code.
 */
export async function planVisualToCodeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const project = await getForgeProjectById(String(req.params.id), user);
    const { before, after, paths } = req.body ?? {};
    if (paths !== undefined && (!Array.isArray(paths) || paths.some((p) => typeof p !== "string"))) {
      throw new AppError("paths must be an array of file paths", 400, "INVALID_PATHS");
    }
    const { planCanvasEdits } = await import("../../services/compiler/canvasEditPlanner.js");
    res.status(200).json({ success: true, ...(await planCanvasEdits(project as any, before, after, paths)) });
  } catch (err) {
    next(err);
  }
}
