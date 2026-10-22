/* global vi -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Characterization harness for PublishModal (src/pages/editor/components/PublishModal.tsx).
 *
 * The modal is mounted on its own with deterministic props and API data, under fake timers and a fixed
 * clock (UTC). Every publishingService method is replaced by a recording mock that returns fixtures built
 * from publishModal.shapes.json (the property chains the unmodified modal reads); direct fetch calls,
 * window.confirm / alert, object URLs / downloads, the wp-page-imported event and every prop callback are
 * recorded too. Request URLs, methods and payloads below the service are pinned separately by the
 * publishingService characterization (tests/services).
 *
 * Actions are discovered from the React props React attaches to DOM nodes (__reactProps$*): onClick,
 * onSubmit, onChange, onKeyDown and onDragStart handlers, in DOM order. explore() walks the reachable UI
 * breadth-first (new DOM states only); replay() re-runs a recorded action sequence from a fresh mount and
 * returns the same record, so a golden captured from the unmodified modal can be compared exactly.
 */
import React from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { createHash } from "node:crypto";
import { PublishModal } from "../../src/pages/editor/components/PublishModal";
import { publishingService } from "../../src/features/publishing/services/publishingService";

process.env.TZ = "UTC";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
export const FIXED_NOW = Date.UTC(2026, 0, 15, 12, 0, 0);

// ---------- deterministic API data from the shapes the modal reads
type Shape = { [k: string]: Shape };
const NUMERIC_ID_ROOTS = new Set(["wpPages", "wpMediaList", "selectedMediaDetail", "mediaUploadSuccess"]);
function leaf(name: string, root: string, i: number): unknown {
  if (/^(is|has|can)[A-Z]|healthy|https|enabled|connected|success|verified|valid|exists|isHome|isCurrent|isActive/i.test(name)) return i % 2 === 0;
  if (/(At|Date|date|modified|checked|timestamp|created|updated)$/.test(name)) return `2026-01-1${i}T08:3${i}:00.000Z`;
  if (name === "id") return NUMERIC_ID_ROOTS.has(root) ? 101 + i : `${root}-id-${i}`;
  if (/(score|Ms|count|Count|size|Size|progress|total|totalPages|perPage|page|width|height|menuOrder|parent|version|Version|bytes|attempts|duration|latency|filesize|number)$/.test(name) && !/(apiVersion|pluginVersion|wordpressVersion|connectorVersion|minimumSupportedVersion)$/.test(name)) return name === "parent" ? 0 : 3 + i;
  // read with Object.entries in the site health panel, rendered as a list everywhere else
  if (name === "capabilities") return root === "siteHealth" ? { publish_pages: true, upload_files: i % 2 === 1, edit_posts: true } : ["pages", "media <x>", "gutenberg"];
  if (/^(metadata|meta|details|result|data|config)$/.test(name)) return { publish_pages: true, upload_files: i % 2 === 1, edit_posts: true };
  if (/status$/i.test(name)) return ({ wpJobs: ["RUNNING", "FAILED", "COMPLETED"], deployments: ["PUBLISHED", "DEPLOY_FAILED", "BUILDING"], wpPages: ["publish", "draft", "private"], activeWpJob: ["RUNNING"] } as Record<string, string[]>)[root]?.[i % 3] ?? ["healthy", "warning", "error"][i % 3];
  if (/(url|Url|link|src|href|siteUrl|source_url|thumbnail|liveUrl)$/i.test(name)) return `https://wp.test/${root}/${name}-${i}`;
  if (/mime/i.test(name)) return i % 2 ? "application/pdf" : "image/png";
  if (/Version$/.test(name)) return `6.${4 + i}.0`;
  return `${name} ${i} <&> "q"`;
}
// "#type" marks usage the generator saw: string methods, toFixed, Object.entries, .length / array use,
// or a value rendered directly as JSX text (must not be an object).
function build(shape: Shape, root: string, name: string, i: number): unknown {
  const type = shape["#type"] ? Object.keys(shape["#type"])[0] : null;
  const keys = Object.keys(shape).filter((k) => k !== "#type");
  if (type === "string") return /hash/i.test(name) ? `0123456789abcdef${i}fedcba9876543210` : `${name} ${i} <&> "q"`;
  if (type === "number") return 3.25 + i;
  if (type === "array" && keys.length === 0) return [`${name} a <&>`, `${name} b`];
  if (type === "object" && keys.length === 0) return { publish_pages: true, upload_files: i % 2 === 1, edit_posts: true };
  if (type === "text" && keys.length === 0) { const v = leaf(name, root, i); return v !== null && typeof v === "object" ? `${name} ${i}` : v; }
  if (keys.length === 0) return leaf(name, root, i);
  shape = Object.fromEntries(keys.map((k) => [k, shape[k]]));
  if (keys.length === 1 && keys[0] === "[]") {
    const item = shape["[]"];
    return [0, 1, 2].map((j) => (Object.keys(item).length ? build(item, root, name, j) : `${name} item ${j}`));
  }
  const o: Record<string, unknown> = {};
  for (const k of keys) if (k !== "[]") o[k] = build(shape[k], root, k, i);
  return o;
}
export function fixturesFrom(shapes: Record<string, Shape>) {
  const f: Record<string, any> = {};
  for (const [root, sh] of Object.entries(shapes)) f[root] = build(sh, root, root, 0);
  return f;
}

// ---------- scenarios
export type ScenarioName = "connected" | "disconnected" | "failing" | "approvalDeployed" | "noWebsite";
export const SCENARIOS: ScenarioName[] = ["connected", "disconnected", "failing", "approvalDeployed", "noWebsite"];

function serviceResponse(fx: Record<string, any>, scenario: ScenarioName, key: string): unknown {
  const job = { ...fx.activeWpJob, status: "RUNNING" };
  switch (key) {
    case "getDeployments": return fx.deployments;
    case "getWordPressStatus": return { ...fx.wpStatus, isConnected: scenario !== "disconnected" };
    case "verifyWordPress": return { verification: fx.verificationDetails };
    case "getWordPressSiteInfo": return fx.siteInfo;
    case "getWordPressSiteHealth": return fx.siteHealth;
    case "listWordPressPages": return { pages: fx.wpPages };
    case "listWordPressMedia": return { data: { items: fx.wpMediaList, pagination: fx.wpMediaPagination } };
    case "getWordPressMedia": case "updateWordPressMedia": return { data: fx.selectedMediaDetail };
    case "uploadWordPressMedia": return { data: fx.mediaUploadSuccess };
    case "previewWordPressHtml": case "previewWordPressGutenberg": return fx.htmlPreviewData;
    case "getWordPressPublishStatus": return fx.wpPagePublishStatus;
    case "getWordPressRollbackTargets": return fx.wpRollbackTargets;
    case "rollbackWordPressPage": return fx.wpRollbackResult;
    case "listWordPressPublishJobs": return fx.wpJobs;
    case "getWordPressPublishJobStatus": return { ...job, status: "COMPLETED" };
    case "createWordPressPublishJob": case "retryWordPressPublishJob": return { job, message: "Job queued <ok>" };
    case "publishWordPressPage": return fx.wpPublishResult;
    case "importWordPressPage": return { elements: [{ id: "imported-1", type: "heading" }], pageSettings: { title: "Imported" } };
    case "reorderWordPressPage": return { pages: [...fx.wpPages].reverse() };
    case "getSftpConfig": return { config: { host: "sftp.test", port: 2222, username: "deploy", remotePath: "/srv/www", status: "CONNECTED" } };
    case "verifySftpConfig": return { success: true };
    case "syncSftp": return { success: true, syncedFilesCount: 12 };
    case "downloadWordPressPlugin": return undefined;
    default: return { success: true, message: `${key} ok` };
  }
}

const hash = (s: string) => createHash("sha256").update(s).digest("hex");
function safe(v: unknown, d = 0): unknown {
  if (d > 6) return "[depth]";
  if (v === undefined) return "[undefined]";
  if (v === null || typeof v !== "object") return typeof v === "function" ? "[function]" : v;
  if (v instanceof File) return { file: v.name, size: v.size, type: v.type };
  if (v instanceof Event) return { event: v.type };
  if (typeof (v as any).nativeEvent === "object" && typeof (v as any).type === "string") return { reactEvent: (v as any).type };
  if (typeof Node !== "undefined" && v instanceof Node) return { node: (v as any).tagName || v.nodeName };
  if (Array.isArray(v)) return v.map((x) => safe(x, d + 1));
  const o: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) o[k] = safe(x, d + 1);
  return o;
}

function propsFor(scenario: ScenarioName, log: unknown[][]) {
  const cb = (name: string, result?: () => Promise<void>) => (...args: unknown[]) => { log.push(["prop", name, safe(args)]); return result ? result() : undefined; };
  const fail = scenario === "failing";
  const deployed = scenario === "approvalDeployed";
  return {
    isOpen: true,
    onClose: cb("onClose"),
    publishing: { status: deployed ? "PUBLISHED" : "DRAFT", lastPublishedAt: deployed ? "2026-01-09T10:00:00.000Z" : undefined, liveUrl: deployed ? "https://live.test/site" : undefined, version: deployed ? 4 : 0 } as any,
    deployment: { provider: deployed ? "custom" : "none", customDomain: deployed ? "shop.test" : "", webhookUrl: deployed ? "https://hooks.test/x" : "", deployedAt: deployed ? "2026-01-09T10:00:00.000Z" : undefined } as any,
    pages: [{ id: "home", name: "Home", slug: "/", isHome: true }, { id: "about", name: "About", slug: "/about" }] as any,
    websiteName: "Fixture Site",
    websiteId: scenario === "noWebsite" ? undefined : "site-1",
    approvalWorkflowEnabled: deployed,
    canPublish: !deployed,
    onPublish: cb("onPublish", () => (fail ? Promise.reject(new Error("publish rejected")) : Promise.resolve())),
    onSubmitApproval: deployed ? cb("onSubmitApproval", () => Promise.resolve()) : undefined,
    onRollback: scenario === "connected" ? cb("onRollback", () => Promise.resolve()) : undefined,
    onUpdateDeployment: cb("onUpdateDeployment"),
    onOpenPreview: cb("onOpenPreview"),
  };
}

// ---------- mount / settle / record
export async function settle(ms: number) {
  for (let i = 0; i < 4; i++) await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
  for (let i = 0; i < 4; i++) await act(async () => { await vi.advanceTimersByTimeAsync(0); });
}

export async function mount(scenario: ScenarioName, fx: Record<string, any>) {
  const log: unknown[][] = [];
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"], now: FIXED_NOW });
  for (const key of Object.keys(publishingService)) {
    vi.spyOn(publishingService as any, key).mockImplementation(async (...args: unknown[]) => {
      log.push(["service", key, safe(args)]);
      if (scenario === "failing") { const e: any = new Error(`${key} failed <x>`); if (key === "rollbackWordPressPage") e.code = "WORDPRESS_ROLLBACK_RESULT_UNKNOWN"; throw e; }
      return serviceResponse(fx, scenario, key);
    });
  }
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    log.push(["fetch", String(url), safe({ method: init?.method, headers: init?.headers, credentials: init?.credentials, body: init?.body })]);
    if (scenario === "failing") return new Response(JSON.stringify({ message: "fetch failed <x>" }), { status: 500, headers: { "content-type": "application/json" } });
    if (String(url).includes("export") || String(url).includes("zip")) return new Response(new Uint8Array([80, 75, 3, 4]), { status: 200, headers: { "content-type": "application/zip", "content-disposition": 'attachment; filename="site.zip"' } });
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "content-type": "application/json" } });
  }));
  vi.spyOn(window, "confirm").mockImplementation((m?: string) => { log.push(["confirm", m]); return true; });
  vi.spyOn(window, "alert").mockImplementation((m?: string) => { log.push(["alert", m]); });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  URL.createObjectURL = vi.fn(() => { log.push(["createObjectURL"]); return "blob:mock/1"; }) as any;
  URL.revokeObjectURL = vi.fn(() => { log.push(["revokeObjectURL"]); });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { log.push(["anchorClick", this.getAttribute("href"), this.getAttribute("download")]); });
  const onImported = (e: Event) => log.push(["event", e.type, safe((e as CustomEvent).detail)]);
  window.addEventListener("forgestudio:wp-page-imported", onImported);
  const props = propsFor(scenario, log);
  const view = render(<PublishModal {...props} />);
  await settle(50);
  return {
    log,
    view,
    rerenderOpen: async (isOpen: boolean) => { view.rerender(<PublishModal {...props} isOpen={isOpen} />); await settle(50); },
    dispose: () => { window.removeEventListener("forgestudio:wp-page-imported", onImported); cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); },
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
    case "drag": {
      const ds: HTMLElement[] = (all as any).draggables;
      const target = ds[ds.length - 1];
      fireEvent.dragStart(ds[0], { dataTransfer: { setData() {}, getData() { return ""; }, effectAllowed: "move", dropEffect: "move" } });
      fireEvent.dragOver(target, { clientY: 1, dataTransfer: { dropEffect: "move" } });
      fireEvent.drop(target, { clientY: 1, dataTransfer: { getData() { return ""; } } });
      break;
    }
    case "change": {
      if (el.tagName === "SELECT") { const opts = el.options; fireEvent.change(el, { target: { value: opts[opts.length - 1]?.value ?? "" } }); }
      else if (el.type === "checkbox" || el.type === "radio") fireEvent.click(el);
      else if (el.type === "file") fireEvent.change(el, { target: { files: [new File(["img-bytes"], "photo.png", { type: "image/png" })] } });
      else if (el.type === "number") fireEvent.change(el, { target: { value: "7" } });
      else if (el.type === "url" || /http|url|site/i.test(el.getAttribute("placeholder") || "")) fireEvent.change(el, { target: { value: "https://wp.test/new" } });
      else fireEvent.change(el, { target: { value: `Typed ${el.getAttribute("name") || el.getAttribute("placeholder") || "value"}` } });
      break;
    }
  }
}

const focusDesc = () => { const el = document.activeElement as HTMLElement | null; return !el || el === document.body ? "body" : describe_(el); };

export type Step = { kind: Action["kind"]; index: number; desc: string };
export type RunRecord = { steps: Step[]; log: unknown[]; dom: string; domLater: string; focus: string; actions: string[] };

/** Replays `steps` from a fresh mount; returns the record and the final DOM (for the blob store). */
export async function replay(scenario: ScenarioName, fx: Record<string, any>, steps: Step[]) {
  const m = await mount(scenario, fx);
  try {
    for (const s of steps) {
      const acts = actionsOf(document.body).filter((a) => a.kind === s.kind);
      const a = acts[s.index];
      if (!a || a.desc !== s.desc) throw new Error(`action not found: ${s.kind}#${s.index} ${s.desc} (found ${a ? a.desc : "nothing"})`);
      perform(a, actionsOf(document.body));
      await settle(1300);
    }
    const html = document.body.innerHTML;
    const actions = actionsOf(document.body).map((a) => `${a.kind}: ${a.desc}`);
    const focus = focusDesc();
    await settle(5000);
    const later = document.body.innerHTML;
    const rec: RunRecord = { steps, log: JSON.parse(JSON.stringify(m.log)), dom: hash(html), domLater: hash(later), focus, actions };
    return { rec, html, later };
  } finally { m.dispose(); }
}

/** Steps for every action available after `steps` (kind-indexed, as replay() resolves them). */
const stepsOf = (actions: string[], base: Step[]): Step[][] => {
  const counters: Record<string, number> = {};
  return actions.map((a) => {
    const kind = a.slice(0, a.indexOf(":")) as Step["kind"];
    const index = (counters[kind] = (counters[kind] ?? -1) + 1);
    return [...base, { kind, index, desc: a.slice(a.indexOf(":") + 2) }];
  });
};

/**
 * Targeted exploration: every action of the initial state; then, below each action, only the controls it
 * revealed (actions whose description was not available before it), each distinct description once
 * (repeated row buttons are exercised on their first row); `depth` levels, at most `cap` runs.
 */
export async function explore(scenario: ScenarioName, fx: Record<string, any>, depth: number, cap: number) {
  const runs: RunRecord[] = [];
  const blobs: Record<string, string> = {};
  const tried = new Set<string>();
  const root = await replay(scenario, fx, []);
  runs.push(root.rec); blobs[root.rec.dom] = root.html; blobs[root.rec.domLater] = root.later;
  let frontier: Array<{ steps: Step[]; available: Set<string>; candidates: Step[][] }> = [{ steps: [], available: new Set(), candidates: stepsOf(root.rec.actions, []) }];
  for (let d = 1; d <= depth && frontier.length; d++) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      for (const steps of node.candidates) {
        const last = steps[steps.length - 1];
        const key = `${last.kind}: ${last.desc}`;
        if (d > 1 && (node.available.has(key) || tried.has(key))) continue;
        tried.add(key);
        if (runs.length >= cap) break;
        const { rec, html, later } = await replay(scenario, fx, steps);
        runs.push(rec); blobs[rec.dom] = html; blobs[rec.domLater] = later;
        const before = new Set(d === 1 ? root.rec.actions : [...node.available, ...node.candidates.map((c) => { const l = c[c.length - 1]; return `${l.kind}: ${l.desc}`; })]);
        const revealed = rec.actions.filter((a) => !before.has(a));
        if (revealed.length) next.push({ steps, available: new Set(rec.actions.filter((a) => before.has(a))), candidates: stepsOf(rec.actions, steps).filter((c) => { const l = c[c.length - 1]; return revealed.includes(`${l.kind}: ${l.desc}`); }) });
      }
    }
    frontier = next;
  }
  return { runs, blobs };
}

/** Open, close (renders nothing), reopen: DOM hashes and the calls made. */
export async function openCloseRecord(fx: Record<string, any>) {
  const m = await mount("connected", fx);
  try {
    const open = hash(document.body.innerHTML);
    await m.rerenderOpen(false);
    const closed = document.body.innerHTML;
    await m.rerenderOpen(true);
    const reopened = hash(document.body.innerHTML);
    return { open, closed, reopened, log: JSON.parse(JSON.stringify(m.log)) };
  } finally { m.dispose(); }
}

