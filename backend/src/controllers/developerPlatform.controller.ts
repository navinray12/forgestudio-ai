/**
 * ForgeStudio Modules 57–61: Developer Platform Controller
 *
 * Implements production REST APIs for:
 * - Module 57: Collaborative Development (Presence, Sessions, Comments, Mentions, Reviews, Shared Previews, 3-Way Conflict Resolution, Activity Timeline)
 * - Module 58: Forge Extension & Plugin SDK (Discovery, Verification, Lifecycle, Hooks, AI Tools, Signing & Trust)
 * - Module 59: Project Import & Migration (Pipeline, Framework/Runtime/Lockfile Detection, Staging, Execution, Rollback)
 * - Module 60: Monorepo & Multi-service Support (Workspace Discovery, Dependency Graph, Affected Analysis, Coordinated Deployment)
 * - Module 61: Container & Infrastructure Tooling (Dockerfile Generator, Container Build/Run Sandbox, Compose, Kubernetes, Terraform, Secret Scan)
 */

import { Request, Response, NextFunction } from "express";
import { collaborationEngineService } from "../modules/collaboration/collaborationEngine.service.js";
import { commentThreadService } from "../modules/collaboration/commentThread.service.js";
import { reviewRequestService } from "../modules/collaboration/reviewRequest.service.js";
import { pluginLifecycleService } from "../modules/extensions/pluginLifecycle.service.js";
import { repositoryAcquisitionService } from "../modules/import-migration/repositoryAcquisition.service.js";
import { monorepoDiscoveryService } from "../modules/monorepo/monorepoDiscovery.service.js";
import { dockerfileGeneratorService } from "../modules/containers/dockerfileGenerator.js";

function paramStr(param: string | string[] | undefined, fallback: string = ""): string {
  if (Array.isArray(param)) return param[0] ?? fallback;
  return param ?? fallback;
}

export class DeveloperPlatformController {
  // =========================================================================
  // MODULE 57: Collaborative Development
  // =========================================================================

  static async getActiveSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = paramStr(req.params.id);
      const sessions = await collaborationEngineService.getActiveSessions(projectId);
      res.json({ success: true, sessions });
    } catch (err) {
      next(err);
    }
  }

  static async heartbeatSession(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = paramStr(req.params.id);
      const user = (req as any).user;
      const session = await collaborationEngineService.heartbeatSession(
        projectId,
        user?.id || req.body.userId || "anonymous",
        req.body
      );
      res.json({ success: true, session });
    } catch (err) {
      next(err);
    }
  }

  static async closeSession(req: Request, res: Response, next: NextFunction) {
    try {
      const sessionId = paramStr(req.params.sessionId);
      await collaborationEngineService.closeSession(sessionId);
      res.json({ success: true, message: "Session closed successfully" });
    } catch (err) {
      next(err);
    }
  }

  static async detectFileConflict(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = paramStr(req.params.id);
      const user = (req as any).user;
      const { filePath, baseRevisionId, incomingContent } = req.body;
      const result = await collaborationEngineService.detectConflict(
        projectId,
        filePath,
        baseRevisionId,
        incomingContent,
        user?.id || req.body.userId || "anonymous"
      );
      res.json({ success: true, result });
    } catch (err) {
      next(err);
    }
  }

  static async resolveFileConflict(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = paramStr(req.params.id);
      const user = (req as any).user;
      const { conflictId, resolutionStrategy, resolvedContent } = req.body;
      const result = await collaborationEngineService.resolveConflict(
        conflictId,
        resolutionStrategy,
        resolvedContent,
        projectId,
        user?.id || "anonymous"
      );
      res.json({ success: true, result });
    } catch (err) {
      next(err);
    }
  }

  static async listComments(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = paramStr(req.params.id);
      const filePath = req.query.filePath as string | undefined;
      const comments = await commentThreadService.listComments(projectId, filePath);
      res.json({ success: true, comments });
    } catch (err) {
      next(err);
    }
  }

  static async createComment(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = paramStr(req.params.id);
      const user = (req as any).user;
      const comment = await commentThreadService.createComment(projectId, {
        ...req.body,
        authorId: user?.id || req.body.authorId || "anonymous",
      });
      res.status(201).json({ success: true, comment });
    } catch (err) {
      next(err);
    }
  }

  static async replyComment(req: Request, res: Response, next: NextFunction) {
    try {
      const commentId = paramStr(req.params.commentId);
      const user = (req as any).user;
      const comment = await commentThreadService.replyComment(commentId, {
        ...req.body,
        authorId: user?.id || req.body.authorId || "anonymous",
      });
      res.status(201).json({ success: true, comment });
    } catch (err) {
      next(err);
    }
  }

  static async resolveComment(req: Request, res: Response, next: NextFunction) {
    try {
      const commentId = paramStr(req.params.commentId);
      const comment = await commentThreadService.resolveComment(commentId);
      res.json({ success: true, comment });
    } catch (err) {
      next(err);
    }
  }

  static async listReviews(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = paramStr(req.params.id);
      const reviews = await reviewRequestService.listReviews(projectId);
      res.json({ success: true, reviews });
    } catch (err) {
      next(err);
    }
  }

  static async createReview(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = paramStr(req.params.id);
      const user = (req as any).user;
      const review = await reviewRequestService.createReview(projectId, {
        ...req.body,
        requesterId: user?.id || req.body.requesterId || "anonymous",
      });
      res.status(201).json({ success: true, review });
    } catch (err) {
      next(err);
    }
  }

  static async submitReviewDecision(req: Request, res: Response, next: NextFunction) {
    try {
      const reviewId = paramStr(req.params.reviewId);
      const user = (req as any).user;
      const { status, comment } = req.body;
      const review = await reviewRequestService.submitReviewDecision(
        reviewId,
        user?.id || req.body.reviewerId || "anonymous",
        status,
        comment
      );
      res.json({ success: true, review });
    } catch (err) {
      next(err);
    }
  }

  static async createPreviewSession(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = paramStr(req.params.id);
      const user = (req as any).user;
      const session = await collaborationEngineService.createPreviewSession(
        projectId,
        user?.id || "anonymous",
        req.body
      );
      res.status(201).json({ success: true, session });
    } catch (err) {
      next(err);
    }
  }

  static async getPreviewSession(req: Request, res: Response, next: NextFunction) {
    try {
      const sessionId = paramStr(req.params.sessionId);
      const session = await collaborationEngineService.getPreviewSession(sessionId);
      res.json({ success: true, session });
    } catch (err) {
      next(err);
    }
  }

  static async getActivityTimeline(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = paramStr(req.params.id);
      const limit = parseInt(req.query.limit as string) || 50;
      const activities = await collaborationEngineService.getActivityTimeline(projectId, limit);
      res.json({ success: true, activities });
    } catch (err) {
      next(err);
    }
  }

  // =========================================================================
  // MODULE 58: Forge Extension & Plugin SDK
  // =========================================================================

  static async listPlugins(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = paramStr(req.params.id);
      const plugins = await pluginLifecycleService.listPlugins(projectId);
      res.json({ success: true, plugins });
    } catch (err) {
      next(err);
    }
  }

  static async installPlugin(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = paramStr(req.params.id);
      const user = (req as any).user;
      const plugin = await pluginLifecycleService.installPlugin(
        projectId,
        req.body.manifest,
        user?.id || "anonymous"
      );
      res.status(201).json({ success: true, plugin });
    } catch (err) {
      next(err);
    }
  }

  static async enablePlugin(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = paramStr(req.params.id);
      const pluginId = paramStr(req.params.pluginId);
      const plugin = await pluginLifecycleService.enablePlugin(projectId, pluginId);
      res.json({ success: true, plugin });
    } catch (err) {
      next(err);
    }
  }

  static async disablePlugin(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = paramStr(req.params.id);
      const pluginId = paramStr(req.params.pluginId);
      const plugin = await pluginLifecycleService.disablePlugin(projectId, pluginId);
      res.json({ success: true, plugin });
    } catch (err) {
      next(err);
    }
  }

  static async uninstallPlugin(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = paramStr(req.params.id);
      const pluginId = paramStr(req.params.pluginId);
      await pluginLifecycleService.uninstallPlugin(projectId, pluginId);
      res.json({ success: true, message: "Plugin uninstalled successfully" });
    } catch (err) {
      next(err);
    }
  }

  static async executePluginHook(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = paramStr(req.params.id);
      const { hookName, context } = req.body;
      const results = await pluginLifecycleService.executeHook(projectId, hookName, context);
      res.json({ success: true, results });
    } catch (err) {
      next(err);
    }
  }

  static async executePluginAiTool(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = paramStr(req.params.id);
      const { pluginId, toolName, params } = req.body;
      const result = await pluginLifecycleService.executeAiTool(projectId, pluginId, toolName, params);
      res.json({ success: true, result });
    } catch (err) {
      next(err);
    }
  }

  // =========================================================================
  // MODULE 59: Project Import & Migration
  // =========================================================================

  static async startImport(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = paramStr(req.params.id);
      const user = (req as any).user;
      const job = await repositoryAcquisitionService.startImport(projectId, req.body, user?.id || "anonymous");
      res.status(202).json({ success: true, job });
    } catch (err) {
      next(err);
    }
  }

  static async getImportStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const jobId = paramStr(req.params.jobId);
      const job = await repositoryAcquisitionService.getImportJob(jobId);
      res.json({ success: true, job });
    } catch (err) {
      next(err);
    }
  }

  static async commitImport(req: Request, res: Response, next: NextFunction) {
    try {
      const jobId = paramStr(req.params.jobId);
      const projectId = paramStr(req.params.id);
      const result = await repositoryAcquisitionService.commitImportToProject(jobId, projectId);
      res.json({ success: true, result });
    } catch (err) {
      next(err);
    }
  }

  // =========================================================================
  // MODULE 60: Monorepo & Multi-service Support
  // =========================================================================

  static async discoverMonorepo(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = paramStr(req.params.id);
      const graph = await monorepoDiscoveryService.discoverMonorepo(projectId);
      res.json({ success: true, graph });
    } catch (err) {
      next(err);
    }
  }

  static async getAffectedPackages(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = paramStr(req.params.id);
      const changedFiles = Array.isArray(req.body.changedFiles) ? req.body.changedFiles : [];
      const affected = await monorepoDiscoveryService.findAffectedPackages(projectId, changedFiles);
      res.json({ success: true, affected });
    } catch (err) {
      next(err);
    }
  }

  static async generateCoordinatedDeployPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = paramStr(req.params.id);
      const targetServices = Array.isArray(req.body.targetServices) ? req.body.targetServices : undefined;
      const plan = await monorepoDiscoveryService.generateDeployPlan(projectId, targetServices);
      res.json({ success: true, plan });
    } catch (err) {
      next(err);
    }
  }

  // =========================================================================
  // MODULE 61: Container & Infrastructure Tooling
  // =========================================================================

  static async getDockerfile(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = paramStr(req.params.id);
      const definition = await dockerfileGeneratorService.detectDockerfile(projectId);
      res.json({ success: true, definition });
    } catch (err) {
      next(err);
    }
  }

  static async generateDockerfile(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = paramStr(req.params.id);
      const dockerfile = await dockerfileGeneratorService.generateDockerfile(projectId, req.body);
      res.json({ success: true, dockerfile });
    } catch (err) {
      next(err);
    }
  }

  static async buildContainer(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = paramStr(req.params.id);
      const user = (req as any).user;
      const build = await dockerfileGeneratorService.triggerContainerBuild(
        projectId,
        req.body,
        user?.id || "anonymous"
      );
      res.status(202).json({ success: true, build });
    } catch (err) {
      next(err);
    }
  }

  static async runContainer(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = paramStr(req.params.id);
      const run = await dockerfileGeneratorService.startContainer(projectId, req.body);
      res.status(201).json({ success: true, run });
    } catch (err) {
      next(err);
    }
  }

  static async listContainers(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = paramStr(req.params.id);
      const runs = await dockerfileGeneratorService.listContainers(projectId);
      res.json({ success: true, runs });
    } catch (err) {
      next(err);
    }
  }

  static async stopContainer(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = paramStr(req.params.id);
      const runId = paramStr(req.params.runId);
      const stopped = await dockerfileGeneratorService.stopContainer(projectId, runId);
      res.json({ success: true, stopped });
    } catch (err) {
      next(err);
    }
  }

  static async getCompose(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = paramStr(req.params.id);
      const compose = await dockerfileGeneratorService.getDockerCompose(projectId);
      res.json({ success: true, compose });
    } catch (err) {
      next(err);
    }
  }

  static async generateKubernetes(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = paramStr(req.params.id);
      const manifests = await dockerfileGeneratorService.generateKubernetesManifests(projectId, req.body);
      res.json({ success: true, manifests });
    } catch (err) {
      next(err);
    }
  }

  static async generateTerraform(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = paramStr(req.params.id);
      const tf = await dockerfileGeneratorService.generateTerraform(projectId, req.body);
      res.json({ success: true, terraform: tf });
    } catch (err) {
      next(err);
    }
  }

  static async validateInfrastructure(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = paramStr(req.params.id);
      const result = await dockerfileGeneratorService.validateInfrastructure(projectId);
      res.json({ success: true, result });
    } catch (err) {
      next(err);
    }
  }
}
