/**
 * Points 09 & 10: CMS Provisioning and Content Management Routes
 */

import { Router } from "express";
import { cmsProvisioningController } from "../controllers/cmsProvisioning.controller.js";

const router = Router();

// Point 09: Recipe & Provisioning lifecycle
router.post("/recipes/plan", (req, res) => cmsProvisioningController.planProvisioning(req, res));
router.post("/recipes/:operationId/execute", (req, res) => cmsProvisioningController.executeProvisioning(req, res));
router.post("/migration-preview", (req, res) => cmsProvisioningController.getMigrationPreview(req, res));
router.post("/click-to-edit", (req, res) => cmsProvisioningController.updateClickToEdit(req, res));

// Point 10: Revisions, Publishing, Scheduling, Trash, and Import
router.post("/entries/:entryId/draft", (req, res) => cmsProvisioningController.saveDraft(req, res));
router.post("/entries/:entryId/publish", (req, res) => cmsProvisioningController.publishEntry(req, res));
router.post("/entries/:entryId/schedule", (req, res) => cmsProvisioningController.scheduleEntry(req, res));
router.post("/entries/:entryId/unpublish", (req, res) => cmsProvisioningController.unpublishEntry(req, res));
router.post("/entries/:entryId/trash", (req, res) => cmsProvisioningController.trashEntry(req, res));
router.post("/entries/:entryId/restore", (req, res) => cmsProvisioningController.restoreEntry(req, res));
router.post("/import/preview", (req, res) => cmsProvisioningController.previewImport(req, res));

export default router;
