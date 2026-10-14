import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/app-error.js";
import { tenantScopeOf } from "../middlewares/tenantScope.middleware.js";
import { listLeads, transitionLead } from "../services/leads/leadIntake.service.js";

/**
 * Forms & leads (blueprint §12). Leads are served from the durable lead authority
 * (services/leads/leadIntake.service.ts, forge_leads); the acting user always comes from the
 * verified session and the website from verified membership.
 *
 * Not exposed: form schemas, upload initiation and the atomic submission boundary. Their services
 * (services/formsLeads/*) keep schemas, uploads, submissions, the idempotency registry and the
 * rate map in process memory. The durable public intake is POST /api/forms/submit. The
 * disaster-recovery profile is not exposed either: its RPO/RTO and backup schedule are constants,
 * not values observed from the deployment.
 */
function userId(res: Response): string {
  const id = res.locals.user?.id;
  if (!id) throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  return id;
}

export async function listLeadsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const stage = typeof req.query.stage === "string" ? req.query.stage : undefined;
    const leads = await listLeads(tenantScopeOf(res).websiteId, userId(res), stage);
    res.json({ success: true, leads });
  } catch (error) {
    next(error);
  }
}

export async function transitionLeadStageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const expectedRevision = Number(req.body?.expectedRevision);
    if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
      throw new AppError("expectedRevision (the lead revision you last saw) is required", 428, "REVISION_REQUIRED");
    }
    const lead = await transitionLead({
      leadId: String(req.params.leadId),
      userId: userId(res),
      targetStage: String(req.body?.targetStage ?? ""),
      expectedRevision,
      evidence: req.body?.qualificationEvidence,
    });
    res.json({ success: true, lead });
  } catch (error) {
    next(error);
  }
}
