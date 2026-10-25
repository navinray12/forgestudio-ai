// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Phase 7C investigation of known issue #3 (revision restore triggers an extra autosave), against a
 * fake backend that keeps one document version the way the real one does: the restore endpoint
 * (backend revision.service restoreRevision) writes editorData itself, and the
 * websites_advance_document_version trigger advances documentVersion (3 -> 4); a PUT whose If-Match
 * names another version is rejected with 412.
 *
 * CURRENT BEHAVIOUR (characterised, not endorsed; left unchanged in Phase 7C, see the report):
 *  - the restore POST is the server-side persistence of the restored draft;
 *  - the editor ignores the version in the restore response, so the autosave that follows is sent on
 *    the pre-restore version (If-Match :3) and the server rejects it with 412;
 *  - the save coordinator then blocks later saves (412 is a blocking status).
 * The editor harness's default backend accepts any If-Match, which is why revision-restore.test.tsx sees
 * that autosave succeed. Whether the client save is needed at all (the server stores the revision
 * snapshot as the whole draft) is a product decision.
 */
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { API, flush, heading, mountEditor, siteFixture, SITE_ID, watchForText, type Route_ } from "./editor-harness";

vi.setConfig({ testTimeout: 60000 });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* ignore */ }
});

const WEBSITE = `${API}/api/websites/${SITE_ID}`;
const REVISIONS = `${WEBSITE}/revisions`;

function versionedBackend() {
  const server = { version: 3, editorData: null as unknown, puts: [] as Array<{ ifMatch: string; status: number }> };
  const revisions: Route_ = (r) => (r.method === "GET" && r.url === REVISIONS ? { status: 200, body: { revisions: [{ id: "rev1", websiteId: SITE_ID, version: 2, createdAt: "2026-05-01T10:00:00.000Z", description: "Before redesign", elements: [heading("old1", "Old heading")], pageSettings: { title: "Old title", path: "/" }, elementCount: 1 }] } } : undefined);
  const restore: Route_ = (r) => {
    if (r.method !== "POST" || r.url !== `${REVISIONS}/rev1/restore`) return undefined;
    const data = { elements: [heading("srv1", "Server heading")], pageSettings: { title: "Server title", path: "/" } };
    server.editorData = data;
    server.version += 1; // the trigger: editorData changed
    return { status: 200, body: { success: true, message: "Restored working draft to revision v2 successfully.", restoredRevision: { id: "rev1", version: 2, data }, website: { id: SITE_ID, documentVersion: server.version } } };
  };
  const put: Route_ = (r) => {
    if (r.method !== "PUT" || r.url !== WEBSITE) return undefined;
    const ifMatch = r.headers["If-Match"] ?? "";
    const expected = Number(/:document:(\d+)"$/.exec(ifMatch)?.[1]);
    if (expected !== server.version) {
      server.puts.push({ ifMatch, status: 412 });
      return { status: 412, body: { success: false, error: { code: "DOCUMENT_VERSION_MISMATCH", message: "The document changed on the server." } } };
    }
    server.version += 1;
    server.puts.push({ ifMatch, status: 200 });
    return { status: 200, body: { website: { id: SITE_ID, documentVersion: server.version } } };
  };
  return { server, routes: [revisions, restore, put] };
}

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

describe("revision restore against a versioned backend (current behaviour)", () => {
  it("the restore POST persists the draft and advances the version; the following autosave uses the old version and gets 412", async () => {
    const { server, routes } = versionedBackend();
    const editor = await mountEditor(siteFixture(), routes);
    await restoreVia();
    await waitFor(() => expect(editor.canvasIds()).toEqual(["srv1"]));
    expect(server.version).toBe(4); // persisted by the restore itself
    expect(server.editorData).toMatchObject({ elements: [{ id: "srv1" }] });
    await waitFor(() => expect(server.puts.length).toBe(1), { timeout: 8000 });
    expect(server.puts[0]).toEqual({ ifMatch: `"${SITE_ID}:document:3"`, status: 412 });
    // the restored document is already the server's draft: the autosave carries the same canvas
    const sent = editor.backend.saves()[0].body as any;
    expect(sent.editorData.pages[0].elements.map((e: { id: string }) => e.id)).toEqual(["srv1"]);
  });

  it("after that 412, a manual save is refused without a request and the user sees the conflict (the coordinator blocks on 412)", async () => {
    const { server, routes } = versionedBackend();
    const editor = await mountEditor(siteFixture(), routes);
    await restoreVia();
    await waitFor(() => expect(server.puts.length).toBe(1), { timeout: 8000 });
    const failed = watchForText("Save failed — changes remain unsaved"); // shown for 3s
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(failed.seen()).toBe(true));
    failed.stop();
    await flush(2);
    expect(server.puts).toHaveLength(1); // the manual save is refused client-side: no request is sent
    expect(screen.getAllByRole("alert").map((n) => n.textContent)).toContain("The document changed on the server.");
    expect(server.version).toBe(4);
    expect(editor.canvasIds()).toEqual(["srv1"]);
  });
});
