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

import {
  upsertFormDeliveryPolicy,
  listFormDeliveryPolicy,
  deleteFormDeliveryPolicy,
} from "../services/form/formDeliveryPolicy.service.js";

const router = Router();

// Public submission endpoint
router.post("/submit", submitFormHandler);

// Authenticated owner/admin management of encrypted server-only form integration settings.
// No credentials or destinations are returned by GET.
router.get("/:websiteId/forms/:formId/delivery", requireAuth, async (req, res, next) => {
  try {
    const result = await listFormDeliveryPolicy(String(req.params.websiteId),
      String(req.params.formId), res.locals.user.id);
    res.setHeader("Cache-Control", "no-store");
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});
router.put("/:websiteId/forms/:formId/delivery", requireAuth, async (req, res, next) => {
  try {
    const result = await upsertFormDeliveryPolicy(String(req.params.websiteId),
      String(req.params.formId), res.locals.user.id, req.body?.actions);
    res.setHeader("Cache-Control", "no-store");
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});
router.delete("/:websiteId/forms/:formId/delivery", requireAuth, async (req, res, next) => {
  try {
    const result = await deleteFormDeliveryPolicy(String(req.params.websiteId),
      String(req.params.formId), res.locals.user.id);
    res.setHeader("Cache-Control", "no-store");
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

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
