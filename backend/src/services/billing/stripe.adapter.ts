import { createHmac, timingSafeEqual } from "crypto";
import { AppError } from "../../utils/app-error.js";

type StripeCheckout = { id: string; url: string | null; expires_at?: number };
type StripeEvent = { id: string; type: string; created?: number; data: { object: any } };

function secret(): string {
  const value = process.env.STRIPE_SECRET_KEY;
  if (!value) throw new AppError("Stripe billing is not configured", 503, "BILLING_PROVIDER_UNAVAILABLE");
  return value;
}

function webhookSecret(): string {
  const value = process.env.STRIPE_WEBHOOK_SECRET;
  if (!value) throw new AppError("Stripe webhook verification is not configured", 503, "BILLING_WEBHOOK_UNAVAILABLE");
  return value;
}

function priceKey(slug: string): string {
  const envName = `STRIPE_PRICE_${slug.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  const value = process.env[envName];
  if (!value) throw new AppError(`Stripe price mapping is missing for plan ${slug}`, 503, "BILLING_PRICE_UNAVAILABLE");
  return value;
}

export async function createStripeCheckout(input: {
  organizationId: string;
  planId: string;
  planSlug: string;
  actorEmail?: string | null;
  idempotencyKey: string;
}): Promise<StripeCheckout> {
  const successUrl = process.env.BILLING_SUCCESS_URL;
  const cancelUrl = process.env.BILLING_CANCEL_URL;
  if (!successUrl || !cancelUrl) throw new AppError("Billing return URLs are not configured", 503, "BILLING_PROVIDER_UNAVAILABLE");

  const body = new URLSearchParams();
  body.set("mode", "subscription");
  body.set("success_url", successUrl);
  body.set("cancel_url", cancelUrl);
  body.set("client_reference_id", input.organizationId);
  body.set("line_items[0][price]", priceKey(input.planSlug));
  body.set("line_items[0][quantity]", "1");
  body.set("metadata[organizationId]", input.organizationId);
  body.set("metadata[planId]", input.planId);
  body.set("subscription_data[metadata][organizationId]", input.organizationId);
  body.set("subscription_data[metadata][planId]", input.planId);
  if (input.actorEmail) body.set("customer_email", input.actorEmail);

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret()}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": input.idempotencyKey,
    },
    body,
    signal: AbortSignal.timeout(8000),
  });
  const payload = await response.json().catch(() => ({})) as any;
  if (!response.ok || typeof payload?.id !== "string") {
    throw new AppError("The billing provider rejected checkout creation", 502, "BILLING_PROVIDER_ERROR");
  }
  return { id: payload.id, url: payload.url ?? null, expires_at: payload.expires_at };
}

export function verifyStripeWebhook(raw: Buffer, signatureHeader: unknown): StripeEvent {
  if (typeof signatureHeader !== "string" || signatureHeader.length > 4096) {
    throw new AppError("Billing webhook signature is invalid", 400, "INVALID_WEBHOOK_SIGNATURE");
  }
  const values = new Map<string, string[]>();
  for (const part of signatureHeader.split(",")) {
    const [key, value] = part.trim().split("=", 2);
    if (!key || !value) continue;
    const list = values.get(key) ?? []; list.push(value); values.set(key, list);
  }
  const timestamp = Number(values.get("t")?.[0]);
  const signatures = values.get("v1") ?? [];
  if (!Number.isFinite(timestamp) || signatures.length === 0 || Math.abs(Date.now()/1000 - timestamp) > 300) {
    throw new AppError("Billing webhook is expired or malformed", 400, "INVALID_WEBHOOK_SIGNATURE");
  }
  const expected = createHmac("sha256", webhookSecret()).update(`${timestamp}.`).update(raw).digest();
  const valid = signatures.some((value) => {
    if (!/^[0-9a-f]{64}$/i.test(value)) return false;
    const actual = Buffer.from(value, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
  if (!valid) throw new AppError("Billing webhook signature is invalid", 400, "INVALID_WEBHOOK_SIGNATURE");
  let event: StripeEvent;
  try { event = JSON.parse(raw.toString("utf8")); }
  catch { throw new AppError("Billing webhook payload is invalid", 400, "INVALID_WEBHOOK_PAYLOAD"); }
  if (!event?.id || !event?.type || !event?.data?.object) throw new AppError("Billing webhook payload is incomplete", 400, "INVALID_WEBHOOK_PAYLOAD");
  return event;
}
