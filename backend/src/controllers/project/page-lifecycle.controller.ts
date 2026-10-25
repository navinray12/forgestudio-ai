/**
 * Project controller: Page lifecycle (create, move, retire, restore).
 * Moved verbatim from project.controller.ts, which re-exports every handler for compatibility.
 */
import { Request, Response, NextFunction } from "express";
import { getForgeProjectById } from "../../services/project/forgeProject.service.js";
import { createPageLifecycle, renameOrMovePage, retirePageReversible, restorePageDraft } from "../../services/compiler/pageRegistry.js";
import { getAuthUser } from "./shared.js";

export async function createPageLifecycleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    const project = await getForgeProjectById(projectId, user);

    const { pageName, routePath, framework, existingPages } = req.body;
    const fw = framework || (project.framework === "nextjs" ? "nextjs" : "react");

    const result = createPageLifecycle({
      projectId,
      pageName: pageName || "New Page",
      routePath: routePath || "/new-page",
      framework: fw,
      existingPages: Array.isArray(existingPages) ? existingPages : [],
    });

    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function movePageLifecycleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { pages, pageKey, newRoutePath, newFilePath, newName } = req.body;
    const result = renameOrMovePage({
      pages: Array.isArray(pages) ? pages : [],
      pageKey,
      newRoutePath,
      newFilePath,
      newName,
    });

    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function retirePageLifecycleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { pages, pageKey, reason } = req.body;
    const result = retirePageReversible(
      Array.isArray(pages) ? pages : [],
      pageKey,
      reason
    );

    res.status(200).json({ success: true, pages: result });
  } catch (err) {
    next(err);
  }
}

export async function restorePageLifecycleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { pages, pageKey } = req.body;
    const result = restorePageDraft(
      Array.isArray(pages) ? pages : [],
      pageKey
    );

    res.status(200).json({ success: true, pages: result });
  } catch (err) {
    next(err);
  }
}
