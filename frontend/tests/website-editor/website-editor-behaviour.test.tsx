// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Regression foundation for the unmodified WebsiteEditor, mounted for real (see editor-harness.tsx:
 * only fetch and missing jsdom APIs are substituted). Covers the load/save/publish request contracts,
 * selection, keyboard shortcuts, undo/redo including redo-branch invalidation, autosave triggering and
 * failure, page switching, permission gating and unmount cleanup.
 */
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { API, SITE_ID, flush, heading, mountEditor, siteFixture, watchForText } from "./editor-harness";

// Each interaction re-renders the whole ~21k-line editor in jsdom (select ~0.7s, keypress ~0.35s).
vi.setConfig({ testTimeout: 60000 }); // heavy real-editor mounts; generous under full-suite CPU load
const AUTOSAVE_WAIT = { timeout: 8000 };

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* ignore */ }
});

describe("loading", () => {
  it("loads the website with credentials and renders its elements without saving", async () => {
    const { backend, canvasIds, consoleErrors } = await mountEditor();
    const load = backend.requests.find((r) => r.url === `${API}/api/websites/${SITE_ID}` && r.method === "GET");
    expect(load).toBeDefined();
    expect(backend.requests.find((r) => r.url === `${API}/api/v1/component-access/${SITE_ID}/all`)).toBeDefined();
    expect(canvasIds()).toEqual(["elA", "elB"]);
    await flush(40); // > autosave debounce would be 1500ms; loading alone must not write
    // Waited inside act(): late load responses (revisions, products) may resolve during the wait, and
    // outside act() React reports them as an un-wrapped update (seen under CPU load).
    await act(async () => { await new Promise((r) => setTimeout(r, 1700)); });
    expect(backend.saves()).toHaveLength(0);
    expect(consoleErrors).toEqual([]);
  }, 60000);

  it("an access-denied load shows the access message, renders no document and never saves", async () => {
    const { backend, canvasIds } = await mountEditor(siteFixture(), [
      (r) => (r.method === "GET" && r.url === `${API}/api/websites/${SITE_ID}` ? { status: 403, body: { message: "Forbidden" } } : undefined),
    ], { waitForLoad: false });
    await waitFor(() => expect(screen.getAllByText(/unavailable or you no longer have access/).length).toBeGreaterThan(0));
    expect(canvasIds()).toEqual([]);
    expect(backend.saves()).toHaveLength(0);
  });

  it("a response for a different website id is rejected", async () => {
    const { canvasIds } = await mountEditor(siteFixture({ id: "otherSite" }), [], { waitForLoad: false });
    await waitFor(() => expect(screen.getAllByText(/did not contain a valid access scope/).length).toBeGreaterThan(0));
    expect(canvasIds()).toEqual([]);
  });
});

describe("selection, deletion and keyboard shortcuts", () => {
  it("Delete removes only the selected element; with nothing selected it does nothing", async () => {
    const { canvasIds, select, key } = await mountEditor();
    await key("Delete");
    expect(canvasIds()).toEqual(["elA", "elB"]);
    await select("elA");
    const ev = await key("Delete");
    expect(ev.defaultPrevented).toBe(true);
    expect(canvasIds()).toEqual(["elB"]);
  });

  it("shortcuts are ignored while typing in an input", async () => {
    const { canvasIds, select, key } = await mountEditor();
    await select("elA");
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    await key("Delete", {}, input);
    expect(canvasIds()).toEqual(["elA", "elB"]);
    input.remove();
  });

  it("Ctrl+D duplicates the selected element; Ctrl+C then Ctrl+V pastes a copy", async () => {
    const { canvasIds, select, key } = await mountEditor();
    await select("elA");
    await key("d", { ctrlKey: true });
    expect(canvasIds()).toHaveLength(3);
    expect(canvasIds().slice(0, 1)).toEqual(["elA"]);
    await select("elB");
    await key("c", { ctrlKey: true });
    await key("v", { ctrlKey: true });
    expect(canvasIds()).toHaveLength(4);
    expect(canvasIds().filter((id) => id === "elB")).toHaveLength(1); // the paste carries a fresh id
  });

  it("? toggles the shortcuts help open and closed; Ctrl+K / Cmd+K toggle the finder", async () => {
    const { key } = await mountEditor();
    expect(screen.queryByText("Keyboard Shortcuts")).toBeNull();
    await key("?");
    expect(screen.getByText("Keyboard Shortcuts")).toBeTruthy();
    await key("?");
    expect(screen.queryByText("Keyboard Shortcuts")).toBeNull();
    const finder = () => screen.queryByPlaceholderText(/Search pages, templates, settings and features/);
    expect(finder()).toBeNull();
    await key("k", { ctrlKey: true });
    expect(finder()).toBeTruthy();
    await key("k", { metaKey: true });
    expect(finder()).toBeNull();
  });

  it("FIXED (was KNOWN DEFECT 3): Escape closes the shortcuts help it opened", async () => {
    // Previously (characterised at commit 0b6a3a6) the keydown effect's dependency list omitted
    // isShortcutsHelpOpen/isFinderOpen, so the handler saw stale values. See keyboard-escape.test.tsx.
    const { key } = await mountEditor();
    await key("?");
    const ev = await key("Escape");
    expect(screen.queryByText("Keyboard Shortcuts")).toBeNull();
    expect(ev.defaultPrevented).toBe(true);
  });

  it("Ctrl+P switches to preview, where clicks no longer select elements", async () => {
    const { canvasIds, canvasEl, key } = await mountEditor();
    await key("p", { ctrlKey: true });
    // Preview mode does not render the editor's selection wrappers around elements.
    fireEvent.click(canvasEl("elA") ?? document.body);
    await key("Delete");
    expect(screen.getAllByText("Alpha heading").length).toBeGreaterThan(0);
    await key("p", { ctrlKey: true });
    expect(canvasIds()).toEqual(["elA", "elB"]);
  });
});

describe("undo / redo history", () => {
  it("Ctrl+Z restores a deletion, Ctrl+Y and Ctrl+Shift+Z redo it", async () => {
    const { canvasIds, select, key } = await mountEditor();
    await select("elA");
    await key("Delete");
    expect(canvasIds()).toEqual(["elB"]);
    await key("z", { ctrlKey: true });
    expect(canvasIds()).toEqual(["elA", "elB"]);
    await key("y", { ctrlKey: true });
    expect(canvasIds()).toEqual(["elB"]);
    await key("z", { metaKey: true });
    expect(canvasIds()).toEqual(["elA", "elB"]);
    await key("z", { ctrlKey: true, shiftKey: true });
    expect(canvasIds()).toEqual(["elB"]);
  });

  it("the toolbar Undo and Redo buttons drive the same history", async () => {
    const { canvasIds, select, key } = await mountEditor();
    await select("elB");
    await key("Delete");
    fireEvent.click(screen.getByTitle("Undo (Ctrl+Z)"));
    await flush(2);
    expect(canvasIds()).toEqual(["elA", "elB"]);
    fireEvent.click(screen.getByTitle("Redo (Ctrl+Y)"));
    await flush(2);
    expect(canvasIds()).toEqual(["elA"]);
  });

  it("a new edit after undo discards the redo branch", async () => {
    const { canvasIds, select, key } = await mountEditor();
    await select("elA");
    await key("Delete");
    await key("z", { ctrlKey: true });
    expect(canvasIds()).toEqual(["elA", "elB"]);
    await select("elB");
    await key("Delete");
    expect(canvasIds()).toEqual(["elA"]);
    await key("y", { ctrlKey: true }); // the undone deletion of elA must not come back
    expect(canvasIds()).toEqual(["elA"]);
    await key("z", { ctrlKey: true });
    expect(canvasIds()).toEqual(["elA", "elB"]);
  });

  it("FIXED (was KNOWN DEFECT 1): undo/redo straight after load keep the loaded document and autosave nothing", async () => {
    // Previously (characterised at commit 0b6a3a6) history held the pre-load [] state, so the first
    // undo emptied the canvas and autosave persisted the empty page. The loaded document must be
    // the start of history.
    const { backend, canvasIds, key } = await mountEditor();
    await key("z", { ctrlKey: true });
    expect(canvasIds()).toEqual(["elA", "elB"]);
    await key("z", { ctrlKey: true });
    await key("y", { ctrlKey: true });
    expect(canvasIds()).toEqual(["elA", "elB"]);
    await new Promise((r) => setTimeout(r, 2000)); // > autosave debounce
    await flush();
    expect(backend.saves()).toHaveLength(0);
  }, 60000);
});

describe("autosave and manual save", () => {
  it("an edit is autosaved once after the debounce with the versioned document-command contract", async () => {
    const { backend, select, key } = await mountEditor();
    await select("elA");
    const editDispatchedAt = Date.now();
    await key("Delete");
    await waitFor(() => expect(backend.saves()).toHaveLength(1), AUTOSAVE_WAIT);
    const put = backend.saves()[0];
    // Debounced, not immediate: the 1500ms timer can only start after the keypress, so the PUT is at
    // least that long after it. (A point-in-time "no PUT yet" check failed under CPU load once the
    // interaction itself took longer than the debounce; 1ms tolerance for timer rounding.)
    expect(put.at - editDispatchedAt).toBeGreaterThanOrEqual(1499);
    expect(put.headers["If-Match"]).toBe(`"${SITE_ID}:document:3"`);
    expect(put.headers["X-Forge-Intent"]).toBe("document-command");
    expect(put.headers["Content-Type"]).toBe("application/json");
    expect(put.headers["Idempotency-Key"]).toMatch(/^[A-Za-z0-9._:-]{8,128}$/);
    const editorData = (put.body as { editorData: { pages: Array<{ id: string; elements: Array<{ id: string }> }> } }).editorData;
    expect(editorData.pages.find((p) => p.id === "home")!.elements.map((e) => e.id)).toEqual(["elB"]);
    await new Promise((r) => setTimeout(r, 1700));
    expect(backend.saves()).toHaveLength(1); // no repeat save without a further change
  }, 60000);

  it("a second autosave uses the acknowledged version as its precondition", async () => {
    const { backend, select, key } = await mountEditor();
    await select("elA");
    await key("Delete");
    await waitFor(() => expect(backend.saves()).toHaveLength(1), AUTOSAVE_WAIT);
    await select("elB");
    await key("Delete");
    await waitFor(() => expect(backend.saves()).toHaveLength(2), AUTOSAVE_WAIT);
    expect(backend.saves()[1].headers["If-Match"]).toBe(`"${SITE_ID}:document:4"`);
    expect(backend.saves()[1].headers["Idempotency-Key"]).not.toBe(backend.saves()[0].headers["Idempotency-Key"]);
  }, 60000);

  it("FIXED (was KNOWN GAP 2): a failed autosave keeps the edit, is logged and is shown as 'Save failed'", async () => {
    // Previously (characterised at commit 0b6a3a6) the failure was only logged: AutosaveStatusIndicator
    // was imported but never rendered. See autosave-status.test.tsx for the full status behaviour.
    const { backend, canvasIds, consoleErrors, select, key } = await mountEditor(siteFixture(), [
      (r) => (r.method === "PUT" ? { status: 500, body: { error: { message: "Database unavailable" } } } : undefined),
    ]);
    await select("elA");
    await key("Delete");
    await waitFor(() => expect(backend.saves().length).toBeGreaterThan(0), AUTOSAVE_WAIT);
    await waitFor(() => expect(consoleErrors.some((e) => e.startsWith("Autosave error:"))).toBe(true), AUTOSAVE_WAIT);
    expect(consoleErrors.find((e) => e.startsWith("Autosave error:"))).toContain("Database unavailable");
    expect(canvasIds()).toEqual(["elB"]);
    await waitFor(() => expect(screen.getAllByText("Save failed").length).toBeGreaterThan(0));
  }, 60000);

  it("Ctrl+S saves immediately through the same contract", async () => {
    const { backend, key } = await mountEditor();
    await key("s", { ctrlKey: true });
    await waitFor(() => expect(backend.saves()).toHaveLength(1));
    expect(backend.saves()[0].headers["If-Match"]).toBe(`"${SITE_ID}:document:3"`);
  });

  it("a VIEWER cannot save: no autosave after an edit and Ctrl+S sends nothing", async () => {
    const { backend, select, key } = await mountEditor(siteFixture({ userPermission: "VIEWER" }));
    await key("s", { ctrlKey: true });
    if (document.querySelector('[data-el-id="elA"]')) { await select("elA"); await key("Delete"); }
    await new Promise((r) => setTimeout(r, 2000));
    await flush();
    expect(backend.saves()).toHaveLength(0);
  }, 60000);
});

describe("page switching", () => {
  const twoPages = () => siteFixture({}, [
    { id: "home", name: "Home", slug: "/", elements: [heading("elA", "Alpha heading")] },
    { id: "about", name: "About", slug: "/about", elements: [heading("elC", "Charlie heading")] },
  ]);

  async function switchTo(name: string) {
    fireEvent.click(screen.getByTitle(/Switch Active Page/));
    await flush(2);
    const option = screen.getAllByText(name).map((n) => n.closest("button")).find(Boolean) as HTMLButtonElement;
    fireEvent.click(option);
    await flush(3);
  }

  it("switching pages shows the target page and resets undo history to it", async () => {
    const { canvasIds, select, key } = await mountEditor(twoPages());
    expect(canvasIds()).toEqual(["elA"]);
    await select("elA");
    await key("Delete");
    expect(canvasIds()).toEqual([]);
    await switchTo("About");
    expect(canvasIds()).toEqual(["elC"]);
    await key("z", { ctrlKey: true }); // history belongs to the new page only
    expect(canvasIds()).toEqual(["elC"]);
    await switchTo("Home");
    expect(canvasIds()).toEqual([]); // the unsaved deletion on Home was kept when switching away
  });
});

describe("publishing", () => {
  async function publishNow() {
    fireEvent.click(screen.getByTitle("Publish Website"));
    await flush(3);
    fireEvent.click(screen.getByText(/Publish Now/));
    await flush(6);
  }

  it("Publish Now posts the working draft to the publish endpoint and reports the version", async () => {
    const { backend, select, key } = await mountEditor();
    await select("elA");
    await key("Delete");
    const published = watchForText(/successfully published/i); // auto-hiding toast
    await publishNow();
    await waitFor(() => expect(backend.publishes()).toHaveLength(1));
    const req = backend.publishes()[0];
    expect(req.headers["Content-Type"]).toBe("application/json");
    const body = req.body as { environment: string; destinationType: string; editorData: { version: number; homePageId: string; pages: Array<{ id: string; elements: Array<{ id: string }> }> } };
    expect(body.environment).toBe("PRODUCTION");
    expect(body.destinationType).toBe("INTERNAL");
    expect(body.editorData.version).toBe(1);
    expect(body.editorData.pages.find((p) => p.id === "home")!.elements.map((e) => e.id)).toEqual(["elB"]);
    await waitFor(() => expect(published.seen()).toBe(true));
    published.stop();
    // Current behaviour (characterised, not endorsed): the published draft is also written to localStorage.
    expect(JSON.parse(localStorage.getItem(`forgestudio_editor_${SITE_ID}`) ?? "null")?.pages?.[0]?.id).toBe("home");
  });

  it("a rejected publish shows the server message", async () => {
    const { backend } = await mountEditor(siteFixture(), [
      (r) => (r.method === "POST" && r.url.endsWith("/publish") ? { status: 422, body: { message: "Validation blocked publish" } } : undefined),
    ]);
    await publishNow();
    await waitFor(() => expect(backend.publishes()).toHaveLength(1));
    await waitFor(() => expect(screen.getAllByText(/Validation blocked publish/).length).toBeGreaterThan(0));
  });
});

describe("unmount cleanup", () => {
  it("removes the window keydown listeners it added", async () => {
    const balance = new Map<string, number>();
    const realAdd = window.addEventListener.bind(window);
    const realRemove = window.removeEventListener.bind(window);
    vi.spyOn(window, "addEventListener").mockImplementation(((t: string, l: any, o?: any) => { balance.set(t, (balance.get(t) ?? 0) + 1); realAdd(t, l, o); }) as typeof window.addEventListener);
    vi.spyOn(window, "removeEventListener").mockImplementation(((t: string, l: any, o?: any) => { balance.set(t, (balance.get(t) ?? 0) - 1); realRemove(t, l, o); }) as typeof window.removeEventListener);
    const { view } = await mountEditor();
    expect(balance.get("keydown") ?? 0).toBeGreaterThan(0);
    view.unmount();
    expect(balance.get("keydown") ?? 0).toBe(0);
  });

  it("unmounting during the initial load aborts the request and applies no late response", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const { backend, view, consoleErrors } = await mountEditor(siteFixture(), [
      (r) => (r.method === "GET" && r.url === `${API}/api/websites/${SITE_ID}` ? gate.then(() => ({ status: 200, body: { website: siteFixture() } })) : undefined),
    ], { waitForLoad: false });
    const isLoad = (r: { method: string; url: string }) => r.method === "GET" && r.url === `${API}/api/websites/${SITE_ID}`;
    await waitFor(() => expect(backend.requests.some(isLoad)).toBe(true));
    const load = backend.requests.find(isLoad)!;
    expect(load.signal?.aborted).toBe(false);
    view.unmount();
    expect(load.signal?.aborted).toBe(true);
    await act(async () => { release(); });
    await flush(5);
    expect(backend.requests.some((r) => r.url.includes("/component-access/"))).toBe(false);
    expect(consoleErrors).toEqual([]);
  });
});
