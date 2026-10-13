/**
 * ForgeStudio Execution Blueprint v2.1 — Point 16: Hosting, Export and WordPress Compatibility
 * Routes Integration
 */

import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { scopeToWebsite, requirePlatformAdmin } from "../middlewares/tenantScope.middleware.js";
import { HostingExportController } from "../controllers/hostingExport.controller.js";

const router = Router();

// 1. Destination Capabilities & Wizard
router.get("/destinations/:destinationType/capabilities", requireAuth, HostingExportController.getDestinationCapabilities);

// 2. Hosting Profiles Qualification
router.post("/profiles/qualify", requireAuth, scopeToWebsite(), HostingExportController.qualifyHostingProfile);

// 3. Portable Export Manifest
router.post("/export/manifest", requireAuth, scopeToWebsite(), HostingExportController.generatePortableExport);

// 4. WordPress Compatibility
router.post("/wordpress/map", requireAuth, HostingExportController.mapToWordPress);

// 5. SFTP Limitations Assessment
router.post("/sftp/assess", requireAuth, HostingExportController.assessSftp);

export default router;
