// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Workspace-sync lifecycle and ordering (captured before the useWorkspaceSync extraction and kept as
 * its contract): exactly one storage / focus / visibilitychange listener and one BroadcastChannel
 * while mounted, all removed or closed on unmount; overlapping reloads apply only the newest request
 * even when the older response arrives last; a reload event fired during the initial load does not
 * replace the document. Triggers, other-site filtering, dirty protection and boundaries are covered in
 * workspace-reload and loading-sync.
 */
import { act, cleanup, screen, waitFor } from "@testing-library/react";
import { API, flush, heading, mountEditor, siteFixture, SITE_ID, watchForText } from "./editor-harness";

vi.setConfig({ testTimeout: 60000 }); // heavy real-editor mounts; generous under full-suite CPU load
const WEBSITE_URL = `${API}/api/websites/${SITE_ID}`;
const SYNC_HANDLERS = ["handleStorage", "handleFocus", "handleVisibilityChange"];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* ignore */ }
});

function trackSyncListeners() {
  const live = new Map<string, number>();
  const wrap = (target: Window | Document) => {
    const realAdd = target.addEventListener.bind(target);
    const realRemove = target.removeEventListener.bind(target);
    vi.spyOn(target, "addEventListener").mockImplementation(((t: string, l: any, o?: any) => { if (SYNC_HANDLERS.includes(l?.name)) live.set(l.name, (live.get(l.name) ?? 0) + 1); realAdd(t, l, o); }) as any);
    vi.spyOn(target, "removeEventListener").mockImplementation(((t: string, l: any, o?: any) => { if (SYNC_HANDLERS.includes(l?.name)) live.set(l.name, (live.get(l.name) ?? 0) - 1); realRemove(t, l, o); }) as any);
  };
  wrap(window); wrap(document);
  let opened = 0, closed = 0;
  const RealBC = globalThis.BroadcastChannel;
  vi.stubGlobal("BroadcastChannel", class extends RealBC {
    constructor(name: string) { super(name); if (name === "forge_workspace_sync") opened++; }
    close() { if (this.name === "forge_workspace_sync") closed++; super.close(); }
  });
  return { active: () => Object.fromEntries(SYNC_HANDLERS.map((n) => [n, live.get(n) ?? 0])), channels: () => opened - closed };
}

/** Versioned server whose GETs can be held individually, in request order. */
function server() {
  const state = { version: 3, elements: [heading("elA", "Alpha heading"), heading("elB", "Bravo heading")] as unknown[], gets: 0, gates: [] as Array<Promise<void> | undefined> };
  const route = (r: { method: string; url: string }) => {
    if (r.url !== WEBSITE_URL || r.method !== "GET") return undefined;
    const n = state.gets++;
    const reply = { status: 200, body: { website: { ...siteFixture(), documentVersion: state.version, editorData: { pages: [{ id: "home", name: "Home", slug: "/", elements: state.elements }] } } } };
    const gate = state.gates[n];
    return gate ? gate.then(() => reply) : reply;
  };
  return { state, route, bump: (els: unknown[]) => { state.version++; state.elements = els; } };
}
const held = () => { let release!: () => void; const gate = new Promise<void>((r) => { release = r; }); return { gate, release: () => release() }; };
const focus = async () => { await act(async () => { window.dispatchEvent(new Event("focus")); }); await flush(4); };

describe("workspace sync listener lifecycle", () => {
  it("one of each listener and one channel while mounted; none after unmount", async () => {
    const t = trackSyncListeners();
    const { view, select, key } = await mountEditor();
    const one = { handleStorage: 1, handleFocus: 1, handleVisibilityChange: 1 };
    expect(t.active()).toEqual(one);
    expect(t.channels()).toBe(1);
    await select("elA");
    await key("Delete"); // ordinary editing never leaves duplicates
    await flush(3);
    expect(t.active()).toEqual(one);
    expect(t.channels()).toBe(1);
    view.unmount();
    expect(t.active()).toEqual({ handleStorage: 0, handleFocus: 0, handleVisibilityChange: 0 });
    expect(t.channels()).toBe(0);
  });

  it("re-subscribing after a dependency change keeps exactly one listener and channel", async () => {
    const t = trackSyncListeners();
    const s = server();
    const { canvasIds } = await mountEditor(undefined, [s.route]);
    s.bump([heading("elC", "From code")]);
    await focus(); // applying a reload updates state the reload callback depends on
    await waitFor(() => expect(canvasIds()).toEqual(["elC"]));
    expect(t.active()).toEqual({ handleStorage: 1, handleFocus: 1, handleVisibilityChange: 1 });
    expect(t.channels()).toBe(1);
  });
});

describe("overlapping reloads", () => {
  it("when the older request resolves last it is ignored, so it cannot replace newer state or later edits", async () => {
    const s = server();
    const older = held(), newer = held();
    s.state.gates[1] = older.gate; // GET #0 is the initial load
    s.state.gates[2] = newer.gate;
    const { canvasIds, select, key } = await mountEditor(undefined, [s.route]);
    s.bump([heading("elC", "Charlie v4")]);
    await focus(); // request 1 (held)
    s.bump([heading("elD", "Delta v5")]);
    await focus(); // request 2 (held)
    expect(s.state.gets).toBe(3);
    await act(async () => { newer.release(); });
    await waitFor(() => expect(canvasIds()).toEqual(["elD"]));
    await select("elD");
    await key("d", { ctrlKey: true }); // a local edit after the newest reload
    expect(canvasIds()).toHaveLength(2);
    await act(async () => { older.release(); });
    await flush(6);
    expect(canvasIds()).toHaveLength(2); // the stale response changed nothing
    expect(canvasIds()[0]).toBe("elD");
  });
});

describe("request order rule (sequence counter)", () => {
  it("only the newest request applies, even if an older request returns a higher version", async () => {
    // With a monotonic server the version check alone already rejects late older responses (see the
    // test above). This pins the request-order rule itself: request 1 is answered later with v6,
    // request 2 earlier with v5 (e.g. a lagging cache); request 2 is applied and request 1 dropped.
    const s = server();
    const older = held();
    const { canvasIds } = await mountEditor(undefined, [(r) => {
      if (r.method !== "GET" || r.url !== WEBSITE_URL) return undefined;
      const n = s.state.gets++;
      const doc = (version: number, id: string) => ({ status: 200, body: { website: { ...siteFixture(), documentVersion: version, editorData: { pages: [{ id: "home", name: "Home", slug: "/", elements: [heading(id, id)] }] } } } });
      if (n === 0) return doc(3, "elA");
      if (n === 1) return older.gate.then(() => doc(6, "fromOlderRequest"));
      return doc(5, "fromNewerRequest");
    }]);
    await focus(); // request 1 (held, will answer v6)
    await focus(); // request 2 (answers v5 now)
    await waitFor(() => expect(canvasIds()).toEqual(["fromNewerRequest"]));
    await act(async () => { older.release(); });
    await flush(6);
    expect(canvasIds()).toEqual(["fromNewerRequest"]);
  });
});

describe("effect timing", () => {
  it("a reload event during the initial load does not replace the document; the initial load still completes", async () => {
    const s = server();
    const initial = held();
    s.state.gates[0] = initial.gate;
    const notice = watchForText(/Code Workspace updated/);
    const { canvasIds } = await mountEditor(undefined, [s.route], { waitForLoad: false });
    await flush(3);
    expect(screen.queryByText("Loading Website Editor...")).toBeTruthy();
    s.bump([heading("elC", "Arrived during load")]); // v4 on the server while v3 is still loading
    await focus(); // reload request while nothing is loaded yet
    await flush(6);
    await act(async () => { initial.release(); });
    // CURRENT BEHAVIOUR (characterised, a known gap): the held initial request completes with the v3
    // document it was answered with; the reload fired before the editor had an autosave baseline is
    // classified "dirty" (hasUnsavedChanges() is true while the baseline is null), so it is announced
    // but not applied and not retried. The editor stays on v3 while the server is on v4; the next save
    // is then rejected by If-Match (412), so newer work is protected but the user must reload.
    await waitFor(() => expect(canvasIds()).toEqual(["elA", "elB"]));
    expect(s.state.gets).toBe(2);
    expect(notice.seen()).toBe(true);
    notice.stop();
  });
});
