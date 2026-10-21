import { Router } from "express";
import { requireAuth } from "../../../middlewares/auth.middleware.js";
import { billingProfile } from "../billing-profile.service.js";
import { requirePrivilegedMutation } from "../../../middlewares/privileged-mutation.js";
import { assignOrganizationSeat, getOrganizationBilling, listOrganizationPlans, reserveUsage, settleUsageReservation, startOrganizationCheckout } from "../billing.service.js";

const router = Router({ mergeParams: true });
router.use(requireAuth);

router.get("/profile", async (req, res, next) => {
  try { res.setHeader("Cache-Control", "no-store"); res.json({ success: true, profile: await billingProfile(organizationId(req), res.locals.user.id) }); }
  catch (error) { next(error); }
});
router.put("/profile", requirePrivilegedMutation, async (req, res, next) => {
  try {
    if (req.get("X-Forge-Intent") !== "billing-profile") return res.status(403).json({ success: false, message: "Billing command header is required" });
    if (!req.body || typeof req.body !== "object") return res.status(400).json({ success: false, message: "Billing profile is required" });
    res.setHeader("Cache-Control", "no-store");
    return res.json({ success: true, profile: await billingProfile(organizationId(req), res.locals.user.id, req.body) });
  } catch (error) { next(error); }
});

function organizationId(req: { params: Record<string, unknown> }) {
  return String(req.params.organizationId || "");
}

router.get("/plans", async (req, res, next) => {
  try {
    res.json({ success: true, plans: await listOrganizationPlans(organizationId(req), res.locals.user.id) });
  } catch (error) { next(error); }
});

router.get("/", async (req, res, next) => {
  try {
    const summary = await getOrganizationBilling(organizationId(req), res.locals.user.id);
    res.json({ success: true, ...summary });
  } catch (error) { next(error); }
});

router.post("/checkout", async (req, res, next) => {
  try {
    const key = String(req.header("Idempotency-Key") || "");
    const result = await startOrganizationCheckout({
      organizationId: organizationId(req),
      actorId: res.locals.user.id,
      planKey: req.body?.planKey,
      successUrl: req.body?.successUrl,
      cancelUrl: req.body?.cancelUrl,
      idempotencyKey: key,
      email: res.locals.user.email,
    });
    res.status(201).json({ success: true, checkout: result });
  } catch (error) { next(error); }
});

router.post("/seats/:userId", async (req, res, next) => {
  try {
    await assignOrganizationSeat(organizationId(req), res.locals.user.id, String((req.params as Record<string, unknown>).userId || ""));
    res.json({ success: true });
  } catch (error) { next(error); }
});

router.post("/usage/reservations", async (req, res, next) => {
  try {
    const result = await reserveUsage({
      organizationId: organizationId(req),
      actorId: res.locals.user.id,
      resource: req.body?.resource,
      amount: Number(req.body?.amount),
      key: String(req.header("Idempotency-Key") || ""),
    });
    res.status(201).json({ success: true, reservation: result });
  } catch (error) { next(error); }
});

router.post("/usage/reservations/:id/:action", async (req, res, next) => {
  try {
    const params = req.params as Record<string, unknown>;
    const action = String(params.action || "");
    if (action !== "consume" && action !== "release") {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND" } });
    }
    const result = await settleUsageReservation(
      organizationId(req),
      res.locals.user.id,
      String(params.id || ""),
      action === "consume" ? "CONSUMED" : "RELEASED",
    );
    return res.json({ success: true, reservation: result });
  } catch (error) { next(error); }
});

export default router;
