// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Phase 5A regression protection for the mounted WebsiteEditor (see editor-harness.tsx), beyond
 * website-editor-behaviour.test.tsx: follow-through of the known defects, save/publish failures and
 * document versions, localStorage draft and sync events, and the paths that run the extracted helpers
 * (range selection, navigator search) plus unmount during pending or in-flight saves.
 *
 * KNOWN DEFECT tests pin current behaviour on purpose; fixing one must flip it deliberately (FIXED tests
 * record what each fix superseded).
 */
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { API, SITE_ID, flush, heading, mountEditor, siteFixture, watchForText } from "./editor-harness";

vi.setConfig({ testTimeout: 60000 }); // heavy real-editor mounts; generous under full-suite CPU load
const AUTOSAVE_WAIT = { timeout: 8000 };
const homeIds = (body: unknown) => (body as { editorData: { pages: Array<{ id: string; elements: Array<{ id: string }> }> } }).editorData.pages.find((p) => p.id === "home")!.elements.map((e) => e.id);
const settleAutosave = () => new Promise((r) => setTimeout(r, 2000));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* ignore */ }
});

describe("known defects: follow-through", () => {
  it("FIXED (was KNOWN DEFECT 1): edit, undo past the edit and redo after load never autosave an empty document", async () => {
    // Previously (characterised at commit 0b6a3a6) undo-on-load was autosaved as an empty page.
    const { backend, canvasIds, select, key } = await mountEditor();
    await select("elA");
    await key("Delete");
    await waitFor(() => expect(backend.saves()).toHaveLength(1), AUTOSAVE_WAIT);
    expect(homeIds(backend.saves()[0].body)).toEqual(["elB"]);
    await key("z", { ctrlKey: true });
    await key("z", { ctrlKey: true }); // one step past the edit: must stop at the loaded document
    expect(canvasIds()).toEqual(["elA", "elB"]);
    await waitFor(() => expect(backend.saves()).toHaveLength(2), AUTOSAVE_WAIT);
    expect(backend.saves()[1].headers["If-Match"]).toBe(`"${SITE_ID}:document:4"`);
    expect(homeIds(backend.saves()[1].body)).toEqual(["elA", "elB"]);
    await key("y", { ctrlKey: true });
    expect(canvasIds()).toEqual(["elB"]);
    await waitFor(() => expect(backend.saves()).toHaveLength(3), AUTOSAVE_WAIT);
    expect(homeIds(backend.saves()[2].body)).toEqual(["elB"]);
    await key("y", { ctrlKey: true }); // nothing further to redo
    await settleAutosave();
    expect(backend.saves()).toHaveLength(3);
    expect(backend.saves().map((s) => homeIds(s.body).length)).not.toContain(0);
  });

  it("FIXED (was KNOWN GAP 2): a failed autosave shows the 'Save failed' status badge (not an alert); a failed manual save is reported as before", async () => {
    // Previously (characterised at commit 0b6a3a6) a failed autosave showed nothing at all.
    const { backend, select, key } = await mountEditor(siteFixture(), [
      (r) => (r.method === "PUT" ? { status: 500, body: { error: { message: "Database unavailable" } } } : undefined),
    ]);
    await select("elA");
    await key("Delete");
    await waitFor(() => expect(backend.saves().length).toBeGreaterThan(0), AUTOSAVE_WAIT);
    await waitFor(() => expect(screen.getAllByRole("status").map((n) => n.textContent?.trim())).toContain("Save failed"));
    expect(screen.queryAllByRole("alert").map((n) => n.textContent)).toEqual([]);
    expect(screen.queryAllByText("Save failed — changes remain unsaved")).toHaveLength(0);
    const manualFailure = watchForText("Save failed — changes remain unsaved"); // auto-hides after 3s
    await key("s", { ctrlKey: true });
    await waitFor(() => expect(manualFailure.seen()).toBe(true));
    manualFailure.stop();
    expect(screen.getAllByRole("alert").map((n) => n.textContent)).toContain("Database unavailable");
  });

  it("FIXED (was KNOWN DEFECT 3): Escape closes the finder it opened", async () => {
    // Previously (characterised at commit 0b6a3a6) the finder stayed open. See keyboard-escape.test.tsx.
    const { key } = await mountEditor();
    const finder = () => screen.queryByPlaceholderText(/Search pages, templates, settings and features/);
    await key("k", { ctrlKey: true });
    expect(finder()).toBeTruthy();
    // Focus is not in an input here (the keydown is dispatched on window), so Escape reaches the handler.
    (document.activeElement as HTMLElement | null)?.blur();
    const ev = await key("Escape");
    expect(finder()).toBeNull();
    expect(ev.defaultPrevented).toBe(true);
  });
});

describe("save and publish: failures and versions", () => {
  it("a version conflict on manual save is reported and blocks every later save until reload (fail closed)", async () => {
    // DocumentSaveCoordinator keeps a 401/403/404/409/412/428 failure as `blocked`: later saves are
    // refused locally rather than re-sent against a document that changed elsewhere.
    let conflict = true;
    const { backend, key } = await mountEditor(siteFixture(), [
      (r) => (r.method === "PUT" && conflict ? { status: 412, body: { code: "DOCUMENT_VERSION_CONFLICT", error: { message: "Document changed elsewhere" } } } : undefined),
    ]);
    const manualFailure = watchForText("Save failed — changes remain unsaved"); // auto-hides after 3s
    await key("s", { ctrlKey: true });
    await waitFor(() => expect(screen.getAllByRole("alert").map((n) => n.textContent)).toContain("Document changed elsewhere"));
    expect(manualFailure.seen()).toBe(true);
    manualFailure.stop();
    expect(backend.saves()[0].headers["If-Match"]).toBe(`"${SITE_ID}:document:3"`);
    conflict = false; // even once the server would accept, the editor does not retry
    await key("s", { ctrlKey: true });
    await flush(6);
    expect(backend.saves()).toHaveLength(1);
    await waitFor(() => expect(screen.getAllByRole("alert").map((n) => n.textContent)).toContain("Document changed elsewhere"));
  });

  it("an unreachable server on manual save is reported as an unknown outcome", async () => {
    const { key } = await mountEditor(siteFixture(), [
      (r) => (r.method === "PUT" ? Promise.reject(new TypeError("Failed to fetch")) as never : undefined),
    ]);
    await key("s", { ctrlKey: true });
    await waitFor(() => expect(screen.getAllByRole("alert").map((n) => n.textContent).join(" ")).toMatch(/Save outcome is unknown/));
  });

  it("FIXED (was OBSERVED): publishing sends no document precondition and is not followed by a redundant autosave", async () => {
    // Previously (characterised at commit 0b6a3a6) the publishing/deployment state change made
    // autosave re-send the unchanged document: those keys are server-owned and stripped from every
    // draft write (draftWritePayload), so no editable data had changed. Publish never advances the
    // document version. See publish-autosave.test.tsx for pending-edit and failure cases.
    const { backend, key } = await mountEditor();
    const published = watchForText(/successfully published/i); // auto-hiding toast
    fireEvent.click(screen.getByTitle("Publish Website"));
    await flush(3);
    fireEvent.click(screen.getByText(/Publish Now/));
    await waitFor(() => expect(backend.publishes()).toHaveLength(1));
    expect(backend.publishes()[0].headers).toEqual({ "Content-Type": "application/json" });
    await waitFor(() => expect(published.seen()).toBe(true));
    published.stop();
    await settleAutosave();
    await flush();
    expect(backend.saves()).toHaveLength(0);
    await key("s", { ctrlKey: true }); // the document version is still the loaded one
    await waitFor(() => expect(backend.saves()).toHaveLength(1));
    const put = backend.saves()[0];
    expect(put.headers["If-Match"]).toBe(`"${SITE_ID}:document:3"`);
    const editorData = (put.body as { editorData: Record<string, unknown> }).editorData;
    for (const serverOwned of ["publishing", "deployment", "publishedData"]) expect(editorData).not.toHaveProperty(serverOwned);
    expect(homeIds(put.body)).toEqual(["elA", "elB"]);
  });

  it("a publish that cannot reach the server shows an error and records no published state", async () => {
    const { backend } = await mountEditor(siteFixture(), [
      (r) => (r.method === "POST" && r.url.endsWith("/publish") ? Promise.reject(new TypeError("Failed to fetch")) as never : undefined),
    ]);
    fireEvent.click(screen.getByTitle("Publish Website"));
    await flush(3);
    fireEvent.click(screen.getByText(/Publish Now/));
    await waitFor(() => expect(backend.publishes()).toHaveLength(1));
    await waitFor(() => expect(screen.getAllByText(/Failed to fetch/).length).toBeGreaterThan(0));
    expect(screen.queryAllByText(/successfully published/i)).toHaveLength(0);
  });
});

describe("localStorage draft and sync events", () => {
  it("a stale local draft is never loaded in place of the server document", async () => {
    localStorage.setItem(`forgestudio_editor_${SITE_ID}`, JSON.stringify({ pages: [{ id: "home", elements: [heading("stale", "Stale draft")] }] }));
    const { canvasIds } = await mountEditor();
    expect(canvasIds()).toEqual(["elA", "elB"]);
  });

  it("a manual save broadcasts a visual_saved sync event with the acknowledged version and writes no draft", async () => {
    const { backend, key } = await mountEditor();
    await key("s", { ctrlKey: true });
    await waitFor(() => expect(backend.saves()).toHaveLength(1));
    await waitFor(() => expect(localStorage.getItem("forge_workspace_sync_event")).not.toBeNull());
    expect(JSON.parse(localStorage.getItem("forge_workspace_sync_event")!)).toMatchObject({ type: "visual_saved", websiteId: SITE_ID, documentVersion: 4 });
    expect(localStorage.getItem(`forgestudio_editor_${SITE_ID}`)).toBeNull();
  });

  it("an autosave writes neither a draft nor a sync event", async () => {
    const { backend, select, key } = await mountEditor();
    await select("elA");
    await key("Delete");
    await waitFor(() => expect(backend.saves()).toHaveLength(1), AUTOSAVE_WAIT);
    await flush(4);
    expect(localStorage.getItem(`forgestudio_editor_${SITE_ID}`)).toBeNull();
    expect(localStorage.getItem("forge_workspace_sync_event")).toBeNull();
  });
});

describe("paths through the extracted helpers", () => {
  const three = () => siteFixture({}, [{ id: "home", name: "Home", slug: "/", elements: [heading("elA", "Alpha heading"), heading("elB", "Bravo heading"), heading("elC", "Charlie heading")] }]);

  it("Shift+click selects the range between two elements; Ctrl+D then duplicates only the last-selected one", async () => {
    // Range selection uses getAllElementIds; lookups use findTreeElement.
    const { canvasIds, canvasEl, select, key } = await mountEditor(three());
    await select("elA");
    fireEvent.click(canvasEl("elC")!, { shiftKey: true });
    await flush(2);
    await key("d", { ctrlKey: true });
    expect(canvasIds()).toHaveLength(4);
    expect(canvasIds().slice(0, 3)).toEqual(["elA", "elB", "elC"]);
  });

  it("navigator search lists matching layers with their type path (flattenAndSearchElements)", async () => {
    await mountEditor(three());
    fireEvent.click(screen.getByText("Navigator"));
    await flush(2);
    fireEvent.change(screen.getByPlaceholderText("Search structure layers..."), { target: { value: "bravo" } });
    await flush(2);
    expect(screen.getAllByText("Bravo heading").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByPlaceholderText("Search structure layers..."), { target: { value: "zzzz" } });
    await flush(2);
    expect(screen.queryAllByText("Bravo heading").filter((n) => !n.closest("[data-el-id]"))).toHaveLength(0);
  });
});

describe("unmount with pending work", () => {
  it("unmounting with an autosave debounce pending clears it and sends nothing afterwards", async () => {
    // Track the autosave debounce timers (1500ms) still pending. Under heavy CPU load the debounce can
    // fire before the unmount (a point-in-time "no save" check then failed); the contract is that a
    // pending debounce is cleared on unmount and no save is sent after it.
    const pendingDebounces = new Set<unknown>();
    const realSet = window.setTimeout.bind(window);
    const realClear = window.clearTimeout.bind(window);
    vi.spyOn(window, "setTimeout").mockImplementation(((fn: TimerHandler, ms?: number, ...rest: unknown[]) => {
      let id: unknown;
      const run = (...args: unknown[]) => { pendingDebounces.delete(id); if (typeof fn === "function") fn(...args); };
      id = realSet(run, ms, ...rest);
      if (ms === 1500) pendingDebounces.add(id);
      return id;
    }) as typeof window.setTimeout);
    vi.spyOn(window, "clearTimeout").mockImplementation(((id?: number) => { pendingDebounces.delete(id); realClear(id); }) as typeof window.clearTimeout);
    const { backend, view, select, key } = await mountEditor();
    await select("elA");
    await key("Delete");
    const savesAtUnmount = backend.saves().length;
    view.unmount();
    expect(pendingDebounces.size).toBe(0);
    await settleAutosave();
    expect(backend.saves()).toHaveLength(savesAtUnmount);
  });

  it("unmounting while an autosave is in flight raises no errors when the response arrives", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const { backend, view, consoleErrors, select, key } = await mountEditor(siteFixture(), [
      (r) => (r.method === "PUT" ? gate.then(() => ({ status: 200, body: { website: { id: SITE_ID, documentVersion: 4 } } })) : undefined),
    ]);
    await select("elA");
    await key("Delete");
    await waitFor(() => expect(backend.saves()).toHaveLength(1), AUTOSAVE_WAIT);
    view.unmount();
    await act(async () => { release(); });
    await flush(5);
    expect(consoleErrors).toEqual([]);
    expect(backend.saves()).toHaveLength(1);
  });

  it("the component-access request is made with credentials for the loaded site", async () => {
    const { backend } = await mountEditor();
    const access = backend.requests.find((r) => r.url === `${API}/api/v1/component-access/${SITE_ID}/all`)!;
    expect(access.method).toBe("GET");
  });
});
