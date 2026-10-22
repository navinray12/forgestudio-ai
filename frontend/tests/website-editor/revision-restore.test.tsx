// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Revision restore through the real Revision History panel (handleRestoreRevision in the editor),
 * characterised before its pure parts moved to core/revisionRestore and kept as their contract: the panel
 * loads the list when the editor mounts; restoring POSTs .../revisions/<id>/restore and then refreshes the
 * list; the server snapshot replaces the canvas and page settings; when the server restore fails the local
 * snapshot from the list is used; a full restored state also replaces pages and site parts; the message is
 * shown and the selection cleared. CURRENT BEHAVIOUR (characterised): the restored document is autosaved
 * once, on the unchanged document version, although the autosave baseline is updated during the restore.
 */
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { API, flush, heading, mountEditor, siteFixture, SITE_ID, watchForText, type Route_ } from "./editor-harness";

vi.setConfig({ testTimeout: 60000 }); // heavy real-editor mounts; generous under full-suite CPU load

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* ignore */ }
});

const REVISIONS = `${API}/api/websites/${SITE_ID}/revisions`;
const revisionsRoute: Route_ = (r) => (r.method === "GET" && r.url === REVISIONS ? { status: 200, body: { revisions: [{ id: "rev1", websiteId: SITE_ID, version: 2, createdAt: "2026-05-01T10:00:00.000Z", description: "Before redesign", elements: [heading("old1", "Old heading")], pageSettings: { title: "Old title", path: "/" }, elementCount: 1 }] } } : undefined);
const restoreRoute = (reply: () => any): Route_ => (r) => (r.method === "POST" && r.url === `${REVISIONS}/rev1/restore` ? reply() : undefined);
const serverSnapshot = () => ({ status: 200, body: { restoredRevision: { data: { elements: [heading("srv1", "Server heading")], pageSettings: { title: "Server title", path: "/" } } } } });

async function restoreVia() {
  fireEvent.click(screen.getByRole("button", { name: "Revision History" }));
  await waitFor(() => expect(screen.getAllByText("Before redesign").length).toBeGreaterThan(0));
  fireEvent.click(screen.getAllByText("Before redesign")[0]);
  await flush(2);
  fireEvent.click(screen.getAllByText("Restore Revision")[0]);
  await waitFor(() => expect(screen.getByText("Restore this revision?")).toBeTruthy());
  const dialog = screen.getByText("Restore this revision?").closest("div")!.parentElement!;
  fireEvent.click(within(dialog).getAllByText("Restore Revision").at(-1)!);
  await flush(4);
}
const revisionRequests = (requests: Array<{ method: string; url: string }>) => requests.filter((r) => r.url.startsWith(REVISIONS)).map((r) => `${r.method} ${r.url.slice(API.length)}`);

describe("revision restore", () => {
  it("POSTs the restore then refreshes the list; applies the server snapshot, announces it and clears the selection", async () => {
    const editor = await mountEditor(siteFixture(), [revisionsRoute, restoreRoute(serverSnapshot)]);
    expect(revisionRequests(editor.backend.requests)).toEqual([`GET /api/websites/${SITE_ID}/revisions`]); // loaded on mount
    await editor.select("elA");
    const toast = watchForText("Restored revision successfully!");
    const start = editor.backend.requests.length;
    await restoreVia();
    await waitFor(() => expect(editor.canvasIds()).toEqual(["srv1"]));
    expect(toast.seen()).toBe(true);
    toast.stop();
    expect(screen.queryByRole("button", { name: "Copy Style" })).toBeNull(); // nothing selected
    expect(revisionRequests(editor.backend.requests.slice(start))).toEqual([`POST /api/websites/${SITE_ID}/revisions/rev1/restore`, `GET /api/websites/${SITE_ID}/revisions`]);
  });

  it("the restored document is autosaved once on the unchanged version; a manual save then uses the acknowledged one", async () => {
    const editor = await mountEditor(siteFixture(), [revisionsRoute, restoreRoute(serverSnapshot)]);
    await restoreVia();
    await waitFor(() => expect(editor.canvasIds()).toEqual(["srv1"]));
    await waitFor(() => expect(editor.backend.saves()).toHaveLength(1), { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 2500));
    await flush();
    expect(editor.backend.saves()).toHaveLength(1);
    const auto = editor.backend.saves()[0];
    expect(auto.headers["If-Match"]).toBe(`"${SITE_ID}:document:3"`);
    const home = (auto.body as any).editorData.pages[0];
    expect(home.elements.map((e: { id: string }) => e.id)).toEqual(["srv1"]);
    expect(home.pageSettings.title).toBe("Server title");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(editor.backend.saves()).toHaveLength(2));
    expect(editor.backend.saves()[1].headers["If-Match"]).toBe(`"${SITE_ID}:document:4"`);
  });

  it("when the server restore fails, the local snapshot from the list is restored", async () => {
    const editor = await mountEditor(siteFixture(), [revisionsRoute, restoreRoute(() => ({ status: 500, body: { message: "Restore service down" } }))]);
    await restoreVia();
    await waitFor(() => expect(editor.canvasIds()).toEqual(["old1"]));
  });

  it("a full restored state also replaces pages and site parts", async () => {
    const editor = await mountEditor(siteFixture(), [revisionsRoute, restoreRoute(() => ({ status: 200, body: { restoredRevision: { data: {
      elements: [heading("srv1", "Server heading")], pageSettings: { title: "Home", path: "/" },
      pages: [{ id: "home", name: "Home", slug: "/", elements: [heading("srv1", "Server heading")] }, { id: "extra", name: "Extra", slug: "/extra", elements: [] }],
      siteParts: { header: { enabled: true, elements: [heading("hdrR", "Restored header")] }, footer: { enabled: false, elements: [] } },
    } } } }))]);
    await restoreVia();
    await waitFor(() => expect(editor.canvasIds()).toContain("srv1"));
    expect(editor.canvasIds()).toContain("hdrR"); // the restored header is shown around the page
    await waitFor(() => expect(editor.backend.saves().length).toBeGreaterThan(0), { timeout: 8000 });
    const data = (editor.backend.saves().at(-1)!.body as any).editorData;
    expect(data.pages.map((p: { id: string }) => p.id)).toEqual(["home", "extra"]);
    expect(data.siteParts.header.elements.map((e: { id: string }) => e.id)).toEqual(["hdrR"]);
  });
});
