/**
 * Point 08: Component Controller
 * Exposes REST API endpoints for component contracts, fidelity, quarantine imports, and 3-way reconciliation.
 */

import { Request, Response } from "express";
import { componentContractRegistry } from "../services/components/componentContractRegistry.service.js";
import { componentSupportStateService } from "../services/components/componentSupportState.service.js";
import { customSourceImportService } from "../services/components/customSourceImport.service.js";
import { threeWaySourceReconciliationService } from "../services/components/threeWaySourceReconciliation.service.js";
import { behavioralReviewGateService } from "../services/components/behavioralReviewGate.service.js";

export class ComponentController {
  /**
   * GET /api/components/contracts
   * Lists all versioned component contracts.
   */
  public listContracts(req: Request, res: Response): void {
    try {
      const target = req.query.target as any;
      const contracts = componentContractRegistry.listContracts(target);
      res.json({ success: true, count: contracts.length, data: contracts });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/components/contracts/:componentId
   * Retrieves specific component contract and version.
   */
  public getContract(req: Request, res: Response): void {
    try {
      const { componentId } = req.params;
      const version = req.query.version as string;
      const contract = componentContractRegistry.getContract(componentId, version);

      if (!contract) {
        res.status(404).json({ success: false, error: `Contract '${componentId}' not found` });
        return;
      }

      res.json({ success: true, data: contract });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/components/validate
   * Validates a component instance against its contract.
   */
  public validateInstance(req: Request, res: Response): void {
    try {
      const { componentId, props, version, target, slots } = req.body;
      const result = componentContractRegistry.validateInstance(componentId, props || {}, {
        version,
        target,
        slots
      });

      res.json({ success: result.isValid, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/components/source/import
   * Upload and quarantine-inspect custom JSX/TSX source.
   */
  public importSource(req: Request, res: Response): void {
    try {
      const { projectId, fileName, sourceContent, declaredLicense } = req.body;
      const tenantId = (req as any).user?.tenantId || "tenant-default";
      const uploaderId = (req as any).user?.id || "user-unknown";
      const importId = `imp-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      const result = customSourceImportService.inspectUploadedSource({
        importId,
        tenantId,
        projectId: projectId || "project-default",
        uploaderId,
        fileName,
        sourceContent,
        declaredLicense
      });

      const statusCode = result.isApproved ? 201 : 403;
      res.status(statusCode).json({ success: result.isApproved, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/components/source/reconcile
   * Performs base-aware three-way reconciliation.
   */
  public reconcileSource(req: Request, res: Response): void {
    try {
      const { websiteId, filePath, proposedContent } = req.body;
      const result = threeWaySourceReconciliationService.reconcileProposal({
        websiteId,
        filePath,
        proposedContent
      });

      res.json({ success: !result.regenerationLocked, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/components/source/conflicts/:websiteId
   * Retrieves active reconciliation conflicts for website.
   */
  public getConflicts(req: Request, res: Response): void {
    try {
      const { websiteId } = req.params;
      const conflicts = threeWaySourceReconciliationService.getActiveConflictsForWebsite(websiteId);
      res.json({ success: true, count: conflicts.length, data: conflicts });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/components/source/conflicts/:conflictId/resolve
   * Explicitly resolves an active source conflict.
   */
  public resolveConflict(req: Request, res: Response): void {
    try {
      const { conflictId } = req.params;
      const { choice, customContent } = req.body;
      const resolvedBy = (req as any).user?.id || "admin";

      const resolved = threeWaySourceReconciliationService.resolveConflict({
        conflictId,
        choice,
        customContent,
        resolvedBy
      });

      res.json({ success: true, data: resolved });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/components/behavior/review
   * Evaluates business logic changes and validates behavioral test evidence.
   */
  public reviewBehavior(req: Request, res: Response): void {
    try {
      const { candidateId, detectedChanges, submittedEvidence, isVisuallyApprovedOnly } = req.body;
      const result = behavioralReviewGateService.reviewReleaseChanges({
        candidateId,
        detectedChanges: detectedChanges || [],
        submittedEvidence: submittedEvidence || [],
        isVisuallyApprovedOnly: Boolean(isVisuallyApprovedOnly)
      });

      res.json({ success: result.isReleaseApproved, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
}

export const componentController = new ComponentController();
