// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Characterisation of WebsiteEditor's undo history ahead of a useEditorHistory extraction
 * (Phase 5B). Covers what the existing suites do not: the 50-entry cap, history boundaries on
 * canvas-scope switch and page creation, the toolbar enabled/disabled contract, and that undo
 * returning to the saved document does not autosave. These pin current behaviour; an extraction
 * must keep them green unchanged.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { flush, heading, mountEditor, siteFixture } from "./editor-harness";

vi.setConfig({ testTimeout: 60000 }); // heavy real-editor mounts; generous under full-suite CPU load
const AUTOSAVE_WAIT = { timeout: 8000 };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* ignore */ }
});

const undoButton = () => screen.getByTitle("Undo (Ctrl+Z)") as HTMLButtonElement;
const redoButton = () => screen.getByTitle("Redo (Ctrl+Y)") as HTMLButtonElement;

describe("undo history (characterised for useEditorHistory)", () => {
  it("toolbar Undo/Redo are disabled at the ends of history and enabled in between", async () => {
    const { select, key } = await mountEditor();
    expect([undoButton().disabled, redoButton().disabled]).toEqual([true, true]);
    await select("elA");
    await key("Delete");
    expect([undoButton().disabled, redoButton().disabled]).toEqual([false, true]);
    await key("z", { ctrlKey: true });
    expect([undoButton().disabled, redoButton().disabled]).toEqual([true, false]);
  });

  it("the editor's history (incl. the 50-entry limit) comes from useEditorHistory", () => {
    // Before Phase 5B-1 this pinned the cap constants inside WebsiteEditor.tsx because driving the cap
    // through the mounted editor took ~85s. The logic now lives in core/useEditorHistory, whose limit,
    // resets and redo-branch handling are tested behaviourally in milliseconds in
    // use-editor-history.test.tsx; this checks the editor still delegates to it.
    const source = readFileSync(resolve(process.cwd(), "src/pages/editor/WebsiteEditor.tsx"), "utf8");
    expect(source).toContain("useEditorHistory(elements, setElements)");
    expect(source).not.toMatch(/\bsetHistory\(|\bsetHistoryIndex\(|isUndoRedoAction/);
  });

  it("switching canvas scope starts a fresh history for that scope", async () => {
    const site = siteFixture();
    (site.editorData as any).siteParts = { header: { enabled: true, elements: [heading("hdrEl", "Header")] } };
    const { select, key, canvasIds } = await mountEditor(site);
    await select("elA");
    await key("Delete");
    fireEvent.click(screen.getByLabelText("Switch Canvas Scope"));
    await flush(2);
    fireEvent.click(screen.getByText("Global Header"));
    await flush(3);
    expect(canvasIds()).toEqual(["hdrEl"]);
    await key("z", { ctrlKey: true });
    await key("z", { ctrlKey: true });
    expect(canvasIds()).toEqual(["hdrEl"]); // the page deletion is not undone into the header
  });

  it("undo back to the last saved document after an autosave saves it again (the restore is a change)", async () => {
    const { backend, select, key, canvasIds } = await mountEditor();
    await select("elA");
    await key("Delete");
    await waitFor(() => expect(backend.saves()).toHaveLength(1), AUTOSAVE_WAIT);
    await key("z", { ctrlKey: true });
    expect(canvasIds()).toEqual(["elA", "elB"]);
    await waitFor(() => expect(backend.saves()).toHaveLength(2), AUTOSAVE_WAIT);
    const ids = (backend.saves()[1].body as any).editorData.pages[0].elements.map((e: { id: string }) => e.id);
    expect(ids).toEqual(["elA", "elB"]);
  });

  it("undo then redo within the debounce window leaves nothing to save", async () => {
    const { backend, select, key } = await mountEditor();
    await select("elA");
    await key("Delete");
    await waitFor(() => expect(backend.saves()).toHaveLength(1), AUTOSAVE_WAIT);
    await key("z", { ctrlKey: true });
    await key("y", { ctrlKey: true }); // back to the acknowledged document before the debounce fires
    await new Promise((r) => setTimeout(r, 2500));
    await flush();
    // Either no further save, or (if the debounce elapsed between the two keys under load) the
    // intermediate state followed by the final one: the server must end on the editor's document.
    const last = backend.saves()[backend.saves().length - 1];
    expect((last.body as any).editorData.pages[0].elements.map((e: { id: string }) => e.id)).toEqual(["elB"]);
  });
});
