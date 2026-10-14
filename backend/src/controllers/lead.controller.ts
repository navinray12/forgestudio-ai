import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/app-error.js";
import { addLeadNote, assignLead, getLead, listLeads, transitionLead } from "../services/leads/leadIntake.service.js";

/** Staff lead management. The acting user always comes from the verified session. */
function userId(res: Response): string {
  const id = res.locals.user?.id;
  if (!id) throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
  return id;
}

function revisionOf(req: Request): number {
  const revision = Number(req.body?.expectedRevision);
  if (!Number.isInteger(revision) || revision < 1) {
    throw new AppError("expectedRevision (the lead revision you last saw) is required", 428, "REVISION_REQUIRED");
  }
  return revision;
}

export async function listLeadsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const stage = typeof req.query.stage === "string" ? req.query.stage : undefined;
    res.json({ success: true, data: await listLeads(String(req.params.websiteId), userId(res), stage) });
  } catch (err) { next(err); }
}

export async function getLeadHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await getLead(String(req.params.leadId), userId(res)) });
  } catch (err) { next(err); }
}

export async function transitionLeadHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await transitionLead({
      leadId: String(req.params.leadId),
      userId: userId(res),
      targetStage: String(req.body?.targetStage ?? ""),
      expectedRevision: revisionOf(req),
      evidence: req.body?.evidence,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function addLeadNoteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json({ success: true, data: await addLeadNote({ leadId: String(req.params.leadId), userId: userId(res), note: req.body?.note }) });
  } catch (err) { next(err); }
}

export async function assignLeadHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const assigneeId = req.body?.assigneeId === null ? null : String(req.body?.assigneeId ?? "");
    const data = await assignLead({ leadId: String(req.params.leadId), userId: userId(res), assigneeId, expectedRevision: revisionOf(req) });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
