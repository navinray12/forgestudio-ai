// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Template elements on the canvas (handleSelectTemplate, handleUnpackTemplate), driven through the real
 * Template widget and characterised before the template tree transformations moved to
 * core/templateElements: choosing a preset records it on the element; unpacking replaces the template
 * element in place (same position, siblings untouched) with the preset's elements under fresh ids, and
 * the new root is selected (Phase 7C fix: before it, the button click reached the removed template
 * element and left nothing selected).
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

const site = () => siteFixture({}, [{ id: "home", name: "Home", slug: "/", elements: [heading("before1", "Before"), { id: "tpl1", type: "template", styles: {} }, heading("after1", "After")] }]);
async function saved(editor: Awaited<ReturnType<typeof mountEditor>>) {
  const n = editor.backend.saves().length;
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(editor.backend.saves().length).toBe(n + 1));
  return (editor.backend.saves().at(-1)!.body as any).editorData.pages[0].elements as any[];
}
const shape = (el: any): any => ({ type: el.type, children: el.children?.map(shape) });

describe("template elements", () => {
  it("choosing a preset records it on the element (preset source)", async () => {
    const editor = await mountEditor(site());
    fireEvent.click(screen.getAllByText("Hero Section")[0].closest("button")!);
    await flush(3);
    const els = await saved(editor);
    expect(els[1]).toMatchObject({ id: "tpl1", type: "template", templateSource: "preset", templatePresetName: "hero" });
    expect(els[1].templateId).toBeUndefined(); // templateId: undefined (dropped from the JSON payload)
  });

  it("unpacking replaces the template element in place with fresh ids and selects the new root", async () => {
    const editor = await mountEditor(site());
    fireEvent.click(screen.getAllByText("Hero Section")[0].closest("button")!);
    await flush(3);
    fireEvent.click(screen.getByTitle("Expand this template into editable elements"));
    await flush(3);
    const els = await saved(editor);
    expect(els).toHaveLength(3);
    expect([els[0].id, els[2].id]).toEqual(["before1", "after1"]);
    const root = els[1];
    expect(root.id).not.toBe("tpl1");
    expect(root.type).not.toBe("template");
    const ids: string[] = []; const walk = (e: any) => { ids.push(e.id); (e.children || []).forEach(walk); }; walk(root);
    expect(new Set(ids).size).toBe(ids.length); // all fresh and distinct
    expect(ids).not.toContain("tpl1");
    expect(editor.canvasIds()).not.toContain("tpl1");
    // Phase 7C: the unpack button no longer lets its click reach the removed template element, so the new
    // root the handler selects stays selected (was: nothing selected). See template-unpack-selection.test.tsx.
    expect(editor.canvasEl(root.id)!.className).toContain("border-2 border-blue-500");
    expect(screen.queryAllByPlaceholderText("Home")).toHaveLength(0); // not the no-selection inspector
    const { PRESET_SECTION_TEMPLATES } = await import("../../src/pages/editor/defaults");
    let n = 0; const fresh = PRESET_SECTION_TEMPLATES.hero.getElements(() => `g${n++}`);
    expect(shape(root)).toEqual(shape(fresh)); // the preset's element structure
  });
});
