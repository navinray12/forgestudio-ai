import { getOrganizationBilling, listOrganizationPlans } from "./billing.service.js";
import { withTenantTransaction } from "../../platform/tenancy/tenant-unit-of-work.js";
import { AppError } from "../../utils/app-error.js";

async function readBilling<T>(read: () => Promise<T>): Promise<T> {
  try { return await read(); }
  catch (error) {
    if (["42P01", "42703"].includes(String((error as { code?: string })?.code))) {
      throw new AppError("Billing storage is not provisioned correctly. Apply the billing database migrations and try again.", 503, "BILLING_SCHEMA_UNAVAILABLE");
    }
    throw error;
  }
}

async function stripe(path: string, body?: URLSearchParams) {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new AppError("Stripe is not configured", 503, "BILLING_PROVIDER_NOT_CONFIGURED");
  const response = await fetch(`https://api.stripe.com/v1/${path}`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${key}`, ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) }, body, signal: AbortSignal.timeout(8000) });
  const data = await response.json();
  if (!response.ok) throw new AppError("Payment provider request failed. Please try again.", 502, "BILLING_PROVIDER_FAILED");
  return data;
}
export function providerLink(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try { const url = new URL(value); return url.protocol === "https:" && ["invoice.stripe.com", "pay.stripe.com", "billing.stripe.com"].includes(url.hostname) ? url.href : null; } catch { return null; }
}
async function stripeList(path: string) {
  const rows: any[] = [];
  let cursor = "";
  for (;;) {
    const page = await stripe(path + (cursor ? `&starting_after=${encodeURIComponent(cursor)}` : ""));
    if (!Array.isArray(page.data)) throw new AppError("Invalid provider response", 502, "BILLING_PROVIDER_FAILED");
    rows.push(...page.data);
    if (!page.has_more) return { data: rows };
    const next = page.data.at(-1)?.id;
    if (!next || next === cursor) throw new AppError("Invalid provider pagination", 502, "BILLING_PROVIDER_FAILED");
    cursor = next;
  }
}
export async function billingDashboard(organizationId: string, actorId: string) {
  const summary = await readBilling(() => getOrganizationBilling(organizationId, actorId)); // OWNER/ADMIN authorization before provider access
  const plans = await readBilling(() => listOrganizationPlans(organizationId, actorId));
  const invoices = await readBilling(() => withTenantTransaction({ organizationId, actorId }, async client => (await client.query(`SELECT id,"providerInvoiceId",amount,currency,status,"issuedAt" FROM organization_invoices WHERE "organizationId"=$1::uuid ORDER BY "issuedAt" DESC,id DESC`, [organizationId])).rows));
  const blocked: string[] = [];
  let methods: Array<{ id: string; brand: string; last4: string; expiry: string }> = [];
  let subscriptionDetails = null;
  let providerInvoices: unknown[] | null = null;
  const customer = summary.account?.providerCustomerId;
  const configured = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  if (!configured) blocked.push("Stripe is not configured. Payment methods, provider invoice downloads and subscription management are unavailable.");
  else if (!customer) blocked.push("No payment-provider customer is linked to this organization.");
  else {
    const results = await Promise.allSettled([
      stripeList(`invoices?customer=${encodeURIComponent(customer)}&limit=100`),
      stripeList(`payment_methods?customer=${encodeURIComponent(customer)}&type=card&limit=100`),
      stripeList(`subscriptions?customer=${encodeURIComponent(customer)}&status=all&limit=100`),
    ]);
    if (results[0].status === "fulfilled") providerInvoices = results[0].value.data.map((row: any) => ({ id: row.id, number: row.number || row.id, amount: row.status === "paid" ? row.amount_paid : row.amount_due, currency: row.currency, status: row.status, issuedAt: new Date(row.created * 1000).toISOString(), periodStart: row.period_start ? new Date(row.period_start * 1000).toISOString() : null, periodEnd: row.period_end ? new Date(row.period_end * 1000).toISOString() : null, downloadUrl: providerLink(row.invoice_pdf) }));
    else blocked.push("Provider invoices could not be loaded. Stored invoice records are shown without download links.");
    if (results[1].status === "fulfilled") methods = results[1].value.data.map((row: any) => ({ id: row.id, brand: row.card?.brand, last4: row.card?.last4, expiry: `${row.card?.exp_month}/${row.card?.exp_year}` }));
    else blocked.push("Payment methods could not be loaded.");
    if (results[2].status === "fulfilled") {
      const subscriptions = results[2].value.data;
      const row = subscriptions.find((item: any) => ["active", "trialing", "past_due"].includes(item.status));
      const price = row?.items?.data?.[0]?.price;
      if (row) subscriptionDetails = { status: row.status, amount: price?.unit_amount ?? null, currency: price?.currency, interval: price?.recurring?.interval, nextBilling: row.current_period_end ? new Date(row.current_period_end * 1000).toISOString() : row.items?.data?.[0]?.current_period_end ? new Date(row.items.data[0].current_period_end * 1000).toISOString() : null };
    } else blocked.push("Live subscription details could not be loaded.");
  }
  const checkoutAvailable = configured && Boolean(process.env.STRIPE_PRICE_MAP_JSON) && Boolean(process.env.STRIPE_WEBHOOK_SECRET) && plans.length > 0;
  if (!checkoutAvailable) blocked.push("New subscription checkout requires Stripe credentials, webhook configuration, a price map and an organization plan catalogue.");
  return { ...summary, plans, invoices: providerInvoices ?? invoices.map(row => ({ ...row, number: row.providerInvoiceId, downloadUrl: null })), paymentMethods: methods, subscriptionDetails, blocked, portalAvailable: configured && Boolean(customer) && Boolean(process.env.FRONTEND_URL), checkoutAvailable };
}
export async function billingPortal(organizationId: string, actorId: string) {
  const summary = await readBilling(() => getOrganizationBilling(organizationId, actorId));
  const customer = summary.account?.providerCustomerId;
  if (!customer) throw new AppError("No payment-provider customer is linked", 409, "BILLING_CUSTOMER_MISSING");
  const frontend = process.env.FRONTEND_URL;
  if (!frontend) throw new AppError("FRONTEND_URL is not configured", 503, "BILLING_PROVIDER_NOT_CONFIGURED");
  const returnUrl = new URL("/dashboard", frontend);
  if (process.env.NODE_ENV === "production" && returnUrl.protocol !== "https:") throw new AppError("A secure frontend URL is required", 503, "BILLING_PROVIDER_NOT_CONFIGURED");
  const data = await stripe("billing_portal/sessions", new URLSearchParams({ customer, return_url: returnUrl.href }));
  const url = providerLink(data.url);
  if (!url) throw new AppError("Payment provider returned an invalid URL", 502, "BILLING_PROVIDER_FAILED");
  return { url };
}
