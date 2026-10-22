// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Deployment rollback (handleRollbackDeployment, reached from PublishModal's deployment history),
 * characterised before its extraction and kept as its contract: the request URL (absolute, built from
 * the editor's apiUrl) and empty body, the publishing state and toast afterwards, the modal's own
 * feedback / in-flight state / history reload (a relative URL, current behaviour), confirmation, and
 * failures. Rollback writes no local draft and no document.
 */
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { API, flush, mountEditor, siteFixture, SITE_ID, type Route_ } from "./editor-harness";
import { recordTimeline } from "./save-timeline";

vi.setConfig({ testTimeout: 60000 }); // heavy real-editor mounts; generous under full-suite CPU load
const ROLLBACK_URL = `${API}/api/websites/${SITE_ID}/deployments/dep4/rollback`;
const HISTORY_URL = `/api/websites/${SITE_ID}/deployments`; // requested by the modal without apiUrl
const ROLLED_BACK = { success: true, version: 8, publishedAt: "2026-03-01T09:00:00.000Z", deploymentId: "dep8", liveUrl: "https://live.example.test" };
const DEPLOYMENTS = [
  { id: "dep5", version: 5, status: "PUBLISHED", destinationType: "INTERNAL", createdAt: "2026-02-02T09:00:00.000Z" },
  { id: "dep4", version: 4, status: "PUBLISHED", destinationType: "INTERNAL", createdAt: "2026-02-01T09:00:00.000Z" },
];
const held = () => { let release!: () => void; const gate = new Promise<void>((r) => { release = r; }); return { gate, release: () => release() }; };
const history: Route_ = (r) => (r.method === "GET" && r.url === HISTORY_URL ? { status: 200, body: { deployments: DEPLOYMENTS } } : undefined);
const rollbackRoute = (reply: () => any): Route_ => (r) => (r.method === "POST" && r.url === ROLLBACK_URL ? reply() : undefined);
let timeline: ReturnType<typeof recordTimeline> | undefined;

afterEach(() => {
  timeline?.stop();
  timeline = undefined;
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* ignore */ }
});

async function openHistory(routes: Route_[], confirm = true) {
  timeline = recordTimeline();
  const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(confirm);
  const editor = await mountEditor(siteFixture(), [timeline.route, history, ...routes]);
  fireEvent.click(screen.getByTitle("Publish Website"));
  await waitFor(() => expect(screen.getAllByRole("button", { name: "Rollback" })).toHaveLength(2));
  return { ...editor, t: timeline, confirmSpy };
}
const rollbackTo4 = () => fireEvent.click(screen.getAllByRole("button", { name: "Rollback" })[1]);
const historyLoads = (requests: Array<{ method: string; url: string }>) => requests.filter((r) => r.method === "GET" && r.url === HISTORY_URL).length;

describe("rollback: success", () => {
  it("confirms, posts to the absolute rollback URL with no body, then marks the version published and shows the toast", async () => {
    const { backend, t, confirmSpy } = await openHistory([rollbackRoute(() => ({ status: 200, body: ROLLED_BACK }))]);
    const loadsBefore = historyLoads(backend.requests);
    const start = t.events.length;
    rollbackTo4();
    expect(confirmSpy).toHaveBeenCalledWith("Are you sure you want to rollback to deployment v4? This will create a new live deployment.");
    await waitFor(() => expect(t.since(start)).toContain("status Successfully rolled back to deployment v8!"));
    const req = backend.requests.find((r) => r.url === ROLLBACK_URL)!;
    expect(req.method).toBe("POST");
    expect(req.headers).toEqual({ "Content-Type": "application/json" });
    expect(req.body).toBeUndefined();
    const reqIndex = backend.requests.indexOf(req);
    expect(backend.requests.slice(reqIndex + 1).filter((r) => r.method !== "GET")).toEqual([]); // nothing written after it
    await waitFor(() => expect(screen.getByText("Published & Live (v8)")).toBeTruthy());
    expect(screen.getAllByText("PUBLISHED").filter((n) => n.classList.contains("font-extrabold"))).toHaveLength(1); // the publish-state label (history badges also say PUBLISHED)
    expect(screen.getAllByText("Successfully rolled back to v4!").length).toBeGreaterThan(0); // the modal's feedback
    await waitFor(() => expect(historyLoads(backend.requests)).toBe(loadsBefore + 1)); // history reloaded after the rollback
    expect(historyLoads(backend.requests.slice(0, reqIndex))).toBe(loadsBefore);
    expect(t.events.some((e) => e.startsWith("storage "))).toBe(false); // no local draft, no sync event
    expect(backend.saves()).toHaveLength(0);
    expect(backend.publishes()).toHaveLength(0);
    await waitFor(() => expect(t.events.at(-1)).toBe("status (cleared)"), { timeout: 7000 });
  });

  it("while in flight the row shows Rolling back... and is disabled; nothing is marked published", async () => {
    const h = held();
    const { backend } = await openHistory([rollbackRoute(() => h.gate.then(() => ({ status: 200, body: ROLLED_BACK })))]);
    rollbackTo4();
    await waitFor(() => expect(backend.requests.some((r) => r.url === ROLLBACK_URL)).toBe(true));
    await flush(2);
    const busy = screen.getByRole("button", { name: "Rolling back..." }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    expect(screen.getByText("DRAFT")).toBeTruthy();
    await act(async () => { h.release(); });
    await waitFor(() => expect(screen.getByText("Published & Live (v8)")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Rolling back..." })).toBeNull();
  });

  it("declining the confirmation sends nothing", async () => {
    const { backend } = await openHistory([], false);
    rollbackTo4();
    await flush(4);
    // (the modal reads WordPress rollback-targets on open; that is not a deployment rollback)
    expect(backend.requests.some((r) => /\/deployments\/[^/]+\/rollback$/.test(r.url))).toBe(false);
    expect(screen.getByText("DRAFT")).toBeTruthy();
  });
});

describe("rollback: failures", () => {
  it("a rejected rollback shows the server message in the modal and changes no publishing state", async () => {
    const { backend, t } = await openHistory([rollbackRoute(() => ({ status: 500, body: { message: "Rollback target missing" } }))]);
    const loadsBefore = historyLoads(backend.requests);
    rollbackTo4();
    await waitFor(() => expect(screen.getAllByText("Rollback target missing").length).toBeGreaterThan(0));
    expect(t.events.some((e) => /rolled back/.test(e))).toBe(false);
    expect(screen.getByText("DRAFT")).toBeTruthy();
    expect(historyLoads(backend.requests)).toBe(loadsBefore); // no reload after a failure
    await waitFor(() => expect((screen.getAllByRole("button", { name: "Rollback" })[1] as HTMLButtonElement).disabled).toBe(false));
  });

  it("CURRENT BEHAVIOUR: success: false changes no state and shows no toast, but the modal still reports success", async () => {
    const { backend, t } = await openHistory([rollbackRoute(() => ({ status: 200, body: { success: false } }))]);
    const loadsBefore = historyLoads(backend.requests);
    rollbackTo4();
    await waitFor(() => expect(screen.getAllByText("Successfully rolled back to v4!").length).toBeGreaterThan(0));
    expect(t.events.some((e) => /rolled back to deployment/.test(e))).toBe(false);
    expect(screen.getByText("DRAFT")).toBeTruthy();
    await waitFor(() => expect(historyLoads(backend.requests)).toBe(loadsBefore + 1));
  });
});
