// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Publishing vs autosave. A successful publish updates only server-owned state (publishing,
 * deployment), which draftWritePayload strips from every draft write, so it must not by itself cause
 * an autosave. Edits that are pending when publishing (or made afterwards) are editable data and must
 * still be autosaved; a failed publish must not mark anything as saved. Publish never advances the
 * document version, so later saves keep the loaded version as their precondition.
 */
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { flush, mountEditor, SAVED_BADGE, siteFixture, SITE_ID, watchForText } from "./editor-harness";

vi.setConfig({ testTimeout: 60000 }); // heavy real-editor mounts; generous under full-suite CPU load
const AUTOSAVE_WAIT = { timeout: 8000 };
const homeIds = (body: unknown) => (body as any).editorData.pages.find((p: { id: string }) => p.id === "home").elements.map((e: { id: string }) => e.id);
const settleAutosave = () => new Promise((r) => setTimeout(r, 2000));
const badge = () => screen.queryAllByRole("status").map((n) => n.textContent?.trim() ?? "").filter((t) => /^(Saved|Saving|Unsaved changes|Save failed)/.test(t));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* ignore */ }
});

async function publishNow() {
  fireEvent.click(screen.getByTitle("Publish Website"));
  await flush(3);
  fireEvent.click(screen.getByText(/Publish Now/));
}

describe("publishing does not trigger redundant autosaves", () => {
  it("records the request sequence: one publish, no save, and the badge stays Saved", async () => {
    const { backend } = await mountEditor();
    const published = watchForText(/successfully published \(v7\)/i); // auto-hiding toast
    await publishNow();
    await waitFor(() => expect(backend.publishes()).toHaveLength(1));
    await waitFor(() => expect(published.seen()).toBe(true));
    published.stop();
    await settleAutosave();
    await flush();
    // Document writes only (the publish modal also issues its own WordPress preview/status requests).
    // Before the fix this was [POST publish, PUT website (If-Match v3, identical editable content)].
    const writes = backend.requests.filter((r) => r.url.endsWith(`/api/websites/${SITE_ID}`) || r.url.endsWith(`/api/websites/${SITE_ID}/publish`)).filter((r) => r.method !== "GET");
    expect(writes.map((r) => `${r.method} ${r.url.replace(/^.*\/api\//, "/api/")}`)).toEqual([`POST /api/websites/${SITE_ID}/publish`]);
    expect(badge()).toEqual(["Saved"]);
  });

  it("an edit pending at publish time is published and still autosaved, exactly once", async () => {
    const { backend, select, key } = await mountEditor();
    await select("elA");
    await key("Delete"); // inside the debounce window
    await publishNow();
    await waitFor(() => expect(backend.publishes()).toHaveLength(1));
    expect(homeIds(backend.publishes()[0].body)).toEqual(["elB"]);
    await waitFor(() => expect(backend.saves()).toHaveLength(1), AUTOSAVE_WAIT);
    expect(homeIds(backend.saves()[0].body)).toEqual(["elB"]);
    expect(backend.saves()[0].headers["If-Match"]).toBe(`"${SITE_ID}:document:3"`);
    await settleAutosave();
    expect(backend.saves()).toHaveLength(1);
    await waitFor(() => expect(badge()[0]).toMatch(SAVED_BADGE)); // wall-clock wording not asserted
  });

  it("a publish that completes while the pending edit's autosave is in flight does not queue a duplicate save", async () => {
    // Deterministic form of a race seen once under full-suite load: publishing re-runs autosave change
    // detection while the edit is unacknowledged, which queued the identical payload behind the
    // in-flight save and sent it again after the acknowledgement.
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    let firstPut = true;
    const { backend, select, key } = await mountEditor(siteFixture(), [
      (r) => (r.method === "PUT" && firstPut ? (firstPut = false, gate.then(() => ({ status: 200, body: { website: { id: SITE_ID, documentVersion: 4 } } }))) : undefined),
    ]);
    await select("elA");
    await key("Delete");
    await waitFor(() => expect(backend.saves()).toHaveLength(1), AUTOSAVE_WAIT); // in flight, held open
    const published = watchForText(/successfully published/i); // auto-hiding toast
    await publishNow();
    await waitFor(() => expect(backend.publishes()).toHaveLength(1));
    await waitFor(() => expect(published.seen()).toBe(true));
    published.stop();
    await settleAutosave(); // longer than the debounce, while the save is still unacknowledged
    await act(async () => { release(); });
    await settleAutosave();
    await flush();
    expect(backend.saves()).toHaveLength(1);
    await waitFor(() => expect(badge()[0]).toMatch(/^Saved/));
  });

  it("a genuinely newer edit queued behind an in-flight save is still sent, on the acknowledged version", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    let firstPut = true;
    const { backend, select, key } = await mountEditor(siteFixture(), [
      (r) => (r.method === "PUT" && firstPut ? (firstPut = false, gate.then(() => ({ status: 200, body: { website: { id: SITE_ID, documentVersion: 4 } } }))) : undefined),
    ]);
    await select("elA");
    await key("Delete");
    await waitFor(() => expect(backend.saves()).toHaveLength(1), AUTOSAVE_WAIT); // held open
    await select("elB");
    await key("Delete"); // a real change while the first save is unacknowledged
    await settleAutosave(); // its debounce elapses, so it is queued
    await act(async () => { release(); });
    await waitFor(() => expect(backend.saves()).toHaveLength(2), AUTOSAVE_WAIT);
    expect(homeIds(backend.saves()[1].body)).toEqual([]);
    expect(backend.saves()[1].headers["If-Match"]).toBe(`"${SITE_ID}:document:4"`);
  });

  it("an edit after publishing is autosaved on the unchanged document version with a fresh idempotency key", async () => {
    const { backend, select, key } = await mountEditor();
    await publishNow();
    await waitFor(() => expect(backend.publishes()).toHaveLength(1));
    await settleAutosave();
    expect(backend.saves()).toHaveLength(0);
    await select("elB");
    await key("Delete");
    await waitFor(() => expect(backend.saves()).toHaveLength(1), AUTOSAVE_WAIT);
    const put = backend.saves()[0];
    expect(put.headers["If-Match"]).toBe(`"${SITE_ID}:document:3"`);
    expect(put.headers["Idempotency-Key"]).toMatch(/^[A-Za-z0-9._:-]{8,128}$/);
    expect(homeIds(put.body)).toEqual(["elA"]);
    for (const serverOwned of ["publishing", "deployment", "publishedData"]) expect((put.body as any).editorData).not.toHaveProperty(serverOwned);
  });

  it("a failed publish does not mark a pending edit as saved: it is still autosaved", async () => {
    // The edit's save is held unacknowledged, so the edit is provably still pending while the publish
    // fails (a point-in-time "Unsaved changes" check raced the debounce under CPU load).
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    let firstPut = true;
    const { backend, select, key } = await mountEditor(siteFixture(), [
      (r) => (r.method === "POST" && r.url.endsWith("/publish") ? { status: 500, body: { message: "Publishing service down" } } : undefined),
      (r) => (r.method === "PUT" && firstPut ? (firstPut = false, gate.then(() => ({ status: 200, body: { website: { id: SITE_ID, documentVersion: 4 } } }))) : undefined),
    ]);
    await select("elA");
    await key("Delete");
    await publishNow();
    await waitFor(() => expect(screen.getAllByText(/Publishing service down/).length).toBeGreaterThan(0));
    expect(badge()[0]).not.toMatch(SAVED_BADGE); // unsaved or saving, never "Saved"
    await act(async () => { release(); });
    await waitFor(() => expect(backend.saves()).toHaveLength(1), AUTOSAVE_WAIT);
    expect(homeIds(backend.saves()[0].body)).toEqual(["elB"]);
    await waitFor(() => expect(badge()[0]).toMatch(SAVED_BADGE));
    await new Promise((r) => setTimeout(r, 2000));
    expect(backend.saves()).toHaveLength(1);
  });

  it("a failed publish with nothing pending writes nothing", async () => {
    const { backend } = await mountEditor(siteFixture(), [
      (r) => (r.method === "POST" && r.url.endsWith("/publish") ? { status: 500, body: { message: "Publishing service down" } } : undefined),
    ]);
    await publishNow();
    await waitFor(() => expect(screen.getAllByText(/Publishing service down/).length).toBeGreaterThan(0));
    await settleAutosave();
    await flush();
    expect(backend.saves()).toHaveLength(0);
    expect(badge()).toEqual(["Saved"]);
  });
});
