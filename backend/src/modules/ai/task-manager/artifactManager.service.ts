/**
 * ForgeStudio Module 42: Artifact Manager Service
 */

import { prisma } from "../../../config/prisma.js";
import { ArtifactEntity } from "./taskManager.types.js";

const db = prisma as any;

export class ArtifactManagerService {
  /**
   * Record a generated engineering artifact
   */
  public async recordArtifact(params: {
    projectId: string;
    taskId?: string;
    runId?: string;
    stepId?: string;
    type: string;
    name: string;
    data: Record<string, any>;
  }): Promise<ArtifactEntity> {
    return await db.forgeAiArtifact.create({
      data: {
        projectId: params.projectId,
        taskId: params.taskId || null,
        runId: params.runId || null,
        stepId: params.stepId || null,
        type: params.type,
        name: params.name,
        data: params.data,
      },
    });
  }

  /**
   * List artifacts for a run
   */
  public async listArtifacts(runId: string): Promise<ArtifactEntity[]> {
    return await db.forgeAiArtifact.findMany({
      where: { runId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Get artifact by ID
   */
  public async getArtifact(artifactId: string): Promise<ArtifactEntity | null> {
    return await db.forgeAiArtifact.findUnique({
      where: { id: artifactId },
    });
  }
}

export const artifactManagerService = new ArtifactManagerService();
