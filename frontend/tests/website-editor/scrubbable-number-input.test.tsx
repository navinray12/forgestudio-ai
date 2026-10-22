// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * ScrubbableNumberInput contract (Phase 5B-2), exercised through the mounted editor.
 *
 * Before the extraction the component was declared inside WebsiteEditor's render function and
 * remounted on every editor render. That behaviour is preserved as historical evidence (the original
 * seven tests verbatim plus their passing run) in
 *   forge-backups/phase5b2-scrubbable-historical-20261019-131049/
 * The FIXED tests below are the approved corrections; each failed against the old implementation:
 * focus survives typing, identity survives unrelated editor renders, drag feedback stays visible for
 * the whole drag, and the temporary window listeners are removed on mouseup AND on unmount.
 * Unchanged: drag increments (x1, Shift x10, Alt x0.1, rounded), primary button only, min/max.
 *
 * Reached via the layout gap control of a selected container (min 0) and, for a second caller with
 * min and max, the masonry column gap (min 0, max 100).
 */
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { flush, heading, mountEditor, siteFixture } from "./editor-harness";

vi.setConfig({ testTimeout: 60000 }); // heavy real-editor mounts; generous under full-suite CPU load

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* ignore */ }
});

const HANDLE = "Drag horizontally to scrub value (Shift for 10x, Alt for 0.1x)";
const THEME_TOGGLE = "Toggle Dynamic Canvas Theme (☀️ Light / 🌙 Dark)"; // an editor render unrelated to the control
const site = (layout: Record<string, unknown> = {}) => siteFixture({}, [{ id: "home", name: "Home", slug: "/", elements: [
  { id: "box", type: "container", content: "", styles: {}, layout, children: [heading("inner", "Inner")] },
] }]);
const gapHandle = () => screen.getAllByTitle(HANDLE)[0];
const gapInput = () => gapHandle().parentElement!.querySelector("input") as HTMLInputElement;
const masonryInput = () => screen.getByText("Masonry Column Gap (px)").parentElement!.querySelector("input") as HTMLInputElement;
const masonryHandle = () => screen.getByText("Masonry Column Gap (px)").parentElement!.querySelector(`[title="${HANDLE}"]`) as HTMLElement;

async function openControl(layout?: Record<string, unknown>) {
  const m = await mountEditor(site(layout));
  await m.select("box");
  return m;
}
const mouse = async (type: "mousemove" | "mouseup", init: MouseEventInit) => {
  await act(async () => { window.dispatchEvent(new MouseEvent(type, { bubbles: true, ...init })); });
  await flush(2);
};
const unrelatedEditorRender = async () => { fireEvent.click(screen.getByTitle(THEME_TOGGLE)); await flush(3); };

function trackDragListeners() {
  const live = new Map<string, number>();
  const realAdd = window.addEventListener.bind(window);
  const realRemove = window.removeEventListener.bind(window);
  vi.spyOn(window, "addEventListener").mockImplementation(((t: string, l: any, o?: any) => { if (t === "mousemove" || t === "mouseup") live.set(t, (live.get(t) ?? 0) + 1); realAdd(t, l, o); }) as typeof window.addEventListener);
  vi.spyOn(window, "removeEventListener").mockImplementation(((t: string, l: any, o?: any) => { if (t === "mousemove" || t === "mouseup") live.set(t, (live.get(t) ?? 0) - 1); realRemove(t, l, o); }) as typeof window.removeEventListener);
  let base = { mousemove: 0, mouseup: 0 };
  return {
    mark: () => { base = { mousemove: live.get("mousemove") ?? 0, mouseup: live.get("mouseup") ?? 0 }; },
    delta: () => [(live.get("mousemove") ?? 0) - base.mousemove, (live.get("mouseup") ?? 0) - base.mouseup],
  };
}

describe("ScrubbableNumberInput: approved corrections (FIXED)", () => {
  it("FIXED: focus and the input node survive sequential keystrokes", async () => {
    const { canvasEl } = await openControl();
    const input = gapInput();
    input.focus();
    for (const value of ["1", "12", "123"]) {
      fireEvent.change(document.activeElement as HTMLInputElement, { target: { value } });
      await flush(3);
      expect(gapInput()).toBe(input);
      expect(document.activeElement).toBe(input);
    }
    expect(input.value).toBe("123");
    expect(canvasEl("box")!.style.gap).toBe("123px");
  });

  it("FIXED: the input node survives editor renders unrelated to the control", async () => {
    await openControl();
    const input = gapInput();
    await unrelatedEditorRender();
    await unrelatedEditorRender();
    expect(gapInput()).toBe(input);
  });

  it("FIXED: drag feedback stays visible for the whole drag, also across unrelated editor renders, and clears on mouseup", async () => {
    const { canvasEl } = await openControl();
    const start = Number(gapInput().value || 0);
    fireEvent.mouseDown(gapHandle(), { button: 0, clientX: 100 });
    await flush(2);
    for (const x of [104, 108]) {
      await mouse("mousemove", { clientX: x });
      expect(gapInput().className).toContain("ring-blue-500 bg-blue-50/50");
    }
    await unrelatedEditorRender(); // parent state changes mid-drag
    expect(gapInput().className).toContain("ring-blue-500 bg-blue-50/50");
    await mouse("mousemove", { clientX: 112 }); // still measured from the original start
    expect(canvasEl("box")!.style.gap).toBe(`${start + 12}px`);
    await mouse("mouseup", {});
    expect(gapInput().className).not.toContain("bg-blue-50/50");
  });

  it("FIXED: unmounting mid-drag removes the window listeners at once; later mouse events do nothing", async () => {
    const t = trackDragListeners();
    const { view, consoleErrors } = await openControl();
    t.mark();
    fireEvent.mouseDown(gapHandle(), { button: 0, clientX: 100 });
    expect(t.delta()).toEqual([1, 1]);
    view.unmount();
    expect(t.delta()).toEqual([0, 0]);
    await act(async () => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: 160 }));
      window.dispatchEvent(new MouseEvent("mouseup"));
    });
    expect(t.delta()).toEqual([0, 0]);
    expect(consoleErrors).toEqual([]); // no update attempted on the closed editor
  });
});

describe("ScrubbableNumberInput: unchanged behaviour", () => {
  it("dragging scrubs from the start value: x1, Shift x10, Alt x0.1 (rounded); mouseup ends it", async () => {
    const { canvasEl } = await openControl();
    const start = Number(gapInput().value || 0);
    fireEvent.mouseDown(gapHandle(), { button: 0, clientX: 100 });
    await flush(2);
    await mouse("mousemove", { clientX: 107 });
    expect(canvasEl("box")!.style.gap).toBe(`${start + 7}px`);
    await mouse("mousemove", { clientX: 103, shiftKey: true });
    expect(canvasEl("box")!.style.gap).toBe(`${start + 30}px`);
    await mouse("mousemove", { clientX: 140, altKey: true });
    expect(canvasEl("box")!.style.gap).toBe(`${start + 4}px`);
    await mouse("mouseup", {});
    await mouse("mousemove", { clientX: 190 });
    expect(canvasEl("box")!.style.gap).toBe(`${start + 4}px`);
  });

  it("a non-primary button does not start a drag or add listeners", async () => {
    const t = trackDragListeners();
    const { canvasEl } = await openControl();
    const before = canvasEl("box")!.style.gap;
    t.mark();
    fireEvent.mouseDown(gapHandle(), { button: 2, clientX: 100 });
    expect(t.delta()).toEqual([0, 0]);
    await mouse("mousemove", { clientX: 150 });
    expect(canvasEl("box")!.style.gap).toBe(before);
  });

  it("window listeners exist only during a drag; repeated drags do not accumulate them", async () => {
    const t = trackDragListeners();
    await openControl();
    t.mark();
    for (let i = 0; i < 3; i++) {
      expect(t.delta()).toEqual([0, 0]);
      fireEvent.mouseDown(gapHandle(), { button: 0, clientX: 100 });
      expect(t.delta()).toEqual([1, 1]);
      await mouse("mouseup", {});
    }
    expect(t.delta()).toEqual([0, 0]);
  });

  it("min is enforced while dragging (gap: min 0)", async () => {
    const { canvasEl } = await openControl();
    fireEvent.mouseDown(gapHandle(), { button: 0, clientX: 500 });
    await mouse("mousemove", { clientX: 0 });
    expect(canvasEl("box")!.style.gap).toBe("0px");
    await mouse("mouseup", {});
  });

  it("a second caller (masonry gap: min 0, max 100) keeps its contract: clamps both ends and applies typed values", async () => {
    await openControl({ layoutType: "masonry" });
    fireEvent.mouseDown(masonryHandle(), { button: 0, clientX: 100 });
    await mouse("mousemove", { clientX: 900 });
    expect(masonryInput().value).toBe("100");
    await mouse("mousemove", { clientX: -900 });
    expect(masonryInput().value).toBe("0");
    await mouse("mouseup", {});
    const input = masonryInput();
    input.focus();
    fireEvent.change(input, { target: { value: "24" } });
    await flush(3);
    expect(masonryInput().value).toBe("24");
  });
});
