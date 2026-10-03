import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { AppError } from "../../utils/app-error.js";
import {
  createOrganizationCheckout,
  getOrganizationBillingSummary,
  processStripeWebhook,
  reserveOrganizationUsage,
  settleOrganizationReservation,
} from "./billing.service.js";

export const billingWebhookRouter = Router();
billingWebhookRouter.post("/stripe", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!Buffer.isBuffer(req.body)) throw new AppError("Raw webhook body is required", 400, "INVALID_WEBHOOK_PAYLOAD");
    const result = await processStripeWebhook(req.body, req.headers["stripe-signature"]);
    res.status(200).json({ received: true, duplicate: result.duplicate, eventId: result.eventId });
  } catch (error) { next(error); }
});

const router = Router({ mergeParams: true });
router.use(requireAuth);

router.get("/:organizationId/billing", async (req, res, next) => {
  try {
    const data = await getOrganizationBillingSummary(String(req.params.organizationId), res.locals.user.id);
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

router.post("/:organizationId/billing/checkout", async (req, res, next) => {
  try {
    const result = await createOrganizationCheckout({
      organizationId: String(req.params.organizationId),
      actorId: res.locals.user.id,
      planSlug: String(req.body?.planSlug ?? ""),
      idempotencyKey: String(req.headers["idempotency-key"] ?? ""),
    });
    res.status(result.checkoutUrl ? 201 : 200).json({ success: true, data: result });
  } catch (error) { next(error); }
});

router.post("/:organizationId/billing/reservations", async (req, res, next) => {
  try {
    const result = await reserveOrganizationUsage({
      organizationId: String(req.params.organizationId),
      actorId: res.locals.user.id,
      metric: req.body?.metric,
      amount: req.body?.amount,
      idempotencyKey: req.headers["idempotency-key"],
      ttlSeconds: req.body?.ttlSeconds,
    });
    res.status(201).json({ success: true, data: result });
  } catch (error) { next(error); }
});

router.post("/:organizationId/billing/reservations/:reservationId/:action", async (req, res, next) => {
  try {
    const action = String(req.params.action);
    if (action !== "consume" && action !== "release") throw new AppError("Unsupported reservation action", 400, "INVALID_ACTION");
    const result = await settleOrganizationReservation({
      organizationId: String(req.params.organizationId),
      actorId: res.locals.user.id,
      reservationId: String(req.params.reservationId),
      action,
    });
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

export default router;
