import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  registerFormSchema,
  getFormSchema,
  validateFormSubmissionAgainstSchema,
  type FormSchemaDefinition,
} from "../services/formsLeads/formSchema.service.js";

import {
  initiateQuarantinedUpload,
  processUploadScan,
  verifyUploadForSubmission,
  cleanupExpiredAbandonedUploads,
} from "../services/formsLeads/quarantinedUpload.service.js";

import {
  executeAtomicSubmission,
  getStoredSubmission,
} from "../services/formsLeads/atomicSubmissionBoundary.service.js";

import {
  createLeadRecord,
  getLeadRecord,
  transitionLeadStage,
  addLeadNote,
  mergeLeads,
} from "../services/formsLeads/leadLifecycle.service.js";

import {
  enqueueOutboxEvent,
  acquireOutboxLease,
  completeOutboxDelivery,
  recordOutboxFailure,
  replayDeadLetterEvent,
} from "../services/formsLeads/durableOutboxWorker.service.js";

import { getDisasterRecoveryProfile } from "../services/formsLeads/disasterRecoveryAudit.service.js";

describe("Point 12 — Forms, Leads and Business Truth", () => {
  const websiteId = "site-forms-test";
  const tenantId = "tenant-forms-test";
  const formId = "contact-form-v1";

  it("should register and validate typed, versioned form schemas with conditional logic", () => {
    const schema: FormSchemaDefinition = {
      id: formId,
      websiteId,
      version: 1,
      name: "Contact & Intake Form",
      purpose: "Customer service inquiry",
      fields: [
        {
          id: "fld:name",
          name: "fullName",
          type: "text",
          label: "Full Name",
          collectionRationale: "Customer identity for response",
          required: true,
          sensitivity: "PII",
          retentionClass: "STANDARD",
        },
        {
          id: "fld:email",
          name: "email",
          type: "email",
          label: "Email Address",
          collectionRationale: "Required for replying to inquiry",
          required: true,
          sensitivity: "PII",
          retentionClass: "STANDARD",
        },
        {
          id: "fld:need_quote",
          name: "needQuote",
          type: "radio",
          label: "Do you need a price quote?",
          collectionRationale: "Inquiry categorization",
          required: false,
          allowedValues: ["yes", "no"],
          sensitivity: "INTERNAL",
          retentionClass: "STANDARD",
        },
        {
          id: "fld:budget",
          name: "estimatedBudget",
          type: "number",
          label: "Estimated Budget ($)",
          collectionRationale: "Lead qualification sizing",
          required: false,
          sensitivity: "INTERNAL",
          retentionClass: "STANDARD",
          validationRules: { minValue: 100 },
        },
      ],
      conditionalBlocks: [
        {
          id: "cond:budget_show",
          targetFieldId: "estimatedBudget",
          action: "show",
          matchType: "all",
          rules: [{ fieldId: "needQuote", operator: "equals", value: "yes" }],
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const registered = registerFormSchema(schema);
    assert.equal(registered.version, 1);

    // Validate valid submission
    const valResult = validateFormSubmissionAgainstSchema(schema, {
      fullName: "Jane Doe",
      email: "jane@example.com",
      needQuote: "yes",
      estimatedBudget: 500,
    });
    assert.equal(valResult.isValid, true);
    assert.equal(valResult.sanitizedValues.estimatedBudget, 500);

    // Validate conditional exclusion: when needQuote is 'no', estimatedBudget is hidden and excluded
    const hiddenResult = validateFormSubmissionAgainstSchema(schema, {
      fullName: "Jane Doe",
      email: "jane@example.com",
      needQuote: "no",
      estimatedBudget: 50, // Below minValue 100, but hidden so excluded!
    });
    assert.equal(hiddenResult.isValid, true);
    assert.equal(hiddenResult.sanitizedValues.estimatedBudget, undefined);
  });

  it("should quarantine file uploads and reject malware before submission attachment", () => {
    // 1. Initiate upload
    const upload = initiateQuarantinedUpload({
      websiteId,
      tenantId,
      formId,
      fileName: "resume.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2048,
    });
    assert.equal(upload.status, "INITIATED");
    assert.equal(upload.isPubliclyAccessible, false, "Must never be publicly accessible");

    // 2. Scan safe file
    const safeBuffer = Buffer.from("%PDF-1.4 sample content for testing");
    const scanned = processUploadScan({
      uploadId: upload.uploadId,
      fileBuffer: safeBuffer,
      simulateMalware: false,
    });
    assert.equal(scanned.status, "VERIFIED_SAFE");

    // 3. Verify upload is attachable
    const verified = verifyUploadForSubmission(upload.uploadId, tenantId, websiteId);
    assert.equal(verified.uploadId, upload.uploadId);

    // 4. Test malware rejection
    const malwareUpload = initiateQuarantinedUpload({
      websiteId,
      tenantId,
      formId,
      fileName: "infected.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
    });
    const rejected = processUploadScan({
      uploadId: malwareUpload.uploadId,
      fileBuffer: Buffer.from("malware byte payload"),
      simulateMalware: true,
    });
    assert.equal(rejected.status, "REJECTED_MALWARE");

    // 5. Attempting to attach rejected upload must fail
    assert.throws(
      () => {
        verifyUploadForSubmission(malwareUpload.uploadId, tenantId, websiteId);
      },
      (err: any) => err.code === "UPLOAD_NOT_VERIFIED",
      "Must reject unverified upload attachment"
    );
  });

  it("should enforce atomic submission boundary, idempotency, and abuse controls", async () => {
    const idempotencyKey = `idem_key_${Date.now().toString(36)}_unique`;
    const payload = {
      websiteId,
      tenantId,
      formId,
      idempotencyKey,
      fields: {
        fullName: "John Smith",
        email: "john@example.com",
        needQuote: "no",
      },
      consentGiven: true,
      consentPurpose: "CUSTOMER_INQUIRY",
    };

    // 1. First execution creates accepted submission & lead
    const receipt1 = await executeAtomicSubmission(payload);
    assert.equal(receipt1.status, "ACCEPTED_DURABLE");
    assert.equal(receipt1.idempotentReplay, false);
    assert.ok(receipt1.receiptId);
    assert.ok(receipt1.leadId);

    // 2. Exact repeated idempotency key returns original receipt (Idempotent replay)
    const receipt2 = await executeAtomicSubmission(payload);
    assert.equal(receipt2.receiptId, receipt1.receiptId);
    assert.equal(receipt2.idempotentReplay, true, "Must be flagged as idempotent replay");

    // 3. Repeated idempotency key with conflicting payload throws 409
    await assert.rejects(
      async () => {
        await executeAtomicSubmission({
          ...payload,
          fields: {
            ...payload.fields,
            fullName: "Changed Person Name", // Changed payload!
          },
        });
      },
      (err: any) => err.code === "IDEMPOTENCY_CONFLICT",
      "Must throw IDEMPOTENCY_CONFLICT on payload tampering"
    );

    // 4. Honeypot check: submissions tripping honeypot are dropped without lead creation
    const botPayload = {
      ...payload,
      idempotencyKey: `idem_bot_${Date.now()}`,
      honeypotValue: "spam-bot-value",
    };
    const botReceipt = await executeAtomicSubmission(botPayload);
    assert.equal(botReceipt.receiptId, "rcpt_dropped_bot");
  });

  it("should manage authoritative lead lifecycle with validated stage transitions", async () => {
    const lead = createLeadRecord({
      websiteId,
      tenantId,
      contactName: "Alice Walker",
      contactEmail: "alice@example.com",
      data: { inquiryType: "Consulting" },
      provenanceSource: "WEBSITE_FORM",
    });
    assert.equal(lead.stage, "NEW");

    // Legal transition: NEW -> CONTACTED
    const contacted = await transitionLeadStage({
      leadId: lead.leadId,
      tenantId,
      actorId: "staff-1",
      targetStage: "CONTACTED",
    });
    assert.equal(contacted.stage, "CONTACTED");

    // Illegal transition: CONTACTED -> WON directly (skipping qualification!)
    await assert.rejects(
      async () => {
        await transitionLeadStage({
          leadId: lead.leadId,
          tenantId,
          actorId: "staff-1",
          targetStage: "WON",
        });
      },
      (err: any) => err.code === "ILLEGAL_STAGE_TRANSITION",
      "Must reject skipping QUALIFIED stage"
    );

    // Transition CONTACTED -> QUALIFIED requires qualification evidence
    await assert.rejects(
      async () => {
        await transitionLeadStage({
          leadId: lead.leadId,
          tenantId,
          actorId: "staff-1",
          targetStage: "QUALIFIED",
          qualificationEvidence: "", // Empty evidence!
        });
      },
      (err: any) => err.code === "MISSING_QUALIFICATION_EVIDENCE",
      "Must require qualification evidence"
    );

    const qualified = await transitionLeadStage({
      leadId: lead.leadId,
      tenantId,
      actorId: "staff-1",
      targetStage: "QUALIFIED",
      qualificationEvidence: "Verified budget of $5,000 and Q4 timeline via call",
    });
    assert.equal(qualified.stage, "QUALIFIED");

    // Add note
    const note = addLeadNote({
      leadId: lead.leadId,
      tenantId,
      authorId: "staff-1",
      authorName: "Sarah Staff",
      content: "Client confirmed readiness for proposal review.",
    });
    assert.equal(note.isInternalOnly, true);
    assert.equal(qualified.notes.length, 1);
  });

  it("should enforce transactional outbox leases, fencing tokens, and backoff", async () => {
    // 1. Enqueue outbox event
    const event = enqueueOutboxEvent({
      tenantId,
      websiteId,
      eventType: "lead.accepted",
      payload: { leadId: "lead-123" },
      destination: "crm.webhook",
      maxAttempts: 3,
    });
    assert.equal(event.status, "QUEUED");

    // 2. Worker 1 acquires fenced lease
    const leased = acquireOutboxLease("worker-1", 10000);
    assert.ok(leased, "Worker 1 should acquire lease");
    assert.equal(leased.status, "PROCESSING");
    assert.ok(leased.leaseToken);

    // 3. Stale worker trying to complete with invalid lease token is rejected
    assert.throws(
      () => {
        completeOutboxDelivery(leased.eventId, "stale-lease-token");
      },
      (err: any) => err.code === "STALE_WORKER_LEASE",
      "Must reject stale worker lease"
    );

    // 4. Record failure and trigger backoff
    const failedAttempt = await recordOutboxFailure(
      leased.eventId,
      leased.leaseToken!,
      "Network connection timeout (504)",
      false
    );
    assert.equal(failedAttempt.status, "QUEUED");
    assert.equal(failedAttempt.attemptCount, 1);

    // 5. Disaster recovery profile truthful disclosures
    const dr = getDisasterRecoveryProfile();
    assert.equal(dr.observedRecoveryPointObjectiveMinutes, 15);
    assert.ok(dr.durabilityDisclosures.some((d) => d.includes("15-minute Recovery Point Objective")));
  });
});
