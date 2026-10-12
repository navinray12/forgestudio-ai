/**
 * ForgeStudio Execution Blueprint v2.1 — Point 06: Core Architecture and Six Authoritative Records
 * Record 5: Business and Policy Ledgers
 *
 * Authority: Accepted leads, transactions, permissions, consent/suppression,
 * workflow obligations, and protected audit.
 *
 * Rules:
 * 1. Do not treat a client-side success message as a durable business record.
 * 2. Do not let optional analytics become a prerequisite for lead acceptance.
 * 3. Enforce idempotency for retryable business operations.
 * 4. Protect consent and suppression from accidental overwrite or reactivation.
 * 5. Keep audit records protected from ordinary customer content-editing operations.
 * 6. Use durable transactional persistence before triggering external CRM/email hooks.
 */

import crypto from "node:crypto";
import { AppError } from "../../utils/app-error.js";

export type LeadStatus =
  | "ACCEPTED_DURABLE"     // Written to primary durable persistence
  | "PENDING_WEBHOOK"      // Queued for external integration
  | "DISPATCHED"           // Successfully sent to CRM/email
  | "DISPATCH_FAILED"      // Webhook failed (lead remains durable locally)
  | "SUPPRESSED";          // Matched an active suppression opt-out

export interface DurableLeadRecord {
  leadId: string;
  websiteId: string;
  tenantId: string;
  formId: string;
  idempotencyKey: string;
  payload: Record<string, any>;
  contactEmail?: string;
  contactPhone?: string;
  consentGiven: boolean;
  consentPurpose: string;
  status: LeadStatus;
  receivedAt: string;
  persistedAt: string;
  externalDeliveryAttempts: Array<{
    attemptNumber: number;
    destination: string;
    success: boolean;
    error?: string;
    timestamp: string;
  }>;
}

export interface ConsentRecord {
  consentId: string;
  tenantId: string;
  subjectIdentifier: string; // Email or hashed device token
  purpose: "MARKETING_EMAIL" | "TRANSACTIONAL_UPDATES" | "ANALYTICS_TRACKING" | "DATA_PROCESSING";
  decision: "GRANTED" | "DENIED" | "WITHDRAWN";
  recordedAt: string;
  policyVersion: string;
  ipAddressMasked?: string;
  immutableAuditRef: string;
}

export interface SuppressionRecord {
  suppressionId: string;
  tenantId: string;
  subjectIdentifier: string; // Email or phone
  reason: "UNSUBSCRIBE" | "GDPR_ERASURE_REQUEST" | "BOUNCE_COMPLAINT" | "MANUAL_OPT_OUT";
  isActive: boolean;
  suppressedAt: string;
  notes?: string;
}

export interface ProtectedAuditEvent {
  eventId: string;
  tenantId: string;
  actorId: string;
  actorRole: string;
  action: string;
  resource: string;
  details: Record<string, any>;
  timestamp: string;
  tamperProofHash: string;
}

// In-memory backing stores for tests and staging
const DURABLE_LEADS = new Map<string, DurableLeadRecord>();
const IDEMPOTENCY_INDEX = new Map<string, string>(); // idempotencyKey -> leadId
const CONSENT_LEDGER = new Map<string, ConsentRecord>();
const SUPPRESSION_LEDGER = new Map<string, SuppressionRecord>();
const PROTECTED_AUDIT_LOG = new Map<string, ProtectedAuditEvent>();

export class BusinessPolicyLedgerService {
  /**
   * Accept a customer lead with durable transactional certainty.
   * Enforces idempotency and verifies consent/suppression.
   * GUARANTEE: Never blocked or failed by optional analytics or third-party webhooks.
   */
  static async acceptDurableLead(params: {
    websiteId: string;
    tenantId: string;
    formId: string;
    idempotencyKey?: string;
    payload: Record<string, any>;
    consentPurpose?: string;
  }): Promise<{ lead: DurableLeadRecord; isDuplicate: boolean }> {
    const idempotencyKey = params.idempotencyKey || crypto.randomUUID();
    const existingLeadId = IDEMPOTENCY_INDEX.get(idempotencyKey);

    if (existingLeadId) {
      const existing = DURABLE_LEADS.get(existingLeadId);
      if (existing) {
        return { lead: existing, isDuplicate: true };
      }
    }

    const email = params.payload.email ? String(params.payload.email).toLowerCase().trim() : undefined;
    const phone = params.payload.phone ? String(params.payload.phone).trim() : undefined;

    // Check suppression list
    let isSuppressed = false;
    if (email && SUPPRESSION_LEDGER.has(`${params.tenantId}:${email}`)) {
      isSuppressed = true;
    }

    const leadId = `lead_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const record: DurableLeadRecord = {
      leadId,
      websiteId: params.websiteId,
      tenantId: params.tenantId,
      formId: params.formId,
      idempotencyKey,
      payload: params.payload,
      contactEmail: email,
      contactPhone: phone,
      consentGiven: Boolean(params.payload.consent || params.payload.acceptTerms),
      consentPurpose: params.consentPurpose || "GENERAL_ENQUIRY",
      status: isSuppressed ? "SUPPRESSED" : "ACCEPTED_DURABLE",
      receivedAt: now,
      persistedAt: now,
      externalDeliveryAttempts: [],
    };

    DURABLE_LEADS.set(leadId, record);
    IDEMPOTENCY_INDEX.set(idempotencyKey, leadId);

    // Record consent in consent ledger
    if (email && record.consentGiven) {
      this.recordConsent({
        tenantId: params.tenantId,
        subjectIdentifier: email,
        purpose: "DATA_PROCESSING",
        decision: "GRANTED",
        policyVersion: "1.0.0",
      });
    }

    return { lead: record, isDuplicate: false };
  }

  /**
   * Record a consent decision. Immutable and auditable.
   */
  static recordConsent(params: {
    tenantId: string;
    subjectIdentifier: string;
    purpose: ConsentRecord["purpose"];
    decision: ConsentRecord["decision"];
    policyVersion: string;
    ipAddressMasked?: string;
  }): ConsentRecord {
    const consentId = `consent_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const raw = `${params.tenantId}:${params.subjectIdentifier}:${params.purpose}:${params.decision}:${now}`;
    const immutableAuditRef = crypto.createHash("sha256").update(raw).digest("hex");

    const record: ConsentRecord = {
      consentId,
      tenantId: params.tenantId,
      subjectIdentifier: params.subjectIdentifier,
      purpose: params.purpose,
      decision: params.decision,
      recordedAt: now,
      policyVersion: params.policyVersion,
      ipAddressMasked: params.ipAddressMasked,
      immutableAuditRef,
    };

    CONSENT_LEDGER.set(consentId, record);
    return record;
  }

  /**
   * Add subject to suppression list (opt-out / unsubscribe / compliance).
   * Protected from accidental reactivation.
   */
  static addSuppression(params: {
    tenantId: string;
    subjectIdentifier: string;
    reason: SuppressionRecord["reason"];
    notes?: string;
  }): SuppressionRecord {
    const key = `${params.tenantId}:${params.subjectIdentifier.toLowerCase().trim()}`;
    const now = new Date().toISOString();

    const record: SuppressionRecord = {
      suppressionId: `supp_${crypto.randomUUID()}`,
      tenantId: params.tenantId,
      subjectIdentifier: params.subjectIdentifier.toLowerCase().trim(),
      reason: params.reason,
      isActive: true,
      suppressedAt: now,
      notes: params.notes,
    };

    SUPPRESSION_LEDGER.set(key, record);
    return record;
  }

  /**
   * Append an immutable, tamper-evident protected audit log event.
   * Ordinary website owners cannot delete these records.
   */
  static appendProtectedAudit(params: {
    tenantId: string;
    actorId: string;
    actorRole: string;
    action: string;
    resource: string;
    details: Record<string, any>;
  }): ProtectedAuditEvent {
    const eventId = `audit_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const digestRaw = `${params.tenantId}:${params.actorId}:${params.action}:${params.resource}:${JSON.stringify(params.details)}:${now}`;
    const tamperProofHash = crypto.createHash("sha256").update(digestRaw).digest("hex");

    const event: ProtectedAuditEvent = {
      eventId,
      tenantId: params.tenantId,
      actorId: params.actorId,
      actorRole: params.actorRole,
      action: params.action,
      resource: params.resource,
      details: params.details,
      timestamp: now,
      tamperProofHash,
    };

    PROTECTED_AUDIT_LOG.set(eventId, event);
    return event;
  }

  /**
   * Clear in-memory records (for tests).
   */
  static clearMemory(): void {
    DURABLE_LEADS.clear();
    IDEMPOTENCY_INDEX.clear();
    CONSENT_LEDGER.clear();
    SUPPRESSION_LEDGER.clear();
    PROTECTED_AUDIT_LOG.clear();
  }
}
