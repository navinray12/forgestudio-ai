// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Phase 7B: login and signup pages (src/pages/auth/LoginPage.tsx and SignupPage.tsx, both
 * AuthenticationPage) with a scripted fetch.
 *
 * Covers rendering for each identity capability set, form interactions, the request sequence (URL,
 * method, credentials, body), the email-code challenge, error display, double-submit protection and
 * "Start again". Paths are checked against the backend identity routers' source
 * (modules/identity/http/local.routes.ts, mounted at /api/v1/auth).
 *
 * This does NOT verify authentication: no backend, session or database is involved. The real
 * sign-in / signup / OTP flow needs an isolated PostgreSQL test database and remains BLOCKED.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import LoginPage from "../../src/pages/auth/LoginPage";
import SignupPage from "../../src/pages/auth/SignupPage";

const AUTH = "http://localhost:5000/api/v1/auth"; // VITE_API_URL is not set in tests
const here = dirname(fileURLToPath(import.meta.url));
const backend = (p: string) => readFileSync(join(here, "../../../backend/src", p), "utf8");

type Call = { url: string; method: string; credentials?: RequestCredentials; body: unknown };
type Reply = { status?: number; json: unknown } | Promise<{ status?: number; json: unknown }>;
function stubFetch(routes: Record<string, Reply | ((body: any) => Reply)>) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: unknown, init: RequestInit = {}) => {
    const url = String(input);
    const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({ url, method: (init.method || "GET").toUpperCase(), credentials: init.credentials, body });
    const route = routes[url.replace(AUTH, "")];
    if (!route) return new Response(JSON.stringify({ success: false, message: `unrouted ${url}` }), { status: 404 });
    const r = await (typeof route === "function" ? route(body) : route);
    return new Response(JSON.stringify(r.json), { status: r.status ?? 200, headers: { "content-type": "application/json" } });
  }));
  return calls;
}
const LOCAL = { "/capabilities": { json: { success: true, data: { local: true, managed: false, phone: false } } } };
const USER = "11111111-1111-4111-8111-111111111111";
const field = (label: RegExp) => screen.getByLabelText(label) as HTMLInputElement;
const type = (label: RegExp, value: string) => fireEvent.change(field(label), { target: { value } });
const submit = (name: string) => act(async () => { fireEvent.click(screen.getByRole("button", { name })); });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("backend identity routes the pages call (from source)", () => {
  it("local identity router defines login, signup and the OTP steps; mounted at /api/v1/auth", () => {
    const src = backend("modules/identity/http/local.routes.ts");
    for (const r of ['router.post("/login"', 'router.post("/signup"', "router.post(`/${prefix}/${action}`", "router.post(`/${prefix}/verify-otp`"]) expect(src).toContain(r);
    expect(src).toContain('[["login", "LOGIN"], ["signup", "SIGNUP"]]');
    expect(src).toContain('["send-otp", "resend-otp"]');
    expect(backend("app.ts")).toContain('app.use(["/api/v1/auth", "/api/auth"], localIdentityRouter);');
  });
});

describe("login page", () => {
  it("shows the loading status, then the local sign-in form and the signup link", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    stubFetch({ "/capabilities": gate.then(() => LOCAL["/capabilities"]) });
    render(<LoginPage />);
    expect(screen.getByRole("status").textContent).toBe("Loading sign-in options…");
    await act(async () => { release(); });
    expect(await screen.findByRole("heading", { name: "Sign in to Forge" })).toBeTruthy();
    expect(field(/Email address/).type).toBe("email");
    expect(field(/Password/).type).toBe("password");
    expect(field(/Password/).autocomplete).toBe("current-password");
    expect(screen.queryByLabelText(/Full name/)).toBeNull();
    expect(screen.getByRole("link", { name: "Create an account" }).getAttribute("href")).toBe("/signup");
    expect(screen.queryByRole("button", { name: "Continue with identity provider" })).toBeNull();
  });

  it("falls back to the local form when capabilities cannot be loaded", async () => {
    stubFetch({ "/capabilities": { status: 500, json: { success: false } } });
    render(<LoginPage />);
    expect(await screen.findByRole("button", { name: "Sign in to Forge" })).toBeTruthy();
  });

  it("managed-only: the identity provider button, no local form; an invalid destination is reported", async () => {
    const calls = stubFetch({
      "/capabilities": { json: { success: true, data: { local: false, managed: true, phone: false } } },
      "/oidc/start": { json: { success: true, data: { authorizationUrl: "http://idp.example.test/authorize" } } },
    });
    render(<LoginPage />);
    const button = await screen.findByRole("button", { name: "Continue with identity provider" });
    expect(screen.queryByLabelText(/Email address/)).toBeNull();
    await act(async () => { fireEvent.click(button); });
    expect((await screen.findByRole("alert")).textContent).toBe("The provider returned an invalid sign-in destination.");
    expect(calls.at(-1)).toMatchObject({ url: `${AUTH}/oidc/start`, method: "POST", credentials: "include", body: {} });
  });

  it("no sign-in method configured: says so", async () => {
    stubFetch({ "/capabilities": { json: { success: true, data: { local: false, managed: false, phone: false } } } });
    render(<LoginPage />);
    expect((await screen.findByRole("alert")).textContent).toBe("Sign-in is not configured. Contact the platform operator.");
  });

  it("sign-in: POST /login, then /login/send-otp; the code challenge, then /login/verify-otp", async () => {
    const calls = stubFetch({
      ...LOCAL,
      "/login": { json: { success: true, requireChannelSelection: true, data: { userId: USER, email: "ada@example.test", channels: ["EMAIL"] } } },
      "/login/send-otp": { json: { success: true, requireOtp: true, message: "Code accepted for delivery." } },
      "/login/verify-otp": { json: { success: true, data: { user: { id: USER } } } },
    });
    render(<LoginPage />);
    await screen.findByRole("button", { name: "Sign in to Forge" });
    type(/Email address/, "ada@example.test");
    type(/Password/, "correct horse");
    await submit("Sign in to Forge");
    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Resend in 60 seconds" }).hasAttribute("disabled")).toBe(true);
    type(/Verification code/, "12a3456");
    expect(field(/Verification code/).value).toBe("123456");
    await submit("Verify and sign in");
    await waitFor(() => expect(calls.map((c) => c.url)).toContain(`${AUTH}/login/verify-otp`));
    expect(calls.slice(1)).toEqual([
      { url: `${AUTH}/login`, method: "POST", credentials: "include", body: { identifier: "ada@example.test", password: "correct horse" } },
      { url: `${AUTH}/login/send-otp`, method: "POST", credentials: "include", body: { userId: USER, channel: "EMAIL" } },
      { url: `${AUTH}/login/verify-otp`, method: "POST", credentials: "include", body: { userId: USER, otp: "123456", channel: "EMAIL" } },
    ]);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a development code returned by send-otp is auto-filled", async () => {
    stubFetch({
      ...LOCAL,
      "/login": { json: { success: true, data: { userId: USER, email: "ada@example.test" } } },
      "/login/send-otp": { json: { success: true, devOtp: "654321" } },
    });
    render(<LoginPage />);
    await screen.findByRole("button", { name: "Sign in to Forge" });
    type(/Email address/, "ada@example.test");
    type(/Password/, "pw");
    await submit("Sign in to Forge");
    await screen.findByText("Auto-filled");
    expect(field(/Verification code/).value).toBe("654321");
  });

  it("rejected credentials show the server message and keep the form; Start again returns from the challenge", async () => {
    let fail = true;
    stubFetch({
      ...LOCAL,
      "/login": () => (fail ? { status: 401, json: { success: false, error: { message: "Invalid email or password." } } } : { json: { success: true, data: { userId: USER, email: "a@b.test" } } }),
      "/login/send-otp": { json: { success: true } },
    });
    render(<LoginPage />);
    await screen.findByRole("button", { name: "Sign in to Forge" });
    type(/Email address/, "ada@example.test");
    type(/Password/, "wrong");
    await submit("Sign in to Forge");
    expect((await screen.findByRole("alert")).textContent).toBe("Invalid email or password.");
    expect(screen.getByRole("button", { name: "Sign in to Forge" }).hasAttribute("disabled")).toBe(false);
    fail = false;
    await submit("Sign in to Forge");
    await screen.findByRole("heading", { name: "Check your email" });
    fireEvent.click(screen.getByRole("button", { name: "Start again" }));
    expect(await screen.findByRole("heading", { name: "Sign in to Forge" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a second submit while the first is pending sends one request and shows the busy label", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const calls = stubFetch({ ...LOCAL, "/login": gate.then(() => ({ status: 401, json: { success: false, message: "no" } })) });
    render(<LoginPage />);
    await screen.findByRole("button", { name: "Sign in to Forge" });
    type(/Email address/, "ada@example.test");
    type(/Password/, "pw");
    const form = field(/Email address/).closest("form")!;
    await act(async () => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(screen.getByRole("button", { name: "Please wait…" }).hasAttribute("disabled")).toBe(true);
    await act(async () => { release(); });
    await screen.findByRole("alert");
    expect(calls.filter((c) => c.url === `${AUTH}/login`)).toHaveLength(1);
  });
});

describe("signup page", () => {
  it("renders name, email, password and confirmation fields and the sign-in link", async () => {
    stubFetch(LOCAL);
    render(<SignupPage />);
    expect(await screen.findByRole("heading", { name: "Create your account" })).toBeTruthy();
    expect(field(/Full name/).required).toBe(true);
    expect(field(/^Password/).minLength).toBe(12);
    expect(field(/^Password/).autocomplete).toBe("new-password");
    expect(field(/Confirm password/).minLength).toBe(12);
    expect(screen.getByRole("link", { name: "Already have an account? Sign in" }).getAttribute("href")).toBe("/login");
  });

  it("mismatched passwords are rejected before any request", async () => {
    const calls = stubFetch(LOCAL);
    render(<SignupPage />);
    await screen.findByRole("button", { name: "Create your account" });
    type(/Full name/, "Ada Lovelace");
    type(/Email address/, "ada@example.test");
    type(/^Password/, "a-long-password-1");
    type(/Confirm password/, "a-long-password-2");
    await submit("Create your account");
    expect((await screen.findByRole("alert")).textContent).toBe("The passwords do not match.");
    expect(calls.filter((c) => c.url !== `${AUTH}/capabilities`)).toEqual([]);
  });

  it("signup: POST /signup with fullName, the challenge (no send-otp), resend after the cooldown, then /signup/verify-otp", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const calls = stubFetch({
        ...LOCAL,
        "/signup": { status: 201, json: { success: true, requireOtp: true, data: { userId: USER, email: "ada@example.test" } } },
        "/signup/resend-otp": { json: { success: true, requireOtp: true } },
        "/signup/verify-otp": { json: { success: true, data: { user: { id: USER } } } },
      });
      render(<SignupPage />);
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      type(/Full name/, "Ada Lovelace");
      type(/Email address/, "ada@example.test");
      type(/^Password/, "a-long-password-1");
      type(/Confirm password/, "a-long-password-1");
      await submit("Create your account");
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(screen.getByRole("heading", { name: "Check your email" })).toBeTruthy();
      for (let i = 0; i < 60; i++) await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
      await submit("Resend code");
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      type(/Verification code/, "246810");
      await submit("Verify and sign in");
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(calls.slice(1)).toEqual([
        { url: `${AUTH}/signup`, method: "POST", credentials: "include", body: { identifier: "ada@example.test", password: "a-long-password-1", fullName: "Ada Lovelace" } },
        { url: `${AUTH}/signup/resend-otp`, method: "POST", credentials: "include", body: { userId: USER, channel: "EMAIL" } },
        { url: `${AUTH}/signup/verify-otp`, method: "POST", credentials: "include", body: { userId: USER, otp: "246810", channel: "EMAIL" } },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a server validation error is shown", async () => {
    stubFetch({ ...LOCAL, "/signup": { status: 409, json: { success: false, error: { message: "An account with this email already exists." } } } });
    render(<SignupPage />);
    await screen.findByRole("button", { name: "Create your account" });
    type(/Full name/, "Ada Lovelace");
    type(/Email address/, "ada@example.test");
    type(/^Password/, "a-long-password-1");
    type(/Confirm password/, "a-long-password-1");
    await submit("Create your account");
    expect((await screen.findByRole("alert")).textContent).toBe("An account with this email already exists.");
  });
});
