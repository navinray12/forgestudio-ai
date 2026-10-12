import { AppError } from "../../utils/app-error.js";
import { recordAuditLog } from "../audit.service.js";
import { redactSensitiveData } from "../ownerExperience/authoritativeAuthorization.service.js";

export type LeadStage = "NEW" | "CONTACTED" | "QUALIFIED" | "WON" | "LOST" | "SPAM";
export type LeadProvenanceSource = "WEBSITE_FORM" | "NATIVE_IMPORT" | "CHAT_AGENT" | "PARTNER_REFERRAL";

export interface LeadStaffNote {
  noteId: string;
  authorId: string;
  authorName: string;
  content: string;
  isInternalOnly: boolean;
  createdAt: string;
}

export interface LeadTask {
  taskId: string;
  title: string;
  dueDateUtc: string;
  assignedTo: string;
  isCompleted: boolean;
  completedAt?: string;
}

export interface LeadRecord {
  leadId: string;
  websiteId: string;
  tenantId: string;
  submissionReceiptId?: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  data: Record<string, any>;
  stage: LeadStage;
  provenance: {
    source: LeadProvenanceSource;
    importBatchId?: string;
    sessionId?: string;
    attribution?: Record<string, any>;
  };
  assignedTo?: string;
  qualificationEvidence?: string;
  notes: LeadStaffNote[];
  tasks: LeadTask[];
  isMerged: boolean;
  mergedIntoLeadId?: string;
  mergedLeadIds?: string[];
  createdAt: string;
  updatedAt: string;
}

// In-memory store for authoritative lead records
const leadRegistry = new Map<string, LeadRecord>();

const VALID_TRANSITIONS: Record<LeadStage, LeadStage[]> = {
  NEW: ["CONTACTED", "QUALIFIED", "LOST", "SPAM"],
  CONTACTED: ["QUALIFIED", "LOST", "SPAM"],
  QUALIFIED: ["WON", "LOST"],
  WON: ["LOST"],
  LOST: ["NEW"],
  SPAM: ["NEW"],
};

export function createLeadRecord(params: {
  websiteId: string;
  tenantId: string;
  submissionReceiptId?: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  data: Record<string, any>;
  provenanceSource: LeadProvenanceSource;
  attribution?: Record<string, any>;
  importBatchId?: string;
}): LeadRecord {
  const {
    websiteId,
    tenantId,
    submissionReceiptId,
    contactName,
    contactEmail,
    contactPhone,
    data,
    provenanceSource,
    attribution,
    importBatchId,
  } = params;

  const leadId = `lead_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
  const record: LeadRecord = {
    leadId,
    websiteId,
    tenantId,
    submissionReceiptId,
    contactName: contactName.trim(),
    contactEmail: contactEmail.trim().toLowerCase(),
    contactPhone: contactPhone ? contactPhone.trim() : undefined,
    data,
    stage: "NEW",
    provenance: {
      source: provenanceSource,
      importBatchId,
      attribution,
    },
    notes: [],
    tasks: [],
    isMerged: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  leadRegistry.set(leadId, record);
  return record;
}

export function getLeadRecord(leadId: string, tenantId: string): LeadRecord {
  const lead = leadRegistry.get(leadId);
  if (!lead) {
    throw new AppError("Lead not found", 404, "LEAD_NOT_FOUND");
  }
  if (lead.tenantId !== tenantId) {
    throw new AppError("Cross-tenant lead access forbidden", 403, "FORBIDDEN");
  }
  return lead;
}

export function listLeads(tenantId: string, websiteId?: string, stage?: LeadStage): LeadRecord[] {
  const results: LeadRecord[] = [];
  for (const lead of leadRegistry.values()) {
    if (lead.tenantId === tenantId) {
      if (websiteId && lead.websiteId !== websiteId) continue;
      if (stage && lead.stage !== stage) continue;
      results.push(lead);
    }
  }
  return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Transitions lead stage with strict state machine validation and audit history.
 */
export async function transitionLeadStage(params: {
  leadId: string;
  tenantId: string;
  actorId: string;
  targetStage: LeadStage;
  qualificationEvidence?: string;
}): Promise<LeadRecord> {
  const { leadId, tenantId, actorId, targetStage, qualificationEvidence } = params;
  const lead = getLeadRecord(leadId, tenantId);

  const allowed = VALID_TRANSITIONS[lead.stage];
  if (!allowed.includes(targetStage)) {
    throw new AppError(
      `Illegal lead stage transition from '${lead.stage}' to '${targetStage}'`,
      400,
      "ILLEGAL_STAGE_TRANSITION"
    );
  }

  if (targetStage === "QUALIFIED" && (!qualificationEvidence || !qualificationEvidence.trim())) {
    throw new AppError("Qualification requires explicit qualification evidence", 400, "MISSING_QUALIFICATION_EVIDENCE");
  }

  const fromStage = lead.stage;
  lead.stage = targetStage;
  if (qualificationEvidence) {
    lead.qualificationEvidence = qualificationEvidence.trim();
  }
  lead.updatedAt = new Date().toISOString();

  await recordAuditLog({
    userId: actorId,
    action: "LEAD_STAGE_TRANSITIONED",
    targetResource: `lead:${leadId}`,
    details: {
      fromStage,
      toStage: targetStage,
      qualificationEvidence,
    },
  });

  return lead;
}

/**
 * Assigns or reassigns lead to a team member.
 */
export async function assignLead(params: {
  leadId: string;
  tenantId: string;
  actorId: string;
  assignedToUserId: string;
}): Promise<LeadRecord> {
  const { leadId, tenantId, actorId, assignedToUserId } = params;
  const lead = getLeadRecord(leadId, tenantId);

  lead.assignedTo = assignedToUserId;
  lead.updatedAt = new Date().toISOString();

  await recordAuditLog({
    userId: actorId,
    action: "LEAD_REASSIGNED",
    targetResource: `lead:${leadId}`,
    details: { assignedToUserId },
  });

  return lead;
}

/**
 * Adds an internal staff note to the lead.
 */
export function addLeadNote(params: {
  leadId: string;
  tenantId: string;
  authorId: string;
  authorName: string;
  content: string;
}): LeadStaffNote {
  const { leadId, tenantId, authorId, authorName, content } = params;
  const lead = getLeadRecord(leadId, tenantId);

  if (!content || !content.trim()) {
    throw new AppError("Note content is required", 400, "INVALID_NOTE");
  }

  const note: LeadStaffNote = {
    noteId: `note_${Date.now().toString(36)}`,
    authorId,
    authorName,
    content: content.trim(),
    isInternalOnly: true,
    createdAt: new Date().toISOString(),
  };

  lead.notes.push(note);
  lead.updatedAt = new Date().toISOString();
  return note;
}

/**
 * Merges secondary duplicate lead into primary lead, preserving relationships and audit trail.
 */
export async function mergeLeads(params: {
  primaryLeadId: string;
  secondaryLeadId: string;
  tenantId: string;
  actorId: string;
}): Promise<{ primaryLead: LeadRecord; mergedLead: LeadRecord }> {
  const { primaryLeadId, secondaryLeadId, tenantId, actorId } = params;

  if (primaryLeadId === secondaryLeadId) {
    throw new AppError("Cannot merge lead into itself", 400, "INVALID_MERGE_TARGET");
  }

  const primary = getLeadRecord(primaryLeadId, tenantId);
  const secondary = getLeadRecord(secondaryLeadId, tenantId);

  if (secondary.isMerged) {
    throw new AppError("Secondary lead is already merged", 409, "LEAD_ALREADY_MERGED");
  }

  secondary.isMerged = true;
  secondary.mergedIntoLeadId = primaryLeadId;
  secondary.updatedAt = new Date().toISOString();

  if (!primary.mergedLeadIds) {
    primary.mergedLeadIds = [];
  }
  primary.mergedLeadIds.push(secondaryLeadId);
  // Merge notes
  primary.notes.push(...secondary.notes);
  primary.updatedAt = new Date().toISOString();

  await recordAuditLog({
    userId: actorId,
    action: "LEADS_MERGED",
    targetResource: `lead:${primaryLeadId}`,
    details: { secondaryLeadId },
  });

  return { primaryLead: primary, mergedLead: secondary };
}
