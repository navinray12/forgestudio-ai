import { Router } from "express";
import {
  createSchemaHandler,
  getSchemaHandler,
  uploadFileInitHandler,
  submitFormAtomicHandler,
  getSubmissionHandler,
  listLeadsHandler,
  transitionLeadStageHandler,
  getDisasterRecoveryProfileHandler,
} from "../controllers/formsLeads.controller.js";

const router = Router();

// Schema endpoints
router.post("/schemas", createSchemaHandler);
router.get("/schemas/:websiteId/:formId", getSchemaHandler);

// Upload endpoint
router.post("/uploads/init", uploadFileInitHandler);

// Atomic submission endpoint
router.post("/submissions", submitFormAtomicHandler);
router.get("/submissions/:receiptId", getSubmissionHandler);

// Lead lifecycle endpoints
router.get("/leads", listLeadsHandler);
router.post("/leads/:leadId/transition", transitionLeadStageHandler);

// Disaster recovery disclosures
router.get("/disaster-recovery", getDisasterRecoveryProfileHandler);

export default router;
