// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Manual save (handleSave), characterised before the useManualSave extraction and kept as its
 * contract: the exact request and event sequence, the document version and idempotency key of each
 * command, saving while autosave is pending or in flight, failures that block later saves (401, 403,
 * 409) and the unknown-outcome retry of the same command, the Code Workspace source-sync messages,
 * and the result callers rely on (the Code Workspace button navigates only after a confirmed save).
 * The 412 conflict, network failure and broadcast basics are also in website-editor-regression and
 * loading-sync.
 */
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { API, flush, mountEditor, SAVED_BADGE, siteFixture, SITE_ID, type Route_ } from "./editor-harness";
import { recordTimeline } from "./save-timeline";

vi.setConfig({ testTimeout: 60000 }); // heavy real-editor mounts; generous under full-suite CPU load
const AUTOSAVE_WAIT = { timeout: 8000 };
const WEBSITE = `/api/websites/${SITE_ID}`;
const PUT = `PUT ${WEBSITE}`;
const SAVED_TOAST = "status Saved successfully!";
const homeIds = (body: unknown) => (body as any).editorData.pages.find((p: { id: string }) => p.id === "home").elements.map((e: { id: string }) => e.id);
const badge = () => screen.queryAllByRole("status").map((n) => n.textContent?.trim() ?? "").filter((t) => /^(Saved|Saving|Unsaved changes|Save failed)/.test(t));
const held = () => { let release!: () => void; const gate = new Promise<void>((r) => { release = r; }); return { gate, release: () => release() }; };
const ack = (version: number, extra: Record<string, unknown> = {}) => ({ status: 200, body: { website: { id: SITE_ID, documentVersion: version }, ...extra } });
const putOnce = (reply: (r: any) => any): Route_ => { let used = false; return (r) => (r.method === "PUT" && r.url === `${API}${WEBSITE}` && !used ? (used = true, reply(r)) : undefined); };
let timeline: ReturnType<typeof recordTimeline> | undefined;

afterEach(() => {
  timeline?.stop();
  timeline = undefined;
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* ignore */ }
});

async function mountRecorded(routes: Route_[] = [], site = siteFixture()) {
  timeline = recordTimeline();
  const editor = await mountEditor(site, [timeline.route, ...routes]);
  return { ...editor, t: timeline };
}
const saveButton = () => screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;

describe("manual save: request and event sequence", () => {
  it("Ctrl+S sends one document command, then broadcasts, writes the sync event and shows the toast, which hides after 3s", async () => {
    const { backend, key, t } = await mountRecorded();
    const start = t.events.length;
    await key("s", { ctrlKey: true });
    await waitFor(() => expect(t.since(start)).toContain(SAVED_TOAST));
    expect(t.since(start)).toEqual([PUT, "broadcast forge_workspace_sync visual_saved v4", "storage forge_workspace_sync_event", SAVED_TOAST]);
    const put = backend.saves()[0];
    expect(put.headers).toEqual({
      "Content-Type": "application/json",
      "X-Forge-Intent": "document-command",
      "If-Match": `"${SITE_ID}:document:3"`,
      "Idempotency-Key": expect.stringMatching(/^[A-Za-z0-9._:-]{8,128}$/),
    });
    expect(homeIds(put.body)).toEqual(["elA", "elB"]);
    for (const serverOwned of ["publishing", "deployment", "publishedData"]) expect((put.body as any).editorData).not.toHaveProperty(serverOwned);
    expect(t.broadcasts).toEqual([{ type: "visual_saved", websiteId: SITE_ID, documentVersion: 4, timestamp: expect.any(Number) }]);
    expect(JSON.parse(localStorage.getItem("forge_workspace_sync_event")!)).toEqual({ type: "visual_saved", websiteId: SITE_ID, documentVersion: 4, timestamp: expect.any(Number) });
    expect(localStorage.getItem(`forgestudio_editor_${SITE_ID}`)).toBeNull(); // a save writes no local draft
    await waitFor(() => expect(t.events.at(-1)).toBe("status (cleared)"), { timeout: 6000 });
    expect(backend.requests.filter((r) => r.method !== "GET" && r.url.startsWith(`${API}/api/websites`))).toHaveLength(1);
    expect(badge()[0]).toMatch(SAVED_BADGE);
  });

  it("the Save button saves the same way and is disabled, with a spinner, until the response", async () => {
    const h = held();
    const { backend, t } = await mountRecorded([putOnce(() => h.gate.then(() => ack(4)))]);
    expect(saveButton().disabled).toBe(false);
    fireEvent.click(saveButton());
    await waitFor(() => expect(backend.saves()).toHaveLength(1));
    await flush(2);
    expect(saveButton().disabled).toBe(true);
    expect(saveButton().querySelector(".animate-spin")).not.toBeNull();
    expect(t.events).not.toContain(SAVED_TOAST);
    await act(async () => { h.release(); });
    await waitFor(() => expect(saveButton().disabled).toBe(false));
    expect(saveButton().querySelector(".animate-spin")).toBeNull();
    expect(t.events).toContain(SAVED_TOAST);
  });

  it("each save uses the version the previous one acknowledged and a new idempotency key", async () => {
    const { backend, key, t } = await mountRecorded();
    await key("s", { ctrlKey: true });
    await waitFor(() => expect(t.broadcasts).toHaveLength(1));
    await key("s", { ctrlKey: true });
    await waitFor(() => expect(t.broadcasts).toHaveLength(2));
    const [first, second] = backend.saves();
    expect([first.headers["If-Match"], second.headers["If-Match"]]).toEqual([`"${SITE_ID}:document:3"`, `"${SITE_ID}:document:4"`]);
    expect(second.headers["Idempotency-Key"]).not.toBe(first.headers["Idempotency-Key"]);
    expect(t.broadcasts.map((b: any) => b.documentVersion)).toEqual([4, 5]);
  });

  it("Ctrl+S during an in-flight save is queued, not dropped: sent after the acknowledgement, on its version", async () => {
    const h = held();
    const { backend, key, t } = await mountRecorded([putOnce(() => h.gate.then(() => ack(4)))]);
    await key("s", { ctrlKey: true });
    await waitFor(() => expect(backend.saves()).toHaveLength(1));
    await key("s", { ctrlKey: true }); // Ctrl+S is not disabled while saving
    await flush(4);
    expect(backend.saves()).toHaveLength(1); // waits behind the unacknowledged command
    await act(async () => { h.release(); });
    await waitFor(() => expect(backend.saves()).toHaveLength(2));
    expect(backend.saves()[1].headers["If-Match"]).toBe(`"${SITE_ID}:document:4"`);
    await waitFor(() => expect(t.broadcasts.map((b: any) => b.documentVersion)).toEqual([4, 5]));
  });
});

describe("manual save: with autosave", () => {
  it("Ctrl+S inside the autosave debounce saves the edit once; autosave does not re-send it", async () => {
    const { backend, select, key } = await mountRecorded();
    await select("elA");
    await key("Delete");
    await key("s", { ctrlKey: true });
    await waitFor(() => expect(backend.saves()).toHaveLength(1));
    expect(homeIds(backend.saves()[0].body)).toEqual(["elB"]);
    await new Promise((r) => setTimeout(r, 2500)); // past the debounce
    await flush();
    expect(backend.saves()).toHaveLength(1);
    await waitFor(() => expect(badge()[0]).toMatch(SAVED_BADGE));
  });

  it("Ctrl+S while an autosave is in flight waits for it, then sends its own command on the acknowledged version", async () => {
    const h = held();
    const { backend, select, key, t } = await mountRecorded([putOnce(() => h.gate.then(() => ack(4)))]);
    await select("elA");
    await key("Delete");
    await waitFor(() => expect(backend.saves()).toHaveLength(1), AUTOSAVE_WAIT); // the autosave, held open
    await key("s", { ctrlKey: true });
    await flush(4);
    expect(backend.saves()).toHaveLength(1);
    await act(async () => { h.release(); });
    await waitFor(() => expect(backend.saves()).toHaveLength(2));
    const [auto, manual] = backend.saves();
    expect(manual.headers["If-Match"]).toBe(`"${SITE_ID}:document:4"`);
    expect(manual.headers["Idempotency-Key"]).not.toBe(auto.headers["Idempotency-Key"]);
    expect(homeIds(manual.body)).toEqual(["elB"]);
    await waitFor(() => expect(t.broadcasts.map((b: any) => b.documentVersion)).toEqual([5])); // only the manual save broadcasts
    await new Promise((r) => setTimeout(r, 2500));
    await flush();
    expect(backend.saves()).toHaveLength(2);
  });
});

describe("manual save: failures", () => {
  for (const [status, code, message] of [
    [401, "UNAUTHENTICATED", "Session expired"],
    [403, "FORBIDDEN", "You can no longer edit this website"],
    [409, "DOCUMENT_SCOPE_CHANGED", "Website changed elsewhere"],
  ] as const) {
    it(`a ${status} is reported, announces nothing and blocks later saves (fail closed)`, async () => {
      const { backend, key, t } = await mountRecorded([
        (r) => (r.method === "PUT" ? { status, body: { code, error: { message } } } : undefined),
      ]);
      const start = t.events.length;
      await key("s", { ctrlKey: true });
      await waitFor(() => expect(t.since(start)).toContain(`alert ${message}`));
      expect(t.since(start).slice(0, 3)).toEqual([PUT, "status Save failed — changes remain unsaved", `alert ${message}`]);
      expect(t.broadcasts).toEqual([]);
      expect(localStorage.getItem("forge_workspace_sync_event")).toBeNull();
      await key("s", { ctrlKey: true });
      await flush(6);
      expect(backend.saves()).toHaveLength(1); // refused locally
      expect(screen.getAllByRole("alert").map((n) => n.textContent)).toContain(message);
      await waitFor(() => expect(saveButton().disabled).toBe(false));
    });
  }

  it("an unknown outcome keeps the command: the next save re-sends the same bytes and key, then succeeds", async () => {
    const { backend, key, t } = await mountRecorded([putOnce(() => Promise.reject(new TypeError("Failed to fetch")))]);
    await key("s", { ctrlKey: true });
    await waitFor(() => expect(screen.getAllByRole("alert").map((n) => n.textContent).join(" ")).toMatch(/Save outcome is unknown/));
    expect(t.broadcasts).toEqual([]);
    await key("s", { ctrlKey: true });
    await waitFor(() => expect(t.broadcasts).toHaveLength(1));
    const [lost, retry] = backend.saves();
    expect(backend.saves()).toHaveLength(2);
    expect(retry.headers["Idempotency-Key"]).toBe(lost.headers["Idempotency-Key"]);
    expect(retry.headers["If-Match"]).toBe(lost.headers["If-Match"]);
    expect(retry.body).toEqual(lost.body);
    expect((t.broadcasts[0] as any).documentVersion).toBe(4);
    await waitFor(() => expect(t.events).toContain(SAVED_TOAST));
    expect(screen.queryAllByRole("alert").filter((n) => n.tagName === "SPAN")).toHaveLength(0); // cleared when the retry started
  });
});

describe("manual save: Code Workspace source sync", () => {
  it("a stale code project is reported after a successful save", async () => {
    const { t, key } = await mountRecorded([putOnce(() => ack(4, { codeSync: { synced: false, stale: true, error: "generator crashed" } }))]);
    const start = t.events.length;
    await key("s", { ctrlKey: true });
    await waitFor(() => expect(t.since(start).some((e) => e.startsWith("alert "))).toBe(true));
    expect(t.since(start)).toEqual([PUT, "broadcast forge_workspace_sync visual_saved v4", "storage forge_workspace_sync_event", SAVED_TOAST,
      "alert Saved. The Code Workspace source could not be regenerated from this design: generator crashed"]);
  });

  it("held-back pages without a code project are listed", async () => {
    const { t, key } = await mountRecorded([putOnce(() => ack(4, { codeSync: { synced: true, stale: false, conflicts: ["app/page.tsx", "app/about/page.tsx"] } }))]);
    await key("s", { ctrlKey: true });
    await waitFor(() => expect(t.events.some((e) => e.startsWith("alert "))).toBe(true));
    expect(t.events.filter((e) => e.startsWith("alert "))).toEqual([
      "alert Saved. These page files hold hand-written code and were not regenerated: app/page.tsx, app/about/page.tsx. Resolve them in the Code Workspace.",
    ]);
  });

  it("canvas edits are applied to held-back pages before the save is announced; applied edits are reported as status", async () => {
    const plans: any[] = [];
    const { t, key, select } = await mountRecorded([
      putOnce(() => ack(4, { codeSync: { synced: true, stale: false, conflicts: ["app/page.tsx"], projectId: "proj1" } })),
      (r) => (r.url === `${API}/api/v1/projects/proj1/sync/visual-to-code/plan` ? (plans.push(r.body), { status: 200, body: { files: [{ filePath: "app/page.tsx", version: 2, edits: [{ elementId: "elA", mutation: { type: "remove" } }], unsupported: [] }], skipped: [] } }) : undefined),
      (r) => (r.url === `${API}/api/v1/projects/proj1/sync/visual-to-code` ? { status: 200, body: { success: true, updated: true, version: 3 } } : undefined),
    ]);
    await select("elA");
    await key("Delete");
    const start = t.events.length;
    await key("s", { ctrlKey: true });
    await waitFor(() => expect(t.since(start)).toContain("status Saved. 1 edit applied to hand-written page source."));
    expect(t.since(start).filter((e) => !e.startsWith("alert "))).toEqual([PUT, "POST /api/v1/projects/proj1/sync/visual-to-code/plan", "POST /api/v1/projects/proj1/sync/visual-to-code",
      "broadcast forge_workspace_sync visual_saved v4", "storage forge_workspace_sync_event", "status Saved. 1 edit applied to hand-written page source."]);
    expect(homeIds({ editorData: plans[0].before })).toEqual(["elA", "elB"]); // the loaded document
    expect(homeIds({ editorData: plans[0].after })).toEqual(["elB"]); // the saved one
    expect(plans[0].paths).toEqual(["app/page.tsx"]);
  });

  it("source edits that were not applied are reported as an alert", async () => {
    const { t, key } = await mountRecorded([
      putOnce(() => ack(4, { codeSync: { synced: true, stale: false, conflicts: ["app/page.tsx"], projectId: "proj1" } })),
      (r) => (r.url === `${API}/api/v1/projects/proj1/sync/visual-to-code/plan` ? { status: 200, body: { files: [{ filePath: "app/page.tsx", version: 2, edits: [{ elementId: "elA", mutation: { type: "remove" } }], unsupported: [] }], skipped: [] } } : undefined),
      (r) => (r.url === `${API}/api/v1/projects/proj1/sync/visual-to-code` ? { status: 422, body: { success: false, error: { code: "ELEMENT_NOT_FOUND", message: "No such element" } } } : undefined),
    ]);
    await key("s", { ctrlKey: true });
    await waitFor(() => expect(t.events.some((e) => e.startsWith("alert "))).toBe(true));
    expect(t.events.filter((e) => e.startsWith("alert "))).toEqual([
      "alert Saved. Not applied to hand-written source: app/page.tsx › elA: No such element. Resolve these in the Code Workspace.",
    ]);
    expect(t.broadcasts).toHaveLength(1);
  });
});

describe("manual save: result used by callers", () => {
  it("the Code Workspace button saves first and navigates only once the save is confirmed", async () => {
    const { backend, view } = await mountRecorded([putOnce(() => ({ status: 500, body: { error: { message: "Database unavailable" } } }))]);
    fireEvent.click(screen.getByRole("button", { name: "Developer Code Workspace" }));
    await waitFor(() => expect(screen.getAllByRole("alert").map((n) => n.textContent)).toContain("Database unavailable"));
    expect(view.container.querySelector("[data-el-id]")).not.toBeNull(); // still in the editor
    fireEvent.click(screen.getByRole("button", { name: "Developer Code Workspace" })); // 5xx keeps the command: re-sent, now acknowledged
    await waitFor(() => expect(view.container.querySelector("[data-el-id]")).toBeNull()); // navigated away
    expect(backend.saves()).toHaveLength(2);
    expect(backend.saves()[1].headers["Idempotency-Key"]).toBe(backend.saves()[0].headers["Idempotency-Key"]);
  });
});
