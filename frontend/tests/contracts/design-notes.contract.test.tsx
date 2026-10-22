// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Phase 7C: DesignNotesOverlay against the backend design-notes routes.
 *
 * The overlay used relative /api/design-notes URLs, which resolve against the frontend's origin (no
 * /api proxy in Vite or nginx). It now uses the API origin. Every request is checked against the
 * routes read from backend source (app.ts mounts + routes/designNotes.routes.ts: all behind
 * requireAuth, so credentials: "include" is required). Responses follow designNotes.controller.ts:
 * { success, notes } / { success, note } / { success, message }.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DesignNotesOverlay } from "../../src/pages/editor/components/notes/DesignNotesOverlay";

const API = "http://localhost:5000"; // VITE_API_URL is not set in tests
const here = dirname(fileURLToPath(import.meta.url));
const backend = (p: string) => readFileSync(join(here, "../../../backend/src", p), "utf8");

const mounts = [...backend("app.ts").matchAll(/app\.use\("([^"]+)",\s*designNotesRoutes\)/g)].map((m) => m[1]);
const routes = [...backend("routes/designNotes.routes.ts").matchAll(/router\.(get|post|patch|delete)\("([^"]+)",\s*([^)]*)\);/g)]
  .flatMap((m) => mounts.map((p) => ({ method: m[1].toUpperCase(), re: new RegExp(`^${(p + m[2]).replace(/\/$/, "").replace(/:[a-zA-Z]+/g, "[^/]+")}$`), auth: /requireAuth/.test(m[3]) })));

type Call = { url: string; method: string; credentials?: RequestCredentials; body?: unknown };
function stubFetch(reply: (c: Call) => { status?: number; json?: unknown; error?: Error }) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: unknown, init: RequestInit = {}) => {
    const c: Call = { url: String(input), method: (init.method || "GET").toUpperCase(), credentials: init.credentials, body: typeof init.body === "string" ? JSON.parse(init.body) : undefined };
    calls.push(c);
    const r = reply(c);
    if (r.error) throw r.error;
    return new Response(JSON.stringify(r.json ?? {}), { status: r.status ?? 200, headers: { "content-type": "application/json" } });
  }));
  return calls;
}
function expectBackendContract(calls: Call[]) {
  expect(calls.length).toBeGreaterThan(0);
  for (const c of calls) {
    const u = new URL(c.url);
    expect(`${u.origin}`).toBe(API);
    const route = routes.find((r) => r.method === c.method && r.re.test(u.pathname));
    expect(route, `${c.method} ${u.pathname} has no backend route`).toBeDefined();
    if (route!.auth) expect(c.credentials).toBe("include");
  }
}
const NOTE = { id: "n1", websiteId: "site-1", elementId: "elA", content: "Make the hero bigger", resolved: false, author: { id: "u1", fullName: "Ada" }, createdAt: "2026-01-15T12:00:00.000Z" };
const open = (props: Partial<React.ComponentProps<typeof DesignNotesOverlay>> = {}) =>
  render(<DesignNotesOverlay websiteId="site-1" activeElementId="elA" isOpen={true} onClose={() => {}} {...props} />);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("design-notes routes read from backend source", () => {
  it("mounted at /api/v1/design-notes and /api/design-notes; every route requires authentication", () => {
    expect(mounts).toEqual(["/api/v1/design-notes", "/api/design-notes"]);
    expect(routes.length).toBe(14);
    expect(routes.every((r) => r.auth)).toBe(true);
  });
});

describe("DesignNotesOverlay requests", () => {
  it("lists the notes of the website from the API origin with the session cookie", async () => {
    const calls = stubFetch(() => ({ json: { success: true, notes: [NOTE] } }));
    open();
    await screen.findByText("Make the hero bigger");
    expect(calls).toEqual([{ url: `${API}/api/design-notes?websiteId=site-1`, method: "GET", credentials: "include", body: undefined }]);
    expectBackendContract(calls);
  });

  it("creates a note for the selected element and shows it first", async () => {
    const calls = stubFetch((c) => (c.method === "POST" ? { status: 201, json: { success: true, note: { ...NOTE, id: "n2", content: "New note" } } } : { json: { success: true, notes: [NOTE] } }));
    open();
    await screen.findByText("Make the hero bigger");
    fireEvent.change(screen.getByPlaceholderText("Leave a comment on this element..."), { target: { value: "  New note  " } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Send" })); });
    await screen.findByText("New note");
    expect(calls[1]).toEqual({ url: `${API}/api/design-notes`, method: "POST", credentials: "include", body: { websiteId: "site-1", elementId: "elA", content: "New note" } });
    expect((screen.getByPlaceholderText("Leave a comment on this element...") as HTMLInputElement).value).toBe("");
    expectBackendContract(calls);
  });

  it("resolves, reopens and deletes through the note routes", async () => {
    const calls = stubFetch((c) => (c.method === "GET" ? { json: { success: true, notes: [NOTE] } } : { json: { success: true, note: NOTE, message: "Note deleted successfully" } }));
    open();
    await screen.findByText("Make the hero bigger");
    fireEvent.click(screen.getByRole("button", { name: "Open only" })); // show resolved notes too
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "✓ Resolve" })); });
    await screen.findByRole("button", { name: "Reopen" });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Reopen" })); });
    await screen.findByRole("button", { name: "✓ Resolve" });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Delete" })); });
    await waitFor(() => expect(screen.queryByText("Make the hero bigger")).toBeNull());
    expect(calls.slice(1).map((c) => `${c.method} ${c.url}`)).toEqual([
      `POST ${API}/api/design-notes/n1/resolve`,
      `POST ${API}/api/design-notes/n1/reopen`,
      `DELETE ${API}/api/design-notes/n1`,
    ]);
    expectBackendContract(calls);
  });

  it("a 401 or a network failure leaves the list unchanged (existing behaviour: no error shown)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let mode: "401" | "offline" = "401";
    stubFetch((c) => (c.method === "GET" ? { json: { success: true, notes: [NOTE] } } : mode === "401" ? { status: 401, json: { success: false, message: "Authentication required" } } : { error: new TypeError("Failed to fetch") }));
    open();
    await screen.findByText("Make the hero bigger");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Delete" })); });
    expect(screen.getByText("Make the hero bigger")).toBeTruthy();
    mode = "offline";
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "✓ Resolve" })); });
    expect(screen.getByRole("button", { name: "✓ Resolve" })).toBeTruthy();
  });

  it("makes no request while closed", () => {
    const calls = stubFetch(() => ({ json: {} }));
    open({ isOpen: false });
    expect(calls).toEqual([]);
  });
});
