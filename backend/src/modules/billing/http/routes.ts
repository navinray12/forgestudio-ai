import { Router } from "express";
import { requireAuth } from "../../../middlewares/auth.middleware.js";
import { assignOrganizationSeat, getOrganizationBilling, reserveUsage, settleUsageReservation, startOrganizationCheckout } from "../billing.service.js";

const router = Router({ mergeParams: true });
router.use(requireAuth);

function organizationId(req: { params: Record<string, unknown> }) {
  return String(req.params.organizationId || "");
}

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
