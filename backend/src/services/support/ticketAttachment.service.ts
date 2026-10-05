import fs from "fs";
import path from "path";
import crypto from "crypto";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";

const db = prisma as any;

const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_ATTACHMENT_SIZE_MB || "10", 10);
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const DISALLOWED_EXTENSIONS = [
  ".exe",
  ".bat",
  ".cmd",
  ".sh",
  ".ps1",
  ".vbs",
  ".dll",
  ".so",
  ".dylib",
  ".com",
  ".scr",
  ".pif",
  ".app",
  ".jar",
  ".iso",
];

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/json",
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
];

export function getUploadDirectory(): string {
  const dir = path.join(process.cwd(), "uploads", "support");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function sanitizeFileName(originalName: string): string {
  const basename = path.basename(originalName);
  return basename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function validateAttachmentFile(file: {
  originalname: string;
  mimetype: string;
  size: number;
}) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (DISALLOWED_EXTENSIONS.includes(ext)) {
    throw new AppError(
      `File extension '${ext}' is disallowed for security reasons.`,
      422,
      "INVALID_ATTACHMENT"
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new AppError(
      `File size exceeds maximum allowed limit of ${MAX_FILE_SIZE_MB}MB.`,
      422,
      "FILE_TOO_LARGE"
    );
  }

  if (file.mimetype && !ALLOWED_MIME_TYPES.includes(file.mimetype) && !ALLOWED_MIME_TYPES.includes("application/octet-stream")) {
    throw new AppError(`MIME type '${file.mimetype}' is not permitted.`, 422, "INVALID_MIME_TYPE");
  }
}

export async function saveSupportAttachment(params: {
  ticketId: string;
  messageId?: string;
  uploadedById: string;
  fileBuffer: Buffer;
  originalName: string;
  mimeType: string;
}) {
  const sanitized = sanitizeFileName(params.originalName);
  validateAttachmentFile({
    originalname: sanitized,
    mimetype: params.mimeType,
    size: params.fileBuffer.length,
  });

  const uploadDir = getUploadDirectory();
  const fileId = crypto.randomUUID();
  const ext = path.extname(sanitized);
  const storageFilename = `${fileId}${ext}`;
  const fullPath = path.join(uploadDir, storageFilename);

  fs.writeFileSync(fullPath, params.fileBuffer);

  const hash = crypto.createHash("sha256").update(params.fileBuffer).digest("hex");

  const attachment = await db.supportTicketAttachment.create({
    data: {
      id: fileId,
      ticketId: params.ticketId,
      messageId: params.messageId || null,
      uploadedById: params.uploadedById,
      fileName: sanitized,
      storageKey: storageFilename,
      mimeType: params.mimeType,
      fileSize: params.fileBuffer.length,
      checksum: hash,
    },
  });

  return attachment;
}

export async function getAttachmentFilePath(attachmentId: string): Promise<{
  attachment: any;
  fullPath: string;
}> {
  const attachment = await db.supportTicketAttachment.findUnique({
    where: { id: attachmentId },
  });

  if (!attachment) {
    throw new AppError("Attachment not found", 404, "NOT_FOUND");
  }

  const uploadDir = getUploadDirectory();
  const fullPath = path.join(uploadDir, attachment.storageKey);

  if (!fs.existsSync(fullPath)) {
    throw new AppError("Attachment file does not exist on disk", 404, "NOT_FOUND");
  }

  return { attachment, fullPath };
}
