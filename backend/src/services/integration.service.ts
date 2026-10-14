import crypto from "crypto";
import dns from "node:dns/promises";
import net from "node:net";
import { safeEgressRequest, parseJsonEgress } from "../platform/integrations/safe-egress.js";

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const DYNAMIC_DATA_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 500;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

const PRIVATE_HOSTNAMES = new Set(["localhost", "localhost.localdomain"]);

function isPrivateIp(address: string): boolean {
  const version = net.isIP(address);
  if (version === 4) {
    const [a, b] = address.split(".").map(Number);
    return a === 10 || a === 127 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) || a === 0;
  }
  if (version === 6) {
    const normalized = address.toLowerCase();
    return normalized === "::1" || normalized === "::" ||
      normalized.startsWith("fc") || normalized.startsWith("fd") ||
      normalized.startsWith("fe8") || normalized.startsWith("fe9") ||
      normalized.startsWith("fea") || normalized.startsWith("feb") ||
      normalized.startsWith("::ffff:127.") || normalized.startsWith("::ffff:10.") ||
      normalized.startsWith("::ffff:192.168.") || normalized.startsWith("::ffff:172.");
  }
  return true;
}

async function assertSafeExternalUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new Error("Invalid integration URL"); }
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("Only HTTP(S) integration URLs are allowed");

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (PRIVATE_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("Private or local integration targets are not allowed");
  }
  if (isPrivateIp(hostname)) throw new Error("Private or local integration targets are not allowed");

  const resolved = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!resolved.length || resolved.some(({ address }) => isPrivateIp(address))) {
    throw new Error("Integration target resolves to a private or local address");
  }
  return url;
}

function withTimeout(timeoutMs: number = REQUEST_TIMEOUT_MS): AbortSignal { return AbortSignal.timeout(timeoutMs); }

async function readJsonResponse(response: Response): Promise<any> {
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_RESPONSE_BYTES) throw new Error("External response exceeds the allowed size");
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) throw new Error("External response exceeds the allowed size");
  try { return JSON.parse(text); } catch { throw new Error("External service returned invalid JSON"); }
}

function validateMoney(amount: string, currency: string): { amount: string; currency: string } {
  const normalizedAmount = String(amount).trim();
  const normalizedCurrency = String(currency).trim().toUpperCase();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalizedAmount) || Number(normalizedAmount) <= 0) {
    throw new Error("Amount must be a positive value with at most two decimal places");
  }
  if (!/^[A-Z]{3}$/.test(normalizedCurrency)) throw new Error("Currency must be a three-letter ISO currency code");
  return { amount: normalizedAmount, currency: normalizedCurrency };
}

async function paypalAccessToken(): Promise<{ token: string; baseUrl: string }> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("PayPal integration is not configured");
  const sandbox = process.env.PAYPAL_ENV !== "production";
  const baseUrl = sandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    signal: withTimeout(),
  });
  if (!response.ok) throw new Error(`PayPal authentication failed (${response.status})`);
  const data = await readJsonResponse(response);
  if (!data.access_token) throw new Error("PayPal did not return an access token");
  return { token: data.access_token, baseUrl };
}

export class IntegrationService {
  // ==========================================
  // F-418: PayPal Payment Integration
  // ==========================================
  public static async createPayPalOrder(
    amount: string,
    currency: string = "USD",
    itemName: string = "Digital Product",
    itemDescription: string = "",
    quantity: number = 1,
    env: string = "sandbox"
  ) {
    const money = validateMoney(amount, currency);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000) {
      throw new Error("PayPal quantity must be a positive integer at most 1000");
    }
    // PAYPAL_ENV and server credentials choose the authorized environment.
    if (env !== "sandbox" && env !== "live") throw new Error("Invalid PayPal environment");
    const unitMinor = Math.round(Number(money.amount) * 100);
    const totalMinor = unitMinor * quantity;
    if (!Number.isSafeInteger(totalMinor) || totalMinor <= 0) throw new Error("PayPal total is out of range");
    const total = (totalMinor / 100).toFixed(2);

    // The opt-in local demo is never an actual checkout or a completed payment.
    if (process.env.NODE_ENV !== "production" && process.env.PAYPAL_DEMO_MODE === "1") {
      return {
        success: true, simulated: true,
        orderId: "PAYPAL-DEMO-" + crypto.randomBytes(8).toString("hex").toUpperCase(),
        amount: total, currency: money.currency, itemName, quantity,
        approveUrl: null, mode: "demo", message: "Development simulation only. No payment was created.",
      };
    }

    const { token, baseUrl } = await paypalAccessToken();
    // An editor must never silently send a sandbox request to live PayPal (or vice versa).
    const authorizedEnv = baseUrl.includes(".sandbox.") ? "sandbox" : "live";
    if (env !== authorizedEnv) throw new Error("Requested PayPal environment differs from the server configuration");
    const response = await fetch(baseUrl + "/v2/checkout/orders", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          description: String(itemDescription || itemName).slice(0, 127),
          amount: {
            currency_code: money.currency, value: total,
            breakdown: { item_total: { currency_code: money.currency, value: total } },
          },
          items: [{
            name: String(itemName || "Digital Product").slice(0, 127),
            quantity: String(quantity),
            unit_amount: { currency_code: money.currency, value: (unitMinor / 100).toFixed(2) },
          }],
        }],
      }),
      signal: withTimeout(),
    });
    const data = await readJsonResponse(response);
    if (!response.ok) throw new Error(data?.message || "PayPal order creation failed (" + response.status + ")");
    const orderId = data?.id;
    const approval = Array.isArray(data?.links) ? data.links.find(
      (link: { rel?: string; href?: string }) => link.rel === "approve" && typeof link.href === "string"
    )?.href : undefined;
    if (typeof orderId !== "string" || !/^[a-zA-Z0-9-]{1,100}$/.test(orderId) ||
        typeof approval !== "string" || !approval.startsWith("https://")) {
      throw new Error("PayPal did not return a valid order and approval URL");
    }
    return {
      success: true, simulated: false, orderId, amount: total, currency: money.currency,
      itemName, quantity, approveUrl: approval,
      mode: baseUrl.includes(".sandbox.") ? "sandbox" : "live",
    };
  }

  public static async capturePayPalOrder(orderId: string) {
    if (typeof orderId !== "string" || !/^[a-zA-Z0-9-]{1,100}$/.test(orderId)) {
      throw new Error("Invalid PayPal order ID");
    }
    if (orderId.startsWith("PAYPAL-DEMO-") || orderId.startsWith("PAYPAL-ORD-")) {
      throw new Error("Simulated PayPal orders cannot be captured");
    }
    const { token, baseUrl } = await paypalAccessToken();
    const response = await fetch(baseUrl + "/v2/checkout/orders/" + encodeURIComponent(orderId) + "/capture", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      signal: withTimeout(),
    });
    const data = await readJsonResponse(response);
    if (!response.ok) throw new Error(data?.message || "PayPal capture failed (" + response.status + ")");
    const captures = data?.purchase_units?.flatMap(
      (unit: { payments?: { captures?: Array<{ id?: string; status?: string }> } }) =>
        unit.payments?.captures ?? []
    ) ?? [];
    const completed = data?.status === "COMPLETED" &&
      captures.length > 0 && captures.every(
        (capture: { id?: string; status?: string }) => capture.status === "COMPLETED" && !!capture.id
      );
    if (!completed) throw new Error("PayPal did not confirm a completed capture");
    return {
      success: true, orderId, status: "COMPLETED",
      transactionId: captures[0].id as string,
      capturedAt: new Date().toISOString(), simulated: false,
    };
  }

  public static async createStripeCheckoutSession(amount: string, currency: string, itemName: string) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const successUrl = process.env.STRIPE_SUCCESS_URL;
    const cancelUrl = process.env.STRIPE_CANCEL_URL;
    if (!secretKey || !successUrl || !cancelUrl) throw new Error("Stripe integration is not configured");
    const money = validateMoney(amount, currency);
    const amountMinor = Math.round(Number(money.amount) * 100);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new Error("Amount is out of range");

    const form = new URLSearchParams({
      mode: "payment", success_url: successUrl, cancel_url: cancelUrl,
      "line_items[0][price_data][currency]": money.currency.toLowerCase(),
      "line_items[0][price_data][product_data][name]": String(itemName || "Subscription").slice(0, 250),
      "line_items[0][price_data][unit_amount]": String(amountMinor),
      "line_items[0][quantity]": "1",
    });
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST", headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form, signal: withTimeout(),
    });
    const data = await readJsonResponse(response);
    if (!response.ok) throw new Error(data?.error?.message || `Stripe checkout creation failed (${response.status})`);
    if (!data.id || !data.url) throw new Error("Stripe did not return a checkout URL");
    return { success: true, sessionId: data.id, sessionUrl: data.url, amount: money.amount, currency: money.currency, itemName };
  }

  public static async fetchDynamicData(targetUrl: string, jsonPath?: string) {
    const safeUrl = await assertSafeExternalUrl(targetUrl);
    const normalizedPath = (jsonPath || "").trim();
    const cacheKey = `${safeUrl.toString()}:${normalizedPath}`;
    const now = Date.now();
    const cached = DYNAMIC_DATA_CACHE.get(cacheKey);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) return cached.data;
    if (cached) DYNAMIC_DATA_CACHE.delete(cacheKey);

    const response = await safeEgressRequest({
      url: safeUrl.toString(),
      method: "GET",
      headers: { Accept: "application/json", "User-Agent": "ForgeStudio-Integration/2.0" },
      timeoutMs: REQUEST_TIMEOUT_MS,
      maxResponseBytes: MAX_RESPONSE_BYTES,
      allowedPorts: process.env.NODE_ENV === "production" ? [443] : [443, 80],
      allowHttp: process.env.NODE_ENV !== "production",
    });
    const json = parseJsonEgress<any>(response);
    let value: unknown = json;
    if (normalizedPath) {
      const parts = normalizedPath.split(".").filter(Boolean);
      if (parts.length > 20 || parts.some((part) => ["__proto__", "prototype", "constructor"].includes(part))) throw new Error("Invalid JSON path");
      let current: any = json;
      for (const part of parts) {
        if (current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, part)) current = current[part];
        else { current = undefined; break; }
      }
      value = current;
    }
    const result = { success: true, value, url: safeUrl.toString(), jsonPath: normalizedPath || undefined };
    if (DYNAMIC_DATA_CACHE.size >= CACHE_MAX_ENTRIES) {
      const oldestKey = DYNAMIC_DATA_CACHE.keys().next().value;
      if (oldestKey) DYNAMIC_DATA_CACHE.delete(oldestKey);
    }
    DYNAMIC_DATA_CACHE.set(cacheKey, { data: result, timestamp: now });
    return result;
  }

  public static async submitLeadToCRM(provider: string, name: string, email: string, customFields?: Record<string, unknown>) {
    const normalizedProvider = String(provider || "hubspot").toLowerCase();
    if (normalizedProvider !== "hubspot") throw new Error(`Unsupported CRM provider: ${normalizedProvider}`);
    const token = process.env.HUBSPOT_ACCESS_TOKEN;
    if (!token) throw new Error("HubSpot integration is not configured");
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Invalid email address");

    const properties: Record<string, string> = { firstname: String(name).trim().slice(0, 100), email: email.trim().slice(0, 320) };
    if (customFields && typeof customFields === "object") {
      for (const [key, value] of Object.entries(customFields)) {
        if (/^[a-zA-Z0-9_]{1,100}$/.test(key) && value !== undefined && value !== null) properties[key] = String(value).slice(0, 2000);
      }
    }
    const response = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ properties }), signal: withTimeout(),
    });
    const data = await readJsonResponse(response);
    if (!response.ok) throw new Error(data?.message || `HubSpot sync failed (${response.status})`);
    return { success: true, syncId: data.id || crypto.randomUUID(), provider: normalizedProvider, lead: { name: properties.firstname, email: properties.email }, timestamp: new Date().toISOString() };
  }

  public static async dispatchWebhook(webhookUrl: string, eventType: string, payload?: unknown, secret?: string) {
    const safeUrl = await assertSafeExternalUrl(webhookUrl);
    const normalizedEvent = String(eventType || "event").trim().slice(0, 100);
    const timestamp = new Date().toISOString();
    const eventId = `evt_${crypto.randomBytes(8).toString("hex")}`;
    const bodyData = { eventId, eventType: normalizedEvent, timestamp, data: payload ?? {} };
    const body = JSON.stringify(bodyData);
    const signature = secret ? crypto.createHmac("sha256", secret).update(body).digest("hex") : "";
    const response = await safeEgressRequest({
      url: safeUrl.toString(), method: "POST",
      headers: {
        "Content-Type": "application/json", "User-Agent": "ForgeStudio-Webhook/2.0",
        ...(signature ? { "X-ForgeStudio-Signature": signature } : {}),
        "X-ForgeStudio-Event": normalizedEvent, "X-ForgeStudio-Event-Id": eventId,
      },
      body, timeoutMs: REQUEST_TIMEOUT_MS, maxResponseBytes: 512 * 1024,
      allowedPorts: process.env.NODE_ENV === "production" ? [443] : [443, 80], allowHttp: process.env.NODE_ENV !== "production",
    });
    const ok=response.status>=200&&response.status<300;
    return { success: ok, status: response.status, eventId, message: ok ? "Webhook dispatched successfully" : `Webhook server returned status ${response.status}` };
  }

  public static async syncToGoogleSheets(config: { webhookUrl: string }, rowData: Record<string, unknown>) {
    if (!config?.webhookUrl) throw new Error("Google Sheets Webhook URL is required");
    const safeUrl = await assertSafeExternalUrl(config.webhookUrl);
    const timestamp = new Date().toISOString();
    const payload = { timestamp, submittedAt: timestamp, ...rowData };
    const response = await safeEgressRequest({
      url: safeUrl.toString(), method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "ForgeStudio-GoogleSheets/2.0" },
      body: JSON.stringify(payload), timeoutMs: 15000, maxResponseBytes: 512 * 1024,
      allowedPorts: process.env.NODE_ENV === "production" ? [443] : [443, 80], allowHttp: process.env.NODE_ENV !== "production",
    });
    if (response.status < 200 || response.status >= 300) throw new Error(`Google Sheets endpoint returned HTTP ${response.status}`);
    return { success: true, provider: "google_sheets", timestamp, rowsAppended: 1 };
  }

  public static async syncToMailchimp(
    config: { apiKey: string; listId: string; serverPrefix?: string },
    contact: { email: string; firstName?: string; lastName?: string; tags?: string[]; mergeFields?: Record<string, unknown> }
  ) {
    const { apiKey, listId } = config || {};
    if (!apiKey || !listId) throw new Error("Mailchimp API Key and List ID are required");
    if (!/^\S+@\S+\.\S+$/.test(contact.email)) throw new Error("Invalid email address for Mailchimp sync");
    const serverPrefix = config.serverPrefix || apiKey.split("-")[1] || "us1";
    if (!/^[a-z0-9-]{2,20}$/i.test(serverPrefix)) throw new Error("Invalid Mailchimp server prefix");
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(listId)) throw new Error("Invalid Mailchimp list ID");
    const subscriberHash = crypto.createHash("md5").update(contact.email.toLowerCase().trim()).digest("hex");
    const url = `https://${serverPrefix}.api.mailchimp.com/3.0/lists/${listId}/members/${subscriberHash}`;

    const mergeFields: Record<string, unknown> = { ...(contact.mergeFields || {}) };
    if (contact.firstName) mergeFields.FNAME = contact.firstName.trim();
    if (contact.lastName) mergeFields.LNAME = contact.lastName.trim();
    const bodyData = { email_address: contact.email.toLowerCase().trim(), status_if_new: "subscribed", merge_fields: mergeFields, tags: contact.tags || ["ForgeStudio Lead"] };

    const response = await safeEgressRequest({
      url, method: "PUT",
      headers: { Authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString("base64")}`, "Content-Type": "application/json" },
      body: JSON.stringify(bodyData), timeoutMs: 15000, maxResponseBytes: 1024 * 1024, allowedPorts: [443],
    });
    const data = parseJsonEgress<any>(response);
    return { success: true, provider: "mailchimp", subscriberId: data?.id || subscriberHash, email: contact.email, status: data?.status || "subscribed" };
  }

  public static async dispatchToZapier(zapierUrl: string, payload: Record<string, unknown>, secret?: string) {
    if (!zapierUrl) throw new Error("Zapier Webhook Catch URL is required");
    const safeUrl = await assertSafeExternalUrl(zapierUrl);
    const timestamp = new Date().toISOString();
    const eventId = `zap_${crypto.randomBytes(8).toString("hex")}`;
    const standardizedPayload = { zapierCatchHook: true, eventId, timestamp, data: payload };
    const body = JSON.stringify(standardizedPayload);
    const signature = secret ? crypto.createHmac("sha256", secret).update(body).digest("hex") : "";
    const response = await safeEgressRequest({
      url: safeUrl.toString(), method: "POST",
      headers: {
        "Content-Type": "application/json", "User-Agent": "ForgeStudio-Zapier/2.0",
        ...(signature ? { "X-ForgeStudio-Signature": signature } : {}), "X-ForgeStudio-Event-Id": eventId,
      },
      body, timeoutMs: 15000, maxResponseBytes: 512 * 1024,
      allowedPorts: process.env.NODE_ENV === "production" ? [443] : [443,80], allowHttp: process.env.NODE_ENV !== "production",
    });
    if (response.status < 200 || response.status >= 300) throw new Error(`Zapier webhook returned HTTP ${response.status}`);
    return { success: true, provider: "zapier", eventId, status: response.status };
  }

}
