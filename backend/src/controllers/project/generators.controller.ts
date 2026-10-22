/**
 * Project controller: Project Generators (Modules 08 & 09).
 * Moved verbatim from project.controller.ts, which re-exports every handler for compatibility.
 */
import { Request, Response, NextFunction } from "express";
import { getForgeProjectById } from "../../services/project/forgeProject.service.js";
import { listFiles } from "../../services/project/forgeFilesystem.service.js";
import { buildZipFromFiles } from "../../services/codeGenerator.service.js";
import { createGenerationPlan, executeGeneration, regenerateScope } from "../../services/generator/index.js";
import { prisma } from "../../config/prisma.js";
import { getAuthUser } from "./shared.js";

// Same alias as project.controller.ts: `prisma` is the shared client instance, so `db` is the same object.
const db = prisma as any;

// ---------------------------------------------------------------------------
// Project Generators (Modules 08 & 09)
// ---------------------------------------------------------------------------

function sendGenerationResult(
  res: Response,
  result: { success: boolean; diagnostics?: Array<{ severity: string; message: string }> }
) {
  if (result.success) {
    return res.status(200).json({ success: true, result });
  }
  const firstError = (result.diagnostics || []).find((d) => d.severity === "error");
  return res.status(422).json({
    success: false,
    message: firstError?.message || "Project generation failed",
    result,
  });
}

/**
 * GET /api/v1/projects/:id/export/zip
 * Download the project's persisted source files (including manual edits) as a standalone ZIP.
 */
export async function exportProjectZipHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    const project = await getForgeProjectById(projectId, user);

    // The archive must hold source generated from the latest saved design
    if (project.websiteId) {
      const { syncBridgedProjectForWebsite } = await import("../../services/project/forgeProject.service.js");
      const sync = await syncBridgedProjectForWebsite(project.websiteId, user);
      if (sync?.stale) {
        const existing = await db.forgeProjectFile.count({ where: { projectId, deletedAt: null } });
        if (existing > 0) {
          return res.status(409).json({
            success: false,
            message: `The project source could not be brought up to date with the visual design, so it was not exported: ${
              sync.error || "generation failed"
            }`,
          });
        }
      }
    }

    const files = (await listFiles(projectId)).filter((f: any) => !f.isDirectory);
    if (files.length === 0) {
      return res.status(409).json({
        success: false,
        message: "This project has no source files yet. Generate the project before exporting.",
      });
    }

    const zipBuffer = await buildZipFromFiles(files);
    const safeSlug = String(project.slug || "project").replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeFramework = String(project.framework || "source").replace(/[^a-zA-Z0-9_-]/g, "_");
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${safeSlug}-${safeFramework}.zip"`);
    res.setHeader("Content-Length", String(zipBuffer.length));
    return res.status(200).send(zipBuffer);
  } catch (err) {
    next(err);
  }
}

export async function generateReactProjectHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const plan = await createGenerationPlan(projectId, "react", {
      editorData: req.body?.editorData,
      reactOptions: req.body?.options,
      scope: req.body?.scope || { type: "full" },
      authorId: user.id,
    });

    const result = await executeGeneration(projectId, plan, user.id);
    sendGenerationResult(res, result);
  } catch (err) {
    next(err);
  }
}

export async function generateNextJsProjectHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const plan = await createGenerationPlan(projectId, "nextjs", {
      editorData: req.body?.editorData,
      nextOptions: req.body?.options,
      scope: req.body?.scope || { type: "full" },
      authorId: user.id,
    });

    const result = await executeGeneration(projectId, plan, user.id);
    sendGenerationResult(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getGenerationPlanHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const framework = (req.query.framework as "react" | "nextjs") || "react";
    const plan = await createGenerationPlan(projectId, framework, {
      editorData: req.body?.editorData,
      authorId: user.id,
    });

    res.status(200).json({ success: true, plan });
  } catch (err) {
    next(err);
  }
}

export async function regenerateScopeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { framework = "react", scope } = req.body;
    if (!scope || !scope.type) {
      return res.status(400).json({ success: false, message: "Valid scope object is required" });
    }

    const result = await regenerateScope(projectId, framework, scope, user.id);
    sendGenerationResult(res, result);
  } catch (err) {
    next(err);
  }
}
