// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Escape closes the editor overlays (supersedes KNOWN DEFECT 3). Priority is unchanged:
 * shortcuts help, then the finder, then full-screen canvas. The finder's search input (autoFocus)
 * promises "Esc to close", so Escape typed there closes it; other inputs keep the existing rule that
 * shortcuts are ignored while typing.
 */
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { flush, mountEditor } from "./editor-harness";

vi.setConfig({ testTimeout: 60000 }); // heavy real-editor mounts; generous under full-suite CPU load

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* ignore */ }
});

const help = () => screen.queryByText("Keyboard Shortcuts");
const finderInput = () => screen.queryByPlaceholderText(/Search pages, templates, settings and features/) as HTMLInputElement | null;
const blur = () => (document.activeElement as HTMLElement | null)?.blur();

describe("Escape closes the open overlay", () => {
  it("closes the shortcuts help", async () => {
    const { key } = await mountEditor();
    await key("?");
    expect(help()).toBeTruthy();
    const ev = await key("Escape");
    expect(help()).toBeNull();
    expect(ev.defaultPrevented).toBe(true);
  });

  it("closes the finder when Escape is pressed in its focused search input", async () => {
    const { key } = await mountEditor();
    await key("k", { ctrlKey: true });
    const input = finderInput()!;
    expect(document.activeElement).toBe(input); // autoFocus
    fireEvent.change(input, { target: { value: "pages" } });
    await key("Escape", {}, input);
    expect(finderInput()).toBeNull();
  });

  it("closes the finder when focus is elsewhere", async () => {
    const { key } = await mountEditor();
    await key("k", { ctrlKey: true });
    blur();
    const ev = await key("Escape");
    expect(finderInput()).toBeNull();
    expect(ev.defaultPrevented).toBe(true);
  });

  it("keeps the existing priority: help closes before the finder", async () => {
    const { key } = await mountEditor();
    await key("k", { ctrlKey: true });
    blur();
    await key("?");
    expect([!!finderInput(), !!help()]).toEqual([true, true]);
    await key("Escape");
    expect([!!finderInput(), !!help()]).toEqual([true, false]);
    await key("Escape");
    expect([!!finderInput(), !!help()]).toEqual([false, false]);
  });

  it("an Escape with nothing open does nothing and is not prevented", async () => {
    const { key, canvasIds } = await mountEditor();
    const ev = await key("Escape");
    expect(ev.defaultPrevented).toBe(false);
    expect(canvasIds()).toEqual(["elA", "elB"]);
  });
});

describe("typing and other shortcuts are unaffected", () => {
  it("typing '?' or Delete in the finder input neither opens help nor deletes the selection", async () => {
    const { key, select, canvasIds } = await mountEditor();
    await select("elA");
    await key("k", { ctrlKey: true });
    const input = finderInput()!;
    await key("?", {}, input);
    await key("Delete", {}, input);
    expect(help()).toBeNull();
    expect(canvasIds()).toEqual(["elA", "elB"]);
    expect(finderInput()).toBeTruthy();
  });

  it("Escape in an ordinary input is still ignored by the editor shortcuts", async () => {
    const { key } = await mountEditor();
    await key("?");
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    await key("Escape", {}, input);
    expect(help()).toBeTruthy(); // shortcuts (other than the finder's own input) ignore typing
    input.remove();
  });

  it("shortcuts keep working after overlays were opened and closed", async () => {
    const { key, select, canvasIds } = await mountEditor();
    await key("?");
    await key("Escape");
    await key("k", { ctrlKey: true });
    await key("Escape", {}, finderInput()!);
    await select("elA");
    await key("d", { ctrlKey: true });
    expect(canvasIds()).toHaveLength(3);
    await key("z", { ctrlKey: true });
    expect(canvasIds()).toEqual(["elA", "elB"]);
  });

  it("toggling overlays does not accumulate window keydown listeners", async () => {
    const live = new Map<unknown, number>();
    const realAdd = window.addEventListener.bind(window);
    const realRemove = window.removeEventListener.bind(window);
    vi.spyOn(window, "addEventListener").mockImplementation(((t: string, l: any, o?: any) => { if (t === "keydown") live.set(l, (live.get(l) ?? 0) + 1); realAdd(t, l, o); }) as typeof window.addEventListener);
    vi.spyOn(window, "removeEventListener").mockImplementation(((t: string, l: any, o?: any) => { if (t === "keydown") live.set(l, (live.get(l) ?? 0) - 1); realRemove(t, l, o); }) as typeof window.removeEventListener);
    const { view, key } = await mountEditor();
    const active = () => [...live.values()].filter((n) => n > 0).length;
    const baseline = active();
    for (let i = 0; i < 4; i++) {
      await key("?");
      await key("Escape");
      await key("k", { ctrlKey: true });
      blur();
      await key("Escape");
    }
    await act(async () => { await flush(2); });
    expect(active()).toBe(baseline);
    view.unmount();
    expect(active()).toBe(0);
  });
});
