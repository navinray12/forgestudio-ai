import crypto from "crypto";
import { AppError } from "../../utils/app-error.js";

type StripeEvent = {
  id: string;
  type: string;
  created?: number;
  data: { object: Record<string, any> };
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new AppError(`${name} is not configured`, 503, "BILLING_PROVIDER_NOT_CONFIGURED");
  return value;
}

function priceFor(planKey: string): string {
  const raw = process.env.STRIPE_PRICE_MAP_JSON || "{}";
  let map: Record<string, string>;
  try { map = JSON.parse(raw); } catch { throw new AppError("Stripe price configuration is invalid", 503, "BILLING_PROVIDER_NOT_CONFIGURED"); }
  const value = map[planKey];
  if (!value || typeof value !== "string") throw new AppError("This plan is not configured for checkout", 400, "PLAN_NOT_AVAILABLE");
  return value;
}

export async function createStripeCheckout(input: {
  organizationId: string;
  planKey: string;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
  customerEmail?: string | null;
}) {
  const secret = required("STRIPE_SECRET_KEY");
  const price = priceFor(input.planKey);
  const body = new URLSearchParams();
  body.set("mode", "subscription");
  body.set("success_url", input.successUrl);
  body.set("cancel_url", input.cancelUrl);
  body.set("client_reference_id", input.organizationId);
  body.set("line_items[0][price]", price);
  body.set("line_items[0][quantity]", "1");
  body.set("metadata[organizationId]", input.organizationId);
  body.set("metadata[planKey]", input.planKey);
  body.set("subscription_data[metadata][organizationId]", input.organizationId);
  body.set("subscription_data[metadata][planKey]", input.planKey);
  if (input.customerEmail) body.set("customer_email", input.customerEmail);

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": input.idempotencyKey,
    },
    body,
    signal: AbortSignal.timeout(8000),
  });
  const data = await response.json() as Record<string, any>;
  if (!response.ok || !data.id || !data.url) {
    throw new AppError(data?.error?.message || "Checkout provider rejected the request", 502, "BILLING_PROVIDER_FAILED");
  }
  return { provider: "stripe", checkoutId: String(data.id), url: String(data.url) };
}

export function verifyStripeWebhook(rawBody: Buffer, signatureHeader: string | undefined): StripeEvent {
  const secret = required("STRIPE_WEBHOOK_SECRET");
  if (!signatureHeader) throw new AppError("Missing Stripe signature", 400, "WEBHOOK_SIGNATURE_INVALID");

  const values = signatureHeader.split(",").map((v) => v.trim());
  const timestampRaw = values.find((v) => v.startsWith("t="))?.slice(2);
  const signatures = values.filter((v) => v.startsWith("v1=")).map((v) => v.slice(3));
  if (!timestampRaw || signatures.length === 0) throw new AppError("Malformed Stripe signature", 400, "WEBHOOK_SIGNATURE_INVALID");

  const timestamp = Number(timestampRaw);
  const tolerance = Number(process.env.STRIPE_WEBHOOK_TOLERANCE_SECONDS || "300");
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > Math.max(60, Math.min(900, tolerance))) {
    throw new AppError("Webhook timestamp is outside the accepted window", 400, "WEBHOOK_EXPIRED");
  }

  const expected = crypto.createHmac("sha256", secret).update(`${timestampRaw}.`).update(rawBody).digest();
  const valid = signatures.some((candidate) => {
    if (!/^[0-9a-f]{64}$/i.test(candidate)) return false;
    const supplied = Buffer.from(candidate, "hex");
    return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
  });
  if (!valid) throw new AppError("Invalid Stripe signature", 400, "WEBHOOK_SIGNATURE_INVALID");

  let event: StripeEvent;
  try { event = JSON.parse(rawBody.toString("utf8")); } catch { throw new AppError("Invalid webhook JSON", 400, "INVALID_WEBHOOK"); }
  if (!event?.id || !event?.type || !event?.data?.object) throw new AppError("Invalid Stripe event", 400, "INVALID_WEBHOOK");
  return event;
}

export function organizationFromStripeEvent(event: StripeEvent): string | null {
  const object = event.data.object || {};
  return object.metadata?.organizationId
    || object.subscription_details?.metadata?.organizationId
    || object.lines?.data?.[0]?.metadata?.organizationId
    || object.client_reference_id
    || null;
}

export type { StripeEvent };
