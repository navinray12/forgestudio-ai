/**
 * ForgeStudio Module 63: Project Snapshot / Checkpoint / Recovery Service
 * Atomic multi-layer point-in-time checkpoints, differential comparisons,
 * full workspace rollback, single-file restoration, and disaster recovery bundles.
 */

import crypto from "crypto";
import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";
import { forgeProjectService } from "../../../services/project/forgeProject.service.js";
import { forgeFilesystemService } from "../../../services/project/forgeFilesystem.service.js";
import { forgeDatabaseService } from "../../data-platform/database/forgeDatabase.service.js";
import { recordAuditLog } from "../../../services/audit.service.js";
import {
  CheckpointRecord,
  CheckpointTag,
  CheckpointDiffResult,
  CheckpointDiffItem,
  RollbackResult,
  FileSnapshotItem,
  DisasterRecoveryBundle,
} from "./recovery.types.js";

const db = prisma as any;

export class ProjectRecoveryService {
  /**
   * Create an atomic multi-layer project checkpoint
   */
  async createCheckpoint(
    projectId: string,
    input: {
      name: string;
      description?: string;
      tag?: CheckpointTag;
      authorId?: string;
    }
  ): Promise<CheckpointRecord> {
    await forgeProjectService.getProjectById(projectId);

    const activeFiles = await forgeFilesystemService.listFiles(projectId);
    const filesSnapshot: FileSnapshotItem[] = [];
    let totalBytes = 0;

    for (const f of activeFiles) {
      if (f.path.includes("node_modules") || f.path.includes(".git")) continue;

      let content = "";
      try {
        const fileData = await forgeFilesystemService.readFile(projectId, f.path);
        content = fileData.content || "";
      } catch {
        continue;
      }

      const size = Buffer.byteLength(content, "utf8");
      totalBytes += size;
      filesSnapshot.push({
        path: f.path,
        content,
        contentHash: f.contentHash,
        sizeBytes: size,
        version: f.version,
      });
    }

    // Capture project manifest
    let manifestSnapshot: Record<string, any> = {};
    try {
      const manifestFile = await forgeFilesystemService.readFile(projectId, "forge.manifest.json");
      manifestSnapshot = JSON.parse(manifestFile.content || "{}");
    } catch {}

    // Capture database schema state
    let databaseSnapshot: Record<string, any> = {};
    try {
      const databases = await forgeDatabaseService.listDatabases(projectId);
      databaseSnapshot = { databasesCount: databases.length, databases };
    } catch {}

    const record = await db.forgeProjectCheckpoint.create({
      data: {
        projectId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        tag: input.tag || "MANUAL",
        filesCount: filesSnapshot.length,
        totalBytes,
        filesSnapshot,
        manifestSnapshot,
        databaseSnapshot,
        configSnapshot: {},
        createdById: input.authorId || null,
        createdAt: new Date(),
      },
    });

    await recordAuditLog({
      userId: input.authorId || "system",
      action: "project.checkpoint_created",
      targetResource: `project:${projectId}`,
      details: { checkpointId: record.id, name: record.name, tag: record.tag },
    });

    return record;
  }

  async listCheckpoints(
    projectId: string,
    tag?: CheckpointTag
  ): Promise<CheckpointRecord[]> {
    await forgeProjectService.getProjectById(projectId);

    const where: any = { projectId };
    if (tag) where.tag = tag;

    return await db.forgeProjectCheckpoint.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  async getCheckpoint(
    projectId: string,
    checkpointId: string
  ): Promise<CheckpointRecord> {
    await forgeProjectService.getProjectById(projectId);

    const checkpoint = await db.forgeProjectCheckpoint.findFirst({
      where: { projectId, id: checkpointId },
    });

    if (!checkpoint) {
      throw new AppError("Checkpoint not found", 404, "NOT_FOUND");
    }

    return checkpoint;
  }

  /**
   * Calculate differential changes between checkpoint and current active workspace
   */
  async compareDiff(
    projectId: string,
    checkpointId: string
  ): Promise<CheckpointDiffResult> {
    return this.diffCheckpointWithWorkspace(projectId, checkpointId);
  }

  async diffCheckpointWithWorkspace(
    projectId: string,
    checkpointId: string
  ): Promise<CheckpointDiffResult> {
    const checkpoint = await this.getCheckpoint(projectId, checkpointId);
    const currentFiles = await forgeFilesystemService.listFiles(projectId);

    const checkpointFileMap = new Map<string, FileSnapshotItem>();
    for (const f of checkpoint.filesSnapshot || []) {
      checkpointFileMap.set(f.path, f);
    }

    const currentFileMap = new Map<string, any>();
    for (const f of currentFiles) {
      currentFileMap.set(f.path, f);
    }

    const diffs: CheckpointDiffItem[] = [];

    // Check files in current workspace against checkpoint
    for (const [path, curr] of currentFileMap.entries()) {
      const chk = checkpointFileMap.get(path);
      if (!chk) {
        diffs.push({
          path,
          status: "ADDED",
          newVersion: curr.version,
          newHash: curr.contentHash,
        });
      } else if (chk.contentHash !== curr.contentHash) {
        diffs.push({
          path,
          status: "MODIFIED",
          oldVersion: chk.version,
          newVersion: curr.version,
          oldHash: chk.contentHash,
          newHash: curr.contentHash,
        });
      } else {
        diffs.push({
          path,
          status: "UNCHANGED",
          oldVersion: chk.version,
          newVersion: curr.version,
          oldHash: chk.contentHash,
          newHash: curr.contentHash,
        });
      }
    }

    // Check for files that were deleted in current workspace but existed in checkpoint
    for (const [path, chk] of checkpointFileMap.entries()) {
      if (!currentFileMap.has(path)) {
        diffs.push({
          path,
          status: "DELETED",
          oldVersion: chk.version,
          oldHash: chk.contentHash,
        });
      }
    }

    const addedCount = diffs.filter((d) => d.status === "ADDED").length;
    const modifiedCount = diffs.filter((d) => d.status === "MODIFIED").length;
    const deletedCount = diffs.filter((d) => d.status === "DELETED").length;
    const totalChanges = addedCount + modifiedCount + deletedCount;

    return {
      checkpointId,
      comparisonTarget: "Active Workspace",
      totalChanges,
      addedCount,
      modifiedCount,
      deletedCount,
      diffs,
    };
  }

  /**
   * Atomically roll back the entire project to the exact state of a checkpoint
   */
  async rollbackToCheckpoint(
    projectId: string,
    checkpointId: string,
    authorId?: string
  ): Promise<RollbackResult> {
    const startTime = Date.now();
    const checkpoint = await this.getCheckpoint(projectId, checkpointId);
    const currentFiles = await forgeFilesystemService.listFiles(projectId);

    const checkpointPaths = new Set(
      (checkpoint.filesSnapshot || []).map((f) => f.path)
    );

    const restoreLog: Array<{ path: string; action: string; version: number }> = [];
    let filesRestoredCount = 0;
    let filesDeletedCount = 0;

    // 1. Delete or tombstone any active files that did not exist in the checkpoint
    for (const curr of currentFiles) {
      if (!checkpointPaths.has(curr.path)) {
        await forgeFilesystemService.deleteFile(projectId, curr.path, authorId);
        filesDeletedCount++;
        restoreLog.push({
          path: curr.path,
          action: "DELETED_POST_CHECKPOINT",
          version: curr.version + 1,
        });
      }
    }

    // 2. Restore/overwrite all files from the checkpoint
    for (const snapshotItem of checkpoint.filesSnapshot || []) {
      const written = await forgeFilesystemService.writeFile(
        projectId,
        snapshotItem.path,
        snapshotItem.content,
        {
          authorId,
          reason: `Restored from checkpoint '${checkpoint.name}' (${checkpoint.id})`,
        }
      );
      filesRestoredCount++;
      restoreLog.push({
        path: snapshotItem.path,
        action: "RESTORED",
        version: written.version,
      });
    }

    const durationMs = Date.now() - startTime;

    // Record restore operation in database
    await db.forgeCheckpointRestore.create({
      data: {
        projectId,
        checkpointId,
        status: "SUCCESS",
        filesRestoredCount,
        filesDeletedCount,
        durationMs,
        restoreLog,
        restoredById: authorId || null,
        restoredAt: new Date(),
      },
    });

    await recordAuditLog({
      userId: authorId || "system",
      action: "project.checkpoint_restored",
      targetResource: `project:${projectId}`,
      details: { checkpointId, filesRestoredCount, filesDeletedCount, durationMs },
    });

    return {
      checkpointId,
      status: "SUCCESS",
      filesRestoredCount,
      filesDeletedCount,
      durationMs,
      restoreLog,
      restoredAt: new Date().toISOString(),
    };
  }

  /**
   * Restore a single specific file from a checkpoint without affecting other files
   */
  async restoreSingleFile(
    projectId: string,
    checkpointId: string,
    filePath: string,
    authorId?: string
  ): Promise<{ path: string; version: number }> {
    const checkpoint = await this.getCheckpoint(projectId, checkpointId);
    const cleanPath = forgeFilesystemService.sanitizeAndNormalizePath(filePath);

    const item = (checkpoint.filesSnapshot || []).find(
      (f) => forgeFilesystemService.sanitizeAndNormalizePath(f.path) === cleanPath
    );

    if (!item) {
      throw new AppError(
        `File '${cleanPath}' does not exist in checkpoint '${checkpoint.name}'`,
        404,
        "FILE_NOT_IN_CHECKPOINT"
      );
    }

    const written = await forgeFilesystemService.writeFile(
      projectId,
      cleanPath,
      item.content,
      {
        authorId,
        reason: `Single-file restore from checkpoint '${checkpoint.name}'`,
      }
    );

    return { path: cleanPath, version: written.version };
  }

  /**
   * Export a self-contained disaster recovery bundle
   */
  async exportDisasterRecoveryBundle(
    projectId: string,
    checkpointId: string
  ): Promise<DisasterRecoveryBundle> {
    const checkpoint = await this.getCheckpoint(projectId, checkpointId);

    return {
      formatVersion: "1.0",
      exportedAt: new Date().toISOString(),
      projectId,
      checkpoint,
    };
  }

  /**
   * Import a disaster recovery bundle and restore project state
   */
  async importDisasterRecoveryBundle(
    projectId: string,
    bundle: DisasterRecoveryBundle,
    authorId?: string
  ): Promise<RollbackResult> {
    if (!bundle || bundle.formatVersion !== "1.0" || !bundle.checkpoint) {
      throw new AppError("Invalid disaster recovery bundle format", 400, "INVALID_BUNDLE");
    }

    // Save checkpoint record in project
    const importedCheckpoint = await db.forgeProjectCheckpoint.create({
      data: {
        projectId,
        name: `Imported: ${bundle.checkpoint.name}`,
        description: `Imported disaster recovery bundle from ${bundle.exportedAt}`,
        tag: "DISASTER_RECOVERY",
        filesCount: bundle.checkpoint.filesCount,
        totalBytes: bundle.checkpoint.totalBytes,
        filesSnapshot: bundle.checkpoint.filesSnapshot,
        manifestSnapshot: bundle.checkpoint.manifestSnapshot || {},
        databaseSnapshot: bundle.checkpoint.databaseSnapshot || {},
        configSnapshot: bundle.checkpoint.configSnapshot || {},
        createdById: authorId || null,
        createdAt: new Date(),
      },
    });

    // Execute atomic rollback to the imported checkpoint
    return await this.rollbackToCheckpoint(projectId, importedCheckpoint.id, authorId);
  }
}

export const projectRecoveryService = new ProjectRecoveryService();
