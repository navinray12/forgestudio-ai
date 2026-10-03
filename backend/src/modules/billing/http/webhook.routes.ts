import { Router } from "express";
import type { Request } from "express";
import { processStripeWebhook } from "../billing.service.js";

const router = Router();

router.post("/", async (req: Request, res, next) => {
  try {
    if (!Buffer.isBuffer(req.body)) return res.status(400).json({ success: false, error: { code: "RAW_BODY_REQUIRED" } });
    const result = await processStripeWebhook(req.body, req.header("Stripe-Signature"));
    res.status(200).json({ success: true, ...result });
  } catch (error) { next(error); }
});

export default router;
