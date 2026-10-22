/**
 * Project controller: Developer Workspace State.
 * Moved verbatim from project.controller.ts, which re-exports every handler for compatibility.
 */
import { Request, Response, NextFunction } from "express";
import { getForgeProjectById } from "../../services/project/forgeProject.service.js";
import { prisma } from "../../config/prisma.js";
import { getAuthUser } from "./shared.js";

// Same alias as project.controller.ts: `prisma` is the shared client instance, so `db` is the same object.
const db = prisma as any;

// ---------------------------------------------------------------------------
// Developer Workspace State
// ---------------------------------------------------------------------------

export async function getWorkspaceStateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const state = await db.forgeWorkspaceState.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: user.id,
        },
      },
    });

    res.status(200).json({
      success: true,
      state: state || {
        layout: {
          openFiles: ["src/App.tsx", "forge.manifest.json"],
          activeFile: "src/App.tsx",
          mode: "code",
          panelSizes: { explorer: 260, editor: 700, preview: 400 },
        },
        preferences: { theme: "vs-dark", fontSize: 13 },
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function saveWorkspaceStateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { layout, preferences } = req.body;

    const existing = await db.forgeWorkspaceState.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: user.id,
        },
      },
    });

    let state;
    if (existing) {
      state = await db.forgeWorkspaceState.update({
        where: { id: existing.id },
        data: {
          layout: layout || existing.layout,
          preferences: preferences || existing.preferences,
        },
      });
    } else {
      state = await db.forgeWorkspaceState.create({
        data: {
          projectId,
          userId: user.id,
          layout: layout || {},
          preferences: preferences || {},
        },
      });
    }

    res.status(200).json({ success: true, state });
  } catch (err) {
    next(err);
  }
}
