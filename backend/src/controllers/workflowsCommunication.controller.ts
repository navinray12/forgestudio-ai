/**
 * ForgeStudio Execution Blueprint v2.1 — Point 15: Workflows, Communication, Experiments and Contextual Chat
 * Controller Integration
 */

import { Request, Response } from "express";
import { VersionedWorkflowEngine } from "../services/workflowsCommunication/workflowEngine.service.ts";
import { PreActionPolicyValidator } from "../services/workflowsCommunication/preActionPolicyValidator.service.ts";
import { CommunicationAdaptersService } from "../services/workflowsCommunication/communicationAdapters.service.ts";
import { ExplainableScoringSegmentation } from "../services/workflowsCommunication/explainableScoringSegmentation.service.ts";
import { ExperimentationEngine } from "../services/workflowsCommunication/experimentationEngine.service.ts";
import { ContextualChatService } from "../services/workflowsCommunication/contextualChatService.service.ts";

export class WorkflowsCommunicationController {
  public static async createWorkflowDraft(req: Request, res: Response) {
    try {
      const { tenantId, workflowId, name, nodes, edges, limits } = req.body;
      const draft = VersionedWorkflowEngine.createWorkflowDraft(tenantId, workflowId, name, nodes, edges, limits);
      return res.status(201).json({ success: true, draft });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message, code: err.code });
    }
  }

  public static async publishWorkflow(req: Request, res: Response) {
    try {
      const { workflowId, version } = req.params;
      const publishedBy = (req as any).user?.id || "admin_user";
      const published = VersionedWorkflowEngine.publishWorkflowVersion(workflowId, parseInt(version, 10), publishedBy);
      return res.status(200).json({ success: true, workflow: published });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message, code: err.code });
    }
  }

  public static async simulateWorkflow(req: Request, res: Response) {
    try {
      const { workflowId, version } = req.params;
      const { initialContext } = req.body;
      const result = VersionedWorkflowEngine.runSimulation(workflowId, parseInt(version, 10), initialContext);
      return res.status(200).json({ success: true, simulation: result });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message, code: err.code });
    }
  }

  public static async revalidatePreAction(req: Request, res: Response) {
    try {
      const decision = PreActionPolicyValidator.revalidatePreAction(req.body);
      return res.status(200).json({ success: true, decision });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message, code: err.code });
    }
  }

  public static async dispatchMessage(req: Request, res: Response) {
    try {
      const receipt = await CommunicationAdaptersService.dispatchMessage(req.body);
      return res.status(200).json({ success: true, receipt });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message, code: err.code });
    }
  }

  public static async calculateLeadScore(req: Request, res: Response) {
    try {
      const { tenantId, leadId, leadData } = req.body;
      const score = ExplainableScoringSegmentation.computeLeadScore(tenantId, leadId, leadData);
      return res.status(200).json({ success: true, score });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message, code: err.code });
    }
  }

  public static async createExperiment(req: Request, res: Response) {
    try {
      const { tenantId, websiteId, experimentId, title, controlRevision, treatmentRevision, guardrails } = req.body;
      const exp = ExperimentationEngine.createExperiment(
        tenantId,
        websiteId,
        experimentId,
        title,
        controlRevision,
        treatmentRevision,
        guardrails
      );
      return res.status(201).json({ success: true, experiment: exp });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message, code: err.code });
    }
  }

  public static async initChat(req: Request, res: Response) {
    try {
      const { tenantId, websiteId, options } = req.body;
      const session = ContextualChatService.initChatSession(tenantId, websiteId, options);
      return res.status(201).json({ success: true, session });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message, code: err.code });
    }
  }

  public static async convertChatLead(req: Request, res: Response) {
    try {
      const result = await ContextualChatService.convertConfirmedChatToLead(req.body);
      return res.status(201).json({ success: true, submission: result });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ success: false, error: err.message, code: err.code });
    }
  }
}
