import { pgPool } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { assertSafeUrl } from "../../utils/ssrf.guard.js";
import { verifyProjectAccess } from "../../modules/data-platform/common/project-access.js";
import { encryptCredential, decryptCredential } from "../../modules/data-platform/security/encryption.js";

/** Startup gate: missing migrations must stop production before accepting form traffic. */
export async function verifyFormDeliveryPolicyMigration(): Promise<void> {
  const { rows } = await pgPool.query<{ policy_table: string | null }>(
    `SELECT to_regclass('public.form_delivery_policies')::text AS policy_table`
  );
  if (!rows[0]?.policy_table) {
    throw new AppError("Form delivery policy migration is missing", 503, "FORM_DELIVERY_MIGRATION_REQUIRED");
  }
}

type FormActions = Record<string, unknown>;
const FORM_ID = /^[A-Za-z0-9._:-]{1,256}$/;
const ACTION_TYPES = new Set(["database", "email", "webhook", "google_sheets", "mailchimp", "zapier", "redirect", "popup"]);

function validateFormId(formId: string): void {
  if (!FORM_ID.test(formId)) throw new AppError("Invalid form ID", 400, "INVALID_FORM_ID");
}

export function validateDeliveryActions(raw: unknown): FormActions {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new AppError("Form action configuration must be an object", 400, "INVALID_FORM_POLICY");
  }
  const value = raw as FormActions;
  const bytes = Buffer.byteLength(JSON.stringify(value), "utf8");
  if (bytes > 32768) throw new AppError("Form action configuration is too large", 413, "FORM_POLICY_TOO_LARGE");
  const active = value.activeActions;
  if (!Array.isArray(active) || active.length > 12 ||
      active.some((a) => typeof a !== "string" || !ACTION_TYPES.has(a))) {
    throw new AppError("Unknown form delivery action", 400, "INVALID_FORM_POLICY");
  }
  // Duplicate action IDs can cause repeated outbound notifications and billing.
  if (new Set(active).size !== active.length) {
    throw new AppError("Duplicate form delivery actions are not allowed", 400, "INVALID_FORM_POLICY");
  }
  for (const action of ["webhook", "google_sheets", "zapier"]) {
    if (!active.includes(action)) continue;
    const key = action === "webhook" ? "webhookConfig" : action === "google_sheets" ? "googleSheetsConfig" : "zapierConfig";
    const entry = value[key] as Record<string, unknown> | undefined;
    const url = action === "webhook" ? entry?.endpointUrl : entry?.webhookUrl;
    if (typeof url !== "string" || !url.startsWith("https://")) {
      throw new AppError("Form delivery requires a configured HTTPS destination", 400, "INVALID_FORM_POLICY");
    }
    assertSafeUrl(url, "Form delivery destination");
  }
  if (active.includes("email")) {
    const email = (value.emailConfig as Record<string, unknown> | undefined)?.toEmail;
    if (typeof email !== "string" || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AppError("Email delivery recipient is invalid", 400, "INVALID_FORM_POLICY");
    }
  }
  if (active.includes("mailchimp")) {
    const config = value.mailchimpConfig as Record<string, unknown> | undefined;
    if (typeof config?.apiKey !== "string" || typeof config?.listId !== "string" ||
        config.apiKey.trim().length === 0 || config.listId.trim().length === 0 ||
        config.apiKey.length > 512 || config.listId.length > 128) {
      throw new AppError("Mailchimp configuration is invalid", 400, "INVALID_FORM_POLICY");
    }
  }
  if (active.includes("redirect")) {
    const url = (value.redirectConfig as Record<string, unknown> | undefined)?.url;
    if (typeof url !== "string" || !url.startsWith("https://")) {
      throw new AppError("Active form redirect requires an HTTPS URL", 400, "INVALID_FORM_POLICY");
    }
    assertSafeUrl(url, "Form redirect");
  }
  if (active.includes("popup")) {
    const popupId = (value.popupConfig as Record<string, unknown> | undefined)?.popupId;
    if (typeof popupId !== "string" || !FORM_ID.test(popupId)) {
      throw new AppError("Active form popup requires a valid ID", 400, "INVALID_FORM_POLICY");
    }
  }
  if (value.redirectConfig && typeof value.redirectConfig === "object") {
    const redirect = (value.redirectConfig as Record<string, unknown>).url;
    if (redirect !== undefined) {
      if (typeof redirect !== "string" || !redirect.startsWith("https://")) {
        throw new AppError("Form redirect must be HTTPS", 400, "INVALID_FORM_POLICY");
      }
      assertSafeUrl(redirect, "Form redirect");
    }
  }
  return value;
}

async function requireFormAdministrator(websiteId: string, actorId: string): Promise<void> {
  if (typeof actorId !== "string" || !actorId) {
    throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  }
  const access = await verifyProjectAccess(websiteId, actorId);
  if (!access.canAdminister) throw new AppError("Form configuration requires website owner/admin", 403, "FORBIDDEN");
}

/** The policy is encrypted before any write and never returned to browsers. */
export async function upsertFormDeliveryPolicy(websiteId: string, formId: string, actorId: string, raw: unknown) {
  validateFormId(formId);
  await requireFormAdministrator(websiteId, actorId);
  const policy = validateDeliveryActions(raw);
  const encrypted = encryptCredential(JSON.stringify(policy));
  await pgPool.query(`INSERT INTO form_delivery_policies
    ("websiteId","formId","encryptedActions","updatedBy","updatedAt")
    VALUES ($1::uuid,$2,$3,$4::uuid,NOW())
    ON CONFLICT ("websiteId","formId") DO UPDATE SET
      "encryptedActions"=EXCLUDED."encryptedActions",
      "updatedBy"=EXCLUDED."updatedBy","updatedAt"=NOW()`,
    [websiteId, formId, encrypted, actorId]);
  return { configured: true, formId, activeActions: policy.activeActions };
}

export async function listFormDeliveryPolicy(websiteId: string, formId: string, actorId: string) {
  validateFormId(formId);
  await requireFormAdministrator(websiteId, actorId);
  const { rowCount, rows } = await pgPool.query<{ "encryptedActions": string }>(
    `SELECT "encryptedActions" FROM form_delivery_policies WHERE "websiteId"=$1::uuid AND "formId"=$2`,
    [websiteId, formId]
  );
  if (!rowCount) return { configured: false, formId, activeActions: [] };
  const actions = JSON.parse(decryptCredential(rows[0].encryptedActions)) as FormActions;
  // Only return non-sensitive metadata. Do not echo URLs or credential fields.
  return { configured: true, formId, activeActions: actions.activeActions };
}

export async function deleteFormDeliveryPolicy(websiteId: string, formId: string, actorId: string) {
  validateFormId(formId);
  await requireFormAdministrator(websiteId, actorId);
  await pgPool.query(`DELETE FROM form_delivery_policies WHERE "websiteId"=$1::uuid AND "formId"=$2`,
    [websiteId, formId]);
  return { configured: false, formId };
}

export async function getServerFormDeliveryActions(websiteId: string, formId: string): Promise<FormActions | undefined> {
  validateFormId(formId);
  const { rows } = await pgPool.query<{ encryptedActions: string }>(
    `SELECT "encryptedActions" FROM form_delivery_policies WHERE "websiteId"=$1::uuid AND "formId"=$2`,
    [websiteId, formId]
  );
  if (!rows[0]) return undefined;
  const policy = JSON.parse(decryptCredential(rows[0].encryptedActions));
  return validateDeliveryActions(policy);
}
