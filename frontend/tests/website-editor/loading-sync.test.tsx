// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Characterisation of editor loading and workspace sync ahead of useWebsiteLoader /
 * useWorkspaceSync / buildCanonicalPages / useManualSave (Phase 5B-2 preparation; nothing extracted).
 * Covers what other suites do not: every reload trigger (storage event, BroadcastChannel,
 * visibilitychange; focus is covered in workspace-reload), events for other sites being ignored,
 * the save broadcast, unmount while a reload is in flight, a failing component-access request, and
 * the legacy single-page document shape.
 */
import { act, cleanup, waitFor } from "@testing-library/react";
import { API, flush, heading, mountEditor, siteFixture, SITE_ID } from "./editor-harness";

vi.setConfig({ testTimeout: 60000 }); // heavy real-editor mounts; generous under full-suite CPU load
const WEBSITE_URL = `${API}/api/websites/${SITE_ID}`;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* ignore */ }
});

/** Serves version 3 until bumped; counts website GETs (the initial load is the first). */
function versionedServer() {
  const state = { version: 3, elements: [heading("elA", "Alpha heading"), heading("elB", "Bravo heading")] as unknown[], gets: 0, getGate: null as Promise<void> | null };
  const route = (r: { method: string; url: string }) => {
    if (r.url !== WEBSITE_URL || r.method !== "GET") return undefined;
    state.gets++;
    const site = { ...siteFixture(), documentVersion: state.version, editorData: { pages: [{ id: "home", name: "Home", slug: "/", elements: state.elements }] } };
    const reply = { status: 200, body: { website: site } };
    return state.getGate && state.gets > 1 ? state.getGate.then(() => reply) : reply;
  };
  return { state, route, bump: (elements: unknown[]) => { state.version++; state.elements = elements; } };
}
const dispatch = async (event: Event) => { await act(async () => { window.dispatchEvent(event); }); await flush(6); };

describe("workspace reload triggers", () => {
  it("a forge_workspace_sync_event storage event for this site reloads; one for another site is ignored", async () => {
    const server = versionedServer();
    const { canvasIds } = await mountEditor(undefined, [server.route]);
    server.bump([heading("elC", "From code")]);
    await dispatch(new StorageEvent("storage", { key: "forge_workspace_sync_event", newValue: JSON.stringify({ websiteId: "otherSite", type: "visual_saved" }) }));
    expect(server.state.gets).toBe(1);
    expect(canvasIds()).toEqual(["elA", "elB"]);
    await dispatch(new StorageEvent("storage", { key: "forge_workspace_sync_event", newValue: JSON.stringify({ websiteId: SITE_ID, type: "code_saved" }) }));
    await waitFor(() => expect(canvasIds()).toEqual(["elC"]));
    expect(server.state.gets).toBe(2);
  });

  it("storage events with another key or no value are ignored", async () => {
    const server = versionedServer();
    await mountEditor(undefined, [server.route]);
    await dispatch(new StorageEvent("storage", { key: "unrelated", newValue: JSON.stringify({ websiteId: SITE_ID }) }));
    await dispatch(new StorageEvent("storage", { key: "forge_workspace_sync_event", newValue: null }));
    expect(server.state.gets).toBe(1);
  });

  it("becoming visible reloads (visibilitychange)", async () => {
    const server = versionedServer();
    const { canvasIds } = await mountEditor(undefined, [server.route]);
    server.bump([heading("elD", "Visible again")]);
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    await waitFor(() => expect(canvasIds()).toEqual(["elD"]));
  });

  it("a BroadcastChannel message for this site reloads (when the environment provides BroadcastChannel)", async () => {
    if (typeof BroadcastChannel === "undefined") {
      // The editor wraps BroadcastChannel in try/catch; without it the other triggers still apply.
      expect(typeof BroadcastChannel).toBe("undefined");
      return;
    }
    const server = versionedServer();
    const { canvasIds } = await mountEditor(undefined, [server.route]);
    server.bump([heading("elE", "From another tab")]);
    const other = new BroadcastChannel("forge_workspace_sync");
    other.postMessage({ websiteId: SITE_ID, type: "code_saved" });
    await waitFor(() => expect(canvasIds()).toEqual(["elE"]));
    other.close();
  });
});

describe("save broadcast and lifecycle", () => {
  it("a manual save announces visual_saved with the acknowledged version on the sync channel", async () => {
    const posted: unknown[] = [];
    if (typeof BroadcastChannel !== "undefined") {
      const real = BroadcastChannel.prototype.postMessage;
      vi.spyOn(BroadcastChannel.prototype, "postMessage").mockImplementation(function (this: BroadcastChannel, msg: unknown) { posted.push(msg); return real.call(this, msg); });
    }
    const { backend, key } = await mountEditor();
    await key("s", { ctrlKey: true });
    await waitFor(() => expect(backend.saves()).toHaveLength(1));
    await waitFor(() => expect(localStorage.getItem("forge_workspace_sync_event")).not.toBeNull());
    expect(JSON.parse(localStorage.getItem("forge_workspace_sync_event")!)).toMatchObject({ type: "visual_saved", websiteId: SITE_ID, documentVersion: 4 });
    if (typeof BroadcastChannel !== "undefined") expect(posted).toEqual([expect.objectContaining({ type: "visual_saved", websiteId: SITE_ID, documentVersion: 4 })]);
  });

  it("unmounting while a workspace reload is in flight applies nothing and raises no errors", async () => {
    const server = versionedServer();
    let release!: () => void;
    server.state.getGate = new Promise<void>((r) => { release = r; });
    const { view, consoleErrors } = await mountEditor(undefined, [server.route]);
    server.bump([heading("elF", "Late")]);
    await dispatch(new Event("focus")); // reload GET is now held
    expect(server.state.gets).toBe(2);
    view.unmount();
    await act(async () => { release(); });
    await flush(5);
    expect(consoleErrors).toEqual([]);
  });

  it("a failing component-access request is logged and the editor still loads", async () => {
    const { canvasIds, consoleErrors } = await mountEditor(siteFixture(), [
      (r) => (r.url.includes("/component-access/") ? Promise.reject(new TypeError("network down")) as never : undefined),
    ]);
    expect(canvasIds()).toEqual(["elA", "elB"]);
    expect(consoleErrors.some((e) => e.startsWith("Failed to fetch accesses"))).toBe(true);
  });

  it("a legacy document without pages loads its top-level elements as the home page, and saves them as pages[home]", async () => {
    const legacy = { ...siteFixture(), editorData: { elements: [heading("old1", "Legacy heading")], pageSettings: { title: "Legacy", path: "/" } } };
    const { backend, canvasIds, key } = await mountEditor(legacy);
    expect(canvasIds()).toEqual(["old1"]);
    await key("s", { ctrlKey: true });
    await waitFor(() => expect(backend.saves()).toHaveLength(1));
    const editorData = (backend.saves()[0].body as any).editorData;
    expect(editorData.pages.map((p: { id: string; slug: string }) => [p.id, p.slug])).toEqual([["home", "/"]]);
    expect(editorData.pages[0].elements.map((e: { id: string }) => e.id)).toEqual(["old1"]);
  });
});
