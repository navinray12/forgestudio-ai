import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { authorizeCapability } from "../services/permission.service.js";
import {
  generateSiteHandler,
  getAiChangesetHandler,
  cancelAiChangesetHandler,
  applyAiChangesetHandler,
  retryAiChangesetHandler,
  generateTextHandler,
  refineContentHandler,
  generateSectionHandler,
  generateContainerHandler,
  generateLayoutHandler,
  generateImageHandler,
  editImageHandler,
  removeBackgroundHandler,
  generateImageVariationsHandler,
  replaceImageElementHandler,
  generateCodeHandler,
  previewCodeHandler,
  explainCodeHandler,
  generateAnimationHandler,
  generateDynamicPropertyHandler,
  generateSeoHandler,
  analyzeSiteHandler,
  savePromptHandler,
  getPromptHandler,
  listPromptsHandler,
  updatePromptHandler,
  deletePromptHandler,
  assistantHandler,
} from "../controllers/ai.controller.js";
import {
  createDesignHandler,
  getDesignHandler,
  cancelDesignHandler,
  retryDesignHandler,
  designCapabilitiesHandler,
} from "../controllers/ai-design.controller.js";

const router = Router();

// Capabilities & Design execution (Preserved from Phase 0)
router.get("/capabilities", requireAuth, designCapabilitiesHandler);
router.post("/websites/:id/executions", requireAuth, createDesignHandler);
router.get("/executions/:executionId", requireAuth, getDesignHandler);
router.post("/executions/:executionId/cancel", requireAuth, cancelDesignHandler);
router.post("/executions/:executionId/retry", requireAuth, retryDesignHandler);

// Site Generation & Blueprint (Preserved)
router.post("/websites/:id/generate", requireAuth, authorizeCapability("EDIT_DESIGN"), generateSiteHandler);

// AI Changesets Lifecycle (Preserved)
router.get("/changesets/:changesetId", requireAuth, getAiChangesetHandler);
router.post("/changesets/:changesetId/apply", requireAuth, applyAiChangesetHandler);
router.post("/changesets/:changesetId/cancel", requireAuth, cancelAiChangesetHandler);
router.post("/changesets/:changesetId/retry", requireAuth, retryAiChangesetHandler);

// Phase 1: AI Text Generation
router.post("/websites/:id/generate-text", requireAuth, authorizeCapability("EDIT_DESIGN"), generateTextHandler);

// Phase 2: AI Content Refinement
router.post("/websites/:id/refine-content", requireAuth, authorizeCapability("EDIT_CONTENT"), refineContentHandler);

// Phase 3: AI Section Generation
router.post("/websites/:id/generate-section", requireAuth, authorizeCapability("EDIT_DESIGN"), generateSectionHandler);

// Phase 4: AI Container Generation
router.post("/websites/:id/generate-container", requireAuth, authorizeCapability("EDIT_DESIGN"), generateContainerHandler);

// Phase 5: AI Layout Generation
router.post("/websites/:id/generate-layout", requireAuth, authorizeCapability("EDIT_DESIGN"), generateLayoutHandler);

// Phases 6 - 10: AI Image Operations
router.post("/images/generate", requireAuth, generateImageHandler);
router.post("/websites/:id/generate-image", requireAuth, authorizeCapability("EDIT_DESIGN"), generateImageHandler);
router.post("/media/:assetId/edit", requireAuth, editImageHandler);
router.post("/media/:assetId/remove-background", requireAuth, removeBackgroundHandler);
router.post("/media/:assetId/variations", requireAuth, generateImageVariationsHandler);
router.post("/websites/:id/replace-image-element", requireAuth, authorizeCapability("EDIT_DESIGN"), replaceImageElementHandler);

// Phases 11 - 13: AI Code Operations
router.post("/websites/:id/generate-code", requireAuth, authorizeCapability("EDIT_DESIGN"), generateCodeHandler);
router.post("/code/preview", requireAuth, previewCodeHandler);
router.post("/code/explain", requireAuth, explainCodeHandler);

// Phase 14: AI Animation Generation
router.post("/websites/:id/generate-animation", requireAuth, authorizeCapability("EDIT_DESIGN"), generateAnimationHandler);

// Phase 15: AI Dynamic Properties
router.post("/websites/:id/generate-dynamic-properties", requireAuth, authorizeCapability("EDIT_DESIGN"), generateDynamicPropertyHandler);

// Phase 16: AI SEO Generation
router.post("/websites/:id/generate-seo", requireAuth, authorizeCapability("EDIT_DESIGN"), generateSeoHandler);

// Phases 17 - 19: AI Site Analysis (Accessibility, Performance, Design)
router.post("/websites/:id/analyze", requireAuth, authorizeCapability("EDIT_DESIGN"), analyzeSiteHandler);

// Phase 20: AI Prompt Library
router.get("/prompts", requireAuth, listPromptsHandler);
router.post("/prompts", requireAuth, savePromptHandler);
router.get("/prompts/:promptId", requireAuth, getPromptHandler);
router.put("/prompts/:promptId", requireAuth, updatePromptHandler);
router.delete("/prompts/:promptId", requireAuth, deletePromptHandler);

// Phase 22: Unified AI Assistant Orchestrator
router.post("/websites/:id/assistant", requireAuth, authorizeCapability("EDIT_DESIGN"), assistantHandler);

export default router;
