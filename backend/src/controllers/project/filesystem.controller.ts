/**
 * Project controller: Persistent Filesystem.
 * Moved verbatim from project.controller.ts, which re-exports every handler for compatibility.
 */
import { Request, Response, NextFunction } from "express";
import { getForgeProjectById } from "../../services/project/forgeProject.service.js";
import { writeFile, readFile, deleteFile, moveOrRenameFile, getProjectFileTree, getFileRevisions, createProjectSnapshot, listProjectSnapshots } from "../../services/project/forgeFilesystem.service.js";
import { syncSourceToVisualWebsite } from "../../services/compiler/visualCodeSync.service.js";
import { recordCheckpoint, findCommittedChangeSet, kindForSyncStatus } from "../../services/workspace/workspaceCheckpoints.service.js";
import { prisma } from "../../config/prisma.js";
import { getAuthUser } from "./shared.js";

// Same alias as project.controller.ts: `prisma` is the shared client instance, so `db` is the same object.
const db = prisma as any;

// ---------------------------------------------------------------------------
// Persistent Filesystem
// ---------------------------------------------------------------------------

export async function getFileTreeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const includeIgnored = req.query.includeIgnored === "true";
    const tree = await getProjectFileTree(projectId, includeIgnored);
    res.status(200).json({ success: true, tree });
  } catch (err) {
    next(err);
  }
}

export async function readFileHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const filePath = String(req.query.path || "");
    const file = await readFile(projectId, filePath);
    res.status(200).json({ success: true, file });
  } catch (err) {
    next(err);
  }
}

export async function writeFileHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    const project = await getForgeProjectById(projectId, user);
    const { path: filePath, content, encoding, expectedVersion, isProtected, reason } = req.body;
    // A retried save (e.g. after a lost acknowledgement) with the same change-set id returns the
    // committed result instead of writing again (blueprint §34.3, FS21-AT-SYN-07).
    const changeSetId = (req.get("Idempotency-Key") || req.body?.changeSetId || "").toString().trim().slice(0, 128) || null;
    if (changeSetId) {
      const committed = await findCommittedChangeSet(projectId, changeSetId);
      if (committed) {
        const { id, sequence, kind } = committed.checkpoint;
        return res.status(200).json({ ...(committed.response as object), checkpoint: { id, sequence, kind }, replayed: true });
      }
    }
    const previous = await db.forgeProjectFile.findFirst({ where: { projectId, path: String(filePath || ""), deletedAt: null } });
    let file = await writeFile(projectId, filePath, {
      content,
      encoding,
      expectedVersion,
      isProtected,
      authorId: user.id,
      reason,
    });

    // A saved source file is reconciled with the visual document as part of the
    // same request, so a page edit can never sit unsynchronised behind a later
    // regeneration. Failures are reported in `sync`; the saved file is kept.
    let sync: any = null;
    const changed = !previous || previous.contentHash !== file.contentHash;
    if (project.websiteId && changed && /\.(tsx|jsx)$/.test(file.path)) {
      try {
        sync = await syncSourceToVisualWebsite(projectId, project.websiteId, file.path, user.id);
      } catch (syncErr: any) {
        sync = {
          success: false,
          mode: "CODE_TO_VISUAL",
          status: "error",
          message: syncErr?.message || "Synchronisation with the visual document failed",
          appliedChangesCount: 0,
          conflicts: [],
          diagnostics: [],
          updatedFiles: [],
        };
      }
    }

    // Editing a generated file that is not a visual page makes it the user's own:
    // regeneration must not silently replace it
    if (changed && previous?.isGenerated && (!sync || sync.status === "not-a-page")) {
      await db.forgeProjectFile.update({ where: { id: file.id }, data: { isGenerated: false } });
    }

    file = (await db.forgeProjectFile.findFirst({ where: { id: file.id } })) || file;
    const body: Record<string, unknown> = { success: true, file, sync };
    if (changed || changeSetId) {
      const checkpoint = await recordCheckpoint({
        projectId,
        websiteId: project.websiteId,
        origin: "CODE",
        kind: kindForSyncStatus(sync?.status),
        filePath: file.path,
        message: sync?.message ?? null,
        changeSetId,
        response: body,
        actorId: user.id,
      });
      body.checkpoint = { id: checkpoint.id, sequence: checkpoint.sequence, kind: checkpoint.kind };
    }
    res.status(200).json(body);
  } catch (err) {
    next(err);
  }
}

export async function deleteFileHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const filePath = String(req.query.path || req.body.path || "");
    const result = await deleteFile(projectId, filePath, user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function moveFileHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { sourcePath, destPath } = req.body;
    const file = await moveOrRenameFile(projectId, sourcePath, destPath, user.id);
    res.status(200).json({ success: true, file });
  } catch (err) {
    next(err);
  }
}

export async function getFileRevisionsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const fileId = String(req.params.fileId);
    const revisions = await getFileRevisions(projectId, fileId);
    res.status(200).json({ success: true, revisions });
  } catch (err) {
    next(err);
  }
}

export async function createSnapshotHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { name, description } = req.body;
    const snapshot = await createProjectSnapshot(projectId, name || "Manual Snapshot", description, user.id);
    res.status(201).json({ success: true, snapshot });
  } catch (err) {
    next(err);
  }
}

export async function listSnapshotsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const snapshots = await listProjectSnapshots(projectId);
    res.status(200).json({ success: true, snapshots });
  } catch (err) {
    next(err);
  }
}
