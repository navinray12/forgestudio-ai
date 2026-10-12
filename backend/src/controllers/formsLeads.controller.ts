import type { Request, Response, NextFunction } from "express";
import {
  registerFormSchema,
  getFormSchema,
} from "../services/formsLeads/formSchema.service.js";
import {
  initiateQuarantinedUpload,
  processUploadScan,
} from "../services/formsLeads/quarantinedUpload.service.js";
import {
  executeAtomicSubmission,
  getStoredSubmission,
} from "../services/formsLeads/atomicSubmissionBoundary.service.js";
import {
  listLeads,
  getLeadRecord,
  transitionLeadStage,
  assignLead,
  addLeadNote,
  mergeLeads,
  type LeadStage,
} from "../services/formsLeads/leadLifecycle.service.js";
import { getDisasterRecoveryProfile } from "../services/formsLeads/disasterRecoveryAudit.service.js";

export async function createSchemaHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = registerFormSchema(req.body);
    res.status(201).json({ success: true, schema });
  } catch (error) {
    next(error);
  }
}

export async function getSchemaHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { websiteId, formId } = req.params;
    const version = req.query.version ? Number(req.query.version) : undefined;
    const schema = getFormSchema(websiteId, formId, version);
    if (!schema) {
      res.status(404).json({ success: false, message: "Form schema not found" });
      return;
    }
    res.json({ success: true, schema });
  } catch (error) {
    next(error);
  }
}

export async function uploadFileInitHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const record = initiateQuarantinedUpload(req.body);
    res.status(201).json({ success: true, upload: record });
  } catch (error) {
    next(error);
  }
}

export async function submitFormAtomicHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const receipt = await executeAtomicSubmission({
      ...req.body,
      clientIp: req.ip || req.body.clientIp,
      userAgent: req.get("User-Agent"),
    });
    res.status(receipt.idempotentReplay ? 200 : 201).json({ success: true, receipt });
  } catch (error) {
    next(error);
  }
}

export async function getSubmissionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { receiptId } = req.params;
    const record = getStoredSubmission(receiptId);
    if (!record) {
      res.status(404).json({ success: false, message: "Submission not found" });
      return;
    }
    res.json({ success: true, submission: record });
  } catch (error) {
    next(error);
  }
}

export async function listLeadsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = (req.query.tenantId as string) || "tenant-1";
    const websiteId = req.query.websiteId as string | undefined;
    const stage = req.query.stage as LeadStage | undefined;
    const leads = listLeads(tenantId, websiteId, stage);
    res.json({ success: true, leads });
  } catch (error) {
    next(error);
  }
}

export async function transitionLeadStageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { leadId } = req.params;
    const { tenantId, targetStage, qualificationEvidence } = req.body;
    const actorId = res.locals.user?.id || req.body.actorId || "user-1";
    const lead = await transitionLeadStage({
      leadId,
      tenantId: tenantId || "tenant-1",
      actorId,
      targetStage,
      qualificationEvidence,
    });
    res.json({ success: true, lead });
  } catch (error) {
    next(error);
  }
}

export async function getDisasterRecoveryProfileHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, profile: getDisasterRecoveryProfile() });
  } catch (error) {
    next(error);
  }
}
