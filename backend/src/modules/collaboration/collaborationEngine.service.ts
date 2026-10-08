/**
 * ForgeStudio Module 57: Collaboration Engine Service
 * Manages presence, live editor sessions, server-authoritative revisions,
 * optimistic concurrency, 3-way conflict detection, and shared preview sessions.
 */

import crypto from "node:crypto";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { forgeFilesystemService } from "../../services/project/forgeFilesystem.service.js";
import type {
  PeerPresence,
  FileSession,
  ThreeWayConflict,
  SharedPreviewSession,
  ActivityEvent,
} from "./collaboration.types.js";

const db = prisma as any;

// In-memory real-time presence registry for ultra-fast broadcasts
const PROJECT_PRESENCE = new Map<string, Map<string, PeerPresence>>();

export class CollaborationEngineService {
  /**
   * Update or register user presence in a project
   */
  async updatePresence(presence: PeerPresence): Promise<PeerPresence[]> {
    const { projectId, userId } = presence;
    if (!PROJECT_PRESENCE.has(projectId)) {
      PROJECT_PRESENCE.set(projectId, new Map());
    }
    const projectPeers = PROJECT_PRESENCE.get(projectId)!;
    projectPeers.set(userId, { ...presence, lastSeen: Date.now() });

    // Persist session asynchronously
    try {
      await db.forgeCollaborationSession.upsert({
        where: { id: presence.socketId || crypto.randomUUID() },
        create: {
          id: presence.socketId || crypto.randomUUID(),
          projectId,
          userId,
          socketId: presence.socketId,
          activeFile: presence.activeFile || null,
          cursorLine: presence.cursor?.line || null,
          cursorColumn: presence.cursor?.column || null,
          selection: presence.selection || {},
          activePanel: presence.activePanel || null,
          status: presence.status,
          lastActiveAt: new Date(),
        },
        update: {
          activeFile: presence.activeFile || null,
          cursorLine: presence.cursor?.line || null,
          cursorColumn: presence.cursor?.column || null,
          selection: presence.selection || {},
          activePanel: presence.activePanel || null,
          status: presence.status,
          lastActiveAt: new Date(),
        },
      });
    } catch {
      // In-memory presence takes precedence during high-frequency typing
    }

    return Array.from(projectPeers.values());
  }

  /**
   * Remove peer from presence on disconnect
   */
  removePresence(projectId: string, userId: string): PeerPresence[] {
    const projectPeers = PROJECT_PRESENCE.get(projectId);
    if (projectPeers) {
      projectPeers.delete(userId);
      if (projectPeers.size === 0) {
        PROJECT_PRESENCE.delete(projectId);
      }
    }
    return projectPeers ? Array.from(projectPeers.values()) : [];
  }

  /**
   * Get active collaborators in a project
   */
  getProjectCollaborators(projectId: string): PeerPresence[] {
    const projectPeers = PROJECT_PRESENCE.get(projectId);
    if (!projectPeers) return [];

    const now = Date.now();
    const active: PeerPresence[] = [];
    for (const [userId, peer] of projectPeers.entries()) {
      if (now - peer.lastSeen <= 60000) {
        active.push(peer);
      } else {
        projectPeers.delete(userId);
      }
    }
    return active;
  }

  /**
   * Acquire or refresh a file editing session lease
   */
  async acquireFileSession(
    projectId: string,
    filePath: string,
    userId: string
  ): Promise<FileSession> {
    const existing = await db.forgeFileSession.findFirst({
      where: { projectId, filePath },
    });

    const activeEditors = new Set<string>(existing?.activeEditors || []);
    activeEditors.add(userId);

    const session = await db.forgeFileSession.upsert({
      where: {
        id: existing?.id || crypto.randomUUID(),
      },
      create: {
        projectId,
        filePath,
        currentRevision: 1,
        activeEditors: Array.from(activeEditors),
        updatedAt: new Date(),
      },
      update: {
        activeEditors: Array.from(activeEditors),
        updatedAt: new Date(),
      },
    });

    return session;
  }

  /**
   * Server-authoritative revision write with optimistic concurrency check
   */
  async writeConcurrentFile(params: {
    projectId: string;
    filePath: string;
    content: string;
    expectedRevision: number;
    userId: string;
  }): Promise<{ success: boolean; newRevision: number; file: any }> {
    const { projectId, filePath, content, expectedRevision, userId } = params;

    // Retrieve file session
    let session = await db.forgeFileSession.findFirst({
      where: { projectId, filePath },
    });

    if (!session) {
      session = await this.acquireFileSession(projectId, filePath, userId);
    }

    // Check lock
    if (session.lockedBy && session.lockedBy !== userId) {
      const lockAge = session.lockedAt ? Date.now() - new Date(session.lockedAt).getTime() : 0;
      if (lockAge < 300000) {
        throw new AppError(
          `File is currently locked by another collaborator`,
          423,
          "FILE_LOCKED"
        );
      }
    }

    // Optimistic concurrency verification
    if (expectedRevision !== undefined && expectedRevision !== null && expectedRevision < session.currentRevision) {
      throw new AppError(
        `Concurrency conflict: file revision is ${session.currentRevision}, but client sent ${expectedRevision}. Conflict resolution required.`,
        409,
        "CONCURRENCY_CONFLICT"
      );
    }

    const nextRevision = session.currentRevision + 1;

    // Write file content via project filesystem service
    const file = await forgeFilesystemService.writeFile(
      projectId,
      filePath,
      content,
      userId
    );

    // Update session revision
    await db.forgeFileSession.update({
      where: { id: session.id },
      data: {
        currentRevision: nextRevision,
        updatedAt: new Date(),
      },
    });

    // Log activity
    await this.recordActivity({
      projectId,
      actorId: userId,
      category: "FILE",
      action: "file.updated",
      targetResource: filePath,
      details: { revision: nextRevision, sizeBytes: Buffer.byteLength(content, "utf8") },
    });

    return { success: true, newRevision: nextRevision, file };
  }

  /**
   * Acquire explicit file lock (pessimistic lock option)
   */
  async lockFile(projectId: string, filePath: string, userId: string): Promise<FileSession> {
    const session = await this.acquireFileSession(projectId, filePath, userId);
    if (session.lockedBy && session.lockedBy !== userId) {
      throw new AppError("File is already locked by another user", 423, "FILE_LOCKED");
    }

    const updated = await db.forgeFileSession.update({
      where: { id: session.id },
      data: {
        lockedBy: userId,
        lockedAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Release file lock
   */
  async unlockFile(projectId: string, filePath: string, userId: string): Promise<FileSession> {
    const session = await db.forgeFileSession.findFirst({
      where: { projectId, filePath },
    });
    if (!session) {
      throw new AppError("File session not found", 404, "NOT_FOUND");
    }

    const updated = await db.forgeFileSession.update({
      where: { id: session.id },
      data: {
        lockedBy: null,
        lockedAt: null,
      },
    });

    return updated;
  }

  /**
   * 3-Way Conflict Detection and Resolution Engine
   */
  detectThreeWayConflict(params: {
    filePath: string;
    baseContent: string;
    currentContent: string;
    incomingContent: string;
    baseRevision: number;
    currentRevision: number;
  }): ThreeWayConflict {
    const { filePath, baseContent, currentContent, incomingContent, baseRevision, currentRevision } = params;

    const baseLines = baseContent.split("\n");
    const currentLines = currentContent.split("\n");
    const incomingLines = incomingContent.split("\n");

    const conflicts: ThreeWayConflict["conflicts"] = [];
    const maxLen = Math.max(baseLines.length, currentLines.length, incomingLines.length);

    for (let i = 0; i < maxLen; i++) {
      const b = baseLines[i] ?? "";
      const c = currentLines[i] ?? "";
      const inc = incomingLines[i] ?? "";

      // Conflict exists when both current and incoming have changed from base, and differ from each other
      if (c !== b && inc !== b && c !== inc) {
        conflicts.push({
          startLine: i + 1,
          endLine: i + 1,
          currentSnippet: c,
          incomingSnippet: inc,
        });
      }
    }

    return {
      filePath,
      baseRevision,
      currentRevision,
      baseContent,
      currentContent,
      incomingContent,
      hasConflicts: conflicts.length > 0,
      conflicts,
    };
  }

  /**
   * Create a Shared Preview Session
   */
  async createSharedPreview(params: {
    projectId: string;
    userId: string;
    initialRoute?: string;
    viewport?: { width: number; height: number };
    ttlHours?: number;
  }): Promise<SharedPreviewSession> {
    const { projectId, userId, initialRoute = "/", viewport = { width: 1280, height: 800 }, ttlHours = 24 } = params;

    const token = `preview_${crypto.randomBytes(16).toString("hex")}`;
    const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000);

    const session = await db.forgeSharedPreviewSession.create({
      data: {
        projectId,
        createdById: userId,
        token,
        currentRoute: initialRoute,
        viewport,
        isSyncActive: true,
        allowedUsers: [userId],
        expiresAt,
      },
    });

    await this.recordActivity({
      projectId,
      actorId: userId,
      category: "DEPLOY",
      action: "preview.shared_session_created",
      targetResource: `preview:${token}`,
      details: { route: initialRoute, expiresAt },
    });

    return session;
  }

  /**
   * Update shared preview state (synchronized navigation & viewport)
   */
  async updateSharedPreview(token: string, updates: { route?: string; viewport?: { width: number; height: number }; isSyncActive?: boolean }) {
    const session = await db.forgeSharedPreviewSession.findUnique({ where: { token } });
    if (!session || new Date(session.expiresAt) < new Date()) {
      throw new AppError("Shared preview session is expired or invalid", 404, "SESSION_EXPIRED");
    }

    return db.forgeSharedPreviewSession.update({
      where: { token },
      data: {
        currentRoute: updates.route || session.currentRoute,
        viewport: updates.viewport || session.viewport,
        isSyncActive: updates.isSyncActive !== undefined ? updates.isSyncActive : session.isSyncActive,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Record tenant/project-scoped developer activity event
   */
  async recordActivity(event: Omit<ActivityEvent, "id" | "createdAt">): Promise<ActivityEvent> {
    const created = await db.forgeActivityEvent.create({
      data: {
        projectId: event.projectId,
        actorId: event.actorId || null,
        category: event.category,
        action: event.action,
        targetResource: event.targetResource,
        details: event.details || {},
      },
    });
    return created;
  }

  /**
   * Query project activity timeline with filters and pagination
   */
  async getActivityTimeline(params: {
    projectId: string;
    category?: string;
    limit?: number;
  }): Promise<ActivityEvent[]> {
    const { projectId, category, limit = 50 } = params;
    const where: any = { projectId };
    if (category) where.category = category;

    const events = await db.forgeActivityEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 100),
    });

    return events;
  }
}

export const collaborationEngineService = new CollaborationEngineService();
