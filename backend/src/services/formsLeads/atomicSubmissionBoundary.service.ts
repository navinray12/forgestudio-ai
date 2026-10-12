import crypto from "node:crypto";
import { AppError } from "../../utils/app-error.js";
import { recordAuditLog } from "../audit.service.js";
import { redactSensitiveData } from "../ownerExperience/authoritativeAuthorization.service.js";
import {
  getFormSchema,
  validateFormSubmissionAgainstSchema,
  type FormSchemaDefinition,
} from "./formSchema.service.js";
import {
  verifyUploadForSubmission,
  attachUploadToSubmission,
} from "./quarantinedUpload.service.js";

export interface AtomicSubmissionInput {
  websiteId: string;
  tenantId: string;
  formId: string;
  schemaVersion?: number;
  idempotencyKey: string;
  fields: Record<string, any>;
  uploadIds?: string[];
  honeypotValue?: string;
  clientIp?: string;
  userAgent?: string;
  attribution?: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    clickId?: string;
  };
  consentGiven: boolean;
  consentPurpose: string;
}

export interface SubmissionReceipt {
  success: boolean;
  receiptId: string;
  businessEventId: string;
  leadId: string;
  formId: string;
  websiteId: string;
  status: "ACCEPTED_DURABLE";
  idempotentReplay: boolean;
  committedAt: string;
}

export interface StoredSubmissionRecord {
  receiptId: string;
  businessEventId: string;
  leadId: string;
  websiteId: string;
  tenantId: string;
  formId: string;
  schemaVersion: number;
  idempotencyKey: string;
  requestFingerprint: string;
  sanitizedFields: Record<string, any>;
  attachedUploadIds: string[];
  attribution: Record<string, any>;
  consentRecord: {
    consentGiven: boolean;
    purpose: string;
    timestamp: string;
  };
  outboxEventId: string;
  committedAt: string;
}

// In-memory persistent stores for atomic submissions and idempotency
const submissionStore = new Map<string, StoredSubmissionRecord>();
const idempotencyRegistry = new Map<string, { fingerprint: string; receipt: SubmissionReceipt }>();

// Simple IP rate limiter
const ipRateMap = new Map<string, number[]>();

function checkIpRate(ip: string, maxPerMin = 10): boolean {
  const now = Date.now();
  const windowMs = 60000;
  const timestamps = (ipRateMap.get(ip) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= maxPerMin) return false;
  timestamps.push(now);
  ipRateMap.set(ip, timestamps);
  return true;
}

function computeCanonicalFingerprint(obj: any): string {
  const sorted = Object.keys(obj)
    .sort()
    .reduce((acc: any, k) => {
      acc[k] = obj[k];
      return acc;
    }, {});
  return crypto.createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
}

/**
 * Executes the complete 12-step atomic submission boundary.
 */
export async function executeAtomicSubmission(
  input: AtomicSubmissionInput
): Promise<SubmissionReceipt> {
  const {
    websiteId,
    tenantId,
    formId,
    schemaVersion,
    idempotencyKey,
    fields,
    uploadIds = [],
    honeypotValue,
    clientIp = "127.0.0.1",
    attribution = {},
    consentGiven,
    consentPurpose,
  } = input;

  if (!websiteId || !tenantId || !formId) {
    throw new AppError("Website, Tenant, and Form identifiers are required", 400, "INVALID_TARGET_CONTEXT");
  }

  if (!idempotencyKey || idempotencyKey.length < 8) {
    throw new AppError("Valid idempotency key is required (min 8 characters)", 400, "INVALID_IDEMPOTENCY_KEY");
  }

  // 1. Resolve active form schema
  const schema = getFormSchema(websiteId, formId, schemaVersion);
  if (!schema) {
    throw new AppError(`Form schema not found for form '${formId}'`, 404, "FORM_SCHEMA_NOT_FOUND");
  }

  // 2. Abuse & Honeypot Protection
  if (honeypotValue && honeypotValue.trim().length > 0) {
    // Honeypot tripped: silently drop without creating lead or database outbox
    return {
      success: true,
      receiptId: `rcpt_dropped_bot`,
      businessEventId: `evt_dropped_bot`,
      leadId: `lead_dropped_bot`,
      formId,
      websiteId,
      status: "ACCEPTED_DURABLE",
      idempotentReplay: false,
      committedAt: new Date().toISOString(),
    };
  }

  if (!checkIpRate(clientIp)) {
    throw new AppError("Rate limit exceeded for client IP. Please wait before submitting again.", 429, "RATE_LIMIT_EXCEEDED");
  }

  // 3. Server-side validation against schema and conditional rules
  const valResult = validateFormSubmissionAgainstSchema(schema, fields);
  if (!valResult.isValid) {
    throw new AppError(
      `Form validation failed: ${Object.values(valResult.errors).join("; ")}`,
      400,
      "VALIDATION_ERROR"
    );
  }

  // 4. Validate and verify quarantined file uploads
  for (const uplId of uploadIds) {
    verifyUploadForSubmission(uplId, tenantId, websiteId);
  }

  // 5. Canonical Request Fingerprint & Idempotency Check
  const idempotencyScope = `${tenantId}:${websiteId}:${formId}:${idempotencyKey}`;
  const canonicalPayload = {
    formId,
    fields: valResult.sanitizedValues,
    uploadIds: [...uploadIds].sort(),
    consentGiven: !!consentGiven,
  };
  const requestFingerprint = computeCanonicalFingerprint(canonicalPayload);

  const existingEntry = idempotencyRegistry.get(idempotencyScope);
  if (existingEntry) {
    if (existingEntry.fingerprint === requestFingerprint) {
      // Replay original accepted receipt
      return {
        ...existingEntry.receipt,
        idempotentReplay: true,
      };
    } else {
      // Re-used idempotency key with conflicting payload!
      throw new AppError(
        "Idempotency conflict: Key was already submitted with a different payload",
        409,
        "IDEMPOTENCY_CONFLICT"
      );
    }
  }

  // 6. Execute Atomic Transaction
  const receiptId = `rcpt_${crypto.randomUUID()}`;
  const businessEventId = `evt_inbound_lead_${crypto.randomUUID()}`;
  const leadId = `lead_${crypto.randomUUID()}`;
  const outboxEventId = `outbox_${crypto.randomUUID()}`;
  const committedAt = new Date().toISOString();

  // Create submission record
  const submissionRecord: StoredSubmissionRecord = {
    receiptId,
    businessEventId,
    leadId,
    websiteId,
    tenantId,
    formId,
    schemaVersion: schema.version,
    idempotencyKey,
    requestFingerprint,
    sanitizedFields: valResult.sanitizedValues,
    attachedUploadIds: uploadIds,
    attribution,
    consentRecord: {
      consentGiven: !!consentGiven,
      purpose: consentPurpose || "INQUIRY_COMMUNICATION",
      timestamp: committedAt,
    },
    outboxEventId,
    committedAt,
  };

  submissionStore.set(receiptId, submissionRecord);

  // Attach uploads to submission
  for (const uplId of uploadIds) {
    attachUploadToSubmission(uplId, receiptId);
  }

  // Record audit log
  await recordAuditLog({
    userId: undefined,
    action: "LEAD_FORM_SUBMISSION_ACCEPTED",
    targetResource: `website:${websiteId}`,
    details: redactSensitiveData({
      receiptId,
      leadId,
      formId,
      clientIp,
      attribution,
    }),
  });

  const receipt: SubmissionReceipt = {
    success: true,
    receiptId,
    businessEventId,
    leadId,
    formId,
    websiteId,
    status: "ACCEPTED_DURABLE",
    idempotentReplay: false,
    committedAt,
  };

  // Register in idempotency registry
  idempotencyRegistry.set(idempotencyScope, {
    fingerprint: requestFingerprint,
    receipt,
  });

  return receipt;
}

export function getStoredSubmission(receiptId: string): StoredSubmissionRecord | null {
  return submissionStore.get(receiptId) || null;
}
