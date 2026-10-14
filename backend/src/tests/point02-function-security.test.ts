import assert from "node:assert/strict";
import test from "node:test";
import { FunctionRuntimeSandbox } from "../modules/runtime-platform/functions/functionRuntime.js";
import { FunctionInvocationContext } from "../modules/runtime-platform/functions/functions.types.js";

test("Point 02: Secure Customer Function Execution & Isolation Boundaries", async (t) => {
  // Mock host secret environment variables for the test process
  const originalEnv = { ...process.env };
  process.env.DATABASE_URL = "postgres://superadmin:ultra_secret_pw@db.internal:5432/forgestudio";
  process.env.JWT_SECRET = "super_confidential_jwt_signing_key_999";
  process.env.ADMIN_TOKEN = "forge_admin_secret_token_12345";

  const sampleContext: FunctionInvocationContext = {
    projectId: "proj-sec-test",
    functionName: "customer-order-handler",
    environment: "production",
    trigger: "HTTP",
    requestId: "req-sec-001",
    env: {
      CUSTOMER_APP_ID: "app_42",
      PUBLIC_STORE_NAME: "My Awesome Store",
    },
  };

  await t.test("1. Shared-host default mode fails closed with HTTP 501", async () => {
    // Ensure default shared-host configuration
    delete process.env.FORGE_FUNCTION_ISOLATION_BACKEND;
    delete process.env.FORGE_ALLOW_INSECURE_DEV_VM;

    const result = await FunctionRuntimeSandbox.execute({
      code: `
        exports.handler = async () => {
          return { status: "OK" };
        };
      `,
      handlerName: "handler",
      context: sampleContext,
      payload: { test: true },
    });

    assert.equal(result.status, "ERROR");
    assert.equal(result.statusCode, 501, "Shared host without isolated runner must return HTTP 501");
    assert.ok(result.error?.includes("501"), "Error must reflect HTTP 501 Not Implemented");
    assert.ok(
      result.logs.some((l) => l.includes("shared API processes is disabled")),
      "Telemetry log must record security policy block"
    );
  });

  await t.test("2. Isolated process runner executes legitimate customer code safely", async () => {
    process.env.FORGE_FUNCTION_ISOLATION_BACKEND = "isolated-process";

    const result = await FunctionRuntimeSandbox.execute({
      code: `
        exports.handler = async (payload, context) => {
          console.log("Processing order for " + payload.customer);
          return {
            statusCode: 200,
            body: {
              orderTotal: payload.price * payload.quantity,
              store: env.PUBLIC_STORE_NAME,
              processed: true
            }
          };
        };
      `,
      handlerName: "handler",
      context: sampleContext,
      payload: { customer: "Alice", price: 30, quantity: 3 },
    });

    assert.equal(result.status, "SUCCESS");
    assert.equal(result.statusCode, 200);
    assert.equal(result.responsePayload.orderTotal, 90);
    assert.equal(result.responsePayload.store, "My Awesome Store");
    assert.ok(result.logs.some((l) => l.includes("Processing order for Alice")));
  });

  await t.test("3. Malicious payload CANNOT access host DATABASE_URL or JWT_SECRET", async () => {
    process.env.FORGE_FUNCTION_ISOLATION_BACKEND = "isolated-process";

    const exfiltrationScript = `
      exports.handler = async () => {
        // Attempt to read process.env host secrets
        const hostDbUrl = typeof process !== "undefined" && process.env ? process.env.DATABASE_URL : undefined;
        const hostJwt = typeof process !== "undefined" && process.env ? process.env.JWT_SECRET : undefined;
        const hostAdminToken = typeof process !== "undefined" && process.env ? process.env.ADMIN_TOKEN : undefined;

        // Attempt prototype traversal escape
        let prototypeEscapeDbUrl;
        try {
          const proc = ({}).constructor.constructor("return process")();
          prototypeEscapeDbUrl = proc.env.DATABASE_URL;
        } catch (e) {
          prototypeEscapeDbUrl = "ESCAPE_BLOCKED";
        }

        return {
          hostDbUrl: hostDbUrl || "UNDISCLOSED",
          hostJwt: hostJwt || "UNDISCLOSED",
          hostAdminToken: hostAdminToken || "UNDISCLOSED",
          prototypeEscapeDbUrl: prototypeEscapeDbUrl || "UNDISCLOSED",
        };
      };
    `;

    const result = await FunctionRuntimeSandbox.execute({
      code: exfiltrationScript,
      handlerName: "handler",
      context: sampleContext,
      payload: {},
    });

    assert.equal(result.status, "SUCCESS");
    assert.equal(result.responsePayload.hostDbUrl, "UNDISCLOSED", "Host DATABASE_URL must NOT be accessible");
    assert.equal(result.responsePayload.hostJwt, "UNDISCLOSED", "Host JWT_SECRET must NOT be accessible");
    assert.equal(result.responsePayload.hostAdminToken, "UNDISCLOSED", "Host ADMIN_TOKEN must NOT be accessible");
    assert.equal(result.responsePayload.prototypeEscapeDbUrl, "UNDISCLOSED", "Host credentials via prototype walk must be UNDISCLOSED");
  });

  await t.test("4. Runaway execution / infinite loop triggers process termination and HTTP 504", async () => {
    process.env.FORGE_FUNCTION_ISOLATION_BACKEND = "isolated-process";

    const runawayScript = `
      exports.handler = async () => {
        const start = Date.now();
        while (Date.now() - start < 5000) {
          // busy wait
        }
        return { done: true };
      };
    `;

    const result = await FunctionRuntimeSandbox.execute({
      code: runawayScript,
      handlerName: "handler",
      context: sampleContext,
      payload: {},
      timeoutMs: 300, // 300ms timeout
    });

    assert.equal(result.status, "TIMEOUT", "Execution exceeding timeout must report TIMEOUT");
    assert.equal(result.statusCode, 504, "Timed out execution must yield HTTP 504");
  });

  // Restore original environment
  process.env = originalEnv;
});
