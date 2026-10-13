/**
 * ForgeStudio Execution Blueprint v2.1 — Point 15: Workflows, Communication, Experiments and Contextual Chat
 * Routes Integration
 */

import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { scopeToWebsite, requirePlatformAdmin } from "../middlewares/tenantScope.middleware.js";
import { WorkflowsCommunicationController } from "../controllers/workflowsCommunication.controller.js";

const router = Router();

// 1. Workflow Automation & Simulation
router.post("/workflows/draft", requireAuth, scopeToWebsite(), WorkflowsCommunicationController.createWorkflowDraft);
router.post("/workflows/:workflowId/publish/:version", requireAuth, scopeToWebsite({ admin: true }), WorkflowsCommunicationController.publishWorkflow);
router.post("/workflows/:workflowId/simulate/:version", requireAuth, scopeToWebsite(), WorkflowsCommunicationController.simulateWorkflow);

// 2. Pre-Action Policy Revalidation
router.post("/policy/revalidate", requireAuth, scopeToWebsite(), WorkflowsCommunicationController.revalidatePreAction);

// 3. Multi-Channel Communication
router.post("/messages/dispatch", requireAuth, scopeToWebsite({ admin: true }), WorkflowsCommunicationController.dispatchMessage);

// 4. Scoring & Segmentation
router.post("/scoring/calculate", requireAuth, scopeToWebsite(), WorkflowsCommunicationController.calculateLeadScore);

// 5. Experiments
router.post("/experiments/create", requireAuth, scopeToWebsite({ admin: true }), WorkflowsCommunicationController.createExperiment);

// 6. Contextual Chat & Confirmed Lead Capture
router.post("/chat/init", requireAuth, scopeToWebsite(), WorkflowsCommunicationController.initChat);
router.post("/chat/convert-lead", requireAuth, scopeToWebsite(), WorkflowsCommunicationController.convertChatLead);

export default router;
