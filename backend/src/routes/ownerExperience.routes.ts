import { Router } from "express";
import {
  getWorkspaceView,
  getEffectivePermissions,
  getPermissionCatalog,
  createCustomRoleHandler,
  getEditorState,
  transitionEditorStateHandler,
  saveEditorAttemptHandler,
  resolveConflictHandler,
  storeLocalDraftHandler,
  evaluateLocalDraftHandler,
  runJourneyHandler,
} from "../controllers/ownerExperience.controller.js";

const router = Router();

// Progressive Disclosure & Navigation
router.get("/view", getWorkspaceView);

// Versioned Dynamic Permissions
router.get("/permissions", getEffectivePermissions);
router.get("/permissions/catalog", getPermissionCatalog);
router.post("/roles/custom", createCustomRoleHandler);

// Truthful Editor & Publishing State Machine
router.get("/editor-state/:websiteId", getEditorState);
router.post("/editor-state/:websiteId/transition", transitionEditorStateHandler);
router.post("/editor-state/:websiteId/save", saveEditorAttemptHandler);
router.post("/editor-state/:websiteId/resolve-conflict", resolveConflictHandler);

// Privacy-Safe Local Draft Recovery
router.post("/drafts/local", storeLocalDraftHandler);
router.get("/drafts/local/:websiteId/:draftId", evaluateLocalDraftHandler);

// Acceptance Journeys
router.post("/journeys/execute", runJourneyHandler);

export default router;
