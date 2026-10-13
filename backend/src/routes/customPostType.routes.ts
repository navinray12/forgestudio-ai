import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
    getCustomPostTypesHandler,
    createCustomPostTypeHandler,
    deleteCustomPostTypeHandler,
    getCustomFieldsHandler,
    saveCustomFieldsHandler,
    getCustomEntriesHandler,
    createCustomEntryHandler,
    updateCustomEntryHandler,
    restoreCustomEntryHandler,
    getTrashedEntriesHandler,
    createPurgeRequestHandler,
    listPurgeRequestsHandler,
    approvePurgeRequestHandler,
    executePurgeRequestHandler,
    deleteCustomEntryHandler
} from "../controllers/customPostType.controller.js";

const router = Router();

// Used behind /api/cpt nested structures
// Ex: /api/cpt/websites/:websiteId/types
router.get("/websites/:websiteId/types", requireAuth, getCustomPostTypesHandler);
router.post("/websites/:websiteId/types", requireAuth, createCustomPostTypeHandler);
router.delete("/types/:cptId", requireAuth, deleteCustomPostTypeHandler);

// Fields
router.get("/types/:cptId/fields", requireAuth, getCustomFieldsHandler);
router.post("/types/:cptId/fields", requireAuth, saveCustomFieldsHandler);

// Entries
router.get("/types/:cptId/entries", requireAuth, getCustomEntriesHandler);
router.post("/types/:cptId/entries", requireAuth, createCustomEntryHandler);
router.patch("/entries/:entryId", requireAuth, updateCustomEntryHandler);
router.delete("/entries/:entryId", requireAuth, deleteCustomEntryHandler);
router.post("/entries/:entryId/restore", requireAuth, restoreCustomEntryHandler);
router.get("/types/:cptId/trash", requireAuth, getTrashedEntriesHandler);

// Permanent deletion of trashed content: exact manifest, independent approval, expiring (blueprint §10)
router.get("/websites/:websiteId/purge-requests", requireAuth, listPurgeRequestsHandler);
router.post("/websites/:websiteId/purge-requests", requireAuth, createPurgeRequestHandler);
router.post("/purge-requests/:requestId/approve", requireAuth, approvePurgeRequestHandler);
router.post("/purge-requests/:requestId/execute", requireAuth, executePurgeRequestHandler);

export default router;
