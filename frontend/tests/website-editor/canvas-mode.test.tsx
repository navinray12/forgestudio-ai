// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Canvas scope switching (handleSwitchCanvasMode), characterised before core/canvasMode was extracted
 * and kept as its contract: the canvas is stored into the page (elements + settings) or site part it
 * was editing; an empty header is seeded with the default header (no isEnabled), empty single / archive
 * / 404 / search-results with their defaults and isEnabled: true, an empty footer stays empty; selection
 * is cleared and undo history starts at the loaded canvas. In page scope the canvas also shows the enabled
 * header / footer around the page.
 */
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { flush, heading, mountEditor, siteFixture } from "./editor-harness";

vi.setConfig({ testTimeout: 60000 }); // heavy real-editor mounts; generous under full-suite CPU load

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* ignore */ }
});

const site = (siteParts?: unknown) => siteFixture(siteParts ? { editorData: { pages: [{ id: "home", name: "Home", slug: "/", elements: [heading("elA", "Alpha heading"), heading("elB", "Bravo heading")] }], siteParts } } : {});
async function switchScope(label: string) {
  fireEvent.click(screen.getByRole("button", { name: "Switch Canvas Scope" }));
  await flush(2);
  fireEvent.click(screen.getAllByText(label).map((n) => n.closest("button")).find(Boolean) as HTMLButtonElement);
  await flush(4);
}
async function saved(editor: Awaited<ReturnType<typeof mountEditor>>) {
  const before = editor.backend.saves().length;
  await editor.key("s", { ctrlKey: true });
  await waitFor(() => expect(editor.backend.saves().length).toBe(before + 1));
  return (editor.backend.saves().at(-1)!.body as any).editorData;
}
const ids = (els: Array<{ id: string }> = []) => els.map((e) => e.id);

describe("handleSwitchCanvasMode", () => {
  it("keeps the page edit when switching to the header and back; the empty header gets the default header", async () => {
    const editor = await mountEditor(site());
    await editor.select("elA");
    await editor.key("Delete");
    await switchScope("Global Header");
    const headerIds = editor.canvasIds();
    expect(headerIds.length).toBeGreaterThan(0); // seeded default header
    expect(headerIds).not.toContain("elB");
    await switchScope("Page Content");
    expect(editor.canvasIds()).toEqual([...headerIds, "elB"]); // page mode renders the enabled header around the page
    const data = await saved(editor);
    expect(ids(data.pages[0].elements)).toEqual(["elB"]);
    expect(ids(data.siteParts.header.elements)[0]).toBe(headerIds[0]);
    expect(data.siteParts.header).not.toHaveProperty("isEnabled");
  });

  it("an edit made in a site-part scope is stored into that site part when switching away", async () => {
    const editor = await mountEditor(site({ header: { enabled: true, elements: [heading("hdr1", "Header one"), heading("hdr2", "Header two")] }, footer: { enabled: true, elements: [heading("ftr1", "Footer one")] } }));
    await switchScope("Global Header");
    expect(editor.canvasIds()).toEqual(["hdr1", "hdr2"]);
    await editor.select("hdr1");
    await editor.key("Delete");
    await switchScope("Global Footer");
    expect(editor.canvasIds()).toEqual(["ftr1"]);
    await switchScope("Global Header");
    expect(editor.canvasIds()).toEqual(["hdr2"]);
    await switchScope("Page Content");
    const data = await saved(editor);
    expect(ids(data.siteParts.header.elements)).toEqual(["hdr2"]);
    expect(ids(data.siteParts.footer.elements)).toEqual(["ftr1"]);
    expect(ids(data.pages[0].elements)).toEqual(["elA", "elB"]);
  });

  it("empty template scopes are seeded and enabled; an empty footer stays empty", async () => {
    const editor = await mountEditor(site());
    await switchScope("Global Footer");
    expect(editor.canvasIds()).toEqual([]);
    for (const label of ["Single Post Template", "Archive Template", "404 Not Found Page", "Search Results Layout"]) {
      await switchScope(label);
      expect(editor.canvasIds().length, label).toBeGreaterThan(0);
    }
    await switchScope("Page Content");
    const data = await saved(editor);
    for (const key of ["single", "archive", "notFound404", "searchResults"]) {
      expect(data.siteParts[key].elements.length, key).toBeGreaterThan(0);
      expect(data.siteParts[key].enabled, key).toBe(true);
    }
    expect(data.siteParts.footer.elements).toEqual([]);
  });

  it("clears the selection, and undo history starts at the loaded canvas", async () => {
    const editor = await mountEditor(site({ header: { enabled: true, elements: [heading("hdr1", "Header one")] } }));
    await editor.select("elA");
    await switchScope("Global Header");
    expect(screen.queryByRole("button", { name: "Copy Style" })).toBeNull(); // nothing selected
    await editor.key("z", { ctrlKey: true });
    expect(editor.canvasIds()).toEqual(["hdr1"]);
    await switchScope("Page Content");
    await editor.key("z", { ctrlKey: true });
    expect(editor.canvasIds()).toEqual(["hdr1", "elA", "elB"]); // header shown around the page; nothing undone
  });
});
