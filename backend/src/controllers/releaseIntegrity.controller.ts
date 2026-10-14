/**
 * ForgeStudio Execution Blueprint v2.1 — Point 17: Release Integrity, Evidence and Change Safety
 * Controller Integration
 */

import { Request, Response } from "express";
import { tenantScopeOf } from "../middlewares/tenantScope.middleware.js";
import { AppError } from "../utils/app-error.js";
import { DurableReleaseController } from "../services/releaseIntegrity/durableReleaseController.service.js";
import { MandatoryReleaseGatesService } from "../services/releaseIntegrity/mandatoryReleaseGates.service.js";
import { ReleasePassportService } from "../services/releaseIntegrity/releasePassportService.service.js";

/** A release ID only counts within the website the request was scoped to; others look absent. */
function assertReleaseInScope(releaseId: string, res: Response) {
  const candidate = DurableReleaseController.getCandidate(releaseId);
  if (candidate.websiteId !== tenantScopeOf(res).websiteId) {
    throw new AppError(`Release ${releaseId} not found`, 404, "NOT_FOUND");
  }
}

export class ReleaseIntegrityController {
  public static async requestRelease(req: Request, res: Response) {
    try {
      const { tenantId, websiteId, version, immutableArtifactDigest, pinnedInputDigests } = req.body;
      const requestedBy = res.locals.user.id;
      const candidate = DurableReleaseController.requestRelease(
        tenantId,
        websiteId,
        version,
        immutableArtifactDigest,
        pinnedInputDigests,
        requestedBy
      );
      return res.status(201).json({ success: true, candidate });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message, code: err.code });
    }
  }

  public static async transitionReleaseState(req: Request, res: Response) {
    try {
      const { releaseId } = req.params as Record<string, string>;
      const { nextState, workerFencingToken } = req.body;
      assertReleaseInScope(releaseId, res);
      const candidate = DurableReleaseController.transitionState(releaseId, nextState, workerFencingToken || 1);
      return res.status(200).json({ success: true, candidate });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message, code: err.code });
    }
  }

  public static async evaluateMandatoryGates(req: Request, res: Response) {
    try {
      const result = MandatoryReleaseGatesService.evaluateAllMandatoryGates(req.body);
      return res.status(200).json({ success: true, evaluation: result });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message, code: err.code });
    }
  }

  public static async issuePassport(req: Request, res: Response) {
    try {
      const { releaseId, websiteId, tenantId, artifactDigest, gateAttestations } = req.body;
      const passport = ReleasePassportService.issueReleasePassport(
        releaseId,
        websiteId,
        tenantId,
        artifactDigest,
        gateAttestations,
        "TRUSTED_PLATFORM_VERIFIER"
      );
      return res.status(201).json({ success: true, passport });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message, code: err.code });
    }
  }

  public static async promoteRelease(req: Request, res: Response) {
    try {
      const { releaseId } = req.params as Record<string, string>;
      const { expectedCurrentReleaseId, verifiedArtifactDigest } = req.body;
      assertReleaseInScope(releaseId, res);
      const promoted = DurableReleaseController.promoteToActive(releaseId, expectedCurrentReleaseId, verifiedArtifactDigest);
      return res.status(200).json({ success: true, promoted });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message, code: err.code });
    }
  }

  public static async rollbackCode(req: Request, res: Response) {
    try {
      const { websiteId, targetKnownGoodReleaseId } = req.body;
      const rollback = DurableReleaseController.rollbackCodeOnly(websiteId, targetKnownGoodReleaseId);
      return res.status(200).json({ success: true, rollback });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message, code: err.code });
    }
  }
}
