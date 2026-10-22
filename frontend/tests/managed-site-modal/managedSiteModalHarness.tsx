/* global vi -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Characterization harness for ManagedSiteModal (src/pages/dashboard/components/ManagedSiteModal.tsx).
 *
 * The modal is mounted on its own under fake timers and a fixed clock (UTC). Every fetch is answered by a
 * router built from managedSiteModal.routes.json, generated from the unmodified component: for each of its
 * 50 fetch calls, the URL template, the method and the response shape the code reads (merged with the shape
 * of the state the response is stored in). Each request is recorded exactly (URL, method, headers,
 * credentials, body), together with window.open, clipboard writes and prop callbacks.
 *
 * Actions come from the React props on DOM nodes (onClick, onSubmit, onChange, onKeyDown, onDragStart).
 * explore() takes every initial action, then the controls each action reveals; replay() re-runs a recorded
 * sequence from a fresh mount, so a golden captured from the unmodified modal can be compared exactly.
 */
import React from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { createHash } from "node:crypto";
import { ManagedSiteModal } from "../../src/pages/dashboard/components/ManagedSiteModal";

process.env.TZ = "UTC";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
export const FIXED_NOW = Date.UTC(2026, 0, 15, 12, 0, 0);
const API = "http://localhost:5000"; // apiUrl fallback (VITE_API_URL is not set in tests)
const SITE_ID = "site-1";

// ---------- deterministic data from shapes
type Shape = { [k: string]: Shape };
function leaf(name: string, i: number): unknown {
  if (/^(is|has|can|should)[A-Z]|^(success|enabled|verified|healthy|isPrimary|active|connected|valid|https|autoRenew|isVerified|isCurrent|isActive)$/i.test(name)) return i % 2 === 0;
  if (/(At|Date|date|timestamp|time|Time|created|updated|expires|sentAt)$/.test(name)) return `2026-01-1${i}T08:3${i}:00.000Z`;
  if (/(Score|score|Ms|ms|count|Count|size|Size|Mb|mb|Kb|Percentage|percentage|percent|Percent|Credits|credits|total|Total|Ratio|ratio|port|Port|uptime|Uptime|version|Version|days|Days|retention|Retention|bytes|Bytes|limit|Limit|amount|Amount|price|Price|rate|Rate|number|Number)$/.test(name) && !/(wpVersion|phpVersion|apiVersion|connectorVersion|mysqlVersion|serverVersion)$/.test(name)) return 3 + i;
  if (name === "id") return `id-${i}`;
  if (/status$|Status$/.test(name)) return ["active", "pending", "failed"][i % 3];
  if (/(url|Url|URL|link|Link|href|src|endpoint|Endpoint|webhook|Webhook)$/.test(name)) return `https://example.test/${name}-${i}`;
  if (/email|Email/.test(name)) return `user${i}@example.test`;
  if (/(domain|Domain|hostname|host|Host)$/.test(name)) return `site${i}.example.test`;
  return `${name} ${i} <&> "q"`;
}
function build(shape: Shape, name: string, i: number): unknown {
  const type = shape["#type"] ? Object.keys(shape["#type"])[0] : null;
  const keys = Object.keys(shape).filter((k) => k !== "#type");
  if (type === "string") return `${name} ${i} <&> "q"`;
  if (type === "number") return 3.25 + i;
  if (type === "array" && keys.length === 0) return [`${name} a <&>`, `${name} b`];
  if (type === "object" && keys.length === 0) return { alpha: true, beta: i % 2 === 1, gamma: "on" };
  if (type === "text" && keys.length === 0) { const v = leaf(name, i); return v !== null && typeof v === "object" ? `${name} ${i}` : v; }
  if (keys.length === 0) return leaf(name, i);
  if (keys.length === 1 && keys[0] === "[]") { const item = shape["[]"]; return [0, 1, 2].map((j) => (Object.keys(item).filter((k) => k !== "#type").length ? build(item, name, j) : leaf(name, j))); }
  const o: Record<string, unknown> = {};
  for (const k of keys) if (k !== "[]") o[k] = build(shape[k], k, i);
  return o;
}
type Route = { line: number; handler: string; method: string; url: string; shape: Shape };
const escapeRe = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function compileRoutes(routes: Route[]) {
  return routes.map((r) => {
    const parts = r.url.replace(/^`|`$/g, "").split(/(\$\{[^}]*\})/);
    const re = parts.map((p) => (p === "${apiUrl}" ? escapeRe(API) : p === "${website.id}" ? SITE_ID : p.startsWith("${") ? "[^?#]+?" : escapeRe(p))).join("");
    return { ...r, re: new RegExp(`^${re}$`) };
  });
}

export type ScenarioName = "rich" | "richNoWordPress" | "failing" | "empty";
export const SCENARIOS: Array<[ScenarioName, number]> = [["rich", 3], ["richNoWordPress", 2], ["failing", 2], ["empty", 2]];

const hash = (s: string) => createHash("sha256").update(s).digest("hex");
function safe(v: unknown, d = 0): unknown {
  if (d > 6) return "[depth]";
  if (v === undefined) return "[undefined]";
  if (v === null || typeof v !== "object") return typeof v === "function" ? "[function]" : v;
  if (typeof (v as any).nativeEvent === "object" && typeof (v as any).type === "string") return { reactEvent: (v as any).type };
  if (typeof Node !== "undefined" && v instanceof Node) return { node: (v as any).tagName || v.nodeName };
  if (v instanceof File) return { file: v.name, size: v.size, type: v.type };
  if (v instanceof Headers) return { headers: [...v.entries()] };
  if (Array.isArray(v)) return v.map((x) => safe(x, d + 1));
  const o: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) o[k] = safe(x, d + 1);
  return o;
}

const website = (scenario: ScenarioName) => ({
  id: SITE_ID, name: "Fixture Site <&>", slug: "fixture-site", status: "PUBLISHED",
  wpConnection: scenario === "richNoWordPress" ? null : { id: "wp-1", siteUrl: "https://wp.example.test", wpSiteName: "WP Fixture", status: "CONNECTED", lastVerifiedAt: "2026-01-10T08:00:00.000Z" },
});

export async function settle(ms: number) {
  for (let i = 0; i < 4; i++) await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
  for (let i = 0; i < 4; i++) await act(async () => { await vi.advanceTimersByTimeAsync(0); });
}

export async function mount(scenario: ScenarioName, routesJson: Route[]) {
  const log: unknown[][] = [];
  const routes = compileRoutes(routesJson);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"], now: FIXED_NOW });
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method || "GET").toUpperCase();
    const match = routes.find((r) => r.method === method && r.re.test(url));
    log.push(["fetch", method, url, match ? match.handler : "(unrouted)", safe({ headers: init?.headers, credentials: init?.credentials, body: init?.body })]);
    if (scenario === "failing") return new Response(JSON.stringify({ success: false, error: `${method} failed <x>`, message: `${method} failed <x>`, detail: "detail <x>" }), { status: 500, headers: { "content-type": "application/json" } });
    if (scenario === "empty" || !match) return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify(build(match.shape, match.handler, 0)), { status: 200, headers: { "content-type": "application/json" } });
  }));
  vi.spyOn(window, "open").mockImplementation((...a: unknown[]) => { log.push(["window.open", safe(a)]); return null; });
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: (t: string) => { log.push(["clipboard", t]); return Promise.resolve(); } } });
  vi.spyOn(window, "confirm").mockImplementation((m?: string) => { log.push(["confirm", m]); return true; });
  vi.spyOn(window, "alert").mockImplementation((m?: string) => { log.push(["alert", m]); });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const props = {
    website: website(scenario),
    isOpen: true,
    onClose: (...a: unknown[]) => { log.push(["prop", "onClose", safe(a)]); },
    onWebsiteUpdated: (...a: unknown[]) => { log.push(["prop", "onWebsiteUpdated", safe(a)]); },
  };
  const view = render(<ManagedSiteModal {...props} />);
  await settle(50);
  return {
    log,
    rerenderOpen: async (isOpen: boolean) => { view.rerender(<ManagedSiteModal {...props} isOpen={isOpen} />); await settle(50); },
    dispose: () => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); },
  };
}

// ---------- actions from React props
type Action = { kind: "click" | "submit" | "change" | "keyEnter" | "keyEscape" | "drag"; el: HTMLElement; desc: string };
const reactProps = (el: Element): Record<string, unknown> | undefined => { const k = Object.keys(el).find((x) => x.startsWith("__reactProps$")); return k ? (el as any)[k] : undefined; };
const describe_ = (el: HTMLElement) => {
  const a = (n: string) => el.getAttribute(n);
  const text = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 48);
  return [el.tagName.toLowerCase(), a("type") && `type=${a("type")}`, a("name") && `name=${a("name")}`, a("placeholder") && `ph=${a("placeholder")}`, a("title") && `title=${a("title")}`, text && `"${text}"`].filter(Boolean).join(" ");
};
export function actionsOf(root: HTMLElement): Action[] {
  const out: Action[] = [];
  const draggables: HTMLElement[] = [];
  root.querySelectorAll<HTMLElement>("*").forEach((el) => {
    const p = reactProps(el);
    if (!p) return;
    const d = describe_(el);
    if (typeof p.onClick === "function") out.push({ kind: "click", el, desc: d });
    if (typeof p.onSubmit === "function") out.push({ kind: "submit", el, desc: d.slice(0, 60) });
    if (typeof p.onChange === "function") out.push({ kind: "change", el, desc: d });
    if (typeof p.onKeyDown === "function") { out.push({ kind: "keyEnter", el, desc: d }); out.push({ kind: "keyEscape", el, desc: d }); }
    if (typeof p.onDragStart === "function") draggables.push(el);
  });
  if (draggables.length >= 2) out.push({ kind: "drag", el: draggables[0], desc: `${describe_(draggables[0])} -> ${describe_(draggables[draggables.length - 1])}` });
  (out as any).draggables = draggables;
  return out;
}
function perform(a: Action, all: Action[]) {
  const el = a.el as any;
  switch (a.kind) {
    case "click": fireEvent.click(el); break;
    case "submit": fireEvent.submit(el); break;
    case "keyEnter": fireEvent.keyDown(el, { key: "Enter", code: "Enter" }); break;
    case "keyEscape": fireEvent.keyDown(el, { key: "Escape", code: "Escape" }); break;
    case "drag": { const ds: HTMLElement[] = (all as any).draggables; const t = ds[ds.length - 1]; fireEvent.dragStart(ds[0], { dataTransfer: { setData() {}, getData() { return ""; } } }); fireEvent.dragOver(t, { dataTransfer: {} }); fireEvent.drop(t, { dataTransfer: { getData() { return ""; } } }); break; }
    case "change": {
      if (el.tagName === "SELECT") { const opts = el.options; fireEvent.change(el, { target: { value: opts[opts.length - 1]?.value ?? "" } }); }
      else if (el.type === "checkbox" || el.type === "radio") fireEvent.click(el);
      else if (el.type === "file") fireEvent.change(el, { target: { files: [new File(["img-bytes"], "photo.png", { type: "image/png" })] } });
      else if (el.type === "number") fireEvent.change(el, { target: { value: "7" } });
      else if (el.type === "email") fireEvent.change(el, { target: { value: "new.owner@example.test" } });
      else if (el.type === "url" || /https?:|url|webhook/i.test(el.getAttribute("placeholder") || "")) fireEvent.change(el, { target: { value: "https://example.test/typed" } });
      else fireEvent.change(el, { target: { value: `Typed ${el.getAttribute("name") || el.getAttribute("placeholder") || "value"}` } });
      break;
    }
  }
}
const focusDesc = () => { const el = document.activeElement as HTMLElement | null; return !el || el === document.body ? "body" : describe_(el); };

export type Step = { kind: Action["kind"]; index: number; desc: string };
export type RunRecord = { steps: Step[]; log: unknown[]; dom: string; domLater: string; focus: string; actions: string[] };

export async function replay(scenario: ScenarioName, routes: Route[], steps: Step[]) {
  const m = await mount(scenario, routes);
  try {
    for (const s of steps) {
      const a = actionsOf(document.body).filter((x) => x.kind === s.kind)[s.index];
      if (!a || a.desc !== s.desc) throw new Error(`action not found: ${s.kind}#${s.index} ${s.desc} (found ${a ? a.desc : "nothing"})`);
      perform(a, actionsOf(document.body));
      await settle(300);
    }
    const html = document.body.innerHTML;
    const actions = actionsOf(document.body).map((a) => `${a.kind}: ${a.desc}`);
    const focus = focusDesc();
    await settle(3000);
    const later = document.body.innerHTML;
    return { rec: { steps, log: JSON.parse(JSON.stringify(m.log)), dom: hash(html), domLater: hash(later), focus, actions } as RunRecord, html, later };
  } finally { m.dispose(); }
}

const stepsOf = (actions: string[], base: Step[]): Step[][] => {
  const counters: Record<string, number> = {};
  return actions.map((a) => { const kind = a.slice(0, a.indexOf(":")) as Step["kind"]; const index = (counters[kind] = (counters[kind] ?? -1) + 1); return [...base, { kind, index, desc: a.slice(a.indexOf(":") + 2) }]; });
};

/** Every initial action, then the controls each action reveals (each distinct control once), `depth` levels. */
export async function explore(scenario: ScenarioName, routes: Route[], depth: number, cap: number) {
  const runs: RunRecord[] = [];
  const blobs: Record<string, string> = {};
  const tried = new Set<string>();
  const root = await replay(scenario, routes, []);
  runs.push(root.rec); blobs[root.rec.dom] = root.html; blobs[root.rec.domLater] = root.later;
  let frontier: Array<{ available: Set<string>; candidates: Step[][] }> = [{ available: new Set(), candidates: stepsOf(root.rec.actions, []) }];
  for (let d = 1; d <= depth && frontier.length; d++) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      for (const steps of node.candidates) {
        const last = steps[steps.length - 1];
        const key = `${last.kind}: ${last.desc}`;
        if (d > 1 && (node.available.has(key) || tried.has(key))) continue;
        tried.add(key);
        if (runs.length >= cap) break;
        const { rec, html, later } = await replay(scenario, routes, steps);
        runs.push(rec); blobs[rec.dom] = html; blobs[rec.domLater] = later;
        const before = new Set(d === 1 ? root.rec.actions : [...node.available, ...node.candidates.map((c) => { const l = c[c.length - 1]; return `${l.kind}: ${l.desc}`; })]);
        const revealed = rec.actions.filter((a) => !before.has(a));
        if (revealed.length) next.push({ available: new Set(rec.actions.filter((a) => before.has(a))), candidates: stepsOf(rec.actions, steps).filter((c) => { const l = c[c.length - 1]; return revealed.includes(`${l.kind}: ${l.desc}`); }) });
      }
    }
    frontier = next;
  }
  return { runs, blobs };
}

/** Open, close (renders nothing), reopen: DOM hashes and the requests made. */
export async function openCloseRecord(routes: Route[]) {
  const m = await mount("rich", routes);
  try {
    const open = hash(document.body.innerHTML);
    await m.rerenderOpen(false);
    const closed = document.body.innerHTML;
    await m.rerenderOpen(true);
    return { open, closed, reopened: hash(document.body.innerHTML), log: JSON.parse(JSON.stringify(m.log)) };
  } finally { m.dispose(); }
}
