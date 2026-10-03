import { createHash, randomUUID } from "crypto";
import { pgPool } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { withTenantTransaction, requireOrganizationMembership } from "../../platform/tenancy/tenant-unit-of-work.js";
import { appendPlatformOutbox } from "../../platform/reliability/postgres-queue.js";
import { createStripeCheckout, organizationFromStripeEvent, verifyStripeWebhook, type StripeEvent } from "./stripe.adapter.js";

function boundedKey(value: unknown, label: string, max = 100): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9._:-]+$/.test(value) || value.length > max) {
    throw new AppError(`${label} is invalid`, 400, "INVALID_INPUT");
  }
  return value;
}

function planDefinition(planKey: string) {
  let catalog: Record<string, any>;
  try { catalog = JSON.parse(process.env.FORGE_PLAN_CATALOG_JSON || "{}"); }
  catch { throw new AppError("Plan catalogue is invalid", 503, "BILLING_CONFIGURATION_INVALID"); }
  const plan = catalog[planKey];
  if (!plan || typeof plan !== "object") throw new AppError("Unknown plan", 400, "PLAN_NOT_AVAILABLE");
  const seatLimit = Number(plan.seatLimit ?? 1);
  const quotas = typeof plan.quotas === "object" && plan.quotas ? plan.quotas : {};
  if (!Number.isSafeInteger(seatLimit) || seatLimit < 1 || seatLimit > 100000) {
    throw new AppError("Plan seat limit is invalid", 503, "BILLING_CONFIGURATION_INVALID");
  }
  return { seatLimit, quotas };
}

async function assertBillingManager(organizationId: string, actorId: string) {
  const client = await pgPool.connect();
  try { return await requireOrganizationMembership(client, organizationId, actorId, ["OWNER", "ADMIN"]); }
  finally { client.release(); }
}

async function assertBillingMember(organizationId: string, actorId: string) {
  const client = await pgPool.connect();
  try { return await requireOrganizationMembership(client, organizationId, actorId); }
  finally { client.release(); }
}

function checkoutRequestHash(planKey: string, successUrl: string, cancelUrl: string) {
  return createHash("sha256").update(JSON.stringify({ planKey, successUrl, cancelUrl })).digest("hex");
}

export async function listOrganizationPlans(organizationId: string, actorId: string) {
  await assertBillingManager(organizationId, actorId);
  let catalog: Record<string, any>;
  try { catalog = JSON.parse(process.env.FORGE_PLAN_CATALOG_JSON || "{}"); }
  catch { throw new AppError("Plan catalogue is invalid", 503, "BILLING_CONFIGURATION_INVALID"); }
  return Object.entries(catalog).flatMap(([key, value]) => {
    if (!value || typeof value !== "object") return [];
    const seatLimit = Number(value.seatLimit ?? 1);
    const quotas = typeof value.quotas === "object" && value.quotas ? value.quotas : {};
    return [{ key, name: String(value.name || key), description: String(value.description || ""), seatLimit, quotas }];
  });
}

export async function getOrganizationBilling(organizationId: string, actorId: string) {
  await assertBillingManager(organizationId, actorId);
  return withTenantTransaction({ organizationId, actorId }, async (client) => {
    const [account, subscription, seats, reservations] = await Promise.all([
      client.query(`SELECT id,provider,status,"providerCustomerId","updatedAt" FROM organization_billing_accounts WHERE "organizationId"=$1::uuid`, [organizationId]),
      client.query(`SELECT id,"planKey",status,"seatLimit",quotas,"currentPeriodStart","currentPeriodEnd","updatedAt" FROM organization_subscriptions_v2 WHERE "organizationId"=$1::uuid`, [organizationId]),
      client.query(`SELECT count(*)::int AS count FROM organization_seat_assignments WHERE "organizationId"=$1::uuid AND status='ACTIVE'`, [organizationId]),
      client.query(`SELECT resource,coalesce(sum(amount),0)::text AS amount FROM usage_reservations WHERE "organizationId"=$1::uuid AND state IN ('RESERVED','CONSUMED') GROUP BY resource`, [organizationId]),
    ]);
    return {
      account: account.rows[0] || null,
      subscription: subscription.rows[0] || null,
      seatsUsed: seats.rows[0]?.count || 0,
      usage: reservations.rows,
    };
  });
}

export async function startOrganizationCheckout(input: {
  organizationId: string;
  actorId: string;
  planKey: string;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
  email?: string | null;
}) {
  await assertBillingManager(input.organizationId, input.actorId);
  const planKey = boundedKey(input.planKey, "Plan");
  boundedKey(input.idempotencyKey, "Idempotency key", 128);
  planDefinition(planKey);

  for (const [label, value] of [["successUrl", input.successUrl], ["cancelUrl", input.cancelUrl]] as const) {
    let parsed: URL;
    try { parsed = new URL(value); } catch { throw new AppError(`${label} is invalid`, 400, "INVALID_REDIRECT"); }
    const frontend = process.env.FRONTEND_URL ? new URL(process.env.FRONTEND_URL) : null;
    if (parsed.protocol !== "https:" && process.env.NODE_ENV === "production") throw new AppError("Checkout redirects must use HTTPS", 400, "INVALID_REDIRECT");
    if (frontend && parsed.origin !== frontend.origin) throw new AppError("Checkout redirect origin is not allowed", 400, "INVALID_REDIRECT");
  }

  const requestHash = checkoutRequestHash(planKey, input.successUrl, input.cancelUrl);
  const existing = await withTenantTransaction(
    { organizationId: input.organizationId, actorId: input.actorId },
    async (client) => {
      const row = await client.query<{ providerCheckoutId: string | null; checkoutUrl: string | null; status: string; requestHash: string }>(
        `SELECT "providerCheckoutId","checkoutUrl",status,"requestHash"
           FROM billing_checkout_intents
          WHERE "organizationId"=$1::uuid AND "actorId"=$2::uuid AND "idempotencyKey"=$3`,
        [input.organizationId, input.actorId, input.idempotencyKey],
      );
      if (row.rows[0]) {
        if (row.rows[0].requestHash !== requestHash) throw new AppError("Idempotency key was used for different checkout input", 409, "IDEMPOTENCY_CONFLICT");
        return row.rows[0];
      }
      await client.query(
        `INSERT INTO billing_checkout_intents
          (id,"organizationId","actorId","idempotencyKey","requestHash","planKey",status)
         VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,'CREATED')`,
        [randomUUID(), input.organizationId, input.actorId, input.idempotencyKey, requestHash, planKey],
      );
      return null;
    },
    "SERIALIZABLE",
  );

  if (existing?.status === "READY" && existing.checkoutUrl) {
    return { provider: "stripe", checkoutId: existing.providerCheckoutId, url: existing.checkoutUrl, replayed: true };
  }

  const checkout = await createStripeCheckout({
    organizationId: input.organizationId,
    planKey,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
    idempotencyKey: `${input.organizationId}:${input.idempotencyKey}`,
    customerEmail: input.email,
  });

  await withTenantTransaction({ organizationId: input.organizationId, actorId: input.actorId }, async (client) => {
    await client.query(
      `UPDATE billing_checkout_intents
          SET status='READY',"providerCheckoutId"=$4,"checkoutUrl"=$5,"updatedAt"=NOW()
        WHERE "organizationId"=$1::uuid AND "actorId"=$2::uuid AND "idempotencyKey"=$3`,
      [input.organizationId, input.actorId, input.idempotencyKey, checkout.checkoutId, checkout.url],
    );
  });

  return { ...checkout, replayed: false };
}

async function applyStripeEvent(event: StripeEvent, organizationId: string) {
  const object = event.data.object || {};
  await withTenantTransaction({ organizationId }, async (client) => {
    if (event.type === "checkout.session.completed") {
      const planKey = boundedKey(object.metadata?.planKey || "unknown", "Plan");
      const plan = planDefinition(planKey);
      await client.query(
        `INSERT INTO organization_billing_accounts
          (id,"organizationId",provider,status,"providerCustomerId")
         VALUES ($1::uuid,$2::uuid,'stripe','ACTIVE',$3)
         ON CONFLICT ("organizationId") DO UPDATE
           SET provider='stripe',status='ACTIVE',
               "providerCustomerId"=coalesce(EXCLUDED."providerCustomerId",organization_billing_accounts."providerCustomerId"),
               "updatedAt"=NOW()`,
        [randomUUID(), organizationId, object.customer || null],
      );
      await client.query(
        `INSERT INTO organization_subscriptions_v2
          (id,"organizationId","planKey",provider,"providerSubscriptionId",status,"seatLimit",quotas,"currentPeriodStart","currentPeriodEnd")
         VALUES ($1::uuid,$2::uuid,$3,'stripe',$4,'ACTIVE',$5,$6::jsonb,NOW(),NULL)
         ON CONFLICT ("organizationId") DO UPDATE
           SET "planKey"=EXCLUDED."planKey",provider='stripe',
               "providerSubscriptionId"=EXCLUDED."providerSubscriptionId",status='ACTIVE',
               "seatLimit"=EXCLUDED."seatLimit",quotas=EXCLUDED.quotas,"updatedAt"=NOW()`,
        [randomUUID(), organizationId, planKey, object.subscription || null, plan.seatLimit, JSON.stringify(plan.quotas)],
      );
    } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const status = event.type.endsWith("deleted") ? "CANCELLED" : String(object.status || "UNKNOWN").toUpperCase();
      await client.query(
        `UPDATE organization_subscriptions_v2
            SET status=$2,"providerSubscriptionId"=coalesce($3,"providerSubscriptionId"),"updatedAt"=NOW()
          WHERE "organizationId"=$1::uuid`,
        [organizationId, status, object.id || null],
      );
    } else if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
      await client.query(
        `INSERT INTO organization_invoices
          (id,"organizationId",provider,"providerInvoiceId",amount,currency,status,"issuedAt")
         VALUES ($1::uuid,$2::uuid,'stripe',$3,$4,$5,$6,to_timestamp($7))
         ON CONFLICT (provider,"providerInvoiceId") DO NOTHING`,
        [
          randomUUID(),
          organizationId,
          object.id,
          Number(object.amount_paid ?? object.amount_due ?? 0),
          String(object.currency || "usd").toUpperCase(),
          event.type === "invoice.paid" ? "PAID" : "PAYMENT_FAILED",
          Number(object.created || event.created || Math.floor(Date.now() / 1000)),
        ],
      );
    }

    await appendPlatformOutbox(client, {
      organizationId,
      eventType: "BILLING_STATE_CHANGED",
      aggregateType: "organization",
      aggregateId: organizationId,
      payload: { providerEventId: event.id, type: event.type },
    });
  });
}

export async function processStripeWebhook(rawBody: Buffer, signatureHeader: string | undefined) {
  const event = verifyStripeWebhook(rawBody, signatureHeader);
  const organizationId = organizationFromStripeEvent(event);
  if (!organizationId) throw new AppError("Webhook is missing organization binding", 400, "WEBHOOK_TENANT_MISSING");

  const client = await pgPool.connect();
  try {
    const inserted = await client.query(
      `INSERT INTO billing_event_inbox
        (id,provider,"providerEventId","organizationId","eventType",payload,status)
       VALUES ($1::uuid,'stripe',$2,$3::uuid,$4,$5::jsonb,'RECEIVED')
       ON CONFLICT (provider,"providerEventId") DO NOTHING
       RETURNING id`,
      [randomUUID(), event.id, organizationId, event.type, JSON.stringify(event)],
    );
    if (!inserted.rowCount) return { accepted: true, duplicate: true };
  } finally {
    client.release();
  }

  try {
    await applyStripeEvent(event, organizationId);
    await pgPool.query(
      `UPDATE billing_event_inbox SET status='PROCESSED',"processedAt"=NOW() WHERE provider='stripe' AND "providerEventId"=$1`,
      [event.id],
    );
  } catch (error) {
    await pgPool.query(
      `UPDATE billing_event_inbox SET status='FAILED',"lastError"=$2 WHERE provider='stripe' AND "providerEventId"=$1`,
      [event.id, error instanceof Error ? error.message.slice(0, 2000) : "Unknown error"],
    );
    throw error;
  }
  return { accepted: true, duplicate: false };
}

export async function assignOrganizationSeat(organizationId: string, actorId: string, userId: string) {
  await assertBillingManager(organizationId, actorId);
  return withTenantTransaction({ organizationId, actorId }, async (client) => {
    await requireOrganizationMembership(client, organizationId, userId);
    const sub = await client.query<{ seatLimit: number; status: string }>(
      `SELECT "seatLimit",status FROM organization_subscriptions_v2 WHERE "organizationId"=$1::uuid FOR UPDATE`,
      [organizationId],
    );
    if (!sub.rows[0] || !["ACTIVE", "TRIAL", "GRACE"].includes(sub.rows[0].status)) {
      throw new AppError("Active subscription required", 403, "SUBSCRIPTION_REQUIRED");
    }
    const used = await client.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM organization_seat_assignments WHERE "organizationId"=$1::uuid AND status='ACTIVE'`,
      [organizationId],
    );
    if ((used.rows[0]?.count || 0) >= sub.rows[0].seatLimit) throw new AppError("Seat limit reached", 429, "SEAT_LIMIT_EXCEEDED");

    await client.query(
      `INSERT INTO organization_seat_assignments (id,"organizationId","userId",status)
       VALUES ($1::uuid,$2::uuid,$3::uuid,'ACTIVE')
       ON CONFLICT ("organizationId","userId") DO UPDATE SET status='ACTIVE',"updatedAt"=NOW()`,
      [randomUUID(), organizationId, userId],
    );
    return { success: true };
  }, "SERIALIZABLE");
}

export async function reserveUsage(input: {
  organizationId: string;
  actorId: string;
  resource: string;
  amount: number;
  key: string;
}) {
  boundedKey(input.resource, "Resource");
  boundedKey(input.key, "Idempotency key", 128);
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    throw new AppError("Usage amount must be a positive integer", 400, "INVALID_USAGE");
  }
  await assertBillingMember(input.organizationId, input.actorId);

  return withTenantTransaction({ organizationId: input.organizationId, actorId: input.actorId }, async (client) => {
    const existing = await client.query<{ id: string; state: string; amount: string; resource: string }>(
      `SELECT id,state,amount::text,resource
         FROM usage_reservations
        WHERE "organizationId"=$1::uuid AND "idempotencyKey"=$2`,
      [input.organizationId, input.key],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].resource !== input.resource || BigInt(existing.rows[0].amount) !== BigInt(input.amount)) {
        throw new AppError("Idempotency key was used for different usage input", 409, "IDEMPOTENCY_CONFLICT");
      }
      return existing.rows[0];
    }

    const sub = await client.query<{ quotas: Record<string, number>; status: string }>(
      `SELECT quotas,status FROM organization_subscriptions_v2 WHERE "organizationId"=$1::uuid FOR UPDATE`,
      [input.organizationId],
    );
    if (!sub.rows[0] || !["ACTIVE", "TRIAL", "GRACE"].includes(sub.rows[0].status)) {
      throw new AppError("Active subscription required", 403, "SUBSCRIPTION_REQUIRED");
    }
    const limit = Number((sub.rows[0].quotas || {})[input.resource]);
    if (!Number.isSafeInteger(limit) || limit < 0) throw new AppError("Resource is not included in the subscription", 403, "ENTITLEMENT_REQUIRED");

    const used = await client.query<{ amount: string }>(
      `SELECT coalesce(sum(amount),0)::text AS amount
         FROM usage_reservations
        WHERE "organizationId"=$1::uuid AND resource=$2 AND state IN ('RESERVED','CONSUMED')`,
      [input.organizationId, input.resource],
    );
    if (BigInt(used.rows[0]?.amount || "0") + BigInt(input.amount) > BigInt(limit)) {
      throw new AppError("Usage quota exceeded", 429, "QUOTA_EXCEEDED");
    }

    const id = randomUUID();
    await client.query(
      `INSERT INTO usage_reservations
        (id,"organizationId","actorId",resource,amount,state,"idempotencyKey","expiresAt")
       VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,'RESERVED',$6,NOW()+interval '15 minutes')`,
      [id, input.organizationId, input.actorId, input.resource, input.amount, input.key],
    );
    return { id, state: "RESERVED", amount: String(input.amount), resource: input.resource };
  }, "SERIALIZABLE");
}

export async function settleUsageReservation(
  organizationId: string,
  actorId: string,
  reservationId: string,
  state: "CONSUMED" | "RELEASED",
) {
  await assertBillingMember(organizationId, actorId);
  return withTenantTransaction({ organizationId, actorId }, async (client) => {
    const result = await client.query(
      `UPDATE usage_reservations
          SET state=$3,"settledAt"=NOW(),"updatedAt"=NOW()
        WHERE id=$1::uuid AND "organizationId"=$2::uuid AND state='RESERVED'
      RETURNING id,state,amount::text,resource`,
      [reservationId, organizationId, state],
    );
    if (!result.rows[0]) throw new AppError("Reservation not found or already settled", 409, "RESERVATION_NOT_SETTLEABLE");
    return result.rows[0];
  });
}
