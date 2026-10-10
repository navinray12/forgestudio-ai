/**
 * ForgeStudio Module 35: Code Intelligence Routes
 */

import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { CodeIntelligenceController } from "../modules/code-intelligence/codeIntelligence.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/symbols", CodeIntelligenceController.getSymbols);
router.get("/definition", CodeIntelligenceController.getDefinition);
router.get("/references", CodeIntelligenceController.getReferences);
router.get("/files/:fileId", CodeIntelligenceController.getFileDependencies);
router.post("/index", CodeIntelligenceController.indexProject);
router.get("/status", CodeIntelligenceController.getStatus);

export default router;
