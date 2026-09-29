import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import {
  healthCheck, livenessCheck, canaryManifest, signOffReport, sanitizeDemo,
  prismaMigrationStatus, prismaMigrationRecover, diagnosePorts,
} from "../controllers/health.controller.js";

const router = Router();
const staff = [requireAuth, requireRole(["ADMIN", "SUPER_ADMIN", "PLATFORM_ADMIN"])] as const;
router.get("/health", healthCheck);
router.get("/live", livenessCheck);
router.get("/ready", healthCheck);
router.get("/canary", ...staff, canaryManifest);
router.get("/prisma-migration-status", ...staff, prismaMigrationStatus);
router.get("/prisma-migration-recover-get", ...staff, prismaMigrationRecover);
router.post("/prisma-migration-recover", ...staff, prismaMigrationRecover);
router.get("/diagnose-ports", ...staff, diagnosePorts);
router.get("/sign-off", ...staff, signOffReport);
router.post("/dev/sanitize-demo", ...staff, sanitizeDemo);
export default router;
