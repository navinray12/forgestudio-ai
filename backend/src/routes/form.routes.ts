import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
  submitFormHandler,
  getWebsiteSubmissionsHandler,
  deleteSubmissionHandler,
  exportSubmissionsHandler,
  downloadSubmissionPdfHandler,
} from "../controllers/form.controller.js";
import {
  listLeadsHandler,
  getLeadHandler,
  transitionLeadHandler,
  addLeadNoteHandler,
  assignLeadHandler,
} from "../controllers/lead.controller.js";

const router = Router();

// Public submission endpoint
router.post("/submit", submitFormHandler);

// Protected endpoints for website owners to inspect leads
router.get("/:websiteId/submissions", requireAuth, getWebsiteSubmissionsHandler);
router.get("/:websiteId/submissions/:submissionId/pdf", requireAuth, downloadSubmissionPdfHandler);
router.delete("/:websiteId/submissions/:submissionId", requireAuth, deleteSubmissionHandler);
router.get("/:websiteId/export", requireAuth, exportSubmissionsHandler);

// Durable leads (blueprint §12): membership is derived from the session; other tenants get 404.
router.get("/:websiteId/leads", requireAuth, listLeadsHandler);
router.get("/leads/:leadId", requireAuth, getLeadHandler);
router.post("/leads/:leadId/transition", requireAuth, transitionLeadHandler);
router.post("/leads/:leadId/notes", requireAuth, addLeadNoteHandler);
router.post("/leads/:leadId/assign", requireAuth, assignLeadHandler);

export default router;
