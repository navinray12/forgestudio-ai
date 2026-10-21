// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Publish orchestration (handlePublishWebsite), characterised before its extraction and kept as its
 * contract: the request and event order (the working draft is written to localStorage BEFORE the
 * publish request, on success and on failure alike: current behaviour, not endorsed), the exact
 * payload, the publishing / deployment state shown afterwards, failures and `success: false`, the
 * in-flight state, pending edits, and unmounting with a publish in flight. Autosave interaction is in
 * publish-autosave; payload values for every canvas mode are in the editor-payloads golden.
 */
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { API, flush, mountEditor, siteFixture, SITE_ID, type Route_ } from "./editor-harness";
import { recordTimeline } from "./save-timeline";

vi.setConfig({ testTimeout: 60000 }); // heavy real-editor mounts; generous under full-suite CPU load
const PUBLISH = `POST /api/websites/${SITE_ID}/publish`;
const DRAFT_KEY = `forgestudio_editor_${SITE_ID}`;
const DRAFT_WRITE = `storage ${DRAFT_KEY}`;
const PUBLISHED_TOAST = "status Website successfully published (v7)!";
const homeIds = (editorData: any) => editorData.pages.find((p: { id: string }) => p.id === "home").elements.map((e: { id: string }) => e.id);
const held = () => { let release!: () => void; const gate = new Promise<void>((r) => { release = r; }); return { gate, release: () => release() }; };
const publishRoute = (reply: () => any): Route_ => (r) => (r.method === "POST" && r.url === `${API}/api/websites/${SITE_ID}/publish` ? reply() : undefined);
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
async function openPublishModal() {
  fireEvent.click(screen.getByTitle("Publish Website"));
  await flush(3);
}
const clickPublishNow = () => fireEvent.click(screen.getByText(/Publish Now/));
const pulseDot = () => screen.getByTitle("Publish Website").querySelector(".animate-pulse");

describe("publish: success", () => {
  it("writes the draft, then posts the exact payload, then updates the published state and shows the toast, which hides after 3.5s", async () => {
    const { backend, t } = await mountRecorded();
    await openPublishModal();
    expect(screen.getByText("DRAFT")).toBeTruthy();
    expect(screen.getByText("Not yet published")).toBeTruthy();
    expect(pulseDot()).toBeNull();
    const start = t.events.length;
    clickPublishNow();
    await waitFor(() => expect(t.since(start)).toContain(PUBLISHED_TOAST));
    expect(t.since(start).slice(0, 3)).toEqual([DRAFT_WRITE, PUBLISH, PUBLISHED_TOAST]);
    const req = backend.publishes()[0];
    expect(req.headers).toEqual({ "Content-Type": "application/json" });
    const body = req.body as any;
    expect(Object.keys(body).sort()).toEqual(["destinationType", "editorData", "environment"]);
    expect(body.environment).toBe("PRODUCTION");
    expect(body.destinationType).toBe("INTERNAL");
    expect(homeIds(body.editorData)).toEqual(["elA", "elB"]);
    expect(body.editorData).not.toHaveProperty("publishing"); // the snapshot carries no publish state
    expect(JSON.parse(localStorage.getItem(DRAFT_KEY)!)).toEqual(body.editorData); // the same snapshot, written first
    await waitFor(() => expect(screen.getByText("Published & Live (v7)")).toBeTruthy());
    expect(screen.getByText("PUBLISHED")).toBeTruthy();
    expect(screen.getAllByText(/Website successfully published to live version!/).length).toBeGreaterThan(0); // the modal's own feedback
    expect(pulseDot()).not.toBeNull();
    expect(backend.saves()).toHaveLength(0);
    await waitFor(() => expect(t.events.at(-1)).toBe("status (cleared)"), { timeout: 7000 });
    expect(t.events.filter((e) => e === PUBLISH)).toHaveLength(1);
  });

  it("while the request is in flight the modal shows Publishing... and nothing is marked published", async () => {
    const h = held();
    const { t } = await mountRecorded([publishRoute(() => h.gate.then(() => ({ status: 200, body: { success: true, version: 7, publishedAt: "2026-01-15T12:00:00.000Z", deploymentId: "deploy7", liveUrl: "https://live.example.test" } })))]);
    await openPublishModal();
    clickPublishNow();
    await waitFor(() => expect(t.events).toContain(PUBLISH));
    await flush(2);
    expect(screen.getAllByText("Publishing...").length).toBeGreaterThan(0);
    expect(t.events).toContain(DRAFT_WRITE); // already written
    expect(screen.getByText("DRAFT")).toBeTruthy();
    expect(pulseDot()).toBeNull();
    await act(async () => { h.release(); });
    await waitFor(() => expect(screen.getByText("Published & Live (v7)")).toBeTruthy());
    expect(screen.queryAllByText("Publishing...")).toHaveLength(0);
  });

  it("a second publish posts again and reports the new version", async () => {
    let version = 7;
    const { backend, t } = await mountRecorded([publishRoute(() => ({ status: 200, body: { success: true, version: version++, publishedAt: "2026-01-15T12:00:00.000Z", deploymentId: `deploy${version}`, liveUrl: "https://live.example.test" } }))]);
    await openPublishModal();
    clickPublishNow();
    await waitFor(() => expect(screen.getByText("Published & Live (v7)")).toBeTruthy());
    await waitFor(() => expect(screen.queryAllByText("Publishing...")).toHaveLength(0));
    clickPublishNow();
    await waitFor(() => expect(screen.getByText("Published & Live (v8)")).toBeTruthy());
    expect(backend.publishes()).toHaveLength(2);
    expect(t.events.filter((e) => e === DRAFT_WRITE || e === PUBLISH)).toEqual([DRAFT_WRITE, PUBLISH, DRAFT_WRITE, PUBLISH]);
    expect(t.events).toContain("status Website successfully published (v8)!");
  });
});

describe("publish: pending edits", () => {
  it("an edit inside the autosave debounce is in both the published payload and the local draft", async () => {
    const { backend, select, key } = await mountRecorded();
    await select("elA");
    await key("Delete");
    await openPublishModal();
    clickPublishNow();
    await waitFor(() => expect(backend.publishes()).toHaveLength(1));
    const editorData = (backend.publishes()[0].body as any).editorData;
    expect(homeIds(editorData)).toEqual(["elB"]);
    expect(homeIds(JSON.parse(localStorage.getItem(DRAFT_KEY)!))).toEqual(["elB"]);
  });
});

describe("publish: failures", () => {
  it("a rejected publish shows the server message and changes no published state; the draft was still written first", async () => {
    const { backend, t } = await mountRecorded([publishRoute(() => ({ status: 500, body: { message: "Publishing service down" } }))]);
    await openPublishModal();
    const start = t.events.length;
    clickPublishNow();
    await waitFor(() => expect(screen.getAllByText(/Publishing service down/).length).toBeGreaterThan(0));
    expect(t.since(start).filter((e) => e === DRAFT_WRITE || e === PUBLISH)).toEqual([DRAFT_WRITE, PUBLISH]);
    expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull(); // CURRENT BEHAVIOUR: written before the request, kept on failure
    expect(t.events.some((e) => /successfully published/.test(e))).toBe(false);
    expect(screen.getByText("DRAFT")).toBeTruthy();
    expect(screen.getByText("Not yet published")).toBeTruthy();
    expect(pulseDot()).toBeNull();
    expect(backend.saves()).toHaveLength(0);
  });

  it("a 200 response with success: false is a failure: 'Publishing failed on server.'", async () => {
    const { t } = await mountRecorded([publishRoute(() => ({ status: 200, body: { success: false } }))]);
    await openPublishModal();
    clickPublishNow();
    await waitFor(() => expect(screen.getAllByText("Publishing failed on server.").length).toBeGreaterThan(0));
    expect(t.events.some((e) => /successfully published/.test(e))).toBe(false);
    expect(screen.getByText("DRAFT")).toBeTruthy();
    expect(pulseDot()).toBeNull();
  });

  it("after a failure, publishing again succeeds normally", async () => {
    let fail = true;
    const { backend } = await mountRecorded([publishRoute(() => (fail ? (fail = false, { status: 500, body: { message: "Publishing service down" } }) : undefined))]);
    await openPublishModal();
    clickPublishNow();
    await waitFor(() => expect(screen.getAllByText(/Publishing service down/).length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.queryAllByText("Publishing...")).toHaveLength(0));
    clickPublishNow();
    await waitFor(() => expect(screen.getByText("Published & Live (v7)")).toBeTruthy());
    expect(backend.publishes()).toHaveLength(2);
  });
});

describe("publish: cleanup", () => {
  it("unmounting with a publish in flight applies nothing and raises no errors when the response arrives", async () => {
    const h = held();
    const { backend, view, consoleErrors, t } = await mountRecorded([publishRoute(() => h.gate.then(() => ({ status: 200, body: { success: true, version: 7, publishedAt: "2026-01-15T12:00:00.000Z", deploymentId: "deploy7", liveUrl: "https://live.example.test" } })))]);
    await openPublishModal();
    clickPublishNow();
    await waitFor(() => expect(backend.publishes()).toHaveLength(1));
    const errorsBefore = consoleErrors.length;
    const requestsBefore = backend.requests.length;
    view.unmount();
    await act(async () => { h.release(); });
    await new Promise((r) => setTimeout(r, 4000)); // past the 3.5s toast timer
    expect(consoleErrors.slice(errorsBefore)).toEqual([]);
    // CURRENT BEHAVIOUR: PublishModal's own continuation still reloads the deployment history (a read,
    // through publishingService.getDeployments without apiUrl, so a relative URL). No write is made.
    expect(backend.requests.slice(requestsBefore).map((r) => `${r.method} ${r.url}`)).toEqual([`GET /api/websites/${SITE_ID}/deployments`]);
    expect(t.events.some((e) => /successfully published/.test(e))).toBe(false);
  });

  it("unmounting while the success toast is showing raises no errors when its timer fires", async () => {
    const { view, consoleErrors, t } = await mountRecorded();
    await openPublishModal();
    clickPublishNow();
    await waitFor(() => expect(t.events).toContain(PUBLISHED_TOAST));
    const errorsBefore = consoleErrors.length;
    view.unmount();
    await new Promise((r) => setTimeout(r, 4000));
    expect(consoleErrors.slice(errorsBefore)).toEqual([]);
  });
});
