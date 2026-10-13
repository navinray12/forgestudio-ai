/**
 * ForgeStudio Execution Blueprint v2.1 — Point 15: Workflows, Communication, Experiments and Contextual Chat
 *
 * Only operations with a durable or stateless contract are exposed:
 *  - workflow definitions are persisted, versioned and immutable (durableWorkflowDefinitions.service);
 *  - scoring is a pure calculation over the supplied lead data;
 *  - a confirmed chat lead commits through the same durable lead service as forms (§15).
 * Message dispatch, pre-action policy revalidation, chat sessions and the in-memory experiment
 * engine are not exposed: they held process-local state (suppression lists, receipts, sessions) or
 * reported provider acceptance without calling a provider. Experiments are served durably by
 * experiment.routes.
 */

import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/app-error.js";
import { tenantScopeOf } from "../middlewares/tenantScope.middleware.js";
import { ExplainableScoringSegmentation } from "../services/workflowsCommunication/explainableScoringSegmentation.service.js";
import {
  createWorkflowDraft,
  listWorkflowVersions,
  publishWorkflowVersion,
  simulateWorkflowVersion,
} from "../services/workflowsCommunication/durableWorkflowDefinitions.service.js";
import { acceptSubmission } from "../services/leads/leadIntake.service.js";

function userId(res: Response): string {
  const id = res.locals.user?.id;
  if (!id) throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  return id;
}

export class WorkflowsCommunicationController {
  public static async createWorkflowDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const { workflowId, name, nodes, edges, limits } = req.body;
      const draft = await createWorkflowDraft(tenantScopeOf(res), userId(res), { workflowKey: workflowId, name, nodes, edges, limits });
      res.status(201).json({ success: true, draft });
    } catch (err) { next(err); }
  }

  public static async listWorkflows(req: Request, res: Response, next: NextFunction) {
    try {
      const workflowId = typeof req.query.workflowId === "string" ? req.query.workflowId : undefined;
      res.json({ success: true, versions: await listWorkflowVersions(tenantScopeOf(res), workflowId) });
    } catch (err) { next(err); }
  }

  public static async publishWorkflow(req: Request, res: Response, next: NextFunction) {
    try {
      const { workflowId, version } = req.params as Record<string, string>;
      const workflow = await publishWorkflowVersion(tenantScopeOf(res), userId(res), workflowId, Number(version));
      res.json({ success: true, workflow });
    } catch (err) { next(err); }
  }

  public static async simulateWorkflow(req: Request, res: Response, next: NextFunction) {
    try {
      const { workflowId, version } = req.params as Record<string, string>;
      const simulation = await simulateWorkflowVersion(tenantScopeOf(res), workflowId, Number(version), req.body?.initialContext);
      res.json({ success: true, simulation });
    } catch (err) { next(err); }
  }

  public static async calculateLeadScore(req: Request, res: Response, next: NextFunction) {
    try {
      const { leadId, leadData } = req.body;
      const score = ExplainableScoringSegmentation.computeLeadScore(tenantScopeOf(res).tenantId, leadId, leadData);
      res.json({ success: true, score });
    } catch (err) { next(err); }
  }

  /** Confirmed chat details become a lead through the durable submission boundary (provenance CHAT_AGENT). */
  public static async convertChatLead(req: Request, res: Response, next: NextFunction) {
    try {
      const { formId, confirmedContact, consentConfirmed, sessionId } = req.body ?? {};
      if (consentConfirmed !== true) {
        throw new AppError("Lead capture requires explicit user confirmation and consent", 400, "CONSENT_REQUIRED");
      }
      const contact = confirmedContact && typeof confirmedContact === "object" ? confirmedContact : {};
      const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
      const email = text(contact.email, 320);
      const phone = text(contact.phone, 64);
      if (!email && !phone) {
        throw new AppError("Valid email or phone is required for lead confirmation", 400, "CONTACT_REQUIRED");
      }
      const receipt = await acceptSubmission({
        websiteId: tenantScopeOf(res).websiteId,
        formId: text(formId, 255) || "chat",
        formName: "Chat conversation",
        data: { name: text(contact.name, 255), email, phone, message: text(contact.message, 5000) },
        metadata: { source: "chat", chatSessionId: text(sessionId, 200), confirmedById: userId(res), submittedAt: new Date().toISOString() },
        idempotencyKey: req.get("Idempotency-Key") || undefined,
        provenance: "CHAT_AGENT",
      });
      res.status(receipt.replayed ? 200 : 201).json({ success: true, receipt });
    } catch (err) { next(err); }
  }
}
