import test from "node:test";
import assert from "node:assert/strict";
import { IntegrationService } from "../services/integration.service.js";

type FetchFunction = typeof globalThis.fetch;

async function withPayPalFixture(
  environment: Record<string, string | undefined>,
  fetcher: FetchFunction,
  run: () => Promise<void>,
) {
  const keys = ["NODE_ENV", "PAYPAL_ENV", "PAYPAL_DEMO_MODE", "PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const oldFetch = globalThis.fetch;
  try {
    for (const key of keys) {
      if (environment[key] === undefined) delete process.env[key];
      else process.env[key] = environment[key];
    }
    globalThis.fetch = fetcher;
    await run();
  } finally {
    globalThis.fetch = oldFetch;
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

const unexpectedNetwork: FetchFunction = async () => { throw new Error("Unexpected provider network request"); };
const asJson = (value: object, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });

test("unconfigured PayPal cannot create or capture money and cannot silently use demo mode", async () => {
  await withPayPalFixture({ NODE_ENV: "production", PAYPAL_DEMO_MODE: "1" }, unexpectedNetwork, async () => {
    await assert.rejects(IntegrationService.createPayPalOrder("10", "USD"), /not configured/);
    await assert.rejects(IntegrationService.capturePayPalOrder("VALIDORDER123"), /not configured/);
  });
});

test("opted-in development PayPal simulation is explicitly marked and never capturable", async () => {
  await withPayPalFixture({ NODE_ENV: "test", PAYPAL_DEMO_MODE: "1" }, unexpectedNetwork, async () => {
    const result = await IntegrationService.createPayPalOrder("9.99", "USD");
    assert.equal(result.simulated, true);
    assert.equal(result.mode, "demo");
    assert.equal(result.approveUrl, null);
    await assert.rejects(IntegrationService.capturePayPalOrder(result.orderId), /cannot be captured/);
    await assert.rejects(IntegrationService.capturePayPalOrder("PAYPAL-ORD-OLD-DEMO"), /cannot be captured/);
  });
});

test("PayPal validates amount and quantity rather than creating incorrect totals", async () => {
  await withPayPalFixture({ NODE_ENV: "test", PAYPAL_DEMO_MODE: "1" }, unexpectedNetwork, async () => {
    await assert.rejects(IntegrationService.createPayPalOrder("0", "USD"), /Amount/);
    await assert.rejects(IntegrationService.createPayPalOrder("1.999", "USD"), /Amount/);
    await assert.rejects(IntegrationService.createPayPalOrder("5", "USD", "Product", "", 0), /quantity/);
    await assert.rejects(IntegrationService.createPayPalOrder("5", "USD", "Product", "", 1.5), /quantity/);
    const value = await IntegrationService.createPayPalOrder("9.99", "USD", "Product", "", 3);
    assert.equal(value.amount, "29.97");
  });
});

test("PayPal uses server-authorized environment and real provider approval for an order", async () => {
  let calls = 0;
  const fetcher: FetchFunction = async (input, init) => {
    const url = String(input);
    calls++;
    if (url.endsWith("/v1/oauth2/token")) return asJson({ access_token: "fixture-token" });
    if (url.endsWith("/v2/checkout/orders")) {
      const request = JSON.parse(String(init?.body));
      assert.equal(request.purchase_units[0].amount.value, "29.97");
      assert.equal(request.purchase_units[0].items[0].quantity, "3");
      assert.equal(request.purchase_units[0].amount.breakdown.item_total.value, "29.97");
      return asJson({ id: "ORDER123", links: [{ rel: "approve", href: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER123" }] });
    }
    throw new Error("Unexpected PayPal URL: " + url);
  };
  await withPayPalFixture({
    NODE_ENV: "production", PAYPAL_ENV: "sandbox", PAYPAL_CLIENT_ID: "test-id", PAYPAL_CLIENT_SECRET: "test-secret",
  }, fetcher, async () => {
    const order = await IntegrationService.createPayPalOrder("9.99", "USD", "Product", "", 3, "sandbox");
    assert.equal(order.success, true);
    assert.equal(order.simulated, false);
    assert.equal(order.orderId, "ORDER123");
    assert.match(order.approveUrl!, /paypal\.com/);
    assert.equal(calls, 2);
    await assert.rejects(
      IntegrationService.createPayPalOrder("4", "USD", "Product", "", 1, "live"),
      /environment differs/,
    );
  });
});

test("PayPal API failure and incomplete capture never become completed transactions", async () => {
  const noOrder: FetchFunction = async (input) => String(input).endsWith("/token")
    ? asJson({ access_token: "fixture-token" })
    : asJson({ message: "Order rejected" }, 422);
  await withPayPalFixture({
    NODE_ENV: "production", PAYPAL_ENV: "sandbox", PAYPAL_CLIENT_ID: "test-id", PAYPAL_CLIENT_SECRET: "test-secret",
  }, noOrder, async () => {
    await assert.rejects(IntegrationService.createPayPalOrder("5", "USD"), /Order rejected/);
    await assert.rejects(IntegrationService.capturePayPalOrder("ORDER123"), /Order rejected/);
  });
  const notCompleted: FetchFunction = async (input) => String(input).endsWith("/token")
    ? asJson({ access_token: "fixture-token" })
    : asJson({ status: "PENDING", purchase_units: [{ payments: { captures: [{ id: "CAP123", status: "PENDING" }] } }] });
  await withPayPalFixture({
    NODE_ENV: "production", PAYPAL_ENV: "sandbox", PAYPAL_CLIENT_ID: "test-id", PAYPAL_CLIENT_SECRET: "test-secret",
  }, notCompleted, async () => {
    await assert.rejects(IntegrationService.capturePayPalOrder("ORDER123"), /did not confirm a completed capture/);
  });
});

test("PayPal only reports actual provider-confirmed capture details", async () => {
  const fetcher: FetchFunction = async (input) => String(input).endsWith("/token")
    ? asJson({ access_token: "fixture-token" })
    : asJson({ status: "COMPLETED", purchase_units: [{ payments: { captures: [{ id: "CAPTURE987", status: "COMPLETED" }] } }] });
  await withPayPalFixture({
    NODE_ENV: "production", PAYPAL_ENV: "sandbox", PAYPAL_CLIENT_ID: "test-id", PAYPAL_CLIENT_SECRET: "test-secret",
  }, fetcher, async () => {
    const captured = await IntegrationService.capturePayPalOrder("ORDER123");
    assert.equal(captured.status, "COMPLETED");
    assert.equal(captured.transactionId, "CAPTURE987");
    assert.equal(captured.simulated, false);
  });
});
