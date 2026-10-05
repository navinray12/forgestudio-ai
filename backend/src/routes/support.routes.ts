import express, { type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireSupportPermission } from "../middlewares/supportAuthorization.middleware.js";
import {
  createTicketHandler,
  listTicketsHandler,
  getTicketHandler,
  addMessageHandler,
  addInternalNoteHandler,
  uploadAttachmentHandler,
  downloadAttachmentHandler,
  assignTicketHandler,
  updateStatusHandler,
  updatePriorityHandler,
  resolveTicketHandler,
  reopenTicketHandler,
  closeTicketHandler,
  listCategoriesHandler,
  createCategoryHandler,
  listTeamsHandler,
  createTeamHandler,
  addTeamMemberHandler,
  getSlaPoliciesHandler,
  getAnalyticsHandler,
  getAuditLogHandler,
  mergeTicketsHandler,
  splitTicketHandler,
  detectDuplicatesHandler,
  bulkUpdateHandler,
  listCannedResponsesHandler,
  createCannedResponseHandler,
  submitCsatHandler,
} from "../controllers/support.controller.js";

const router = express.Router();

// Attachment upload parser middleware
async function parseAttachmentUpload(req: Request, res: Response, next: NextFunction) {
  try {
    const contentType = req.headers["content-type"] || "";
    let fileBuffer: Buffer | null = null;
    let originalName = "attachment.dat";
    let mimeType = "application/octet-stream";

    if (contentType.includes("multipart/form-data")) {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const rawBuffer = Buffer.concat(chunks);
      const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
      const boundary = boundaryMatch ? boundaryMatch[1] || boundaryMatch[2] : null;

      if (boundary) {
        const boundaryBuffer = Buffer.from(`--${boundary}`);
        const parts = splitBuffer(rawBuffer, boundaryBuffer);
        for (const part of parts) {
          const headerEnd = part.indexOf("\r\n\r\n");
          if (headerEnd === -1) continue;
          const headerText = part.subarray(0, headerEnd).toString("utf8");
          if (headerText.includes('name="file"') || headerText.includes('filename=')) {
            const filenameMatch = headerText.match(/filename="([^"]+)"/i);
            if (filenameMatch) originalName = filenameMatch[1];
            const mimeMatch = headerText.match(/Content-Type:\s*([^\r\n]+)/i);
            if (mimeMatch) mimeType = mimeMatch[1].trim();

            let body = part.subarray(headerEnd + 4);
            if (body.subarray(body.length - 2).toString() === "\r\n") {
              body = body.subarray(0, body.length - 2);
            }
            fileBuffer = body;
            break;
          }
        }
      }
    } else if (req.body && Buffer.isBuffer(req.body)) {
      fileBuffer = req.body;
    }

    if (fileBuffer) {
      (req as any).file = {
        buffer: fileBuffer,
        originalname: originalName,
        mimetype: mimeType,
        size: fileBuffer.length,
      };
    }
    next();
  } catch (err) {
    next(err);
  }
}

function splitBuffer(buffer: Buffer, delimiter: Buffer): Buffer[] {
  const parts: Buffer[] = [];
  let start = 0;
  let index: number;
  while ((index = buffer.indexOf(delimiter, start)) !== -1) {
    if (index > start) parts.push(buffer.subarray(start, index));
    start = index + delimiter.length;
  }
  if (start < buffer.length) parts.push(buffer.subarray(start));
  return parts;
}

// All support endpoints require authentication
router.use(requireAuth);

// Categories
router.get("/categories", requireSupportPermission("ticket:create"), listCategoriesHandler);
router.post("/categories", requireSupportPermission("ticket:manage_categories"), createCategoryHandler);

// Teams & Members
router.get("/teams", requireSupportPermission("ticket:manage_teams"), listTeamsHandler);
router.post("/teams", requireSupportPermission("ticket:manage_teams"), createTeamHandler);
router.post("/teams/:teamId/members", requireSupportPermission("ticket:manage_teams"), addTeamMemberHandler);

// SLA Policies
router.get("/sla", requireSupportPermission("ticket:manage_sla"), getSlaPoliciesHandler);

// Support Analytics & Audit
router.get("/analytics", requireSupportPermission("ticket:view_analytics"), getAnalyticsHandler);
router.get("/search", requireSupportPermission("ticket:view_own"), listTicketsHandler);

// Canned Responses
router.get("/canned-responses", requireSupportPermission("ticket:reply"), listCannedResponsesHandler);
router.post("/canned-responses", requireSupportPermission("ticket:manage_categories"), createCannedResponseHandler);

// Duplicate Detection & Bulk Operations (Must precede /tickets/:id parameter matching)
router.get("/tickets/duplicates/check", requireSupportPermission("ticket:view_own"), detectDuplicatesHandler);
router.post("/tickets/bulk-update", requireSupportPermission("ticket:assign"), bulkUpdateHandler);

// Ticket Lifecycle Operations
router.get("/tickets", requireSupportPermission("ticket:view_own"), listTicketsHandler);
router.post("/tickets", requireSupportPermission("ticket:create"), createTicketHandler);

router.get("/tickets/:id", requireSupportPermission("ticket:view_own"), getTicketHandler);
router.post("/tickets/:id/messages", requireSupportPermission("ticket:reply"), addMessageHandler);
router.post("/tickets/:id/internal-notes", requireSupportPermission("ticket:internal_note"), addInternalNoteHandler);

// Attachment Upload & Secure Download
router.post("/tickets/:id/attachments", requireSupportPermission("ticket:reply"), parseAttachmentUpload, uploadAttachmentHandler);
router.get("/tickets/:id/attachments/:attachmentId/download", requireSupportPermission("ticket:view_own"), downloadAttachmentHandler);

// Staff Operations (Merge & Split)
router.post("/tickets/:id/merge", requireSupportPermission("ticket:assign"), mergeTicketsHandler);
router.post("/tickets/:id/split", requireSupportPermission("ticket:assign"), splitTicketHandler);

// Customer CSAT Rating
router.post("/tickets/:id/csat", requireSupportPermission("ticket:view_own"), submitCsatHandler);

// Staff Actions
router.post("/tickets/:id/assign", requireSupportPermission("ticket:assign"), assignTicketHandler);
router.post("/tickets/:id/status", requireSupportPermission("ticket:change_status"), updateStatusHandler);
router.post("/tickets/:id/priority", requireSupportPermission("ticket:change_priority"), updatePriorityHandler);
router.post("/tickets/:id/resolve", requireSupportPermission("ticket:resolve"), resolveTicketHandler);
router.post("/tickets/:id/reopen", requireSupportPermission("ticket:reopen"), reopenTicketHandler);
router.post("/tickets/:id/close", requireSupportPermission("ticket:close"), closeTicketHandler);
router.get("/tickets/:id/audit", requireSupportPermission("ticket:view_audit"), getAuditLogHandler);

export default router;
