// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Correct behaviour for site-part enablement (supersedes KNOWN DEFECT 4).
 *
 * Canonical meaning, taken from the existing code: a site part is shown unless explicitly disabled.
 * Draft documents (editor load/save/autosave, backend page compilers) use `enabled`; published
 * snapshots and older documents use `isEnabled`; when both are present `enabled` wins, which is how
 * the editor canvas has always resolved them. Disabled parts must stay disabled through load,
 * save, reload and publish, and on the live site; theme templates must survive reload + save.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { flush, heading, installBackend, mountEditor, siteFixture, SITE_ID } from "./editor-harness";
import PublishedSite from "../../src/pages/published/PublishedSite";

vi.setConfig({ testTimeout: 60000 }); // heavy real-editor mounts; generous under full-suite CPU load

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* ignore */ }
});

const part = (flags: Record<string, unknown>, id: string) => ({ ...flags, elements: [heading(id, `${id} content`)] });
const siteWithParts = (siteParts: Record<string, unknown>) => {
  const site = siteFixture();
  (site.editorData as any).siteParts = siteParts;
  return site;
};
type Parts = Record<string, { enabled?: boolean; isEnabled?: boolean; elements: Array<{ id: string }> }>;

async function saveAndPublish(site: unknown) {
  const m = await mountEditor(site);
  await m.key("s", { ctrlKey: true });
  await waitFor(() => expect(m.backend.saves()).toHaveLength(1));
  fireEvent.click(screen.getByTitle("Publish Website"));
  await flush(3);
  fireEvent.click(screen.getByText(/Publish Now/));
  await waitFor(() => expect(m.backend.publishes()).toHaveLength(1));
  return {
    ...m,
    saved: (m.backend.saves()[0].body as { editorData: { siteParts: Parts } }).editorData,
    published: (m.backend.publishes()[0].body as { editorData: { siteParts: Parts } }).editorData,
  };
}

describe("site-part enablement in the editor (FIXED, was KNOWN DEFECT 4)", () => {
  it("a header disabled with `enabled: false` stays off the canvas, is saved disabled and is published disabled", async () => {
    const { canvasIds, saved, published } = await saveAndPublish(siteWithParts({ header: part({ enabled: false }, "hdrEl"), footer: part({ enabled: true }, "ftrEl") }));
    expect(canvasIds()).not.toContain("hdrEl");
    expect(canvasIds()).toContain("ftrEl");
    expect(saved.siteParts.header).toMatchObject({ enabled: false });
    expect(published.siteParts.header.isEnabled).toBe(false);
    expect(published.siteParts.footer.isEnabled).toBe(true);
  });

  it("a footer disabled only by the legacy `isEnabled: false` loads disabled, saves `enabled: false` and publishes disabled", async () => {
    const { canvasIds, saved, published } = await saveAndPublish(siteWithParts({ header: part({}, "hdrEl"), footer: part({ isEnabled: false }, "ftrEl") }));
    expect(canvasIds()).toContain("hdrEl");
    expect(canvasIds()).not.toContain("ftrEl");
    expect(saved.siteParts.footer).toMatchObject({ enabled: false });
    expect(published.siteParts.footer.isEnabled).toBe(false);
    expect(saved.siteParts.header.enabled).toBe(true);
    expect(published.siteParts.header.isEnabled).toBe(true);
  });

  it("conflicting flags resolve with `enabled` winning, exactly as the editor canvas shows them", async () => {
    const { canvasIds, saved, published } = await saveAndPublish(siteWithParts({ header: part({ enabled: false, isEnabled: true }, "hdrEl"), footer: part({ enabled: true, isEnabled: false }, "ftrEl") }));
    expect(canvasIds()).not.toContain("hdrEl");
    expect(canvasIds()).toContain("ftrEl");
    expect([saved.siteParts.header.enabled, published.siteParts.header.isEnabled]).toEqual([false, false]);
    expect([saved.siteParts.footer.enabled, published.siteParts.footer.isEnabled]).toEqual([true, true]);
  });

  it("theme templates keep their elements and flags across reload, save and publish", async () => {
    const { saved, published } = await saveAndPublish(siteWithParts({
      single: part({ enabled: false }, "sglEl"), archive: part({ isEnabled: false }, "arcEl"),
      notFound404: part({ enabled: true }, "nfEl"), searchResults: part({}, "srchEl"),
    }));
    const expected = { single: ["sglEl", false], archive: ["arcEl", false], notFound404: ["nfEl", true], searchResults: ["srchEl", true] } as const;
    for (const [name, [id, on]] of Object.entries(expected)) {
      expect([saved.siteParts[name].elements.map((e) => e.id), saved.siteParts[name].enabled]).toEqual([[id], on]);
      expect([published.siteParts[name].elements.map((e) => e.id), published.siteParts[name].isEnabled]).toEqual([[id], on]);
    }
  });

  it("parts without any flag, or missing entirely, stay enabled (unchanged default)", async () => {
    const { saved, published } = await saveAndPublish(siteWithParts({ header: part({}, "hdrEl") }));
    for (const name of ["header", "footer", "single", "archive", "notFound404", "searchResults"]) {
      expect(saved.siteParts[name].enabled).toBe(true);
      expect(published.siteParts[name].isEnabled).toBe(true);
    }
    expect(saved.siteParts.footer.elements).toEqual([]);
  });

  it("a saved document reloads with the same disabled parts (save -> reload -> publish round trip)", async () => {
    const first = await saveAndPublish(siteWithParts({ header: part({ enabled: false }, "hdrEl"), single: part({ isEnabled: false }, "sglEl") }));
    const stored = { ...siteFixture(), editorData: first.saved, documentVersion: 4 };
    cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals();
    const second = await saveAndPublish(stored);
    expect(second.canvasIds()).not.toContain("hdrEl");
    expect(second.saved.siteParts.header.enabled).toBe(false);
    expect(second.saved.siteParts.single).toMatchObject({ enabled: false });
    expect(second.saved.siteParts.single.elements.map((e) => e.id)).toEqual(["sglEl"]);
    expect([second.published.siteParts.header.isEnabled, second.published.siteParts.single.isEnabled]).toEqual([false, false]);
  });
});

describe("site-part enablement on the published site", () => {
  async function renderLive(siteParts: Record<string, unknown>) {
    const pages = [{ id: "home", name: "Home", slug: "/", isHome: true, elements: [heading("bodyEl", "Body content")] }];
    const site = { id: SITE_ID, name: "Live", editorData: { publishedData: { version: 7, pages, homePageId: "home", elements: pages[0].elements, siteParts } } };
    installBackend(site, [(r) => (r.url.endsWith(`/api/v1/websites/public/${SITE_ID}`) ? { status: 200, body: { website: site } } : undefined)]);
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<MemoryRouter initialEntries={[`/site/${SITE_ID}`]}><Routes><Route path="/site/:websiteId" element={<PublishedSite />} /></Routes></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByText("Body content").length).toBeGreaterThan(0));
    await flush(3);
  }
  const shown = (text: string) => screen.queryAllByText(text).length > 0;

  it("hides a header disabled with `enabled: false` and a footer disabled with `isEnabled: false`", async () => {
    await renderLive({ header: part({ enabled: false }, "hdrEl"), footer: part({ isEnabled: false }, "ftrEl") });
    expect([shown("hdrEl content"), shown("ftrEl content")]).toEqual([false, false]);
  });

  it("shows parts that are enabled by either spelling or carry no flag; `enabled` wins a conflict", async () => {
    await renderLive({ header: part({ isEnabled: true }, "hdrEl"), footer: part({}, "ftrEl") });
    expect([shown("hdrEl content"), shown("ftrEl content")]).toEqual([true, true]);
    cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals();
    await renderLive({ header: part({ enabled: false, isEnabled: true }, "hdrEl"), footer: part({ enabled: true, isEnabled: false }, "ftrEl") });
    expect([shown("hdrEl content"), shown("ftrEl content")]).toEqual([false, true]);
  });
});
