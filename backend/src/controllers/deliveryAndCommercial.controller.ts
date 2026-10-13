/**
 * Delivery and Commercial Governance Controller
 *
 * Exposes endpoints for Points 24-28:
 * - /api/delivery-governance/stages (Delivery stages, capacity, critical path)
 * - /api/delivery-governance/test-program (Source registers, visual env, executable mutation test harness)
 * - /api/delivery-governance/commerce-webhook (Cross-domain commerce webhook routing)
 * - /api/delivery-governance/initiate-transfer (Cryptographically secure ownership transfer)
 * - /api/delivery-governance/complete-transfer (Transfer finalization with orphan prevention)
 * - /api/delivery-governance/past-due-status (Account past-due non-destructive lifecycle)
 * - /api/delivery-governance/capture-snapshot (Source and content snapshot capture)
 * - /api/delivery-governance/verify-snapshot (Byte-for-byte restore verification)
 * - /api/delivery-governance/legacy-retirement-check (10 legacy retirement gates)
 * - /api/delivery-governance/decisions (ADR register D-01..D-12)
 * - /api/delivery-governance/check-launch-risks (10 non-negotiable release blocking launch risks)
 */

import { Request, Response } from 'express';
import { DeliveryStagesPlanningService, ReleaseScopeLabel } from '../services/deliveryPlanning/deliveryStagesPlanning.service.js';
import { TestProgramEvidenceBenchmarksService } from '../services/testProgram/testProgramEvidenceBenchmarks.service.js';
import { CommercialAgencySupportService } from '../services/commercialOperations/commercialAgencySupport.service.js';
import { MigrationExistingCustomerProtectionService } from '../services/migrationProtection/migrationExistingCustomerProtection.service.js';
import { DecisionRegisterRiskControlsService } from '../services/decisionGovernance/decisionRegisterRiskControls.service.js';

export class DeliveryAndCommercialController {
  // --- Point 24 Endpoints ---
  public static getDeliveryStages(req: Request, res: Response): void {
    res.json({
      stages: DeliveryStagesPlanningService.getDeliveryStages(),
      teamCapacity: DeliveryStagesPlanningService.getTeamCapacity(),
      criticalPath: DeliveryStagesPlanningService.getCriticalPath(),
      dagValidation: DeliveryStagesPlanningService.validateCriticalPath()
    });
  }

  public static validateReleaseScope(req: Request, res: Response): void {
    const { label, intendedClaims, passedGateCount, targetProfile } = req.body;
    if (!label) {
      res.status(400).json({ error: 'Missing release scope label' });
      return;
    }
    const result = DeliveryStagesPlanningService.validateReleaseScopeClaim(
      label as ReleaseScopeLabel,
      intendedClaims || [],
      passedGateCount || 0,
      { targetProfile }
    );
    res.json(result);
  }

  // --- Point 25 Endpoints ---
  public static getSourceRegisters(req: Request, res: Response): void {
    res.json({
      registers: TestProgramEvidenceBenchmarksService.getSourceRegisters(),
      inventorySummary: TestProgramEvidenceBenchmarksService.getTotalSourceItems(),
      pinnedVisualEnvironment: TestProgramEvidenceBenchmarksService.PINNED_VISUAL_ENV,
      mutationHarnessExecution: TestProgramEvidenceBenchmarksService.executeMutationHarness()
    });
  }

  // --- Point 26 Endpoints ---
  public static processCommerceWebhook(req: Request, res: Response): void {
    const event = req.body;
    if (!event || !event.domain || !event.eventType) {
      res.status(400).json({ error: 'Invalid commerce event structure' });
      return;
    }
    const result = CommercialAgencySupportService.processCommerceWebhook(event);
    if (!result.accepted) {
      res.status(422).json(result);
      return;
    }
    res.json(result);
  }

  public static initiateOwnershipTransfer(req: Request, res: Response): void {
    const { websiteId, currentOwnerTenantId, targetOwnerTenantId, initiatedByUserId } = req.body;
    try {
      const result = CommercialAgencySupportService.initiateOwnershipTransfer({
        websiteId,
        currentOwnerTenantId,
        targetOwnerTenantId,
        initiatedByUserId
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  public static completeOwnershipTransfer(req: Request, res: Response): void {
    const { transferId, targetAcceptanceToken, simulateTargetError } = req.body;
    const result = CommercialAgencySupportService.completeOwnershipTransfer(
      transferId,
      targetAcceptanceToken,
      simulateTargetError
    );
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  }

  public static getPastDueLifecycle(req: Request, res: Response): void {
    const { days, tenantId } = req.query;
    const daysNum = parseInt(days as string, 10) || 0;
    const tid = (tenantId as string) || 'default-tenant';
    const status = CommercialAgencySupportService.evaluatePastDueLifecycle(daysNum, tid);
    res.json(status);
  }

  // --- Point 27 Endpoints ---
  public static captureSourceSnapshot(req: Request, res: Response): void {
    const { websiteId, tenantId, files, currentReleaseDigest, contentManifest } = req.body;
    try {
      const snapshot = MigrationExistingCustomerProtectionService.captureSourceSnapshot({
        websiteId,
        tenantId,
        files: files || {},
        currentReleaseDigest: currentReleaseDigest || 'rel-digest-0',
        contentManifest
      });
      res.json(snapshot);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  public static verifySnapshotRestore(req: Request, res: Response): void {
    const { snapshot, restoredFiles, requireExactFileMatch } = req.body;
    if (!snapshot || !restoredFiles) {
      res.status(400).json({ error: 'Missing snapshot or restoredFiles' });
      return;
    }
    const result = MigrationExistingCustomerProtectionService.verifySnapshotRestore(
      snapshot,
      restoredFiles,
      { requireExactFileMatch }
    );
    res.json(result);
  }

  public static evaluateLegacyRetirement(req: Request, res: Response): void {
    const checklist = req.body;
    const result = MigrationExistingCustomerProtectionService.evaluateLegacyRetirementGates(checklist);
    res.json(result);
  }

  // --- Point 28 Endpoints ---
  public static getDecisions(req: Request, res: Response): void {
    res.json({
      decisions: DecisionRegisterRiskControlsService.getAllDecisions(),
      validation: DecisionRegisterRiskControlsService.validateDecisionsFreshness()
    });
  }

  public static evaluateReleaseBlockingRisks(req: Request, res: Response): void {
    const checks = req.body;
    const result = DecisionRegisterRiskControlsService.evaluateReleaseBlockingRisks(checks);
    res.json(result);
  }
}
