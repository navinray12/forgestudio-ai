// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Direct tests of core/usePublishWebsite and core/useManualSave, for what the mounted-editor suites
 * (publish-flow, manual-save) cannot observe: publishedDataRef, the exact values given to each setter
 * and their order, the WORDPRESS destination, a throwing localStorage, the guard paths and non-Error
 * failures. Only fetch is substituted.
 */
import { act, renderHook } from "@testing-library/react";
import { usePublishWebsite, useRollbackDeployment, type PublishWebsiteInput } from "../../src/pages/editor/core/usePublishWebsite";
import { useManualSave, type ManualSaveInput } from "../../src/pages/editor/core/useManualSave";
import { buildPublishDraftSnapshot, buildSavePayload } from "../../src/pages/editor/core/documentPayloads";

const API_URL = "http://api.test";
const SITE = "site9";
const PUBLISHED = { success: true, version: 12, publishedAt: "2026-02-01T10:00:00.000Z", deploymentId: "dep12", liveUrl: "https://live.example.test" };

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* ignore */ }
});

function stubFetch(status: number, body: unknown, log: string[] = []) {
  const fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
    log.push(`fetch ${init.method ?? "GET"} ${url}`);
    return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

function publishInput(log: string[], overrides: Partial<PublishWebsiteInput> = {}): PublishWebsiteInput {
  const record = (name: string) => vi.fn((value: unknown) => { log.push(`${name} ${typeof value === "function" ? "(updater)" : JSON.stringify(value)}`); });
  return {
    websiteId: SITE,
    apiUrl: API_URL,
    canvasMode: "page",
    elements: [{ id: "e1", type: "heading", content: "Hello", styles: {} }] as any,
    siteParts: { header: { enabled: true, elements: [] }, footer: { enabled: false, elements: [] } } as any,
    pages: [{ id: "home", name: "Home", slug: "/", elements: [] }, { id: "about", name: "About", slug: "/about", elements: [] }] as any,
    activePageId: "home",
    pageSettings: { title: "Home", path: "/" },
    homePageId: "home",
    deployment: { provider: "static" } as any,
    breakpoints: [],
    globalSettings: { siteIdentity: { name: "Site" } },
    popups: [],
    pageCss: ".a{}",
    publishing: { status: "DRAFT", publishedVersion: 1, customFlag: true } as any,
    setPublishing: record("setPublishing") as any,
    setDeployment: record("setDeployment") as any,
    publishedDataRef: { current: { previous: true } },
    setSaveMessage: record("setSaveMessage") as any,
    ...overrides,
  };
}

function trackDraftWrites(log: string[]) {
  const real = Storage.prototype.setItem;
  return vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) { log.push(`storage ${key}`); return real.call(this, key, value); });
}

describe("usePublishWebsite", () => {
  it("writes the draft, posts, then sets publishing, deployment, publishedDataRef and the toast, in that order", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const log: string[] = [];
    const fetch = stubFetch(200, PUBLISHED, log);
    trackDraftWrites(log);
    const input = publishInput(log);
    const { result } = renderHook(() => usePublishWebsite(input));
    await act(async () => { await result.current(); });
    const snapshot = buildPublishDraftSnapshot(input);
    // The previous publishing state, with the published fields overriding it (key order as spread).
    const updatedPub = { status: "PUBLISHED", publishedVersion: 12, customFlag: true, version: 12, publishedAt: PUBLISHED.publishedAt, deploymentId: "dep12" };
    expect(log).toEqual([
      `storage forgestudio_editor_${SITE}`,
      `fetch POST ${API_URL}/api/websites/${SITE}/publish`,
      `setPublishing ${JSON.stringify(updatedPub)}`,
      "setDeployment (updater)",
      'setSaveMessage "Website successfully published (v12)!"',
    ]);
    expect(JSON.parse((fetch.mock.calls[0][1] as RequestInit).body as string)).toEqual({ editorData: JSON.parse(JSON.stringify(snapshot)), environment: "PRODUCTION", destinationType: "INTERNAL" });
    expect((fetch.mock.calls[0][1] as RequestInit).headers).toEqual({ "Content-Type": "application/json" });
    expect((fetch.mock.calls[0][1] as RequestInit).credentials).toBe("include");
    expect(JSON.parse(localStorage.getItem(`forgestudio_editor_${SITE}`)!)).toEqual(JSON.parse(JSON.stringify(snapshot)));
    expect((input.setPublishing as any).mock.calls[0][0]).toEqual(updatedPub);
    const updater = (input.setDeployment as any).mock.calls[0][0];
    expect(updater({ provider: "static", region: "eu" })).toEqual({ provider: "static", region: "eu", deployedAt: PUBLISHED.publishedAt, productionUrl: PUBLISHED.liveUrl });
    expect(input.publishedDataRef.current).toEqual({ ...snapshot, version: 12, publishing: (input.setPublishing as any).mock.calls[0][0] });
    vi.advanceTimersByTime(3499);
    expect(log.at(-1)).toBe('setSaveMessage "Website successfully published (v12)!"');
    vi.advanceTimersByTime(1);
    expect(log.at(-1)).toBe('setSaveMessage ""');
  });

  it("passes the WORDPRESS destination through", async () => {
    const fetch = stubFetch(200, PUBLISHED);
    const { result } = renderHook(() => usePublishWebsite(publishInput([])));
    await act(async () => { await result.current({ destinationType: "WORDPRESS" }); });
    expect(JSON.parse((fetch.mock.calls[0][1] as RequestInit).body as string).destinationType).toBe("WORDPRESS");
  });

  it("a rejected request propagates the server message; the draft was written and nothing else changed", async () => {
    const log: string[] = [];
    stubFetch(500, { message: "Publishing service down" }, log);
    trackDraftWrites(log);
    const input = publishInput(log);
    const { result } = renderHook(() => usePublishWebsite(input));
    await expect(result.current()).rejects.toThrow("Publishing service down");
    expect(log).toEqual([`storage forgestudio_editor_${SITE}`, `fetch POST ${API_URL}/api/websites/${SITE}/publish`]);
    expect(input.publishedDataRef.current).toEqual({ previous: true });
  });

  it("success: false is a failure and changes nothing", async () => {
    const log: string[] = [];
    stubFetch(200, { success: false }, log);
    const input = publishInput(log);
    const { result } = renderHook(() => usePublishWebsite(input));
    await expect(result.current()).rejects.toThrow("Publishing failed on server.");
    expect(log).toEqual([`fetch POST ${API_URL}/api/websites/${SITE}/publish`]);
    expect(input.publishedDataRef.current).toEqual({ previous: true });
  });

  it("a localStorage that throws does not stop the publish", async () => {
    const log: string[] = [];
    stubFetch(200, PUBLISHED, log);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("QuotaExceededError"); });
    const input = publishInput(log);
    const { result } = renderHook(() => usePublishWebsite(input));
    await act(async () => { await result.current(); });
    expect(log[0]).toBe(`fetch POST ${API_URL}/api/websites/${SITE}/publish`);
    expect(log).toContain('setSaveMessage "Website successfully published (v12)!"');
  });

  it("without a website id it does nothing", async () => {
    const log: string[] = [];
    const fetch = stubFetch(200, PUBLISHED, log);
    trackDraftWrites(log);
    const { result } = renderHook(() => usePublishWebsite(publishInput(log, { websiteId: undefined })));
    await expect(result.current()).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
    expect(log).toEqual([]);
  });

  it("returns a new function on every render, closing over that render's input (no memoisation)", async () => {
    const fetch = stubFetch(200, PUBLISHED);
    const { result, rerender } = renderHook((props: PublishWebsiteInput) => usePublishWebsite(props), { initialProps: publishInput([]) });
    const first = result.current;
    rerender(publishInput([], { pageCss: ".changed{}" }));
    expect(result.current).not.toBe(first);
    await act(async () => { await result.current(); });
    expect(JSON.parse((fetch.mock.calls[0][1] as RequestInit).body as string).editorData.pageCss).toBe(".changed{}");
  });
});

describe("useRollbackDeployment", () => {
  const rollbackInput = (log: string[], { websiteId = SITE as string | undefined } = {}) => ({
    websiteId,
    apiUrl: API_URL,
    setPublishing: vi.fn((value: unknown) => { log.push(`setPublishing ${typeof value === "function" ? "(updater)" : "value"}`); }) as any,
    setSaveMessage: vi.fn((value: string) => { log.push(`setSaveMessage ${JSON.stringify(value)}`); }),
  });

  it("posts to the apiUrl rollback endpoint, then updates publishing (keeping other fields) and shows the toast for 3.5s", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const log: string[] = [];
    const fetch = stubFetch(200, PUBLISHED, log);
    const input = rollbackInput(log);
    const { result } = renderHook(() => useRollbackDeployment(input));
    await act(async () => { await result.current("dep4"); });
    expect(log).toEqual([`fetch POST ${API_URL}/api/websites/${SITE}/deployments/dep4/rollback`, "setPublishing (updater)", 'setSaveMessage "Successfully rolled back to deployment v12!"']);
    expect((fetch.mock.calls[0][1] as RequestInit).body).toBeUndefined();
    const updater = input.setPublishing.mock.calls[0][0];
    expect(updater({ status: "DRAFT", publishedVersion: 1, customFlag: true })).toEqual({ status: "PUBLISHED", publishedVersion: 12, customFlag: true, version: 12, publishedAt: PUBLISHED.publishedAt, deploymentId: "dep12" });
    vi.advanceTimersByTime(3500);
    expect(log.at(-1)).toBe('setSaveMessage ""');
  });

  it("success: false resolves and changes nothing; a rejected request propagates its message", async () => {
    const log: string[] = [];
    stubFetch(200, { success: false }, log);
    const { result } = renderHook(() => useRollbackDeployment(rollbackInput(log)));
    await expect(result.current("dep4")).resolves.toBeUndefined();
    expect(log).toEqual([`fetch POST ${API_URL}/api/websites/${SITE}/deployments/dep4/rollback`]);
    stubFetch(500, { message: "Rollback target missing" });
    await expect(result.current("dep4")).rejects.toThrow("Rollback target missing");
  });

  it("without a website id it does nothing", async () => {
    const log: string[] = [];
    const fetch = stubFetch(200, PUBLISHED, log);
    const { result } = renderHook(() => useRollbackDeployment(rollbackInput(log, { websiteId: "" })));
    await expect(result.current("dep4")).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
    expect(log).toEqual([]);
  });
});

function saveInput(log: string[], overrides: Partial<ManualSaveInput> = {}): ManualSaveInput {
  const record = (name: string) => vi.fn((...args: unknown[]) => { log.push(`${name} ${args.length > 1 ? `(${args.length} args)` : JSON.stringify(args[0])}`); });
  return {
    websiteId: SITE,
    website: { id: SITE },
    userAccess: { canEditContent: true },
    setSaving: record("setSaving"),
    setSaveMessage: record("setSaveMessage"),
    setErrorMessage: record("setErrorMessage"),
    canvasMode: "page",
    elements: [{ id: "e1", type: "heading", content: "Hello", styles: {} }] as any,
    siteParts: { header: { enabled: true, elements: [] }, footer: { enabled: true, elements: [] } } as any,
    pages: [{ id: "home", name: "Home", slug: "/", elements: [] }] as any,
    activePageId: "home",
    pageSettings: { title: "Home", path: "/" },
    homePageId: "home",
    publishing: { status: "DRAFT", publishedVersion: 1 } as any,
    deployment: { provider: "static" } as any,
    breakpoints: [],
    globalSettings: {},
    globalVariables: [],
    globalClasses: [],
    popups: [],
    pageCss: "",
    publishedDataRef: { current: null },
    persistDocument: vi.fn(async () => { log.push("persist"); return { id: SITE, documentVersion: 4 } as any; }),
    updateAutosaveBaseline: record("updateAutosaveBaseline") as any,
    ...overrides,
  };
}

describe("useManualSave", () => {
  it("persists the save payload, then updates the baseline with the canonical page elements, then reports", async () => {
    const log: string[] = [];
    vi.stubGlobal("BroadcastChannel", class { postMessage(m: any) { log.push(`broadcast ${m.type} v${m.documentVersion}`); } close() { log.push("close"); } });
    trackDraftWrites(log);
    const input = saveInput(log);
    const { result } = renderHook(() => useManualSave(input));
    let returned: unknown;
    await act(async () => { returned = await result.current(); });
    expect(returned).toEqual({ id: SITE, documentVersion: 4 });
    expect(log).toEqual(['setSaving true', 'setSaveMessage ""', 'setErrorMessage ""', "persist", "updateAutosaveBaseline (12 args)",
      'setSaveMessage "Saved successfully!"', "broadcast visual_saved v4", "close", "storage forge_workspace_sync_event", "setSaving false"]);
    const { payload, canonicalPageElements } = buildSavePayload(input);
    expect((input.persistDocument as any).mock.calls[0]).toEqual([payload]);
    const baseline = (input.updateAutosaveBaseline as any).mock.calls[0];
    expect(baseline[0]).toBe(canonicalPageElements);
    expect(baseline.slice(1)).toEqual([input.pageSettings, payload.editorData.pages, "home", input.siteParts, input.globalSettings, undefined, input.publishing, input.deployment, [], [], ""]);
  });

  it("does nothing without a website, a loaded document or edit access", async () => {
    for (const overrides of [{ websiteId: undefined }, { website: null }, { userAccess: { canEditContent: false } }]) {
      const log: string[] = [];
      const input = saveInput(log, overrides);
      const { result } = renderHook(() => useManualSave(input));
      await expect(result.current()).resolves.toBeUndefined();
      expect(log).toEqual([]);
    }
  });

  it("a failure that is not an Error is reported generically; nothing is announced and it resolves to undefined", async () => {
    const log: string[] = [];
    trackDraftWrites(log);
    const input = saveInput(log, { persistDocument: vi.fn(async () => { log.push("persist"); throw "boom"; }) as any });
    const { result } = renderHook(() => useManualSave(input));
    await expect(result.current()).resolves.toBeUndefined();
    expect(log).toEqual(['setSaving true', 'setSaveMessage ""', 'setErrorMessage ""', "persist",
      'setSaveMessage "Save failed — changes remain unsaved"', 'setErrorMessage "The server did not confirm this save"', "setSaving false"]);
  });

  it("a missing BroadcastChannel and a throwing localStorage do not fail a confirmed save", async () => {
    const log: string[] = [];
    vi.stubGlobal("BroadcastChannel", undefined);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    const input = saveInput(log);
    const { result } = renderHook(() => useManualSave(input));
    await expect(result.current()).resolves.toEqual({ id: SITE, documentVersion: 4 });
    expect(log).toContain('setSaveMessage "Saved successfully!"');
    expect(log.at(-1)).toBe("setSaving false");
  });
});
