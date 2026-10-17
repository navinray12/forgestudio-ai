/* global vi -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Mounts the real, unmodified WebsiteEditor under a MemoryRouter in jsdom.
 *
 * Only two things are substituted:
 *  - the network (global fetch), answered by an in-memory fake backend that records every request;
 *  - browser APIs jsdom does not implement (dialog showModal/close, matchMedia, ResizeObserver,
 *    IntersectionObserver, scrollIntoView). These are environment polyfills, not editor mocks.
 * Every editor module, hook, service and child component runs as in production.
 *
 * Identifiers avoid word-dash-number tokens because Tailwind scans test files for class names.
 */
import { act, configure, fireEvent, render, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import WebsiteEditor from "../../src/pages/editor/WebsiteEditor";

// Each re-render of the ~21k-line editor is slow in jsdom, and slower still while the other heavy
// suites run in parallel, so the 1s default for waitFor/findBy is too tight to be reliable.
configure({ asyncUtilTimeout: 8000 });

export const SITE_ID = "site1";
export const API = "http://localhost:5000";

export interface RecordedRequest { method: string; url: string; headers: Record<string, string>; body: unknown; signal?: AbortSignal }
type Reply = { status: number; body: unknown } | Promise<{ status: number; body: unknown }>;
export type Route_ = (req: RecordedRequest) => Reply | undefined;

export const heading = (id: string, content: string) => ({ id, type: "heading", content, styles: {} });

export function siteFixture(overrides: Record<string, unknown> = {}, pages?: unknown[]) {
  return {
    id: SITE_ID,
    name: "Harness Site",
    userPermission: "OWNER",
    documentVersion: 3,
    editorData: {
      pages: pages ?? [{ id: "home", name: "Home", slug: "/", elements: [heading("elA", "Alpha heading"), heading("elB", "Bravo heading")] }],
    },
    ...overrides,
  };
}

function installPolyfills() {
  const D = HTMLDialogElement.prototype as any;
  D.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
  D.show ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
  D.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })) as any;
  (globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  (globalThis as any).IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
  Element.prototype.scrollIntoView ??= function () {};
}

/**
 * Fake backend. Defaults: GET website -> the fixture; PUT website -> acknowledges version+1 (read from
 * If-Match); POST publish -> success v7; anything else -> 200 {}. `routes` are consulted first.
 */
export function installBackend(site: unknown, routes: Route_[] = []) {
  const requests: RecordedRequest[] = [];
  const respond = (status: number, body: unknown) => ({
    ok: status >= 200 && status < 300, status,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body, text: async () => JSON.stringify(body),
  });
  vi.stubGlobal("fetch", vi.fn(async (input: unknown, init: RequestInit = {}) => {
    const url = String(input);
    const headers = Object.fromEntries(Object.entries((init.headers ?? {}) as Record<string, string>));
    let body: unknown = init.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { /* keep text */ } }
    const req: RecordedRequest = { method: (init.method ?? "GET").toUpperCase(), url, headers, body, signal: init.signal ?? undefined };
    requests.push(req);
    for (const r of routes) {
      const reply = r(req);
      if (reply) { const { status, body: b } = await reply; return respond(status, b); }
    }
    const websiteUrl = `${API}/api/websites/${SITE_ID}`;
    if (url === websiteUrl && req.method === "GET") return respond(200, { website: site });
    if (url === websiteUrl && req.method === "PUT") {
      const expected = Number(/:document:(\d+)"$/.exec(headers["If-Match"] ?? "")?.[1]);
      return respond(200, { website: { id: SITE_ID, documentVersion: expected + 1 } });
    }
    if (url === `${websiteUrl}/publish` && req.method === "POST") {
      return respond(200, { success: true, version: 7, publishedAt: "2026-01-15T12:00:00.000Z", deploymentId: "deploy7", liveUrl: "https://live.example.test" });
    }
    if (url.endsWith("/deployments")) return respond(200, []);
    return respond(200, {});
  }));
  return {
    requests,
    saves: () => requests.filter((r) => r.method === "PUT" && r.url === `${API}/api/websites/${SITE_ID}`),
    publishes: () => requests.filter((r) => r.method === "POST" && r.url === `${API}/api/websites/${SITE_ID}/publish`),
  };
}

/** Lets pending promises, effects and zero-delay timers run. */
export async function flush(rounds = 10) {
  for (let i = 0; i < rounds; i++) await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
}

export async function mountEditor(site: unknown = siteFixture(), routes: Route_[] = [], { waitForLoad = true } = {}) {
  installPolyfills();
  const consoleErrors: string[] = [];
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => { consoleErrors.push(args.map(String).join(" ")); });
  const backend = installBackend(site, routes);
  const view = render(
    <MemoryRouter initialEntries={[`/editor/${SITE_ID}`]}>
      <Routes><Route path="/editor/:websiteId" element={<WebsiteEditor />} /></Routes>
    </MemoryRouter>,
  );
  if (waitForLoad) {
    await waitFor(() => expect(view.container.querySelector("[data-el-id]")).not.toBeNull(), { timeout: 10000 });
    await flush();
  }
  const canvasEl = (id: string) => view.container.querySelector<HTMLElement>(`[data-el-id="${id}"]`);
  const canvasIds = () => [...view.container.querySelectorAll<HTMLElement>("[data-el-id]")].map((n) => n.getAttribute("data-el-id"));
  const select = async (id: string) => { fireEvent.click(canvasEl(id)!); await flush(2); };
  const key = async (k: string, mods: Partial<Record<"ctrlKey" | "metaKey" | "shiftKey" | "altKey", boolean>> = {}, target: EventTarget = window) => {
    const ev = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...mods });
    await act(async () => { target.dispatchEvent(ev); });
    await flush(2);
    return ev;
  };
  return { view, backend, consoleErrors, canvasEl, canvasIds, select, key };
}
