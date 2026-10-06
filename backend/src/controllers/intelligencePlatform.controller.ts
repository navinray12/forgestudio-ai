/**
 * ForgeStudio Modules 62–64: Intelligence Platform Controller
 * Optimization Engine, Project Checkpoint & Recovery, and Architecture Visualization.
 */

import { Request, Response, NextFunction } from "express";
import { optimizationEngineService } from "../modules/intelligence-platform/optimization/optimizationEngine.service.js";
import { projectRecoveryService } from "../modules/intelligence-platform/recovery/projectRecovery.service.js";
import { architectureVisualizationService } from "../modules/intelligence-platform/architecture-viz/architectureVisualization.service.js";

export class IntelligencePlatformController {
  // ------------------------------------------------------------
  // Module 62: Optimization Engine
  // ------------------------------------------------------------

  static async runOptimizationAudit(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = req.params.id as string;
      const audit = await optimizationEngineService.runOptimizationAudit(projectId);
      res.status(201).json({ success: true, audit });
    } catch (err) {
      next(err);
    }
  }

  static async getLatestAudit(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = req.params.id as string;
      const audit = await optimizationEngineService.getLatestAudit(projectId);
      res.json({ success: true, audit });
    } catch (err) {
      next(err);
    }
  }

  static async listAudits(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = req.params.id as string;
      const audits = await optimizationEngineService.listAudits(projectId);
      res.json({ success: true, audits });
    } catch (err) {
      next(err);
    }
  }

  static async generateAiOptimizationPatch(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = req.params.id as string;
      const recId = req.params.recId as string;
      const result = await optimizationEngineService.generateAiOptimizationPatch(
        projectId,
        recId
      );
      res.json({ success: true, patch: result });
    } catch (err) {
      next(err);
    }
  }

  // ------------------------------------------------------------
  // Module 63: Project Snapshot / Checkpoint / Recovery
  // ------------------------------------------------------------

  static async createCheckpoint(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = req.params.id as string;
      const checkpoint = await projectRecoveryService.createCheckpoint(
        projectId,
        req.body
      );
      res.status(201).json({ success: true, checkpoint });
    } catch (err) {
      next(err);
    }
  }

  static async listCheckpoints(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = req.params.id as string;
      const tag = req.query.tag as any;
      const checkpoints = await projectRecoveryService.listCheckpoints(projectId, tag);
      res.json({ success: true, checkpoints });
    } catch (err) {
      next(err);
    }
  }

  static async getCheckpoint(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = req.params.id as string;
      const checkpointId = req.params.checkpointId as string;
      const checkpoint = await projectRecoveryService.getCheckpoint(
        projectId,
        checkpointId
      );
      res.json({ success: true, checkpoint });
    } catch (err) {
      next(err);
    }
  }

  static async diffCheckpointWithWorkspace(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = req.params.id as string;
      const checkpointId = req.params.checkpointId as string;
      const diff = await projectRecoveryService.diffCheckpointWithWorkspace(
        projectId,
        checkpointId
      );
      res.json({ success: true, diff });
    } catch (err) {
      next(err);
    }
  }

  static async rollbackToCheckpoint(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = req.params.id as string;
      const checkpointId = req.params.checkpointId as string;
      const result = await projectRecoveryService.rollbackToCheckpoint(
        projectId,
        checkpointId,
        (req as any).user?.id
      );
      res.json({ success: true, rollback: result });
    } catch (err) {
      next(err);
    }
  }

  static async restoreSingleFile(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = req.params.id as string;
      const checkpointId = req.params.checkpointId as string;
      const filePath = req.body.filePath;
      const result = await projectRecoveryService.restoreSingleFile(
        projectId,
        checkpointId,
        filePath,
        (req as any).user?.id
      );
      res.json({ success: true, restored: result });
    } catch (err) {
      next(err);
    }
  }

  static async exportDisasterRecoveryBundle(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = req.params.id as string;
      const checkpointId = req.params.checkpointId as string;
      const bundle = await projectRecoveryService.exportDisasterRecoveryBundle(
        projectId,
        checkpointId
      );
      res.json({ success: true, bundle });
    } catch (err) {
      next(err);
    }
  }

  static async importDisasterRecoveryBundle(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = req.params.id as string;
      const result = await projectRecoveryService.importDisasterRecoveryBundle(
        projectId,
        req.body.bundle,
        (req as any).user?.id
      );
      res.json({ success: true, rollback: result });
    } catch (err) {
      next(err);
    }
  }

  // ------------------------------------------------------------
  // Module 64: Architecture Visualization
  // ------------------------------------------------------------

  static async getArchitectureGraph(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = req.params.id as string;
      const layer = (req.query.layer as any) || "ALL";
      const graph = await architectureVisualizationService.generateArchitectureGraph(
        projectId,
        layer
      );
      res.json({ success: true, graph });
    } catch (err) {
      next(err);
    }
  }
}
