/**
 * ForgeStudio Features 34, 33, 32: Design System, Registry & Templates Routes
 */

import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { DesignSystemPlatformController } from "../modules/design-system/designSystem.controller.js";

const router = Router();

router.use(requireAuth);

// Feature 34: Design System
router.get("/tokens", DesignSystemPlatformController.getTokens);
router.post("/tokens", DesignSystemPlatformController.setToken);
router.delete("/tokens/:category/:name", DesignSystemPlatformController.deleteToken);
router.get("/tokens/compile", DesignSystemPlatformController.compileTokens);
router.post("/tokens/apply", DesignSystemPlatformController.applyTokens);

// Feature 33: Component Registry
router.post("/components/discover", DesignSystemPlatformController.discoverComponents);
router.get("/components", DesignSystemPlatformController.listComponents);
router.get("/components/:componentId", DesignSystemPlatformController.getComponent);
router.get("/components/:componentId/export", DesignSystemPlatformController.exportComponent);

// Feature 32: Project Templates
router.get("/templates", DesignSystemPlatformController.listTemplates);
router.post("/templates/:templateId/scaffold", DesignSystemPlatformController.scaffoldTemplate);

export default router;
