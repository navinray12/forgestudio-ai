/**
 * ForgeStudio Execution Blueprint v2.1 — Point 15: Workflows, Communication, Experiments and Contextual Chat
 * Routes Integration
 */

import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { WorkflowsCommunicationController } from "../controllers/workflowsCommunication.controller.ts";

const router = Router();

// 1. Workflow Automation & Simulation
router.post("/workflows/draft", requireAuth, WorkflowsCommunicationController.createWorkflowDraft);
router.post("/workflows/:workflowId/publish/:version", requireAuth, WorkflowsCommunicationController.publishWorkflow);
router.post("/workflows/:workflowId/simulate/:version", requireAuth, WorkflowsCommunicationController.simulateWorkflow);

// 2. Pre-Action Policy Revalidation
router.post("/policy/revalidate", requireAuth, WorkflowsCommunicationController.revalidatePreAction);

// 3. Multi-Channel Communication
router.post("/messages/dispatch", requireAuth, WorkflowsCommunicationController.dispatchMessage);

// 4. Scoring & Segmentation
router.post("/scoring/calculate", requireAuth, WorkflowsCommunicationController.calculateLeadScore);

// 5. Experiments
router.post("/experiments/create", requireAuth, WorkflowsCommunicationController.createExperiment);

// 6. Contextual Chat & Confirmed Lead Capture
router.post("/chat/init", requireAuth, WorkflowsCommunicationController.initChat);
router.post("/chat/convert-lead", requireAuth, WorkflowsCommunicationController.convertChatLead);

export default router;
