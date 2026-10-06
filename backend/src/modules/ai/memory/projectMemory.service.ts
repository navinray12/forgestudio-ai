/**
 * ForgeStudio Module 38: AI Project Memory Service
 * Durable project-scoped engineering memory management.
 */

import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";
import {
  CreateMemoryDto,
  UpdateMemoryDto,
  ProjectMemoryEntity,
  MemoryStatus,
} from "./memory.types.js";

const db = prisma as any;

export class ProjectMemoryService {
  /**
   * Create a new project engineering memory
   */
  public async createMemory(dto: CreateMemoryDto): Promise<ProjectMemoryEntity> {
    if (!dto.projectId) {
      throw new AppError("projectId is required", 400, "MISSING_PROJECT_ID");
    }
    if (!dto.title || !dto.title.trim()) {
      throw new AppError("title is required", 400, "MISSING_TITLE");
    }
    if (!dto.content || !dto.content.trim()) {
      throw new AppError("content is required", 400, "MISSING_CONTENT");
    }

    const memory = await db.forgeAiProjectMemory.create({
      data: {
        projectId: dto.projectId,
        workspaceId: dto.workspaceId || null,
        type: dto.type,
        title: dto.title.trim(),
        content: dto.content.trim(),
        metadata: dto.metadata || {},
        source: dto.source || "USER",
        provenance: dto.provenance || { source: dto.source || "USER", timestamp: new Date().toISOString() },
        confidence: dto.confidence ?? 1.0,
        status: "ACTIVE",
        severity: dto.severity || "WARNING",
        version: 1,
        tags: dto.tags || [],
        relatedFiles: dto.relatedFiles || [],
        relatedSymbols: dto.relatedSymbols || [],
        relatedModules: dto.relatedModules || [],
        createdBy: dto.createdBy || null,
      },
    });

    return memory;
  }

  /**
   * Get memory by ID
   */
  public async getMemory(memoryId: string): Promise<ProjectMemoryEntity | null> {
    const memory = await db.forgeAiProjectMemory.findUnique({
      where: { id: memoryId },
    });
    return memory || null;
  }

  /**
   * List memories for project
   */
  public async listMemories(
    projectId: string,
    filters: {
      type?: string;
      status?: MemoryStatus;
      severity?: string;
      search?: string;
    } = {}
  ): Promise<ProjectMemoryEntity[]> {
    const where: any = { projectId };
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;
    if (filters.severity) where.severity = filters.severity;

    const memories: ProjectMemoryEntity[] = await db.forgeAiProjectMemory.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    if (filters.search) {
      const q = filters.search.toLowerCase();
      return memories.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.content.toLowerCase().includes(q) ||
          m.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }

    return memories;
  }

  /**
   * Update existing memory
   */
  public async updateMemory(memoryId: string, dto: UpdateMemoryDto): Promise<ProjectMemoryEntity> {
    const existing = await this.getMemory(memoryId);
    if (!existing) throw new AppError("Memory not found", 404, "MEMORY_NOT_FOUND");

    const updated = await db.forgeAiProjectMemory.update({
      where: { id: memoryId },
      data: {
        ...(dto.title && { title: dto.title.trim() }),
        ...(dto.content && { content: dto.content.trim() }),
        ...(dto.metadata && { metadata: dto.metadata }),
        ...(dto.severity && { severity: dto.severity }),
        ...(dto.tags && { tags: dto.tags }),
        ...(dto.relatedFiles && { relatedFiles: dto.relatedFiles }),
        ...(dto.relatedSymbols && { relatedSymbols: dto.relatedSymbols }),
        ...(dto.relatedModules && { relatedModules: dto.relatedModules }),
        version: existing.version + 1,
        updatedAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Supersede memory with an upgraded version
   */
  public async supersedeMemory(oldMemoryId: string, dto: CreateMemoryDto): Promise<{ old: ProjectMemoryEntity; new: ProjectMemoryEntity }> {
    const oldMem = await this.getMemory(oldMemoryId);
    if (!oldMem) throw new AppError("Original memory not found", 404, "MEMORY_NOT_FOUND");

    const newMem = await this.createMemory({
      ...dto,
      projectId: oldMem.projectId,
      type: dto.type || oldMem.type,
      tags: dto.tags || oldMem.tags,
      relatedFiles: dto.relatedFiles || oldMem.relatedFiles,
    });

    const updatedOld = await db.forgeAiProjectMemory.update({
      where: { id: oldMemoryId },
      data: {
        status: "SUPERSEDED",
        supersededBy: newMem.id,
        updatedAt: new Date(),
      },
    });

    await db.forgeAiProjectMemory.update({
      where: { id: newMem.id },
      data: {
        supersedes: oldMemoryId,
        version: oldMem.version + 1,
      },
    });

    return { old: updatedOld, new: newMem };
  }

  /**
   * Revoke a memory rule
   */
  public async revokeMemory(memoryId: string, reason?: string): Promise<ProjectMemoryEntity> {
    const mem = await this.getMemory(memoryId);
    if (!mem) throw new AppError("Memory not found", 404, "MEMORY_NOT_FOUND");

    const updated = await db.forgeAiProjectMemory.update({
      where: { id: memoryId },
      data: {
        status: "REVOKED",
        metadata: { ...mem.metadata, revocationReason: reason || "Revoked by user" },
        updatedAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Archive memory
   */
  public async archiveMemory(memoryId: string): Promise<ProjectMemoryEntity> {
    const mem = await this.getMemory(memoryId);
    if (!mem) throw new AppError("Memory not found", 404, "MEMORY_NOT_FOUND");

    return await db.forgeAiProjectMemory.update({
      where: { id: memoryId },
      data: { status: "ARCHIVED", updatedAt: new Date() },
    });
  }
}

export const projectMemoryService = new ProjectMemoryService();
