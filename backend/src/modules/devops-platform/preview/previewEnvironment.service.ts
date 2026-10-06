/**
 * ForgeStudio Module 53: Preview Environment Manager Service
 * Manages ephemeral branch & pull request preview environments,
 * isolated database schemas, TTL auto-expiration, and promotions.
 */

import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";
import { forgeProjectService } from "../../../services/project/forgeProject.service.js";
import { forgeDatabaseService } from "../../data-platform/database/forgeDatabase.service.js";
import {
  PreviewEnvironmentRecord,
  PreviewEnvironmentStatus,
  CreatePreviewInput,
  UpdatePreviewInput,
  PromotionResult,
} from "./preview.types.js";

const db = prisma as any;

export class PreviewEnvironmentService {
  /**
   * Helper: Generate a deterministic slug from name/branch
   */
  private generateSlug(name: string, branch: string): string {
    const raw = `${branch}-${name}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    return (raw.slice(0, 36) || "preview") + "-" + Math.random().toString(36).slice(2, 6);
  }

  /**
   * List all preview environments for a project
   */
  async listPreviewEnvironments(projectId: string): Promise<PreviewEnvironmentRecord[]> {
    await forgeProjectService.getProjectById(projectId);

    const records = await db.forgePreviewEnvironment.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    // Check & update expired records on query
    const now = new Date();
    const results: PreviewEnvironmentRecord[] = [];

    for (const r of records) {
      if (r.status === "ACTIVE" && r.expiresAt && new Date(r.expiresAt) < now) {
        await db.forgePreviewEnvironment.update({
          where: { id: r.id },
          data: { status: "EXPIRED", updatedAt: now },
        });
        results.push({ ...r, status: "EXPIRED", updatedAt: now.toISOString() });
      } else {
        results.push(r);
      }
    }

    return results;
  }

  /**
   * Get a preview environment by ID or slug
   */
  async getPreviewEnvironment(
    projectId: string,
    envIdOrSlug: string
  ): Promise<PreviewEnvironmentRecord> {
    await forgeProjectService.getProjectById(projectId);

    const record = await db.forgePreviewEnvironment.findFirst({
      where: {
        projectId,
        OR: [{ id: envIdOrSlug }, { slug: envIdOrSlug }],
      },
    });

    if (!record) {
      throw new AppError("Preview environment not found", 404, "NOT_FOUND");
    }

    return record;
  }

  /**
   * Create an ephemeral preview environment
   */
  async createPreviewEnvironment(
    projectId: string,
    input: CreatePreviewInput
  ): Promise<PreviewEnvironmentRecord> {
    const project = await forgeProjectService.getProjectById(projectId);
    const ttlHours = input.ttlHours && input.ttlHours > 0 ? input.ttlHours : 72;
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    const slug = this.generateSlug(input.name, input.branch);
    const url = `https://${slug}.preview.${project.slug || "forge"}.internal`;

    // Ephemeral database branch provisioning if requested
    let databaseBranchId: string | null = null;
    if (input.cloneDatabase) {
      try {
        const databases = await forgeDatabaseService.listDatabases(projectId);
        if (databases.length > 0) {
          databaseBranchId = `${slug}_schema`;
        }
      } catch (err) {
        console.warn(`[PREVIEW] Optional DB branch creation skipped:`, err);
      }
    }

    const record = await db.forgePreviewEnvironment.create({
      data: {
        projectId,
        name: input.name,
        slug,
        branch: input.branch,
        pullRequestId: input.pullRequestId || null,
        url,
        status: "ACTIVE" as PreviewEnvironmentStatus,
        envVars: input.envVars || {},
        databaseBranchId,
        ttlHours,
        expiresAt,
        lastDeployedAt: new Date(),
      },
    });

    // Create an associated deployment record in forge_deployments
    try {
      await db.forgeDeployment.create({
        data: {
          projectId,
          environment: "preview",
          mode: "STATIC",
          status: "ACTIVE",
          branch: input.branch,
          url,
          config: {
            previewEnvId: record.id,
            envVars: input.envVars || {},
          },
          logs: [
            {
              timestamp: new Date().toISOString(),
              stage: "PREVIEW_PROVISION",
              level: "info",
              message: `Ephemeral preview environment ${record.slug} created for branch ${input.branch}`,
            },
          ],
        },
      });
    } catch (err) {
      console.warn("[PREVIEW] Deployment sync record notice:", err);
    }

    return record;
  }

  /**
   * Redeploy an existing preview environment
   */
  async deployPreviewEnvironment(
    projectId: string,
    envId: string
  ): Promise<PreviewEnvironmentRecord> {
    const existing = await this.getPreviewEnvironment(projectId, envId);

    const updated = await db.forgePreviewEnvironment.update({
      where: { id: existing.id },
      data: {
        status: "ACTIVE",
        lastDeployedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Extend the TTL of a preview environment
   */
  async extendTtl(
    projectId: string,
    envId: string,
    additionalHours: number
  ): Promise<PreviewEnvironmentRecord> {
    const existing = await this.getPreviewEnvironment(projectId, envId);
    const baseDate = new Date(existing.expiresAt) > new Date()
      ? new Date(existing.expiresAt)
      : new Date();
    const newExpiresAt = new Date(baseDate.getTime() + additionalHours * 60 * 60 * 1000);
    const newTtl = existing.ttlHours + additionalHours;

    const updated = await db.forgePreviewEnvironment.update({
      where: { id: existing.id },
      data: {
        expiresAt: newExpiresAt,
        ttlHours: newTtl,
        status: "ACTIVE",
        updatedAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Teardown / destroy an ephemeral preview environment
   */
  async teardownPreviewEnvironment(
    projectId: string,
    envId: string
  ): Promise<{ success: boolean; id: string }> {
    const existing = await this.getPreviewEnvironment(projectId, envId);

    await db.forgePreviewEnvironment.update({
      where: { id: existing.id },
      data: {
        status: "DESTROYED",
        updatedAt: new Date(),
      },
    });

    return { success: true, id: existing.id };
  }

  /**
   * Promote a preview environment to Staging or Production
   */
  async promotePreviewEnvironment(
    projectId: string,
    envId: string,
    targetEnvironment: "staging" | "production"
  ): Promise<PromotionResult> {
    const preview = await this.getPreviewEnvironment(projectId, envId);
    const project = await forgeProjectService.getProjectById(projectId);

    const targetUrl = targetEnvironment === "production"
      ? `https://${project.slug || "app"}.forge.live`
      : `https://${project.slug || "app"}-staging.forge.live`;

    const deployment = await db.forgeDeployment.create({
      data: {
        projectId,
        environment: targetEnvironment,
        mode: "STATIC",
        status: "ACTIVE",
        branch: preview.branch,
        url: targetUrl,
        config: {
          promotedFromPreviewId: preview.id,
          sourceBranch: preview.branch,
          envVars: preview.envVars,
        },
        logs: [
          {
            timestamp: new Date().toISOString(),
            stage: "PROMOTION",
            level: "info",
            message: `Promoted preview ${preview.slug} (${preview.branch}) directly to ${targetEnvironment.toUpperCase()}`,
          },
        ],
      },
    });

    return {
      sourceEnvironmentId: preview.id,
      targetEnvironment,
      deploymentId: deployment.id,
      url: targetUrl,
      status: "ACTIVE",
      promotedAt: new Date().toISOString(),
    };
  }
}

export const previewEnvironmentService = new PreviewEnvironmentService();
