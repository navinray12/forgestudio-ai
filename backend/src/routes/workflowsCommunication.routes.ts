/**
 * ForgeStudio Execution Blueprint v2.1 — Point 15: Workflows, Communication, Experiments and Contextual Chat
 * Routes Integration
 */

import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { scopeToWebsite } from "../middlewares/tenantScope.middleware.js";
import { WorkflowsCommunicationController } from "../controllers/workflowsCommunication.controller.js";

const router = Router();

// 1. Durable workflow definitions & simulation
router.get("/workflows", requireAuth, scopeToWebsite(), WorkflowsCommunicationController.listWorkflows);
router.post("/workflows/draft", requireAuth, scopeToWebsite(), WorkflowsCommunicationController.createWorkflowDraft);
router.post("/workflows/:workflowId/publish/:version", requireAuth, scopeToWebsite({ admin: true }), WorkflowsCommunicationController.publishWorkflow);
router.post("/workflows/:workflowId/simulate/:version", requireAuth, scopeToWebsite(), WorkflowsCommunicationController.simulateWorkflow);

// 2. Scoring (pure calculation)
router.post("/scoring/calculate", requireAuth, scopeToWebsite(), WorkflowsCommunicationController.calculateLeadScore);

// 3. Confirmed chat lead capture, committed through the durable lead service
router.post("/chat/convert-lead", requireAuth, scopeToWebsite(), WorkflowsCommunicationController.convertChatLead);

// Not exposed (see controller): /policy/revalidate, /messages/dispatch, /experiments/create, /chat/init.

export default router;
