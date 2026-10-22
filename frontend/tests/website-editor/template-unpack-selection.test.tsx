// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Phase 7C regression test for known issue #2 (phase5b11-known-issues.md): unpacking a template selects
 * the new root element (handleUnpackTemplate), but the "Unpack to Canvas" click used to bubble to the
 * template element's own onClick, which re-selected the template's id after the element had been
 * replaced, leaving nothing selected. The unpacked root must stay selected; ordinary selection, the
 * template preset choice and undo are unaffected.
 */
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { flush, heading, mountEditor, siteFixture } from "./editor-harness";

vi.setConfig({ testTimeout: 60000 }); // heavy real-editor mounts

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* ignore */ }
});

const site = () => siteFixture({}, [{ id: "home", name: "Home", slug: "/", elements: [heading("before1", "Before"), { id: "tpl1", type: "template", styles: {} }, heading("after1", "After")] }]);
const SELECTED = "border-2 border-blue-500";
const selectedIds = () => [...document.querySelectorAll<HTMLElement>("[data-el-id]")].filter((n) => n.className.includes(SELECTED)).map((n) => n.getAttribute("data-el-id"));
const topLevelIds = (editor: Awaited<ReturnType<typeof mountEditor>>) => editor.canvasIds().filter((id) => document.querySelector(`[data-el-id="${id}"]`)!.parentElement!.closest("[data-el-id]") === null);

async function choosePresetAndUnpack(editor: Awaited<ReturnType<typeof mountEditor>>) {
  fireEvent.click(screen.getAllByText("Hero Section")[0].closest("button")!);
  await flush(3);
  fireEvent.click(screen.getByTitle("Expand this template into editable elements"));
  await flush(4);
  const top = topLevelIds(editor);
  expect(top).toHaveLength(3);
  expect([top[0], top[2]]).toEqual(["before1", "after1"]);
  expect(top[1]).not.toBe("tpl1");
  return top[1];
}

describe("template unpack selection", () => {
  it("the unpacked root is selected after Unpack to Canvas", async () => {
    const editor = await mountEditor(site());
    const root = await choosePresetAndUnpack(editor);
    expect(selectedIds()).toEqual([root]);
    expect(screen.queryAllByPlaceholderText("Page SEO description...")).toHaveLength(0); // element inspector, not page settings
  });

  it("choosing the preset keeps the template element selected (unchanged)", async () => {
    const editor = await mountEditor(site());
    await editor.select("tpl1");
    fireEvent.click(screen.getAllByText("Hero Section")[0].closest("button")!);
    await flush(3);
    expect(selectedIds()).toEqual(["tpl1"]);
  });

  it("other elements are still selected normally after an unpack", async () => {
    const editor = await mountEditor(site());
    await choosePresetAndUnpack(editor);
    await editor.select("after1");
    expect(selectedIds()).toEqual(["after1"]);
    await editor.select("before1");
    expect(selectedIds()).toEqual(["before1"]);
  });

  it("undo restores the template element; redo brings the unpacked root back", async () => {
    const editor = await mountEditor(site());
    const root = await choosePresetAndUnpack(editor);
    await editor.key("z", { ctrlKey: true });
    await flush(4);
    await waitFor(() => expect(topLevelIds(editor)).toEqual(["before1", "tpl1", "after1"]));
    await editor.key("z", { ctrlKey: true, shiftKey: true });
    await flush(4);
    await waitFor(() => expect(topLevelIds(editor)).toEqual(["before1", root, "after1"]));
  });
});
