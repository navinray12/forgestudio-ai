/**
 * ForgeStudio Module 36: Repository Knowledge Graph Routes
 */

import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { KnowledgeGraphController } from "../modules/knowledge-graph/knowledgeGraph.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/query", KnowledgeGraphController.queryGraph);
router.post("/query", KnowledgeGraphController.queryGraph);
router.post("/build", KnowledgeGraphController.buildGraph);
router.get("/", KnowledgeGraphController.getGraph);

export default router;
