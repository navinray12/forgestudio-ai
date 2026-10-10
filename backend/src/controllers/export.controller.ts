import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { generateAllCodeOutputs, buildProjectZipStream, EXPORT_TYPES, ExportType } from "../services/codeGenerator.service.js";
import { buildHelloThemeZipStream, generateHelloThemeFiles } from "../services/helloTheme.service.js";

const db = prisma as any;

async function getAuthorizedWebsite(websiteId: string, userId?: string) {
  // Fail closed: an export is never served without an authenticated user
  if (!userId) return null;
  const website = await db.website.findUnique({ where: { id: websiteId } });
  if (!website) return null;
  if (website.userId !== userId) {
    const collab = await db.websiteCollaborator?.findFirst?.({ where: { websiteId, userId } });
    if (!collab) {
      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user || !["ADMIN", "SUPER_ADMIN", "PLATFORM_ADMIN"].includes(user.role as string)) return null;
    }
  }
  return website;
}

/**
 * GET /api/websites/:websiteId/export/preview
 * Generate and preview code outputs (HTML, CSS, JS, Optimized DOM, Semantic HTML, React, Tailwind, Next.js, Component Export).
 */
export async function getCodePreview(req: Request, res: Response) {
  try {
    const websiteId = String(req.params.websiteId || "");
    const userId = res.locals.user?.id || (req as any).user?.id;
    const scope = (req.query.scope as any) === "component" ? "component" : "full";
    const componentId = req.query.componentId ? String(req.query.componentId) : undefined;

    const website = await getAuthorizedWebsite(websiteId, userId);
    if (!website) return res.status(404).json({ success: false, message: "Website not found or unauthorized" });

    const editorData = typeof website.editorData === "string"
      ? JSON.parse(website.editorData)
      : (website.editorData || {});

    const codeResult = generateAllCodeOutputs(editorData, { scope, componentId });

    return res.status(200).json({
      success: true,
      websiteId: website.id,
      websiteName: website.name,
      scope,
      componentId,
      code: codeResult,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/websites/:websiteId/export/zip
 * Download complete portable project or single component ZIP archive (static, react, tailwind, nextjs).
 */
export async function downloadProjectZip(req: Request, res: Response) {
  try {
    const websiteId = String(req.params.websiteId || "");
    const userId = res.locals.user?.id || (req as any).user?.id;
    const exportType = String(req.query.type || "static") as ExportType;
    if (!EXPORT_TYPES.includes(exportType)) {
      return res.status(400).json({
        success: false,
        message: `Unsupported export type. Use one of: ${EXPORT_TYPES.join(", ")}`,
      });
    }
    const scope = (req.query.scope as any) === "component" ? "component" : "full";
    const componentId = req.query.componentId ? String(req.query.componentId) : undefined;

    const website = await getAuthorizedWebsite(websiteId, userId);
    if (!website) return res.status(404).json({ success: false, message: "Website not found or unauthorized" });

    let editorData: any;
    try {
      editorData = typeof website.editorData === "string"
        ? JSON.parse(website.editorData)
        : (website.editorData || {});
    } catch {
      return res.status(422).json({ success: false, message: "The website's saved editor data is not valid JSON" });
    }

    let zipBuffer: Buffer;
    const bridgedProject = scope === "full" && (exportType === "react" || exportType === "nextjs")
      ? await db.forgeProject.findFirst({ where: { websiteId, deletedAt: null } })
      : null;

    if (bridgedProject && bridgedProject.framework === exportType) {
      // Export what the project holds for the latest saved design, including code edits
      const { syncBridgedProjectForWebsite } = await import("../services/project/forgeProject.service.js");
      const sync = await syncBridgedProjectForWebsite(websiteId, { id: userId });
      if (sync?.stale) {
        return res.status(409).json({
          success: false,
          message: `The project source could not be brought up to date with the visual design, so it was not exported: ${
            sync.error || "generation failed"
          }`,
        });
      }
      const { listFiles } = await import("../services/project/forgeFilesystem.service.js");
      const { buildZipFromFiles } = await import("../services/codeGenerator.service.js");
      const persistedFiles = (await listFiles(bridgedProject.id)).filter((f: any) => !f.isDirectory);
      if (persistedFiles.length > 0) {
        zipBuffer = await buildZipFromFiles(persistedFiles);
      } else {
        zipBuffer = await buildProjectZipStream(editorData, exportType, scope, componentId, {
          projectName: website.name,
          projectSlug: website.slug || website.name,
        });
      }
    } else {
      zipBuffer = await buildProjectZipStream(editorData, exportType, scope, componentId, {
        projectName: website.name,
        projectSlug: website.slug || website.name,
        projectId: bridgedProject?.id,
      });
    }
    const safeSlug = (website.slug || website.name || "project").replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeComponentId = String(componentId || "export").replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = scope === "component" ? `component-${safeComponentId}.zip` : `${safeSlug}-${exportType}-export.zip`;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(zipBuffer);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/plugins/wordpress/hello-theme/download
 * Download Hello Theme companion WordPress theme zip package (X-786).
 */
export async function downloadHelloThemeZip(_req: Request, res: Response) {
  try {
    const zipBuffer = await buildHelloThemeZipStream("Hello ForgeStudio");

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="hello-forgestudio-theme.zip"');
    return res.status(200).send(zipBuffer);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/plugins/wordpress/hello-theme/preview
 * Preview Hello Theme companion theme source files.
 */
export async function previewHelloThemeFiles(_req: Request, res: Response) {
  try {
    const files = generateHelloThemeFiles();
    return res.status(200).json({ success: true, theme: files });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
