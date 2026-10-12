/**
 * Point 07: Generation Controller
 * Exposes REST API endpoints for the reliable generation pipeline.
 */

import { Request, Response } from "express";
import { generationEngineService } from "../services/generation/generationEngine.service.js";
import { generationJobStateMachine } from "../services/generation/generationJobStateMachine.service.js";
import { budgetReservationService } from "../services/generation/budgetReservation.service.js";
import { deterministicRegenerationService } from "../services/generation/deterministicRegeneration.service.js";
import { generationDiagnosticsService } from "../services/generation/generationDiagnostics.service.js";
import { boundedRepairController } from "../services/generation/boundedRepairController.service.js";

export class GenerationController {
  /**
   * POST /api/generation/jobs
   * Start a reliable generation job.
   */
  public async createJob(req: Request, res: Response): Promise<void> {
    try {
      const { websiteId, tenantId, brief, preferredModelId, idempotencyKey } = req.body;
      const callerRole = (req as any).user?.role || "OWNER";
      const jobId = `gen-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      const { job, reservation, snapshot } = await generationEngineService.initiateGeneration({
        jobId,
        websiteId,
        tenantId: tenantId || "tenant-default",
        callerRole,
        idempotencyKey,
        brief,
        preferredModelId
      });

      res.status(201).json({
        success: true,
        data: {
          jobId: job.jobId,
          currentState: job.currentState,
          reservation: {
            reservedAmountCents: reservation.reservedAmountCents,
            status: reservation.status
          },
          snapshot: {
            snapshotHash: snapshot.snapshotHash,
            capturedAt: snapshot.capturedAt
          }
        }
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/generation/jobs/:jobId
   * Retrieve job status, budget usage, and candidate details.
   */
  public async getJob(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const job = generationJobStateMachine.getJob(jobId);
      const reservation = budgetReservationService.getReservation(jobId);
      const diagnostics = job.candidateId 
        ? generationDiagnosticsService.getDiagnosticsForCandidate(job.candidateId)
        : [];

      res.json({
        success: true,
        data: {
          job,
          reservation,
          diagnostics
        }
      });
    } catch (err: any) {
      res.status(404).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/generation/jobs/:jobId/cancel
   * Cancel an in-flight generation job.
   */
  public async cancelJob(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const { reason } = req.body;
      const job = generationJobStateMachine.cancelJob(jobId, reason);
      budgetReservationService.releaseReservation(jobId);

      res.json({ success: true, data: job });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/generation/jobs/:jobId/regenerate-offline
   * Trigger deterministic regeneration with zero AI provider calls.
   */
  public async regenerateOffline(req: Request, res: Response): Promise<void> {
    try {
      const { websiteId, tenantId, targetEnvironment } = req.body;
      const result = await deterministicRegenerationService.regenerateOffline({
        websiteId,
        tenantId: tenantId || "tenant-default",
        targetEnvironment
      });

      res.json({ success: result.success, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/generation/jobs/:jobId/override-budget
   * Platform policy owner budget override.
   */
  public async overrideBudget(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const { additionalAmountCents, reason } = req.body;
      const callerRole = (req as any).user?.role || "USER";
      const actorId = (req as any).user?.id || "actor-unknown";

      const updatedReservation = budgetReservationService.overrideBudget({
        jobId,
        additionalAmountCents,
        callerRole,
        reason,
        actorId
      });

      res.json({ success: true, data: updatedReservation });
    } catch (err: any) {
      res.status(403).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/generation/jobs/:jobId/diagnostics
   * Fetch structured actionable diagnostics for a candidate.
   */
  public async getDiagnostics(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const job = generationJobStateMachine.getJob(jobId);
      const diagnostics = job.candidateId 
        ? generationDiagnosticsService.getDiagnosticsForCandidate(job.candidateId)
        : [];

      res.json({ success: true, data: diagnostics });
    } catch (err: any) {
      res.status(404).json({ success: false, error: err.message });
    }
  }
}

export const generationController = new GenerationController();
