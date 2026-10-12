/**
 * ForgeStudio Execution Blueprint v2.1 — Point 20: Service Objectives and Failure Behavior
 * Controller Integration
 */

import { Request, Response } from "express";
import { ServiceLevelObjectivesRegisterService } from "../services/serviceObjectives/serviceLevelObjectivesRegister.service.ts";
import { FailureIsolationContractsService, OutageType } from "../services/serviceObjectives/failureIsolationContracts.service.ts";
import { IncidentAlertOperationsService } from "../services/serviceObjectives/incidentAlertOperations.service.ts";

export class ServiceObjectivesController {
  public static async listSLOs(req: Request, res: Response) {
    try {
      const slos = ServiceLevelObjectivesRegisterService.getSLORegister();
      return res.status(200).json({ success: true, slos });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }

  public static async evaluateFailureIsolation(req: Request, res: Response) {
    try {
      const { outageType } = req.body;
      const evaluation = FailureIsolationContractsService.evaluateFailureIsolation(outageType as OutageType);
      return res.status(200).json({ success: true, evaluation });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }

  public static async getAlertDefinitions(req: Request, res: Response) {
    try {
      const alerts = IncidentAlertOperationsService.getAlertDefinitions();
      return res.status(200).json({ success: true, alerts });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }

  public static async evaluateErrorBudget(req: Request, res: Response) {
    try {
      const availabilityPercent = parseFloat(req.query.availability as string) || 99.9;
      const status = IncidentAlertOperationsService.evaluateErrorBudget(availabilityPercent);
      return res.status(200).json({ success: true, errorBudget: status });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }
}
