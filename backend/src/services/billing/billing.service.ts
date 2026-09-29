import { createHash, randomUUID } from "crypto";
import { pgPool, prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { withTenantTransaction, requireOrganizationManagerSql } from "../../platform/tenancy/context.js";
import { createStripeCheckout, verifyStripeWebhook } from "./stripe.adapter.js";

function key(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(value)) {
    throw new AppError("A valid Idempotency-Key is required", 400, "IDEMPOTENCY_KEY_REQUIRED");
  }
  return value;
}
function metric(value: unknown): string {
  if (typeof value !== "string" || !/^[a-z][a-z0-9._-]{1,79}$/.test(value)) throw new AppError("Invalid usage metric", 400, "INVALID_USAGE_METRIC");
  return value;
}
function amount(value: unknown): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) throw new AppError("Usage amount must be a positive integer", 400, "INVALID_USAGE_AMOUNT");
  return n;
}
function seatLimit(features: unknown): number {
  if (features && typeof features === "object" && !Array.isArray(features)) {
    const n = Number((features as Record<string,unknown>).seatLimit);
    if (Number.isSafeInteger(n) && n > 0) return n;
  }
  return 5;
}

export async function getOrganizationBillingSummary(organizationId: string, actorId: string) {
  return withTenantTransaction({ organizationId, actorId }, async (client) => {
    await requireOrganizationManagerSql(client, organizationId, actorId);
    const [subscription, seats, usage, invoices] = await Promise.all([
      client.query(`SELECT s.*,p.name AS "planName",p.slug AS "planSlug",p.price,p.currency,
                           p."websiteLimit",p."storageLimitMb",p."aiCreditLimit",p.features
                      FROM organization_subscriptions s
                      JOIN subscription_plans p ON p.id=s."planId"
                     WHERE s."organizationId"=$1::uuid`, [organizationId]),
      client.query(`SELECT count(*)::int AS count FROM organization_members WHERE "organizationId"=$1::uuid`, [organizationId]),
      client.query(`SELECT metric,coalesce(sum(quantity),0)::bigint AS quantity
                      FROM usage_events WHERE "organizationId"=$1::uuid GROUP BY metric ORDER BY metric`, [organizationId]),
      client.query(`SELECT id,provider,"providerInvoiceId",amount,currency,status,"periodStart","periodEnd","createdAt"
                      FROM organization_invoices WHERE "organizationId"=$1::uuid ORDER BY "createdAt" DESC LIMIT 50`, [organizationId]),
    ]);
    return {
      subscription: subscription.rows[0] ?? null,
      seatsUsed: seats.rows[0]?.count ?? 0,
      usage: usage.rows,
      invoices: invoices.rows,
    };
  });
}

export async function createOrganizationCheckout(input: {
  organizationId: string; actorId: string; planSlug: string; idempotencyKey: string;
}) {
  const idempotencyKey = key(input.idempotencyKey);
  if (!/^[a-z0-9-]{1,64}$/i.test(input.planSlug)) throw new AppError("Invalid plan", 400, "INVALID_PLAN");
  const plan = await prisma.subscriptionPlan.findUnique({ where: { slug: input.planSlug.toLowerCase() } });
  if (!plan || !plan.isActive) throw new AppError("Plan is unavailable", 404, "PLAN_NOT_FOUND");

  const intent = await withTenantTransaction({ organizationId: input.organizationId, actorId: input.actorId }, async (client) => {
    await requireOrganizationManagerSql(client, input.organizationId, input.actorId);
    const actor = await client.query<{email:string|null}>(`SELECT email FROM users WHERE id=$1::uuid AND status='ACTIVE'`, [input.actorId]);
    if (!actor.rows[0]) throw new AppError("Account is not active", 403, "ACCOUNT_INACTIVE");

    const existing = await client.query(`SELECT * FROM billing_checkout_intents
      WHERE "organizationId"=$1::uuid AND "actorId"=$2::uuid AND "idempotencyKey"=$3`,
      [input.organizationId,input.actorId,idempotencyKey]);
    if (existing.rows[0]) return { row: existing.rows[0], email: actor.rows[0].email, replay: true };

    if (plan.price === 0) {
      await client.query(`INSERT INTO organization_subscriptions
        ("organizationId","planId",provider,status,"seatLimit","currentPeriodStart","updatedAt")
        VALUES($1::uuid,$2::uuid,NULL,'ACTIVE',$3,now(),now())
        ON CONFLICT("organizationId") DO UPDATE SET "planId"=excluded."planId",provider=NULL,status='ACTIVE',
          "seatLimit"=excluded."seatLimit","currentPeriodStart"=now(),"currentPeriodEnd"=NULL,
          "cancelAtPeriodEnd"=false,version=organization_subscriptions.version+1,"updatedAt"=now()`,
        [input.organizationId,plan.id,seatLimit(plan.features)]);
      const inserted = await client.query(`INSERT INTO billing_checkout_intents
        (id,"organizationId","actorId","planId",provider,"idempotencyKey",status,"createdAt","updatedAt")
        VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,'internal',$5,'COMPLETED',now(),now()) RETURNING *`,
        [randomUUID(),input.organizationId,input.actorId,plan.id,idempotencyKey]);
      await client.query(`INSERT INTO durable_outbox
        ("organizationId","eventType","aggregateType","aggregateId",payload)
        VALUES($1::uuid,'billing.subscription.changed','organization',$1,$2::jsonb)`,
        [input.organizationId,JSON.stringify({planId:plan.id,status:"ACTIVE",source:"free-plan"})]);
      return { row: inserted.rows[0], email: actor.rows[0].email, replay: false };
    }

    const created = await client.query(`INSERT INTO billing_checkout_intents
      (id,"organizationId","actorId","planId",provider,"idempotencyKey",status,"createdAt","updatedAt")
      VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,'stripe',$5,'PENDING',now(),now()) RETURNING *`,
      [randomUUID(),input.organizationId,input.actorId,plan.id,idempotencyKey]);
    return { row: created.rows[0], email: actor.rows[0].email, replay: false };
  });

  if (intent.row.status === "COMPLETED") return { status: "COMPLETED", checkoutUrl: null, plan };
  if (intent.row.checkoutUrl) return { status: intent.row.status, checkoutUrl: intent.row.checkoutUrl, plan };

  const checkout = await createStripeCheckout({
    organizationId: input.organizationId,
    planId: plan.id,
    planSlug: plan.slug,
    actorEmail: intent.email,
    idempotencyKey: `forge-${intent.row.id}`,
  });
  await withTenantTransaction({ organizationId: input.organizationId, actorId: input.actorId }, async (client) => {
    await client.query(`UPDATE billing_checkout_intents SET "providerSessionId"=$1,"checkoutUrl"=$2,
      status='CHECKOUT_CREATED',"expiresAt"=to_timestamp($3),"updatedAt"=now()
      WHERE id=$4::uuid AND status='PENDING'`, [checkout.id,checkout.url,checkout.expires_at ?? Math.floor(Date.now()/1000)+1800,intent.row.id]);
  });
  return { status: "CHECKOUT_CREATED", checkoutUrl: checkout.url, plan };
}

function statusFromStripe(value: unknown): string {
  const state = String(value ?? "").toLowerCase();
  if (["active","trialing"].includes(state)) return "ACTIVE";
  if (["past_due","unpaid","incomplete","incomplete_expired"].includes(state)) return "PAST_DUE";
  if (["canceled","cancelled"].includes(state)) return "CANCELLED";
  return "PENDING";
}

export async function processStripeWebhook(raw: Buffer, signature: unknown): Promise<{ duplicate: boolean; eventId: string }> {
  const event = verifyStripeWebhook(raw, signature);
  const digest = createHash("sha256").update(raw).digest("hex");
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    const accepted = await client.query(`INSERT INTO billing_event_inbox(provider,"eventId","eventType","payloadDigest")
      VALUES('stripe',$1,$2,$3) ON CONFLICT(provider,"eventId") DO NOTHING RETURNING "eventId"`,
      [event.id,event.type,digest]);
    if (!accepted.rowCount) { await client.query("ROLLBACK"); return { duplicate: true, eventId: event.id }; }

    const object = event.data.object;
    const metadata = object?.metadata ?? object?.subscription_details?.metadata ?? object?.parent?.subscription_details?.metadata ?? {};
    const organizationId = metadata.organizationId ?? object?.client_reference_id;
    const planId = metadata.planId;
    if (typeof organizationId !== "string") throw new AppError("Billing event is missing organization metadata", 422, "BILLING_RECONCILIATION_REQUIRED");
    await client.query("SELECT set_config('app.tenant_id',$1,true)", [organizationId]);

    if (event.type === "checkout.session.completed") {
      const customerId = typeof object.customer === "string" ? object.customer : object.customer?.id;
      await client.query(`INSERT INTO organization_billing_accounts("organizationId",provider,"providerCustomerId",currency,status)
        VALUES($1::uuid,'stripe',$2,$3,'ACTIVE')
        ON CONFLICT("organizationId") DO UPDATE SET "providerCustomerId"=excluded."providerCustomerId",
          currency=excluded.currency,status='ACTIVE',version=organization_billing_accounts.version+1,"updatedAt"=now()`,
        [organizationId,customerId ?? null,String(object.currency ?? "usd").toUpperCase()]);
      if (planId) {
        const plan = await client.query(`SELECT features FROM subscription_plans WHERE id=$1::uuid`, [planId]);
        await client.query(`INSERT INTO organization_subscriptions("organizationId","planId",provider,"providerSubscriptionId",status,"seatLimit","currentPeriodStart")
          VALUES($1::uuid,$2::uuid,'stripe',$3,'PENDING',$4,now())
          ON CONFLICT("organizationId") DO UPDATE SET "planId"=excluded."planId",provider='stripe',
          "providerSubscriptionId"=excluded."providerSubscriptionId",status='PENDING',"seatLimit"=excluded."seatLimit",
          version=organization_subscriptions.version+1,"updatedAt"=now()`,
          [organizationId,planId,typeof object.subscription==="string"?object.subscription:null,seatLimit(plan.rows[0]?.features)]);
      }
    } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.created") {
      if (!planId) throw new AppError("Subscription event is missing plan metadata", 422, "BILLING_RECONCILIATION_REQUIRED");
      const plan = await client.query(`SELECT features FROM subscription_plans WHERE id=$1::uuid`, [planId]);
      await client.query(`INSERT INTO organization_subscriptions("organizationId","planId",provider,"providerSubscriptionId",status,"seatLimit","currentPeriodStart","currentPeriodEnd","cancelAtPeriodEnd")
        VALUES($1::uuid,$2::uuid,'stripe',$3,$4,$5,to_timestamp($6),to_timestamp($7),$8)
        ON CONFLICT("organizationId") DO UPDATE SET "planId"=excluded."planId",provider='stripe',
        "providerSubscriptionId"=excluded."providerSubscriptionId",status=excluded.status,"seatLimit"=excluded."seatLimit",
        "currentPeriodStart"=excluded."currentPeriodStart","currentPeriodEnd"=excluded."currentPeriodEnd",
        "cancelAtPeriodEnd"=excluded."cancelAtPeriodEnd",version=organization_subscriptions.version+1,"updatedAt"=now()`,
        [organizationId,planId,object.id,statusFromStripe(object.status),seatLimit(plan.rows[0]?.features),
         Number(object.current_period_start || Math.floor(Date.now()/1000)),
         Number(object.current_period_end || Math.floor(Date.now()/1000)),Boolean(object.cancel_at_period_end)]);
    } else if (event.type === "customer.subscription.deleted") {
      await client.query(`UPDATE organization_subscriptions SET status='CANCELLED',"cancelAtPeriodEnd"=false,
        version=version+1,"updatedAt"=now() WHERE "organizationId"=$1::uuid`, [organizationId]);
    } else if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
      const amount = Number(event.type === "invoice.paid" ? object.amount_paid : object.amount_due);
      await client.query(`INSERT INTO organization_invoices
        ("organizationId",provider,"providerInvoiceId",amount,currency,status,"periodStart","periodEnd")
        VALUES($1::uuid,'stripe',$2,$3,$4,$5,to_timestamp($6),to_timestamp($7))
        ON CONFLICT(provider,"providerInvoiceId") DO UPDATE SET status=excluded.status,amount=excluded.amount`,
        [organizationId,object.id,Number.isSafeInteger(amount)?amount:0,String(object.currency ?? "usd").toUpperCase(),
         event.type === "invoice.paid" ? "PAID" : "PAYMENT_FAILED",
         Number(object.period_start || object.lines?.data?.[0]?.period?.start || Math.floor(Date.now()/1000)),
         Number(object.period_end || object.lines?.data?.[0]?.period?.end || Math.floor(Date.now()/1000))]);
      if (event.type === "invoice.payment_failed") {
        await client.query(`UPDATE organization_subscriptions SET status='PAST_DUE',version=version+1,"updatedAt"=now()
          WHERE "organizationId"=$1::uuid`, [organizationId]);
      }
    }

    await client.query(`INSERT INTO durable_outbox("organizationId","eventType","aggregateType","aggregateId",payload)
      VALUES($1::uuid,$2,'organization',$1,$3::jsonb)`, [organizationId,`billing.${event.type}`,JSON.stringify({eventId:event.id})]);
    await client.query(`UPDATE billing_event_inbox SET "processedAt"=now(),"lastError"=NULL WHERE provider='stripe' AND "eventId"=$1`, [event.id]);
    await client.query("COMMIT");
    return { duplicate: false, eventId: event.id };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    await pgPool.query(`UPDATE billing_event_inbox SET "lastError"=$1 WHERE provider='stripe' AND "eventId"=$2`,
      [error instanceof Error ? error.message.slice(0,1000) : "unknown", event.id]).catch(() => undefined);
    throw error;
  } finally { client.release(); }
}

async function limitFor(client: any, organizationId: string, metricName: string): Promise<number | null> {
  const result = await client.query(`SELECT p."websiteLimit",p."storageLimitMb",p."aiCreditLimit",s."seatLimit"
    FROM organization_subscriptions s JOIN subscription_plans p ON p.id=s."planId"
    WHERE s."organizationId"=$1::uuid AND s.status IN ('ACTIVE','TRIALING','GRACE')`, [organizationId]);
  const row = result.rows[0]; if (!row) throw new AppError("Active organization subscription is required", 402, "SUBSCRIPTION_REQUIRED");
  if (metricName === "websites") return Number(row.websiteLimit);
  if (metricName === "storage_bytes") return Number(row.storageLimitMb) * 1024 * 1024;
  if (metricName === "ai_credits") return Number(row.aiCreditLimit);
  if (metricName === "seats") return Number(row.seatLimit);
  return null;
}

export async function reserveOrganizationUsage(input: {
  organizationId:string; actorId:string; metric:unknown; amount:unknown; idempotencyKey:unknown; ttlSeconds?:number;
}) {
  const metricName=metric(input.metric), qty=amount(input.amount), idem=key(input.idempotencyKey);
  return withTenantTransaction({organizationId:input.organizationId,actorId:input.actorId}, async client => {
    await requireOrganizationManagerSql(client,input.organizationId,input.actorId);
    // Serialize strict quota decisions per organization+metric so concurrent
    // reservations cannot each observe the same remaining balance.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [input.organizationId+":"+metricName]);
    const existing=await client.query(`SELECT * FROM quota_reservations WHERE "organizationId"=$1::uuid AND metric=$2 AND "idempotencyKey"=$3`,
      [input.organizationId,metricName,idem]); if(existing.rows[0]) return existing.rows[0];
    const limit=await limitFor(client,input.organizationId,metricName);
    if(limit!==null){
      let consumed=0;
      if(metricName==="seats") consumed=Number((await client.query(`SELECT count(*)::int AS n FROM organization_members WHERE "organizationId"=$1::uuid`,[input.organizationId])).rows[0].n);
      else consumed=Number((await client.query(`SELECT coalesce(sum(quantity),0)::bigint AS n FROM usage_events WHERE "organizationId"=$1::uuid AND metric=$2`,[input.organizationId,metricName])).rows[0].n);
      const reserved=Number((await client.query(`SELECT coalesce(sum(amount),0)::bigint AS n FROM quota_reservations
        WHERE "organizationId"=$1::uuid AND metric=$2 AND state='RESERVED' AND "expiresAt">now()`,[input.organizationId,metricName])).rows[0].n);
      if(consumed+reserved+qty>limit) throw new AppError("Organization quota is exhausted",429,"QUOTA_EXCEEDED");
    }
    const ttl=Math.min(3600,Math.max(30,input.ttlSeconds??300));
    return (await client.query(`INSERT INTO quota_reservations(id,"organizationId",metric,amount,state,"idempotencyKey","expiresAt")
      VALUES($1::uuid,$2::uuid,$3,$4,'RESERVED',$5,now()+($6::text||' seconds')::interval) RETURNING *`,
      [randomUUID(),input.organizationId,metricName,qty,idem,String(ttl)])).rows[0];
  });
}

export async function settleOrganizationReservation(input:{
  organizationId:string;actorId:string;reservationId:string;action:"consume"|"release";
}) {
  return withTenantTransaction({organizationId:input.organizationId,actorId:input.actorId}, async client=>{
    await requireOrganizationManagerSql(client,input.organizationId,input.actorId);
    const found=await client.query(`SELECT * FROM quota_reservations WHERE id=$1::uuid AND "organizationId"=$2::uuid FOR UPDATE`,[input.reservationId,input.organizationId]);
    const row=found.rows[0]; if(!row) throw new AppError("Reservation not found",404,"NOT_FOUND");
    if(row.state!=="RESERVED") return row;
    if(input.action==="consume"){
      await client.query(`INSERT INTO usage_events(id,"organizationId",metric,quantity,"idempotencyKey","reservationId")
        VALUES($1::uuid,$2::uuid,$3,$4,$5,$6::uuid) ON CONFLICT DO NOTHING`,
        [randomUUID(),input.organizationId,row.metric,row.amount,`reservation:${row.id}`,row.id]);
    }
    return (await client.query(`UPDATE quota_reservations SET state=$1,"updatedAt"=now() WHERE id=$2::uuid RETURNING *`,
      [input.action==="consume"?"CONSUMED":"RELEASED",row.id])).rows[0];
  });
}
