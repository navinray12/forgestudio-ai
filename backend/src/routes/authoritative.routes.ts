/**
 * ForgeStudio Execution Blueprint v2.1 — Point 06: Core Architecture and Six Authoritative Records
 * Authoritative Records & Architecture Express Routes
 */

import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
  getBusinessFactsHandler,
  proposeBusinessFactHandler,
  approveBusinessFactHandler,
  getLatestSiteSpecHandler,
  createSiteSpecRevisionHandler,
  convertEditorDataToSiteSpecHandler,
  getSourceManifestHandler,
  registerSourceFileHandler,
  defineCollectionSchemaHandler,
  acceptDurableLeadHandler,
  compileVersionedCandidateHandler,
  getActiveReleaseHandler,
  publishCandidateReleaseHandler,
  rollbackReleaseHandler,
  previewChangeImpactHandler,
  getSecurityPlanesStatusHandler,
} from "../controllers/authoritative.controller.js";

const router = Router();

// Public delivery endpoints
router.get("/business-facts/:websiteId", getBusinessFactsHandler);
router.post("/leads/:websiteId", acceptDurableLeadHandler);
router.get("/releases/:websiteId/active", getActiveReleaseHandler);
router.get("/security-planes/status", getSecurityPlanesStatusHandler);

// Authenticated authoring & governance endpoints
router.use(requireAuth);

// Record 1: Business Facts
router.post("/business-facts/:websiteId/propose", proposeBusinessFactHandler);
router.post("/business-facts/:websiteId/:factId/approve", approveBusinessFactHandler);

// Record 2: SiteSpec
router.get("/sitespec/:websiteId/latest", getLatestSiteSpecHandler);
router.post("/sitespec/:websiteId/revisions", createSiteSpecRevisionHandler);
router.post("/sitespec/:websiteId/convert", convertEditorDataToSiteSpecHandler);

// Record 3: Source Manifest
router.get("/source-manifest/:websiteId", getSourceManifestHandler);
router.post("/source-manifest/:websiteId/files", registerSourceFileHandler);

// Record 4: CMS Schemas
router.post("/cms/:websiteId/collections", defineCollectionSchemaHandler);

// Record 6 & Compiler: Releases & Rollback
router.post("/releases/:websiteId/compile", compileVersionedCandidateHandler);
router.post("/releases/:websiteId/:releaseId/publish", publishCandidateReleaseHandler);
router.post("/releases/:websiteId/rollback", rollbackReleaseHandler);

// Change-Impact Graph
router.post("/change-impact/:websiteId/preview", previewChangeImpactHandler);

export default router;
