import test from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "./load-typescript.mjs";
const security = await loadTypeScript("backend/src/modules/identity/domain/security-policy.ts");
const assurance = await loadTypeScript("backend/src/modules/identity/domain/assurance.ts");
const now = new Date();
const user = { id: "actor", status: "ACTIVE", authEpoch: 3 };
const challenge = { userId: "actor", authEpoch: 3, kind: "LOGIN", status: "READY", expiresAt: new Date(now.getTime()+1000) };

test("IDENTITY-001: proof digest is bound to browser and challenge", () => {
  const secret = security.opaqueToken();
  assert.match(secret, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(security.proofDigest(secret, "challenge:123456"), security.proofDigest(security.opaqueToken(), "challenge:123456"));
  assert.notEqual(security.proofDigest(secret, "challenge:123456"), security.proofDigest(secret, "other:123456"));
  assert.equal(security.safeEqual("abc", "abcdef"), false);
});
for (const change of [{ userId: "other" }, { authEpoch: 2 }, { kind: "SIGNUP" }, { status: "CONSUMED" },
  { status: "FAILED" }, { expiresAt: now }]) {
  test(`IDENTITY-002: reject mismatched or stale challenge ${Object.keys(change)[0]}=${change[Object.keys(change)[0]]}`, () => {
    assert.throws(() => security.requireChallenge({ ...challenge, ...change }, user, now, "LOGIN"));
  });
}
test("IDENTITY-003: provider assurance must be explicit and fresh", () => {
  const good = { authMethod: "oidc", assurance: "phishing-resistant", audience: "TENANT", mfaVerifiedAt: now };
  assert.doesNotThrow(() => assurance.requireRecentMfa(good, true, now));
  for (const fields of [{ authMethod: "local" }, { assurance: "email-otp" }, { audience: "CONTROL" },
    { mfaVerifiedAt: null }, { mfaVerifiedAt: new Date(now.getTime()-900001) },
    { mfaVerifiedAt: new Date(now.getTime()+60001) }]) {
    assert.throws(() => assurance.requireRecentMfa({ ...good, ...fields }, true, now));
  }
  assert.throws(() => assurance.requireRecentMfa({ ...good, assurance: "mfa" }, true, now));
  assert.doesNotThrow(() => assurance.requireRecentMfa({ ...good, assurance: "mfa" }, false, now));
});
test("IDENTITY-004: public identity serialization excludes credentials", () => {
  const result = security.publicUser({ ...user, passwordHash: "never-disclose", authEpoch: 3, email:"test@example.test" });
  assert.equal("passwordHash" in result, false); assert.equal("authEpoch" in result, false);
});
test("IDENTITY-005: OIDC config rejects insecure, incomplete and arbitrary callback configuration", async () => {
  for (const env of [
    { OIDC_ISSUER:"http://issuer.example" },
    { OIDC_ISSUER:"https://issuer.example", OIDC_CLIENT_ID:"client", OIDC_CLIENT_SECRET:"secret", OIDC_CALLBACK_URL:"https://app.example/other" },
    { OIDC_ISSUER:"https://issuer.example", OIDC_CLIENT_ID:"client", OIDC_CLIENT_SECRET:"secret", OIDC_CALLBACK_URL:"https://app.example/api/v1/auth/oidc/callback", OIDC_ALLOWED_ORIGINS:"http://internal.test" },
  ]) {
    const config = await loadTypeScript("backend/src/adapters/identity/oidc.config.ts", {}, { process: { env: {NODE_ENV:"production", ...env} } });
    assert.throws(() => config.loadOidcConfiguration());
  }
});
test("IDENTITY-006: production never exposes local credential login", async () => {
  const config = await loadTypeScript("backend/src/config/auth.ts", {}, { process:{env:{NODE_ENV:"production", FORGE_AUTH_MODE:"local"}} });
  assert.equal(config.localAuthenticationEnabled(), false);
  assert.equal(config.AUTH_COOKIE_OPTIONS.sameSite, "lax");
  assert.equal(config.AUTH_COOKIE_OPTIONS.secure, true);
  assert.equal(config.AUTH_COOKIE_NAME, "__Host-forge_session");
});

// Exercise the real TSX provider with controlled React effects and pending HTTP
// promises. In StrictMode, cleanup/setup is replayed before the first request's
// rejection settles; a stale completion must not release the route guard.
async function authBootstrapHarness() {
  const { readFileSync } = await import("node:fs");
  const { createRequire } = await import("node:module");
  const { resolve } = await import("node:path");
  const { createContext, SourceTextModule, SyntheticModule } = await import("node:vm");
  const ts = createRequire(resolve("frontend/package.json"))("typescript");
  const raw = readFileSync("frontend/src/context/AuthContext.tsx", "utf8");
  const code = ts.transpileModule(raw, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const states = [], pending = [], effects = [];
  const mocks = {
    react: {
      createContext: () => ({ Provider: "test-provider" }), useContext: () => null,
      useCallback: callback => callback, useRef: current => ({ current }),
      useState(initial) { const index = states.push(initial)-1; return [initial, value => { states[index] = value; }]; },
      useEffect: effect => effects.push(effect),
    },
    "react/jsx-runtime": { jsx: (_type, props) => props },
    "../features/identity/identity-api": {
      identityRequest: (_path, _body, signal) => new Promise((resolve, reject) => {
        pending.push({ resolve, reject });
        signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      }),
    },
  };
  const context = createContext({ AbortController, localStorage: { removeItem() {} } });
  const module = new SourceTextModule(code, { context });
  await module.link(specifier => {
    const values = mocks[specifier]; assert.ok(values, `Unmocked provider dependency: ${specifier}`);
    return new SyntheticModule(Object.keys(values), function () {
      for (const [name, value] of Object.entries(values)) this.setExport(name, value);
    }, { context });
  });
  await module.evaluate(); module.namespace.AuthProvider({ children: null });
  const flush = () => new Promise(resolve => setImmediate(resolve));
  return { states, pending, start: effects[0], flush };
}

test("IDENTITY-BOOTSTRAP-001: superseded StrictMode request cannot redirect a deep link", async () => {
  const harness = await authBootstrapHarness();
  const firstCleanup = harness.start(); firstCleanup();
  const secondCleanup = harness.start();
  await harness.flush();
  assert.equal(harness.states[1], true, "Loading must remain true until the current session resolves");
  const actor = { id: "verified-actor", status: "ACTIVE", role: "USER" };
  harness.pending[1].resolve({ data: { user: actor } });
  await harness.flush();
  assert.equal(harness.states[0], actor); assert.equal(harness.states[1], false);
  secondCleanup();
});
test("IDENTITY-BOOTSTRAP-002: unmount cannot publish a stale loading completion", async () => {
  const harness = await authBootstrapHarness();
  const cleanup = harness.start(); cleanup();
  await harness.flush();
  assert.equal(harness.states[0], null); assert.equal(harness.states[1], true);
});
test("IDENTITY-BOOTSTRAP-003: current denied session completes without authenticating", async () => {
  const harness = await authBootstrapHarness();
  const cleanup = harness.start(); harness.pending[0].reject(new Error("session denied"));
  await harness.flush();
  assert.equal(harness.states[0], null); assert.equal(harness.states[1], false);
  cleanup();
});
