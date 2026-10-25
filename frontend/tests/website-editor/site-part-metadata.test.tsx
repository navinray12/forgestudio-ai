// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Site-part metadata preservation. SitePartSection declares `conditions` (display rules read by the
 * editor canvas and the backend static compiler through matchesThemeCondition) and `customCss`.
 * Neither is edited by the editor UI; both arrive in stored documents and must survive load, edit,
 * save, reload and publish unchanged. Parts without them must serialise exactly as before.
 *
 * Pre-fix behaviour (commit 1c4e0d8): loadSiteParts kept only { enabled, elements } and the save /
 * publish builders wrote only { enabled | isEnabled, elements }, so both fields were dropped.
 */
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { flush, heading, mountEditor, siteFixture } from "./editor-harness";
import { buildPublishDraftSnapshot, buildSavePayload } from "../../src/pages/editor/core/documentPayloads";
import { loadSiteParts } from "../../src/pages/editor/core/siteParts";
import { CANVAS_MODES, makeState } from "./editor-payloads.fixtures";

vi.setConfig({ testTimeout: 60000 }); // heavy real-editor mounts; generous under full-suite CPU load
const AUTOSAVE_WAIT = { timeout: 8000 };
const PARTS = ["header", "footer", "single", "archive", "notFound404", "searchResults"] as const;
const MODE_OF: Record<string, string> = { header: "header", footer: "footer", single: "single", archive: "archive", notFound404: "404", searchResults: "search-results" };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* ignore */ }
});

const meta = (name: string) => ({ conditions: [`include:page:${name}`, "exclude:singular:home"], customCss: `.${name} { color: red; }` });
const partsWithMeta = () => Object.fromEntries(PARTS.map((name, i) => [name, {
  ...(i % 2 ? { isEnabled: false } : { enabled: true }),
  ...meta(name),
  elements: [heading(`${name}El`, `${name} content`)],
}]));

describe("builders and loader keep declared site-part metadata", () => {
  it("loadSiteParts keeps conditions and customCss for every part, and omits them when absent", () => {
    const loaded = loadSiteParts(partsWithMeta()) as Record<string, any>;
    for (const name of PARTS) expect(loaded[name]).toEqual({ enabled: expect.any(Boolean), elements: expect.any(Array), ...meta(name) });
    expect(loadSiteParts({ header: { enabled: true, elements: [] } })).toEqual({ header: { enabled: true, elements: [] }, footer: { enabled: true, elements: [] } });
  });

  it("save and publish payloads keep conditions and customCss in every canvas mode", () => {
    for (const mode of CANVAS_MODES) {
      const state = makeState({ canvasMode: mode, siteParts: partsWithMeta() });
      const save = buildSavePayload(state as any).payload.editorData.siteParts as Record<string, any>;
      const pub = (buildPublishDraftSnapshot(state as any) as any).siteParts as Record<string, any>;
      for (const name of PARTS) {
        expect(save[name], `${mode} save ${name}`).toMatchObject(meta(name));
        expect(pub[name], `${mode} publish ${name}`).toMatchObject(meta(name));
        expect(Object.keys(save[name])).toEqual(["enabled", "elements", "conditions", "customCss"]);
        expect(Object.keys(pub[name])).toEqual(["isEnabled", "elements", "conditions", "customCss"]);
      }
      if (MODE_OF.header === mode) expect(save.header.elements).toBe(state.elements); // canvas content + stored metadata
    }
  });

  it("parts without metadata serialise exactly as before (older documents)", () => {
    const state = makeState({ siteParts: { header: { enabled: false, elements: [] }, footer: { isEnabled: true, elements: [] } } });
    const save = buildSavePayload(state as any).payload.editorData.siteParts as Record<string, any>;
    const pub = (buildPublishDraftSnapshot(state as any) as any).siteParts as Record<string, any>;
    for (const name of PARTS) {
      expect(Object.keys(save[name])).toEqual(["enabled", "elements"]);
      expect(Object.keys(pub[name])).toEqual(["isEnabled", "elements"]);
    }
  });

  it("empty values are preserved as stored, not dropped or rewritten", () => {
    const state = makeState({ siteParts: { header: { conditions: [], customCss: "", elements: [] } } });
    const save = buildSavePayload(state as any).payload.editorData.siteParts as Record<string, any>;
    expect(save.header).toEqual({ enabled: true, elements: [], conditions: [], customCss: "" });
  });
});

describe("metadata through the mounted editor", () => {
  const site = () => { const s = siteFixture(); (s.editorData as any).siteParts = partsWithMeta(); return s; };

  async function publish(m: Awaited<ReturnType<typeof mountEditor>>) {
    fireEvent.click(screen.getByTitle("Publish Website"));
    await flush(3);
    fireEvent.click(screen.getByText(/Publish Now/));
    await waitFor(() => expect(m.backend.publishes()).toHaveLength(1));
    return (m.backend.publishes()[0].body as any).editorData.siteParts as Record<string, any>;
  }

  it("load -> page edit -> autosave -> publish keeps every part's metadata", async () => {
    const m = await mountEditor(site());
    await m.select("elA");
    await m.key("Delete");
    await waitFor(() => expect(m.backend.saves()).toHaveLength(1), AUTOSAVE_WAIT);
    const saved = (m.backend.saves()[0].body as any).editorData.siteParts as Record<string, any>;
    const published = await publish(m);
    for (const name of PARTS) {
      expect(saved[name]).toMatchObject({ ...meta(name), elements: [{ id: `${name}El` }] });
      expect(published[name]).toMatchObject({ ...meta(name), elements: [{ id: `${name}El` }] });
    }
  });

  it("editing the header's own content in header scope keeps its conditions and customCss", async () => {
    const m = await mountEditor(site());
    fireEvent.click(screen.getByLabelText("Switch Canvas Scope"));
    await flush(2);
    fireEvent.click(screen.getByText("Global Header"));
    await flush(3);
    expect(m.canvasIds()).toContain("headerEl");
    await m.select("headerEl");
    await m.key("Delete");
    // Switching scope may itself be autosaved first (timing-dependent), so wait for the save that
    // carries the deletion, and require the metadata on every save, not just that one.
    const headers = () => m.backend.saves().map((s) => (s.body as any).editorData.siteParts.header);
    await waitFor(() => expect(headers().some((h) => h.elements.length === 0)).toBe(true), AUTOSAVE_WAIT);
    expect(headers().find((h) => h.elements.length === 0)).toEqual({ enabled: true, elements: [], ...meta("header") });
    for (const h of headers()) expect(h).toMatchObject(meta("header"));
  });

  it("save -> reload -> save keeps the metadata (round trip)", async () => {
    const first = await mountEditor(site());
    await first.key("s", { ctrlKey: true });
    await waitFor(() => expect(first.backend.saves()).toHaveLength(1));
    const stored = { ...siteFixture(), documentVersion: 4, editorData: (first.backend.saves()[0].body as any).editorData };
    cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals();
    const second = await mountEditor(stored);
    await second.key("s", { ctrlKey: true });
    await waitFor(() => expect(second.backend.saves()).toHaveLength(1));
    const parts = (second.backend.saves()[0].body as any).editorData.siteParts as Record<string, any>;
    for (const name of PARTS) expect(parts[name]).toMatchObject(meta(name));
  });
});
