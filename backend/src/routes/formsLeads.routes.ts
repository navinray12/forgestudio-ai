import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { scopeToWebsite } from "../middlewares/tenantScope.middleware.js";
import { userRateLimit } from "../middlewares/userRateLimit.middleware.js";
import { listLeadsHandler, transitionLeadStageHandler } from "../controllers/formsLeads.controller.js";

const router = Router();
router.use(requireAuth, userRateLimit(120));

// Lead lifecycle, backed by the durable lead service
router.get("/leads", scopeToWebsite(), listLeadsHandler);
router.post("/leads/:leadId/transition", userRateLimit(30), transitionLeadStageHandler);

// Not exposed (see controller): /schemas, /uploads/init, /submissions, /disaster-recovery.

export default router;
