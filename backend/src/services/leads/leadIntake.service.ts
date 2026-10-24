/**
 * Durable form submission boundary and lead lifecycle (blueprint §12, §15 "chat capture commits
 * through the same lead service").
 *
 * acceptSubmission commits the submission, its lead, the lead's audit event and its notification
 * jobs in one transaction. Only after that commit does the caller return an accepted receipt;
 * email/webhook delivery runs later from background_jobs (durable leases, bounded retries), so an
 * unavailable provider never holds the transaction open or turns a saved lead into a failure.
 *
 * Transition rules and the qualification-evidence rule are the product's existing lead policy
 * (services/formsLeads/leadLifecycle.service.ts), now applied to persisted records.
 */
import crypto from "node:crypto";
import type { PoolClient } from "pg";
import { pgPool } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { verifyProjectAccess } from "../../modules/data-platform/common/project-access.js";

export type LeadStage = "NEW" | "CONTACTED" | "QUALIFIED" | "WON" | "LOST" | "SPAM";
export type LeadProvenance = "WEBSITE_FORM" | "CHAT_AGENT" | "NATIVE_IMPORT";

export const LEAD_STAGES: LeadStage[] = ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST", "SPAM"];
export const VALID_TRANSITIONS: Record<LeadStage, LeadStage[]> = {
  NEW: ["CONTACTED", "QUALIFIED", "LOST", "SPAM"],
  CONTACTED: ["QUALIFIED", "LOST", "SPAM"],
  QUALIFIED: ["WON", "LOST"],
  WON: ["LOST"],
  LOST: ["NEW"],
  SPAM: ["NEW"],
};

export interface LeadNotification {
  runAt?: Date;
  /** Distinguishes multiple destinations of the same notification type. */
  key?: string;
  /** Existing durable job types: WEBHOOK_RETRY delivers webhooks, FORM_NOTIFICATION_EMAIL sends site email. */
  type: "WEBHOOK_RETRY" | "FORM_NOTIFICATION_EMAIL";
  payload: Record<string, unknown>;
}

export interface SubmissionInput {
  websiteId: string;
  formId: string;
  formName?: string;
  data: Record<string, unknown>;
  metadata: Record<string, unknown>;
  idempotencyKey?: string;
  provenance?: LeadProvenance;
  notifications?: LeadNotification[];
}

export interface SubmissionReceipt {
  submissionId: string;
  leadId: string;
  acceptedAt: string;
  replayed: boolean;
}

const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{8,200}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const requestHash = (input: SubmissionInput) =>
  crypto.createHash("sha256").update(JSON.stringify([input.websiteId, input.formId, input.data])).digest("hex");

function pick(data: Record<string, unknown>, pattern: RegExp, max: number): string | null {
  for (const [key, value] of Object.entries(data)) {
    if (pattern.test(key) && typeof value === "string" && value.trim()) return value.trim().slice(0, max);
  }
  return null;
}

async function inTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Accepts a submission atomically. A repeated idempotency key with the same request returns the
 * original receipt; with a different request it is a conflict. Without a key every call is a new
 * enquiry (contact email is deliberately not a deduplication key).
 */
export async function acceptSubmission(input: SubmissionInput): Promise<SubmissionReceipt> {
  if (!UUID.test(input.websiteId) || !input.formId) {
    throw new AppError("Website ID and Form ID are required", 400, "INVALID_FORM_SUBMISSION");
  }
  if (input.idempotencyKey !== undefined && !IDEMPOTENCY_KEY.test(input.idempotencyKey)) {
    throw new AppError("Idempotency-Key must be 8-200 characters of [A-Za-z0-9._:-]", 400, "INVALID_IDEMPOTENCY_KEY");
  }
  const hash = requestHash(input);

  try {
    return await inTransaction(async (client) => {
      if (input.idempotencyKey) {
        // Serializes concurrent requests with the same key for this website.
        await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`form-submission:${input.websiteId}:${input.idempotencyKey}`]);
        const { rows } = await client.query(
          `SELECT id, "leadId", "requestHash", "createdAt" FROM form_submissions WHERE "websiteId" = $1::uuid AND "idempotencyKey" = $2`,
          [input.websiteId, input.idempotencyKey]
        );
        if (rows[0]) {
          if (rows[0].requestHash !== hash) {
            throw new AppError("This idempotency key was already used for a different submission", 409, "IDEMPOTENCY_CONFLICT");
          }
          return { submissionId: rows[0].id, leadId: rows[0].leadId, acceptedAt: new Date(rows[0].createdAt).toISOString(), replayed: true };
        }
      }

      const { rows: [submission] } = await client.query(
        `INSERT INTO form_submissions (id, "websiteId", "formId", "formName", data, metadata, "idempotencyKey", "requestHash", "createdAt")
         VALUES (gen_random_uuid(), $1::uuid, $2, $3, $4::jsonb, $5::jsonb, $6, $7, now()) RETURNING id, "createdAt"`,
        [input.websiteId, input.formId, input.formName || "Contact Form", JSON.stringify(input.data), JSON.stringify(input.metadata),
          input.idempotencyKey ?? null, hash]
      );
      const { rows: [lead] } = await client.query(
        `INSERT INTO forge_leads ("websiteId", "submissionId", provenance, "formId", "displayName", email, phone)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7) RETURNING id`,
        [input.websiteId, submission.id, input.provenance ?? "WEBSITE_FORM", input.formId,
          pick(input.data, /name/i, 255), pick(input.data, /e-?mail/i, 320), pick(input.data, /phone|tel|mobile/i, 64)]
      );
      await client.query(`UPDATE form_submissions SET "leadId" = $1::uuid WHERE id = $2::uuid`, [lead.id, submission.id]);
      await client.query(
        `INSERT INTO forge_lead_events ("leadId", "websiteId", type, "toStage", data) VALUES ($1::uuid, $2::uuid, 'CREATED', 'NEW', $3::jsonb)`,
        [lead.id, input.websiteId, JSON.stringify({ submissionId: submission.id, provenance: input.provenance ?? "WEBSITE_FORM" })]
      );
      for (const notification of input.notifications ?? []) {
        await client.query(
          `INSERT INTO background_jobs (id, type, payload, status, attempts, "maxAttempts", "runAt", "idempotencyKey", "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), $1, $2::jsonb, 'QUEUED', 0, 5, $4, $3, now(), now())`,
          [notification.type, JSON.stringify({ ...notification.payload, leadId: lead.id, submissionId: submission.id }),
            `lead:${lead.id}:${notification.type}${notification.key ? `:${notification.key}` : ""}`, notification.runAt || new Date()]
        );
      }
      return { submissionId: submission.id, leadId: lead.id, acceptedAt: new Date(submission.createdAt).toISOString(), replayed: false };
    });
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    if (err?.code === "23503") throw new AppError("Website not found", 404, "WEBSITE_NOT_FOUND");
    if (err?.code === "23505") throw new AppError("This idempotency key was already used for a different submission", 409, "IDEMPOTENCY_CONFLICT");
    // Nothing was committed; the visitor must not be told the enquiry was received.
    console.error("[lead intake] submission was not saved:", err?.message || err);
    throw new AppError("Your submission could not be saved. Please try again.", 503, "SUBMISSION_NOT_SAVED");
  }
}

/** True when this key already recorded a submission for the website (a retry of a committed request). */
export async function isKnownSubmissionKey(websiteId: string, idempotencyKey: string | undefined): Promise<boolean> {
  if (!idempotencyKey || !UUID.test(websiteId) || !IDEMPOTENCY_KEY.test(idempotencyKey)) return false;
  const { rowCount } = await pgPool.query(
    `SELECT 1 FROM form_submissions WHERE "websiteId" = $1::uuid AND "idempotencyKey" = $2`, [websiteId, idempotencyKey]);
  return (rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------------------------
// Staff-facing lead management (membership derived from the session, never from the client)
// ---------------------------------------------------------------------------------------------

const LEAD_COLUMNS = `l.id, l."websiteId", l."submissionId", l.provenance, l."formId", l."displayName", l.email, l.phone, l.stage,
  l."assignedToId", l."qualificationEvidence", l.revision, l."createdAt", l."updatedAt", l."stageChangedAt"`;

export async function listLeads(websiteId: string, userId: string, stage?: string) {
  await verifyProjectAccess(websiteId, userId);
  if (stage !== undefined && !LEAD_STAGES.includes(stage as LeadStage)) {
    throw new AppError(`stage must be one of ${LEAD_STAGES.join(", ")}`, 400, "INVALID_STAGE");
  }
  const { rows } = await pgPool.query(
    `SELECT ${LEAD_COLUMNS} FROM forge_leads l WHERE l."websiteId" = $1::uuid ${stage ? "AND l.stage = $2" : ""} ORDER BY l."createdAt" DESC LIMIT 500`,
    stage ? [websiteId, stage] : [websiteId]
  );
  return rows;
}

async function loadLeadForMember(leadId: string, userId: string) {
  if (!UUID.test(leadId)) throw new AppError("Lead not found", 404, "LEAD_NOT_FOUND");
  const { rows } = await pgPool.query(`SELECT "websiteId" FROM forge_leads WHERE id = $1::uuid`, [leadId]);
  if (!rows[0]) throw new AppError("Lead not found", 404, "LEAD_NOT_FOUND");
  try {
    await verifyProjectAccess(rows[0].websiteId, userId);
  } catch {
    throw new AppError("Lead not found", 404, "LEAD_NOT_FOUND");
  }
  return rows[0].websiteId as string;
}

export async function getLead(leadId: string, userId: string) {
  await loadLeadForMember(leadId, userId);
  const { rows: [lead] } = await pgPool.query(`SELECT ${LEAD_COLUMNS} FROM forge_leads l WHERE l.id = $1::uuid`, [leadId]);
  const { rows: events } = await pgPool.query(
    `SELECT id, "actorId", type, "fromStage", "toStage", note, "createdAt" FROM forge_lead_events WHERE "leadId" = $1::uuid ORDER BY "createdAt"`,
    [leadId]
  );
  return { ...lead, events };
}

/** Moves a lead along the existing transition policy, guarded by its revision, with an audit event. */
export async function transitionLead(params: {
  leadId: string; userId: string; targetStage: string; expectedRevision: number; evidence?: string;
}) {
  const websiteId = await loadLeadForMember(params.leadId, params.userId);
  if (!LEAD_STAGES.includes(params.targetStage as LeadStage)) {
    throw new AppError(`targetStage must be one of ${LEAD_STAGES.join(", ")}`, 400, "INVALID_STAGE");
  }
  const target = params.targetStage as LeadStage;
  const evidence = typeof params.evidence === "string" ? params.evidence.trim() : "";
  if (target === "QUALIFIED" && !evidence) {
    throw new AppError("Qualification requires explicit qualification evidence", 400, "MISSING_QUALIFICATION_EVIDENCE");
  }
  return inTransaction(async (client) => {
    const { rows: [lead] } = await client.query(`SELECT stage, revision FROM forge_leads WHERE id = $1::uuid FOR UPDATE`, [params.leadId]);
    if (lead.revision !== params.expectedRevision) {
      throw new AppError("The lead changed since it was read", 409, "REVISION_CONFLICT");
    }
    if (!VALID_TRANSITIONS[lead.stage as LeadStage].includes(target)) {
      throw new AppError(`Illegal lead stage transition from '${lead.stage}' to '${target}'`, 409, "ILLEGAL_STAGE_TRANSITION");
    }
    const { rows: [updated] } = await client.query(
      `UPDATE forge_leads SET stage = $2::varchar, revision = revision + 1, "updatedAt" = now(), "stageChangedAt" = now(),
         "qualificationEvidence" = CASE WHEN $2::varchar = 'QUALIFIED' THEN $3::text ELSE "qualificationEvidence" END
       WHERE id = $1::uuid RETURNING id, stage, revision, "qualificationEvidence"`,
      [params.leadId, target, evidence || null]
    );
    await client.query(
      `INSERT INTO forge_lead_events ("leadId", "websiteId", "actorId", type, "fromStage", "toStage", note)
       VALUES ($1::uuid, $2::uuid, $3::uuid, 'STAGE_CHANGED', $4, $5, $6)`,
      [params.leadId, websiteId, params.userId, lead.stage, target, evidence || null]
    );
    return updated;
  });
}

/** Records an internal staff note; notes are immutable audit entries. */
export async function addLeadNote(params: { leadId: string; userId: string; note: string }) {
  const websiteId = await loadLeadForMember(params.leadId, params.userId);
  const note = typeof params.note === "string" ? params.note.trim() : "";
  if (!note || note.length > 5000) throw new AppError("note must be 1-5000 characters", 400, "INVALID_NOTE");
  const { rows: [event] } = await pgPool.query(
    `INSERT INTO forge_lead_events ("leadId", "websiteId", "actorId", type, note) VALUES ($1::uuid, $2::uuid, $3::uuid, 'NOTE', $4)
     RETURNING id, type, note, "createdAt"`,
    [params.leadId, websiteId, params.userId, note]
  );
  return event;
}

/** Assigns a lead to a member of the same website, or clears the assignment. */
export async function assignLead(params: { leadId: string; userId: string; assigneeId: string | null; expectedRevision: number }) {
  const websiteId = await loadLeadForMember(params.leadId, params.userId);
  if (params.assigneeId !== null) {
    if (!UUID.test(params.assigneeId)) throw new AppError("assigneeId must be a user id", 400, "INVALID_ASSIGNEE");
    try {
      await verifyProjectAccess(websiteId, params.assigneeId);
    } catch {
      throw new AppError("The assignee is not a member of this website", 400, "INVALID_ASSIGNEE");
    }
  }
  return inTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE forge_leads SET "assignedToId" = $2::uuid, revision = revision + 1, "updatedAt" = now()
       WHERE id = $1::uuid AND revision = $3 RETURNING id, "assignedToId", revision`,
      [params.leadId, params.assigneeId, params.expectedRevision]
    );
    if (!rows[0]) throw new AppError("The lead changed since it was read", 409, "REVISION_CONFLICT");
    await client.query(
      `INSERT INTO forge_lead_events ("leadId", "websiteId", "actorId", type, data) VALUES ($1::uuid, $2::uuid, $3::uuid, 'ASSIGNED', $4::jsonb)`,
      [params.leadId, websiteId, params.userId, JSON.stringify({ assigneeId: params.assigneeId })]
    );
    return rows[0];
  });
}
