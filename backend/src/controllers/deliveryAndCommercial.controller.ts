/**
 * Delivery and Commercial Governance Controller
 *
 * Read-only registers for Points 24, 25 and 28:
 * - /stages (delivery stages, capacity, critical path)
 * - /source-registers (source registers and the pinned visual environment)
 * - /decisions (ADR register D-01..D-12)
 *
 * Not exposed:
 * - /commerce-webhook: no provider signature check, and replay protection is a process-local Set.
 *   Signed billing webhooks are handled under /api/v1/billing/webhooks.
 * - /initiate-transfer, /complete-transfer: transfers are held in process memory, take both tenant
 *   IDs from the request body, accept a client "simulateTargetError" flag and never change the
 *   website's owner.
 * - /past-due-status: evaluates a client-supplied tenant ID and day count; billing owns that state.
 * - /capture-snapshot, /verify-snapshot: return and compare digests of client-supplied files
 *   without storing a snapshot. Project snapshots live in forge_project_snapshots.
 * - /validate-scope, /legacy-retirement-check, /check-launch-risks: gate verdicts computed from
 *   client-asserted results.
 */

import { Request, Response } from 'express';
import { DeliveryStagesPlanningService } from '../services/deliveryPlanning/deliveryStagesPlanning.service.js';
import { TestProgramEvidenceBenchmarksService } from '../services/testProgram/testProgramEvidenceBenchmarks.service.js';
import { DecisionRegisterRiskControlsService } from '../services/decisionGovernance/decisionRegisterRiskControls.service.js';

export class DeliveryAndCommercialController {
  // --- Point 24 ---
  public static getDeliveryStages(_req: Request, res: Response): void {
    res.json({
      stages: DeliveryStagesPlanningService.getDeliveryStages(),
      teamCapacity: DeliveryStagesPlanningService.getTeamCapacity(),
      criticalPath: DeliveryStagesPlanningService.getCriticalPath(),
      dagValidation: DeliveryStagesPlanningService.validateCriticalPath()
    });
  }

  // --- Point 25 ---
  public static getSourceRegisters(_req: Request, res: Response): void {
    res.json({
      registers: TestProgramEvidenceBenchmarksService.getSourceRegisters(),
      inventorySummary: TestProgramEvidenceBenchmarksService.getTotalSourceItems(),
      pinnedVisualEnvironment: TestProgramEvidenceBenchmarksService.PINNED_VISUAL_ENV
    });
  }

  // --- Point 28 ---
  public static getDecisions(_req: Request, res: Response): void {
    res.json({
      decisions: DecisionRegisterRiskControlsService.getAllDecisions(),
      validation: DecisionRegisterRiskControlsService.validateDecisionsFreshness()
    });
  }
}
