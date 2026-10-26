/**
 * Phase 7B regression guard: the backend side of the frontend integration and image-upload calls.
 *
 * The real application (createApplication) is started on an ephemeral port with an inert database
 * (every Prisma call rejects, nothing is written) and outbound fetch blocked. Each request below is
 * exactly what the frontend now sends (URL, method, credentials mode, body), as pinned on the frontend
 * side by frontend/tests/contracts/integration-endpoints.contract.test.tsx. Bodies are chosen so each
 * controller stops at its own validation, before any database or third-party call.
 *
 * It checks that every call reaches its handler (not Express's default "Cannot METHOD /path" 404),
 * that the authenticated routes still reject unauthenticated requests, and that the old frontend paths
 * stay unmapped (no alias was added).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";

vi.mock("../../config/prisma.js", () => {
  const reject = () => Promise.reject(new Error("inert test database"));
  const delegate: any = new Proxy(function () {}, {
    get: (_t, key) => (key === "then" ? undefined : delegate),
    apply: () => reject(),
  });
  return { prisma: delegate, pgPool: delegate, default: delegate };
});

let server: http.Server;
let port = 0;
const realFetch = globalThis.fetch;

beforeAll(async () => {
  globalThis.fetch = (async () => {
    throw new Error("outbound network blocked in tests");
  }) as typeof fetch;
  const { createApplication } = await import("../../app.js");
  server = http.createServer(createApplication());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
}, 60_000);

afterAll(async () => {
  globalThis.fetch = realFetch;
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
});

type Reply = { status: number; body: string; json: any };

function send(method: string, path: string, opts: { json?: unknown; multipart?: { field: string; filename: string; type: string; data: string } } = {}): Promise<Reply> {
  let payload: Buffer | undefined;
  const headers: Record<string, string> = {};
  if (opts.json !== undefined) {
    payload = Buffer.from(JSON.stringify(opts.json));
    headers["content-type"] = "application/json";
  } else if (opts.multipart) {
    const b = "----phase7b";
    const m = opts.multipart;
    payload = Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="${m.field}"; filename="${m.filename}"\r\nContent-Type: ${m.type}\r\n\r\n${m.data}\r\n--${b}--\r\n`);
    headers["content-type"] = `multipart/form-data; boundary=${b}`;
  }
  if (payload) headers["content-length"] = String(payload.length);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method, path, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        let json: any = null;
        try { json = JSON.parse(body); } catch { /* not JSON */ }
        resolve({ status: res.statusCode ?? 0, body, json });
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const expressDefault404 = (r: Reply) => r.status === 404 && /Cannot (GET|POST|PUT|PATCH|DELETE) \//.test(r.body);

describe("public integration routes reached by editor / published-site widgets", () => {
  it("POST /api/v1/integrations/paypal/create-order reaches the controller (amount validation)", async () => {
    // IntegrationRenderers sends { amount, currency, itemName, env }; the PayPal widget also sends itemDescription and quantity.
    const r = await send("POST", "/api/v1/integrations/paypal/create-order", { json: { amount: "0", currency: "USD", itemName: "x", itemDescription: "", quantity: 1, env: "sandbox" } });
    expect(r.status).toBe(400);
    expect(r.json).toEqual({ success: false, message: "Invalid amount. Amount must be a positive number greater than 0." });
  });

  it("POST /api/v1/integrations/paypal/capture-order reaches the controller (orderId validation)", async () => {
    const r = await send("POST", "/api/v1/integrations/paypal/capture-order", { json: {} });
    expect(r.status).toBe(400);
    expect(r.json).toEqual({ success: false, message: "orderId is required" });
  });

  it("POST /api/v1/integrations/stripe/create-checkout-session reaches the controller and answers JSON", async () => {
    // The controller has no request validation; with no Stripe configuration and network blocked the
    // service fails, and the controller's JSON error is what the frontend parses (data.message).
    const r = await send("POST", "/api/v1/integrations/stripe/create-checkout-session", { json: { amount: "49.00", currency: "USD", itemName: "Pro Plan" } });
    expect(expressDefault404(r)).toBe(false);
    expect(r.json?.success).toBe(false);
    expect(typeof r.json?.message).toBe("string");
  });

  it("GET /api/v1/integrations/dynamic-data/fetch reaches the controller (url validation)", async () => {
    const r = await send("GET", "/api/v1/integrations/dynamic-data/fetch?url=&jsonPath=");
    expect(r.status).toBe(400);
    expect(r.json).toEqual({ success: false, message: "Query parameter 'url' is required" });
  });

  it("POST /api/v1/integrations/crm/submit-lead reaches the controller (name / email validation)", async () => {
    const r = await send("POST", "/api/v1/integrations/crm/submit-lead", { json: { provider: "hubspot", name: "", email: "" } });
    expect(r.status).toBe(400);
    expect(r.json).toEqual({ success: false, message: "Name and email are required for CRM sync" });
  });
});

describe("authenticated integration routes keep requiring authentication", () => {
  for (const path of ["/api/v1/integrations/webhook/dispatch", "/api/v1/integrations/google-sheets/test", "/api/v1/integrations/mailchimp/test", "/api/v1/integrations/zapier/test"]) {
    it(`POST ${path} without credentials -> 401`, async () => {
      const r = await send("POST", path, { json: { webhookUrl: "https://example.invalid/hook" } });
      expect(r.status).toBe(401);
      expect(expressDefault404(r)).toBe(false);
    });
  }
});

describe("image upload route used by the shared image picker", () => {
  it("POST /api/v1/uploads/image (multipart field \"image\") without credentials -> 401", async () => {
    const r = await send("POST", "/api/v1/uploads/image", { multipart: { field: "image", filename: "pic.png", type: "image/png", data: "png-bytes" } });
    expect(r.status).toBe(401);
  });
});

describe("design-notes routes used by DesignNotesOverlay (Phase 7C)", () => {
  for (const [method, path] of [
    ["GET", "/api/design-notes?websiteId=site-1"],
    ["POST", "/api/design-notes"],
    ["POST", "/api/design-notes/n1/resolve"],
    ["POST", "/api/design-notes/n1/reopen"],
    ["DELETE", "/api/design-notes/n1"],
  ] as const) {
    it(`${method} ${path} without credentials -> 401`, async () => {
      const r = await send(method, path, method === "POST" ? { json: {} } : {});
      expect(r.status).toBe(401);
      expect(expressDefault404(r)).toBe(false);
    });
  }
});

describe("old frontend paths stay unmapped (no alias was added)", () => {
  for (const [method, path] of [
    ["POST", "/api/integrations/paypal/create-order"],
    ["POST", "/api/integrations/paypal/capture-order"],
    ["POST", "/api/integrations/stripe/create-checkout-session"],
    ["GET", "/api/integrations/dynamic-data/fetch?url=x"],
    ["POST", "/api/integrations/crm/submit-lead"],
    ["POST", "/api/integrations/webhook/dispatch"],
    ["POST", "/api/integrations/zapier/test"],
    ["POST", "/api/upload"],
  ] as const) {
    it(`${method} ${path} -> Express default 404`, async () => {
      expect(expressDefault404(await send(method, path, { json: {} }))).toBe(true);
    });
  }
});

describe("still missing (blocked, see the Phase 7B report)", () => {
  it("POST /api/approval-requests has no route", async () => {
    expect(expressDefault404(await send("POST", "/api/approval-requests", { json: { websiteId: "x", note: "n" } }))).toBe(true);
  });
});
