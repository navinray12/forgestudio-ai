// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Phase 7B: dropping onto the canvas and reordering by drag, in the real WebsiteEditor (editor-harness:
 * mocked backend, no database).
 *
 * HTML5 drag events carry one shared dataTransfer object, as a browser does. jsdom has no layout, so the
 * drop target's getBoundingClientRect is stubbed (top 100, height 40): a pointer in its upper half drops
 * "before", the lower half "after", which is the editor's own rule (handleDragOverElement).
 * Persistence is checked through the document the next manual save sends.
 */
import { act, cleanup, createEvent, fireEvent, screen } from "@testing-library/react";
import { flush, heading, mountEditor, siteFixture } from "./editor-harness";

vi.setConfig({ testTimeout: 60000 }); // heavy real-editor mounts

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* ignore */ }
});

const site = () => siteFixture({}, [{ id: "home", name: "Home", slug: "/", elements: [heading("elA", "Alpha"), heading("elB", "Bravo"), heading("elC", "Charlie")] }]);
const homeIds = (body: unknown) => (body as any).editorData.pages.find((p: { id: string }) => p.id === "home").elements.map((e: { id: string; type: string }) => e.id);
const homeTypes = (body: unknown) => (body as any).editorData.pages.find((p: { id: string }) => p.id === "home").elements.map((e: { type: string }) => e.type);

function transfer(initial: Record<string, string> = {}) {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    setData: (k: string, v: string) => { data[k] = v; },
    getData: (k: string) => data[k] ?? "",
    effectAllowed: "all",
    dropEffect: "none",
    types: Object.keys(data),
  };
}
function placeAt(el: HTMLElement) {
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({ top: 100, height: 40, bottom: 140, left: 0, right: 400, width: 400, x: 0, y: 100, toJSON: () => ({}) } as DOMRect);
}
/** jsdom has no DragEvent, so clientY passed in the event init is dropped; set it on the event itself. */
function fireAt(kind: "dragOver" | "drop", target: HTMLElement, dt: unknown, clientY: number) {
  const ev = createEvent[kind](target, { dataTransfer: dt });
  Object.defineProperty(ev, "clientY", { value: clientY });
  fireEvent(target, ev);
}
/** Drag source -> over target -> drop on target, with the pointer at clientY. */
async function dragOnto(source: HTMLElement | null, target: HTMLElement, clientY: number, dt = transfer()) {
  placeAt(target);
  if (source) { fireEvent.dragStart(source, { dataTransfer: dt }); await flush(2); }
  fireAt("dragOver", target, dt, clientY);
  await flush(2);
  fireAt("drop", target, dt, clientY);
  if (source) fireEvent.dragEnd(source, { dataTransfer: dt });
  await flush(4);
  return dt;
}
const savedDocument = async (editor: Awaited<ReturnType<typeof mountEditor>>) => {
  const before = editor.backend.saves().length;
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save" })); });
  await flush(10);
  const saves = editor.backend.saves();
  expect(saves.length).toBe(before + 1);
  return saves.at(-1)!.body;
};

describe("reorder by drag on the canvas", () => {
  it("dragging an element carries the move payload; dropping in the upper half of a target places it before", async () => {
    const editor = await mountEditor(site());
    const dt = await dragOnto(editor.canvasEl("elC"), editor.canvasEl("elA")!, 105);
    expect(JSON.parse(dt.data["application/json"])).toEqual({ type: "move", id: "elC" });
    expect(editor.canvasIds()).toEqual(["elC", "elA", "elB"]);
    expect(homeIds(await savedDocument(editor))).toEqual(["elC", "elA", "elB"]);
  });

  it("dropping in the lower half places it after", async () => {
    const editor = await mountEditor(site());
    await dragOnto(editor.canvasEl("elA"), editor.canvasEl("elB")!, 135);
    expect(editor.canvasIds()).toEqual(["elB", "elA", "elC"]);
    expect(homeIds(await savedDocument(editor))).toEqual(["elB", "elA", "elC"]);
  });

  it("dropping an element onto itself changes nothing", async () => {
    const editor = await mountEditor(site());
    await dragOnto(editor.canvasEl("elB"), editor.canvasEl("elB")!, 105);
    expect(editor.canvasIds()).toEqual(["elA", "elB", "elC"]);
  });

  it("the moved element is selected and the move can be undone", async () => {
    const editor = await mountEditor(site());
    await dragOnto(editor.canvasEl("elC"), editor.canvasEl("elA")!, 105);
    expect(editor.canvasIds()).toEqual(["elC", "elA", "elB"]);
    await editor.key("z", { ctrlKey: true });
    await flush(4);
    expect(editor.canvasIds()).toEqual(["elA", "elB", "elC"]);
  });
});

describe("drop a new widget from the library onto the canvas", () => {
  it("a new-widget payload dropped after an element inserts that widget there and selects it", async () => {
    const editor = await mountEditor(site());
    const dt = transfer({ "application/json": JSON.stringify({ type: "new", widgetType: "heading" }) });
    await dragOnto(null, editor.canvasEl("elA")!, 135, dt);
    const ids = editor.canvasIds();
    expect(ids).toHaveLength(4);
    expect(ids[0]).toBe("elA");
    expect(ids.slice(2)).toEqual(["elB", "elC"]);
    const saved = await savedDocument(editor);
    expect(homeIds(saved)).toEqual(ids);
    expect(homeTypes(saved)[1]).toBe("heading");
  });

  it("the text/plain fallback payload is accepted too; an unparseable payload is ignored", async () => {
    const editor = await mountEditor(site());
    await dragOnto(null, editor.canvasEl("elC")!, 135, transfer({ "text/plain": JSON.stringify({ type: "new", widgetType: "heading" }) }));
    expect(editor.canvasIds()).toHaveLength(4);
    expect(editor.canvasIds().slice(0, 3)).toEqual(["elA", "elB", "elC"]);
    await dragOnto(null, editor.canvasEl("elA")!, 105, transfer({ "application/json": "{not json" }));
    expect(editor.canvasIds()).toHaveLength(4);
  });
});
