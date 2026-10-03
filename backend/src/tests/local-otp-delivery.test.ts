import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { readFile, stat, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { LocalOtpDelivery } from "../adapters/identity/local-otp-delivery.js";

test("local OTP delivery requires explicit local non-production mode", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousAuthMode = process.env.FORGE_AUTH_MODE;
  try {
    process.env.NODE_ENV = "production";
    process.env.FORGE_AUTH_MODE = "local";
    assert.throws(() => new LocalOtpDelivery(join(tmpdir(), "forge-test.json")), /LOCAL_OTP_DELIVERY_FORBIDDEN/);
    process.env.NODE_ENV = "development";
    process.env.FORGE_AUTH_MODE = "oidc";
    assert.throws(() => new LocalOtpDelivery(join(tmpdir(), "forge-test.json")), /LOCAL_OTP_DELIVERY_FORBIDDEN/);
    process.env.FORGE_AUTH_MODE = "local";
    assert.throws(() => new LocalOtpDelivery("/etc/forge-test.json"), /LOCAL_OTP_DELIVERY_FORBIDDEN/);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousAuthMode === undefined) delete process.env.FORGE_AUTH_MODE;
    else process.env.FORGE_AUTH_MODE = previousAuthMode;
  }
});

test("local OTP delivery writes a private file and does not return the code", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousAuthMode = process.env.FORGE_AUTH_MODE;
  const file = join(tmpdir(), `forge-${randomUUID()}.json`);
  try {
    process.env.NODE_ENV = "development";
    process.env.FORGE_AUTH_MODE = "local";
    const result = await new LocalOtpDelivery(file).sendCode({ email: "tester@example.test", code: "123456", purpose: "LOGIN" });
    assert.equal(result, undefined);
    const contents = JSON.parse(await readFile(file, "utf8"));
    assert.equal(contents.code, "123456");
    assert.equal(contents.email, "tester@example.test");
    if (process.platform !== "win32") assert.equal((await stat(file)).mode & 0o077, 0);
  } finally {
    await unlink(file).catch(() => undefined);
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousAuthMode === undefined) delete process.env.FORGE_AUTH_MODE;
    else process.env.FORGE_AUTH_MODE = previousAuthMode;
  }
});
