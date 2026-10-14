/**
 * ForgeStudio Execution Blueprint v2.1 — Point 18: Security, Privacy, Audit and Abuse Resistance
 * Routes Integration
 */

import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { scopeToWebsite, requirePlatformAdmin } from "../middlewares/tenantScope.middleware.js";
import { SecurityAuditController } from "../controllers/securityAudit.controller.js";

const router = Router();

// 1. Threat Model & ASVS Mapping
router.get("/threat-model", requireAuth, SecurityAuditController.getThreatModel);

// 2. Security Planes & Server-Side Tenant Scoping
router.get("/context/resolve", requireAuth, SecurityAuditController.resolveContext);

// 3. SSRF & Network Quarantine
router.post("/ssrf/validate", requireAuth, SecurityAuditController.validateOutboundUrl);

// 4. Shared Redaction
router.post("/redact", requireAuth, SecurityAuditController.redactPayload);

// 5. Audit Chain Integrity Verification
router.get("/audit/integrity", requireAuth, requirePlatformAdmin, SecurityAuditController.verifyAuditIntegrity);

// 6. Tenant Quotas & Abuse Pausing
router.post("/quota/check", requireAuth, scopeToWebsite(), SecurityAuditController.checkQuota);

export default router;
