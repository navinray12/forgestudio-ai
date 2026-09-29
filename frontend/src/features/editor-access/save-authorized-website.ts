export interface DocumentAcknowledgement {
  id: string; name: string; slug: string; status: string; documentVersion: number; updatedAt: string;
}
export interface DocumentWriteOptions { expectedVersion: number; key: string; signal?: AbortSignal; }
export class DocumentSaveError extends Error {
  readonly status: number;
  readonly code: string;
  readonly outcomeUnknown: boolean;
  constructor(message: string, status: number, code: string, outcomeUnknown = false) {
    super(message); this.name = "DocumentSaveError";
    this.status = status; this.code = code; this.outcomeUnknown = outcomeUnknown;
  }
}
const serverOwned = new Set(["publishedData", "publishing", "releases", "currentReleaseId", "deploymentHistory", "deployment", "backups", "backupPolicy", "hostingConfig", "customDomains", "scheduledPublish"]);
/** The browser submits draft fields only. Publication/configuration is a different command. */
export function draftWritePayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new DocumentSaveError("Invalid save request", 422, "DOCUMENT_INVALID");
  const cloned = JSON.parse(JSON.stringify(payload));
  if (cloned.editorData && typeof cloned.editorData === "object") for (const key of serverOwned) delete cloned.editorData[key];
  return cloned;
}
export async function saveAuthorizedWebsite(base: string, websiteId: string, payload: unknown, options: DocumentWriteOptions): Promise<DocumentAcknowledgement> {
  if (!options || !Number.isInteger(options.expectedVersion) || options.expectedVersion < 1 || !/^[A-Za-z0-9._:-]{8,128}$/.test(options.key)) {
    throw new DocumentSaveError("Reload the website before saving", 428, "DOCUMENT_PRECONDITION_REQUIRED");
  }
  const body = JSON.stringify(draftWritePayload(payload));
  let response: Response;
  const deadline = AbortSignal.timeout(15000);
  try {
    response = await fetch(`${base}/api/websites/${encodeURIComponent(websiteId)}`, {
      method: "PUT", credentials: "include", headers: { "Content-Type": "application/json", "X-Forge-Intent": "document-command",
        "If-Match": `"${websiteId}:document:${options.expectedVersion}"`, "Idempotency-Key": options.key },
      body, signal: options.signal ? AbortSignal.any([options.signal, deadline]) : deadline,
    });
  } catch { throw new DocumentSaveError("Save outcome is unknown. Retry this same save before submitting newer changes.", 0, "DOCUMENT_OUTCOME_UNKNOWN", true); }
  let result;
  try { result = await response.json(); }
  catch { throw new DocumentSaveError("Save acknowledgement could not be read. Retry the same save.", response.status, "DOCUMENT_OUTCOME_UNKNOWN", true); }
  if (!response.ok) throw new DocumentSaveError(result?.error?.message || result?.detail || "The server did not confirm this save. Changes remain unsaved.", response.status,
    result?.code || result?.error?.code || "DOCUMENT_SAVE_FAILED", response.status >= 500);
  const saved = result?.website;
  if (!saved || saved.id !== websiteId || !Number.isInteger(saved.documentVersion) || saved.documentVersion < options.expectedVersion || saved.documentVersion > options.expectedVersion + 1) {
    throw new DocumentSaveError("The server returned an invalid save acknowledgement. Retry the same save.", response.status, "DOCUMENT_OUTCOME_UNKNOWN", true);
  }
  return saved;
}
