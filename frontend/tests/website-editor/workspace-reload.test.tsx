// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Code Workspace reload vs undo history and autosave.
 *
 * reloadWebsiteFromWorkspace (triggered by focus, visibility, BroadcastChannel and storage events)
 * asks decideWorkspaceRefresh: older/equal server versions are ignored ("stale"), unsaved local
 * edits are never overwritten ("dirty": the reload is skipped and the user is told), otherwise the
 * authoritative server document replaces the editor document ("apply"). An applied reload is a
 * history boundary: undo/redo must not bring back the pre-reload document, which autosave would
 * otherwise write over the newer server version.
 *
 * The fake server here is stateful and enforces If-Match like the real document endpoint.
 */
import { act, cleanup, screen, waitFor } from "@testing-library/react";
import { API, flush, heading, mountEditor, SAVED_BADGE, siteFixture, SITE_ID, watchForText } from "./editor-harness";

vi.setConfig({ testTimeout: 60000 }); // heavy real-editor mounts; generous under full-suite CPU load
const AUTOSAVE_WAIT = { timeout: 8000 };
const WEBSITE_URL = `${API}/api/websites/${SITE_ID}`;
const homeIds = (editorData: any) => editorData.pages.find((p: { id: string }) => p.id === "home").elements.map((e: { id: string }) => e.id);
const settleAutosave = () => new Promise((r) => setTimeout(r, 2000));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* ignore */ }
});

function statefulServer() {
  const server = {
    version: 3,
    editorData: siteFixture().editorData as any,
    getDelays: [] as Array<Promise<void>>, // per-GET gates, consumed in order
    /** The Code Workspace writes a new authoritative document. */
    workspaceWrite(elements: unknown[]) {
      server.version++;
      server.editorData = { pages: [{ id: "home", name: "Home", slug: "/", elements }] };
    },
  };
  const snapshot = () => ({ ...siteFixture(), documentVersion: server.version, editorData: JSON.parse(JSON.stringify(server.editorData)) });
  const route = (r: { method: string; url: string; headers: Record<string, string>; body: unknown }) => {
    if (r.url !== WEBSITE_URL) return undefined;
    if (r.method === "GET") {
      const reply = snapshot();
      const gate = server.getDelays.shift();
      return gate ? gate.then(() => ({ status: 200, body: { website: reply } })) : { status: 200, body: { website: reply } };
    }
    if (r.method === "PUT") {
      const expected = Number(/:document:(\d+)"$/.exec(r.headers["If-Match"] ?? "")?.[1]);
      if (expected !== server.version) return { status: 412, body: { code: "DOCUMENT_VERSION_CONFLICT", error: { message: "Document changed elsewhere" } } };
      server.version++;
      server.editorData = (r.body as { editorData: unknown }).editorData;
      return { status: 200, body: { website: { id: SITE_ID, documentVersion: server.version } } };
    }
    return undefined;
  };
  return { server, route };
}

async function workspaceReload() {
  await act(async () => { window.dispatchEvent(new Event("focus")); });
  await flush(6);
}

describe("Code Workspace reload is a history boundary", () => {
  it("undo after an applied reload does not restore the pre-reload document, and nothing old is autosaved", async () => {
    const { server, route } = statefulServer();
    const { backend, canvasIds, select, key } = await mountEditor(undefined, [route]);
    await select("elA");
    await key("Delete");
    await waitFor(() => expect(backend.saves()).toHaveLength(1), AUTOSAVE_WAIT);
    await waitFor(() => expect(server.version).toBe(4));
    server.workspaceWrite([heading("elC", "Charlie from code")]); // v5
    await workspaceReload();
    await waitFor(() => expect(canvasIds()).toEqual(["elC"]));
    await key("z", { ctrlKey: true });
    await key("z", { ctrlKey: true });
    expect(canvasIds()).toEqual(["elC"]);
    await key("y", { ctrlKey: true });
    expect(canvasIds()).toEqual(["elC"]);
    await settleAutosave();
    await flush();
    // Nothing from before the reload is ever written back: every later save carries only the
    // reloaded document and targets the reloaded version.
    const after = backend.saves().slice(1);
    for (const s of after) {
      expect(homeIds((s.body as any).editorData)).toEqual(["elC"]);
      expect(s.headers["If-Match"]).toBe(`"${SITE_ID}:document:5"`);
    }
    // FIXED (was OBSERVED at commit bc37b30): one redundant re-save of the unchanged reloaded document
    // followed, because the reload's hand-built autosave baseline used the raw page settings while
    // editor state merged in its defaults. An unchanged reloaded document is not saved again.
    expect(after).toHaveLength(0);
    expect(server.version).toBe(5);
    expect(homeIds(server.editorData)).toEqual(["elC"]);
  });

  it("undo/redo still work within the reloaded document, and its saves use the reloaded version", async () => {
    const { server, route } = statefulServer();
    const { backend, canvasIds, select, key } = await mountEditor(undefined, [route]);
    server.workspaceWrite([heading("elC", "Charlie from code"), heading("elD", "Delta from code")]); // v4
    await workspaceReload();
    await waitFor(() => expect(canvasIds()).toEqual(["elC", "elD"]));
    await select("elC");
    await key("Delete");
    expect(canvasIds()).toEqual(["elD"]);
    await waitFor(() => expect(backend.saves()).toHaveLength(1), AUTOSAVE_WAIT);
    expect(backend.saves()[0].headers["If-Match"]).toBe(`"${SITE_ID}:document:4"`);
    await key("z", { ctrlKey: true });
    expect(canvasIds()).toEqual(["elC", "elD"]);
    await key("z", { ctrlKey: true }); // boundary: nothing before the reload
    expect(canvasIds()).toEqual(["elC", "elD"]);
    await key("y", { ctrlKey: true });
    expect(canvasIds()).toEqual(["elD"]);
    // Whether the intermediate undo state gets its own autosave depends on timing; either way the
    // server must converge on the editor's final document, and nothing pre-reload is ever written.
    await waitFor(() => expect(homeIds(server.editorData)).toEqual(["elD"]), AUTOSAVE_WAIT);
    await settleAutosave();
    await flush();
    expect(homeIds(server.editorData)).toEqual(["elD"]);
    expect(backend.saves().every((s) => homeIds((s.body as any).editorData).every((id: string) => id === "elC" || id === "elD"))).toBe(true);
    expect(backend.saves().every((s) => Number(/:document:(\d+)"$/.exec(s.headers["If-Match"])?.[1]) >= 4)).toBe(true);
  });

  it("a reload while there are unsaved edits is not applied: the edits and their history are kept and the user is told", async () => {
    const { server, route } = statefulServer();
    // The edit's autosave is held unacknowledged until after the reload, so the edit is provably
    // still unsaved when the reload arrives (under CPU load the debounced save could otherwise land
    // first and make the editor clean). The server judges the held save only once released.
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    let firstPut = true;
    const held = (r: Parameters<typeof route>[0]) => (r.method === "PUT" && firstPut ? (firstPut = false, gate.then(() => route(r)!)) : route(r));
    const { backend, canvasIds, select, key } = await mountEditor(undefined, [held]);
    await select("elA");
    await key("Delete"); // unsaved: its save is pending or in flight, never acknowledged before the reload
    server.workspaceWrite([heading("elC", "Charlie from code")]); // v4
    const notice = watchForText(/Code Workspace updated \(v4\)/); // auto-hides after 5s
    await workspaceReload();
    expect(canvasIds()).toEqual(["elB"]);
    await waitFor(() => expect(notice.seen()).toBe(true));
    notice.stop();
    await act(async () => { release(); });
    // The pending autosave targets the version it was edited against, so the server rejects it
    // instead of the older draft silently replacing the workspace document.
    await waitFor(() => expect(backend.saves()).toHaveLength(1), AUTOSAVE_WAIT);
    expect(backend.saves()[0].headers["If-Match"]).toBe(`"${SITE_ID}:document:3"`);
    expect(homeIds(server.editorData)).toEqual(["elC"]);
    await waitFor(() => expect(screen.getAllByRole("status").map((n) => n.textContent?.trim())).toContain("Save failed"));
    expect(canvasIds()).toEqual(["elB"]); // local edits are not discarded
    await key("z", { ctrlKey: true }); // and their history is intact
    expect(canvasIds()).toEqual(["elA", "elB"]);
  });

  it("a delayed older reload response cannot roll back a newer applied one", async () => {
    const { server, route } = statefulServer();
    const { backend, canvasIds, key } = await mountEditor(undefined, [route]);
    let releaseSlow!: () => void;
    server.workspaceWrite([heading("elC", "Charlie v4")]); // v4, served slowly
    server.getDelays.push(new Promise<void>((r) => { releaseSlow = r; }));
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    server.workspaceWrite([heading("elD", "Delta v5")]); // v5, served immediately
    await workspaceReload();
    await waitFor(() => expect(canvasIds()).toEqual(["elD"]));
    await act(async () => { releaseSlow(); });
    await flush(6);
    expect(canvasIds()).toEqual(["elD"]);
    await key("z", { ctrlKey: true });
    expect(canvasIds()).toEqual(["elD"]);
    await settleAutosave();
    await flush();
    expect(backend.saves()).toHaveLength(0); // neither response leads to a write
    expect(server.version).toBe(5);
  });

  it("a reload returning the version the editor already has is ignored and keeps history", async () => {
    const { route } = statefulServer();
    const { backend, canvasIds, select, key } = await mountEditor(undefined, [route]);
    await select("elA");
    await key("Delete");
    await waitFor(() => expect(backend.saves()).toHaveLength(1), AUTOSAVE_WAIT);
    await workspaceReload(); // server is at v4, which the editor already acknowledged
    expect(canvasIds()).toEqual(["elB"]);
    await key("z", { ctrlKey: true }); // ordinary history is untouched by a stale reload
    expect(canvasIds()).toEqual(["elA", "elB"]);
  });
});

describe("no redundant autosave after an applied reload", () => {
  const badge = () => screen.queryAllByRole("status").map((n) => n.textContent?.trim() ?? "").filter((t) => /^(Saved|Saving|Unsaved changes|Save failed)/.test(t));

  it("a clean editor applies the reload, shows Saved and writes nothing", async () => {
    const { server, route } = statefulServer();
    const { backend, canvasIds } = await mountEditor(undefined, [route]);
    server.workspaceWrite([heading("elC", "Charlie from code")]); // v4
    await workspaceReload();
    await waitFor(() => expect(canvasIds()).toEqual(["elC"]));
    await settleAutosave();
    await flush();
    expect(backend.saves()).toHaveLength(0);
    expect(badge()[0]).toMatch(SAVED_BADGE); // wall-clock wording not asserted
    expect(server.version).toBe(4);
  });

  it("a genuine edit after the reload is autosaved exactly once, on the reloaded version", async () => {
    const { server, route } = statefulServer();
    const { backend, canvasIds, select, key } = await mountEditor(undefined, [route]);
    server.workspaceWrite([heading("elC", "Charlie from code"), heading("elD", "Delta from code")]); // v4
    await workspaceReload();
    await waitFor(() => expect(canvasIds()).toEqual(["elC", "elD"]));
    await settleAutosave(); // the reload alone must not produce a save
    expect(backend.saves()).toHaveLength(0);
    await select("elC");
    await key("Delete");
    await waitFor(() => expect(backend.saves()).toHaveLength(1), AUTOSAVE_WAIT);
    expect(backend.saves()[0].headers["If-Match"]).toBe(`"${SITE_ID}:document:4"`);
    expect(homeIds((backend.saves()[0].body as any).editorData)).toEqual(["elD"]);
    await settleAutosave();
    expect(backend.saves()).toHaveLength(1);
    expect(homeIds(server.editorData)).toEqual(["elD"]);
  });

  it("after a failed autosave the unsaved edit blocks the reload instead of being replaced", async () => {
    const { server, route } = statefulServer();
    let failNext = true;
    const flaky = (r: Parameters<typeof route>[0]) => (r.method === "PUT" && failNext ? (failNext = false, { status: 500, body: { error: { message: "Database unavailable" } } }) : route(r));
    const { backend, canvasIds, select, key } = await mountEditor(undefined, [flaky]);
    await select("elA");
    await key("Delete");
    await waitFor(() => expect(badge()).toEqual(["Save failed"]), AUTOSAVE_WAIT);
    server.workspaceWrite([heading("elC", "Charlie from code")]); // v4
    const notice = watchForText(/Code Workspace updated \(v4\)/); // auto-hides after 5s
    await workspaceReload();
    expect(canvasIds()).toEqual(["elB"]); // the unsaved edit is kept
    await waitFor(() => expect(notice.seen()).toBe(true));
    notice.stop();
    expect(backend.saves()).toHaveLength(1);
    expect(homeIds(server.editorData)).toEqual(["elC"]); // and newer work on the server is untouched
  });
});
