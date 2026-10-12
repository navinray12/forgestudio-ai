import crypto from "node:crypto";
import { AppError } from "../../utils/app-error.js";

export type UploadQuarantineStatus =
  | "INITIATED"
  | "QUARANTINED"
  | "SCANNING"
  | "VERIFIED_SAFE"
  | "REJECTED_MALWARE"
  | "REJECTED_POLICY"
  | "EXPIRED"
  | "ATTACHED_SUBMITTED";

export interface QuarantinedUploadRecord {
  uploadId: string;
  websiteId: string;
  tenantId: string;
  formId: string;
  originalFileName: string;
  sanitizedFileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256Hash: string;
  status: UploadQuarantineStatus;
  statusReason?: string;
  scannerEngine: string;
  scannerSignature?: string;
  isPubliclyAccessible: boolean;
  isAttachedToSubmission: boolean;
  submissionId?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

// In-memory quarantined upload registry
const quarantinedUploadStore = new Map<string, QuarantinedUploadRecord>();

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB limit

/**
 * Initiates an upload reservation within tenant boundaries.
 */
export function initiateQuarantinedUpload(params: {
  websiteId: string;
  tenantId: string;
  formId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): QuarantinedUploadRecord {
  const { websiteId, tenantId, formId, fileName, mimeType, sizeBytes } = params;

  if (sizeBytes > MAX_UPLOAD_BYTES) {
    throw new AppError(`File exceeds maximum size limit of 10MB (${sizeBytes} bytes)`, 400, "FILE_TOO_LARGE");
  }

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new AppError(`MIME type '${mimeType}' is not permitted for form uploads`, 400, "DISALLOWED_MIME_TYPE");
  }

  const uploadId = `upl_${crypto.randomUUID()}`;
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

  const record: QuarantinedUploadRecord = {
    uploadId,
    websiteId,
    tenantId,
    formId,
    originalFileName: fileName,
    sanitizedFileName: sanitized,
    mimeType,
    sizeBytes,
    sha256Hash: "",
    status: "INITIATED",
    scannerEngine: "clamav-heuristics-v2",
    isPubliclyAccessible: false, // Strict invariant: Never publicly exposed while in quarantine!
    isAttachedToSubmission: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour TTL before expiry if abandoned
  };

  quarantinedUploadStore.set(uploadId, record);
  return record;
}

/**
 * Ingests upload payload bytes, computes cryptographic hash, and executes quarantine scanning.
 */
export function processUploadScan(params: {
  uploadId: string;
  fileBuffer: Buffer;
  simulateMalware?: boolean;
}): QuarantinedUploadRecord {
  const { uploadId, fileBuffer, simulateMalware = false } = params;
  const record = quarantinedUploadStore.get(uploadId);

  if (!record) {
    throw new AppError("Quarantined upload record not found", 404, "UPLOAD_NOT_FOUND");
  }

  if (record.status !== "INITIATED" && record.status !== "QUARANTINED") {
    throw new AppError(`Cannot scan upload in status: ${record.status}`, 409, "INVALID_UPLOAD_STATE");
  }

  record.sha256Hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
  record.sizeBytes = fileBuffer.length;
  record.status = "SCANNING";

  // Simulate or execute malware heuristics inspection
  if (simulateMalware || fileBuffer.toString("utf8", 0, 100).includes("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR")) {
    record.status = "REJECTED_MALWARE";
    record.statusReason = "Malware payload signature detected by quarantine scanner";
    record.updatedAt = new Date().toISOString();
    return record;
  }

  record.status = "VERIFIED_SAFE";
  record.scannerSignature = `sig_${record.sha256Hash.substring(0, 16)}`;
  record.updatedAt = new Date().toISOString();
  return record;
}

/**
 * Verifies that upload is safe and validly belongs to the given tenant and form.
 */
export function verifyUploadForSubmission(
  uploadId: string,
  tenantId: string,
  websiteId: string
): QuarantinedUploadRecord {
  const record = quarantinedUploadStore.get(uploadId);
  if (!record) {
    throw new AppError(`Upload not found: ${uploadId}`, 404, "UPLOAD_NOT_FOUND");
  }

  if (record.tenantId !== tenantId || record.websiteId !== websiteId) {
    throw new AppError("Cross-tenant upload reference rejected", 403, "TENANT_UPLOAD_MISMATCH");
  }

  if (record.status !== "VERIFIED_SAFE") {
    throw new AppError(
      `File upload cannot be attached: status is ${record.status} (${record.statusReason || "Unverified"})`,
      400,
      "UPLOAD_NOT_VERIFIED"
    );
  }

  return record;
}

/**
 * Attaches verified upload to a confirmed submission.
 */
export function attachUploadToSubmission(uploadId: string, submissionId: string) {
  const record = quarantinedUploadStore.get(uploadId);
  if (record) {
    record.status = "ATTACHED_SUBMITTED";
    record.isAttachedToSubmission = true;
    record.submissionId = submissionId;
    record.updatedAt = new Date().toISOString();
  }
}

/**
 * Cleans up unattached abandoned uploads that have passed their TTL.
 */
export function cleanupExpiredAbandonedUploads(): { purgedCount: number } {
  let purgedCount = 0;
  const now = Date.now();
  for (const [key, record] of quarantinedUploadStore.entries()) {
    if (!record.isAttachedToSubmission && new Date(record.expiresAt).getTime() < now) {
      quarantinedUploadStore.delete(key);
      purgedCount++;
    }
  }
  return { purgedCount };
}
