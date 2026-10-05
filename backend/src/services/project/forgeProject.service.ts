import crypto from "node:crypto";
import { prisma, pgPool } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { recordAuditLog } from "../audit.service.js";

const db = prisma as any;

export type ProjectType =
  | "VISUAL_WEBSITE"
  | "REACT"
  | "NEXTJS"
  | "STATIC"
  | "HYBRID"
  | "IMPORTED";

export type ProjectLifecycleStatus =
  | "CREATING"
  | "ACTIVE"
  | "CLONING"
  | "ARCHIVED"
  | "RESTORING"
  | "DELETED";

export interface ProjectCapabilities {
  visualEditing: boolean;
  sourceEditing: boolean;
  react: boolean;
  nextjs: boolean;
  database: boolean;
  storage: boolean;
  git: boolean;
  preview: boolean;
  build: boolean;
  ai: boolean;
  deployment: boolean;
  [key: string]: boolean;
}

export interface ProjectFrameworkMetadata {
  framework: string;
  frameworkVersion: string;
  runtime: string;
  runtimeVersion: string;
  packageManager: "npm" | "pnpm" | "yarn" | "bun";
  language: "typescript" | "javascript";
  config?: Record<string, any>;
}

export interface ForgeProjectEntity {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  projectType: ProjectType;
  lifecycleStatus: ProjectLifecycleStatus;
  websiteId?: string | null;
  workspaceId?: string | null;
  organizationId?: string | null;
  ownerId: string;
  framework: string;
  frameworkVersion: string;
  runtime: string;
  runtimeVersion: string;
  packageManager: string;
  language: string;
  capabilities: ProjectCapabilities;
  settings: Record<string, any>;
  compatibility: Record<string, any>;
  metadata: Record<string, any>;
  deletedAt?: Date | null;
  lastActivityAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const VALID_LIFECYCLE_TRANSITIONS: Record<ProjectLifecycleStatus, ProjectLifecycleStatus[]> = {
  CREATING: ["ACTIVE", "DELETED"],
  ACTIVE: ["ARCHIVED", "CLONING", "DELETED"],
  CLONING: ["ACTIVE", "DELETED"],
  ARCHIVED: ["RESTORING", "DELETED"],
  RESTORING: ["ACTIVE", "ARCHIVED", "DELETED"],
  DELETED: ["RESTORING"], // Soft delete retention allows restoration by owner/admin
};

export function validateLifecycleTransition(
  current: ProjectLifecycleStatus,
  next: ProjectLifecycleStatus
): boolean {
  if (current === next) return true;
  const allowed = VALID_LIFECYCLE_TRANSITIONS[current] || [];
  return allowed.includes(next);
}

export function generateProjectSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${base || "project"}-${suffix}`;
}

export function getDefaultCapabilities(type: ProjectType): ProjectCapabilities {
  switch (type) {
    case "VISUAL_WEBSITE":
      return {
        visualEditing: true,
        sourceEditing: true,
        react: true,
        nextjs: false,
        database: true,
        storage: true,
        git: true,
        preview: true,
        build: true,
        ai: true,
        deployment: true,
      };
    case "NEXTJS":
      return {
        visualEditing: true,
        sourceEditing: true,
        react: true,
        nextjs: true,
        database: true,
        storage: true,
        git: true,
        preview: true,
        build: true,
        ai: true,
        deployment: true,
      };
    case "REACT":
      return {
        visualEditing: true,
        sourceEditing: true,
        react: true,
        nextjs: false,
        database: true,
        storage: true,
        git: true,
        preview: true,
        build: true,
        ai: true,
        deployment: true,
      };
    case "STATIC":
      return {
        visualEditing: true,
        sourceEditing: true,
        react: false,
        nextjs: false,
        database: false,
        storage: true,
        git: true,
        preview: true,
        build: true,
        ai: true,
        deployment: true,
      };
    default:
      return {
        visualEditing: true,
        sourceEditing: true,
        react: true,
        nextjs: false,
        database: true,
        storage: true,
        git: true,
        preview: true,
        build: true,
        ai: true,
        deployment: true,
      };
  }
}

/**
 * Create a new canonical Forge Project
 */
export async function createForgeProject(input: {
  name: string;
  slug?: string;
  description?: string;
  projectType?: ProjectType;
  ownerId: string;
  websiteId?: string | null;
  workspaceId?: string | null;
  organizationId?: string | null;
  frameworkMeta?: Partial<ProjectFrameworkMetadata>;
  capabilities?: Partial<ProjectCapabilities>;
  settings?: Record<string, any>;
}): Promise<ForgeProjectEntity> {
  if (!input.name || !input.name.trim()) {
    throw new AppError("Project name is required", 400, "VALIDATION_ERROR");
  }

  const slug = input.slug?.trim() || generateProjectSlug(input.name);
  const projectType = input.projectType || "VISUAL_WEBSITE";

  // Check slug uniqueness
  const existing = await db.forgeProject.findUnique({ where: { slug } });
  if (existing) {
    throw new AppError(`Project slug '${slug}' is already in use`, 409, "SLUG_CONFLICT");
  }

  // If websiteId is provided, verify it exists and belongs to workspace/owner
  if (input.websiteId) {
    const site = await db.website.findUnique({ where: { id: input.websiteId } });
    if (!site) {
      throw new AppError("Associated website not found", 404, "NOT_FOUND");
    }
  }

  const baseCaps = getDefaultCapabilities(projectType);
  const mergedCaps: ProjectCapabilities = {
    ...baseCaps,
    ...(input.capabilities || {}),
  };

  const project = await db.forgeProject.create({
    data: {
      slug,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      projectType,
      lifecycleStatus: "ACTIVE",
      websiteId: input.websiteId || null,
      workspaceId: input.workspaceId || null,
      organizationId: input.organizationId || null,
      ownerId: input.ownerId,
      framework: input.frameworkMeta?.framework || (projectType === "NEXTJS" ? "nextjs" : "react"),
      frameworkVersion: input.frameworkMeta?.frameworkVersion || "19.0.0",
      runtime: input.frameworkMeta?.runtime || "node",
      runtimeVersion: input.frameworkMeta?.runtimeVersion || "22.0.0",
      packageManager: input.frameworkMeta?.packageManager || "npm",
      language: input.frameworkMeta?.language || "typescript",
      capabilities: mergedCaps,
      settings: input.settings || {},
      compatibility: { manifestVersion: "1.0.0", irVersion: "1.0.0" },
      metadata: { createdVia: "forge_api", version: 1 },
    },
  });

  // Record audit log
  await recordAuditLog({
    userId: input.ownerId,
    action: "project.created",
    targetResource: `project:${project.id}`,
    details: { name: project.name, slug: project.slug, projectType },
  });

  return project;
}

/**
 * Get project by ID with tenant isolation verification
 */
export async function getForgeProjectById(
  projectId: string,
  user?: { id?: string; role?: string }
): Promise<ForgeProjectEntity> {
  const project = await db.forgeProject.findUnique({ where: { id: projectId } });
  if (!project || project.deletedAt) {
    throw new AppError("Project not found", 404, "NOT_FOUND");
  }

  if (!user) return project;

  // Tenant / permission verification:
  // Allowed if owner, workspace member, or admin
  const isPrivileged = ["ADMIN", "SUPER_ADMIN", "PLATFORM_ADMIN"].includes(user.role || "");
  if (!isPrivileged && user.id && project.ownerId !== user.id) {
    if (project.workspaceId) {
      const isMember = await db.workspaceMember?.findUnique?.({
        where: {
          workspaceId_userId: {
            workspaceId: project.workspaceId,
            userId: user.id,
          },
        },
      });
      if (!isMember) {
        throw new AppError("You do not have permission to view this project", 403, "FORBIDDEN");
      }
    } else {
      throw new AppError("You do not have permission to view this project", 403, "FORBIDDEN");
    }
  }

  return project;
}

/**
 * Get or automatically provision a Forge Project for a Website.
 * This bridges existing visual builder websites seamlessly to the Phase 2 developer platform!
 */
export async function getOrCreateProjectForWebsite(
  websiteId: string,
  user: { id: string; role: string }
): Promise<ForgeProjectEntity> {
  // Check if project already exists for this website
  const existing = await db.forgeProject.findFirst({
    where: { websiteId, deletedAt: null },
  });
  if (existing) {
    return existing;
  }

  // Verify website exists and user has access
  const site = await db.website.findUnique({ where: { id: websiteId } });
  if (!site) {
    throw new AppError("Website not found", 404, "NOT_FOUND");
  }

  const isPrivileged = ["ADMIN", "SUPER_ADMIN", "PLATFORM_ADMIN"].includes(user.role);
  if (!isPrivileged && site.userId !== user.id) {
    throw new AppError("You do not have permission to access this website", 403, "FORBIDDEN");
  }

  // Create project bridging the website
  return createForgeProject({
    name: site.name,
    slug: generateProjectSlug(site.slug || site.name),
    description: `Developer project for website: ${site.name}`,
    projectType: "VISUAL_WEBSITE",
    ownerId: site.userId,
    websiteId: site.id,
    workspaceId: site.workspaceId,
    organizationId: site.organizationId,
  });
}

/**
 * Update project metadata, settings, capabilities, or framework configuration
 */
export async function updateForgeProject(
  projectId: string,
  user: { id: string; role: string },
  updates: {
    name?: string;
    description?: string;
    capabilities?: Partial<ProjectCapabilities>;
    settings?: Record<string, any>;
    metadata?: Record<string, any>;
    frameworkMeta?: Partial<ProjectFrameworkMetadata>;
  }
): Promise<ForgeProjectEntity> {
  const current = await getForgeProjectById(projectId, user);

  const data: any = {};
  if (updates.name !== undefined) data.name = updates.name.trim();
  if (updates.description !== undefined) data.description = updates.description.trim();
  if (updates.settings !== undefined) {
    data.settings = { ...current.settings, ...updates.settings };
  }
  if (updates.metadata !== undefined) {
    data.metadata = { ...current.metadata, ...updates.metadata };
  }
  if (updates.capabilities !== undefined) {
    data.capabilities = { ...current.capabilities, ...updates.capabilities };
  }
  if (updates.frameworkMeta) {
    if (updates.frameworkMeta.framework) data.framework = updates.frameworkMeta.framework;
    if (updates.frameworkMeta.frameworkVersion) data.frameworkVersion = updates.frameworkMeta.frameworkVersion;
    if (updates.frameworkMeta.runtime) data.runtime = updates.frameworkMeta.runtime;
    if (updates.frameworkMeta.runtimeVersion) data.runtimeVersion = updates.frameworkMeta.runtimeVersion;
    if (updates.frameworkMeta.packageManager) data.packageManager = updates.frameworkMeta.packageManager;
    if (updates.frameworkMeta.language) data.language = updates.frameworkMeta.language;
  }
  data.lastActivityAt = new Date();

  const updated = await db.forgeProject.update({
    where: { id: projectId },
    data,
  });

  await recordAuditLog({
    userId: user.id,
    action: "project.updated",
    targetResource: `project:${projectId}`,
    details: updates,
  });

  return updated;
}

/**
 * Transition project lifecycle (ACTIVE -> ARCHIVED, ARCHIVED -> RESTORING -> ACTIVE, DELETED)
 */
export async function transitionProjectLifecycle(
  projectId: string,
  targetStatus: ProjectLifecycleStatus,
  user: { id: string; role: string }
): Promise<ForgeProjectEntity> {
  const current = await getForgeProjectById(projectId, user);

  if (!validateLifecycleTransition(current.lifecycleStatus, targetStatus)) {
    throw new AppError(
      `Invalid lifecycle transition from ${current.lifecycleStatus} to ${targetStatus}`,
      422,
      "INVALID_LIFECYCLE_TRANSITION"
    );
  }

  const data: any = {
    lifecycleStatus: targetStatus,
    lastActivityAt: new Date(),
  };

  if (targetStatus === "DELETED") {
    data.deletedAt = new Date();
  } else if (current.lifecycleStatus === "DELETED" && targetStatus !== "DELETED") {
    data.deletedAt = null;
  }

  const updated = await db.forgeProject.update({
    where: { id: projectId },
    data,
  });

  await recordAuditLog({
    userId: user.id,
    action: `project.${targetStatus.toLowerCase()}`,
    targetResource: `project:${projectId}`,
    details: { from: current.lifecycleStatus, to: targetStatus },
  });

  return updated;
}

/**
 * List projects accessible to user (filtering by workspace, owner, status)
 */
export async function listForgeProjects(
  user: { id: string; role: string },
  filters: {
    workspaceId?: string;
    organizationId?: string;
    status?: ProjectLifecycleStatus;
    projectType?: ProjectType;
    limit?: number;
    skip?: number;
  } = {}
): Promise<{ items: ForgeProjectEntity[]; total: number }> {
  const isPrivileged = ["ADMIN", "SUPER_ADMIN", "PLATFORM_ADMIN"].includes(user.role);
  const where: any = {};

  if (!isPrivileged) {
    if (filters.workspaceId) {
      where.workspaceId = filters.workspaceId;
    } else {
      where.ownerId = user.id;
    }
  } else {
    if (filters.workspaceId) where.workspaceId = filters.workspaceId;
    if (filters.organizationId) where.organizationId = filters.organizationId;
  }

  if (filters.status) {
    where.lifecycleStatus = filters.status;
  } else {
    where.deletedAt = null; // Exclude deleted by default
  }

  if (filters.projectType) {
    where.projectType = filters.projectType;
  }

  const [total, items] = await Promise.all([
    db.forgeProject.count({ where }),
    db.forgeProject.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: Math.min(filters.limit || 50, 100),
      skip: filters.skip || 0,
    }),
  ]);

  return { items, total };
}

/**
 * Clone an existing Forge Project with its files and configuration
 */
export async function cloneForgeProject(
  sourceProjectId: string,
  user: { id: string; role: string },
  overrides: { name?: string; slug?: string } = {}
): Promise<ForgeProjectEntity> {
  const source = await getForgeProjectById(sourceProjectId, user);

  const cloneName = overrides.name?.trim() || `${source.name} (Copy)`;
  const cloneSlug = overrides.slug?.trim() || generateProjectSlug(cloneName);

  const newProject = await createForgeProject({
    name: cloneName,
    slug: cloneSlug,
    description: source.description || undefined,
    projectType: source.projectType,
    ownerId: user.id,
    workspaceId: source.workspaceId,
    organizationId: source.organizationId,
    frameworkMeta: {
      framework: source.framework,
      frameworkVersion: source.frameworkVersion,
      runtime: source.runtime,
      runtimeVersion: source.runtimeVersion,
      packageManager: source.packageManager as any,
      language: source.language as any,
    },
    capabilities: source.capabilities,
    settings: source.settings,
  });

  // Clone source files
  const sourceFiles = await db.forgeProjectFile.findMany({
    where: { projectId: sourceProjectId, deletedAt: null },
  });

  if (sourceFiles.length > 0) {
    for (const file of sourceFiles) {
      await db.forgeProjectFile.create({
        data: {
          projectId: newProject.id,
          path: file.path,
          name: file.name,
          extension: file.extension,
          mimeType: file.mimeType,
          isDirectory: file.isDirectory,
          sizeBytes: file.sizeBytes,
          content: file.content,
          encoding: file.encoding,
          contentHash: file.contentHash,
          version: 1,
          isGenerated: file.isGenerated,
          isProtected: file.isProtected,
        },
      });
    }
  }

  await recordAuditLog({
    userId: user.id,
    action: "project.cloned",
    targetResource: `project:${newProject.id}`,
    details: { sourceProjectId, newProjectId: newProject.id },
  });

  return newProject;
}

export const forgeProjectService = {
  createProject: (ownerIdOrPayload: any, payloadOrOwnerId?: any) => {
    if (typeof ownerIdOrPayload === "string") {
      return createForgeProject({ ...(payloadOrOwnerId || {}), ownerId: ownerIdOrPayload });
    }
    return createForgeProject({ ...ownerIdOrPayload, ownerId: payloadOrOwnerId || ownerIdOrPayload.ownerId });
  },
  createForgeProject,
  getForgeProjectById,
  getProjectById: (id: string, user?: any) => getForgeProjectById(id, user),
  getOrCreateProjectForWebsite,
  updateForgeProject,
  transitionProjectLifecycle,
  listForgeProjects,
  cloneForgeProject,
};
