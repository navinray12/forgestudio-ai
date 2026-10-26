import { Router } from "express";
import { IntegrationController } from "../controllers/integration.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requirePrivilegedMutation } from "../middlewares/privileged-mutation.js";
import { siteIntegrationSettings } from "../services/integrations/site-integrations.service.js";

const router = Router();

router.get("/sites/:websiteId/settings", requireAuth, async (req, res, next) => {
  try { res.setHeader("Cache-Control", "no-store"); res.json({ success: true, ...await siteIntegrationSettings(String(req.params.websiteId), res.locals.user.id) }); }
  catch (error) { next(error); }
});
router.put("/sites/:websiteId/settings", requireAuth, requirePrivilegedMutation, async (req, res, next) => {
  try {
    if (req.get("X-Forge-Intent") !== "integration-settings") return res.status(403).json({ success: false, message: "Integration command header is required." });
    if (!req.body) return res.status(400).json({ success: false, message: "Settings are required." });
    res.setHeader("Cache-Control", "no-store");
    return res.json({ success: true, ...await siteIntegrationSettings(String(req.params.websiteId), res.locals.user.id, req.body) });
  } catch (error) { next(error); }
});

// Integration endpoints: public endpoints (payments, CRM leads, webhooks, dynamic data)
// can be triggered by visitors on published sites or authenticated users in the editor.
// Test endpoints require authentication.
router.post("/paypal/create-order", IntegrationController.createPayPalOrder);
router.post("/paypal/capture-order", IntegrationController.capturePayPalOrder);
router.post("/stripe/create-checkout-session", IntegrationController.createStripeCheckoutSession);
router.get("/dynamic-data/fetch", IntegrationController.fetchDynamicData);
router.post("/crm/submit-lead", IntegrationController.submitLeadToCRM);
router.post("/webhook/dispatch", requireAuth, IntegrationController.dispatchWebhook);

// Admin / Test Endpoints (Require Auth)
router.post("/google-sheets/test", requireAuth, IntegrationController.testGoogleSheets);
router.post("/mailchimp/test", requireAuth, IntegrationController.testMailchimp);
router.post("/zapier/test", requireAuth, IntegrationController.testZapier);

export default router;
