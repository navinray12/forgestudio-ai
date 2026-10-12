/**
 * ForgeStudio Execution Blueprint v2.1 — Point 19: Adaptive Infrastructure and Operating Economics
 * Controller Integration
 */

import { Request, Response } from "express";
import {
  InfrastructureProfilesService,
  InfrastructureProfileType,
} from "../services/adaptiveInfrastructure/infrastructureProfiles.service.ts";
import { OptionalInfrastructureCapabilitiesService } from "../services/adaptiveInfrastructure/optionalInfrastructureCapabilities.service.ts";
import { UpgradeInfrastructureWorkflowService } from "../services/adaptiveInfrastructure/upgradeInfrastructureWorkflow.service.ts";
import { AutoscalingCostEconomicsService } from "../services/adaptiveInfrastructure/autoscalingCostEconomics.service.ts";

export class AdaptiveInfrastructureController {
  public static async listProfiles(req: Request, res: Response) {
    try {
      const profiles = InfrastructureProfilesService.getAllProfiles();
      return res.status(200).json({ success: true, profiles });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }

  public static async generateMigrationPlan(req: Request, res: Response) {
    try {
      const { tenantId, currentProfile, targetProfile } = req.body;
      const plan = InfrastructureProfilesService.generateProfileMigrationPlan(
        tenantId,
        currentProfile as InfrastructureProfileType,
        targetProfile as InfrastructureProfileType
      );
      return res.status(200).json({ success: true, plan });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }

  public static async executeUpgrade(req: Request, res: Response) {
    try {
      const { plan, approvals } = req.body;
      const receipt = UpgradeInfrastructureWorkflowService.executeUpgradePlan(plan, approvals || []);
      return res.status(200).json({ success: true, receipt });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }

  public static async evaluateAutoscaling(req: Request, res: Response) {
    try {
      const decision = AutoscalingCostEconomicsService.evaluateAutoscaling(req.body);
      return res.status(200).json({ success: true, decision });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }

  public static async getCostScenarios(req: Request, res: Response) {
    try {
      const scenario = (req.query.scenario as any) || "BASE";
      const costs = AutoscalingCostEconomicsService.computeScenarioCostModel(scenario);
      return res.status(200).json({ success: true, costs });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }
}
