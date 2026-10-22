// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Characterisation of WebsiteEditor keyboard shortcuts ahead of a useEditorShortcuts extraction
 * (Phase 5B), for behaviour the other suites do not cover: Backspace, Alt+Arrow reordering, Escape
 * leaving full-screen (lowest overlay priority), the contentEditable typing guard, Ctrl/Cmd+K from
 * inside an input, and which shortcuts suppress the browser default (only when they act).
 */
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { flush, mountEditor } from "./editor-harness";

vi.setConfig({ testTimeout: 60000 }); // heavy real-editor mounts; generous under full-suite CPU load

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* ignore */ }
});

const finderInput = () => screen.queryByPlaceholderText(/Search pages, templates, settings and features/);
const exitFullScreen = () => screen.queryByTitle("Exit Full Screen Mode (Esc)");

describe("editing shortcuts", () => {
  it("Backspace deletes the selected element like Delete", async () => {
    const { select, key, canvasIds } = await mountEditor();
    await select("elB");
    const ev = await key("Backspace");
    expect(ev.defaultPrevented).toBe(true);
    expect(canvasIds()).toEqual(["elA"]);
  });

  it("Alt+ArrowDown / Alt+ArrowUp move the selected element and are undoable", async () => {
    const { select, key, canvasIds } = await mountEditor();
    await select("elA");
    await key("ArrowDown", { altKey: true });
    expect(canvasIds()).toEqual(["elB", "elA"]);
    await key("ArrowUp", { altKey: true });
    expect(canvasIds()).toEqual(["elA", "elB"]);
    await key("z", { ctrlKey: true });
    expect(canvasIds()).toEqual(["elB", "elA"]);
  });

  it("with nothing selected, Delete / Ctrl+D / Ctrl+C / Ctrl+V and Alt+Arrow leave the browser default alone", async () => {
    const { key, canvasIds } = await mountEditor();
    for (const [k, mods] of [["Delete", {}], ["Backspace", {}], ["d", { ctrlKey: true }], ["c", { ctrlKey: true }], ["v", { ctrlKey: true }], ["ArrowUp", { altKey: true }]] as const) {
      const ev = await key(k, mods);
      expect(ev.defaultPrevented, `${k} ${JSON.stringify(mods)}`).toBe(false);
    }
    expect(canvasIds()).toEqual(["elA", "elB"]);
  });

  it("Ctrl+S, Ctrl+P, Ctrl+Z, Ctrl+Y and ? always suppress the browser default", async () => {
    const { key } = await mountEditor();
    for (const [k, mods] of [["s", { ctrlKey: true }], ["z", { ctrlKey: true }], ["y", { ctrlKey: true }], ["p", { ctrlKey: true }], ["p", { ctrlKey: true }], ["?", {}], ["?", {}]] as const) {
      const ev = await key(k, mods);
      expect(ev.defaultPrevented, `${k} ${JSON.stringify(mods)}`).toBe(true);
    }
  });
});

describe("typing guards", () => {
  it("shortcuts are ignored while typing in a contentEditable element", async () => {
    const { select, key, canvasIds } = await mountEditor();
    await select("elA");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    Object.defineProperty(editable, "isContentEditable", { value: true }); // jsdom does not compute it
    editable.tabIndex = 0;
    document.body.appendChild(editable);
    editable.focus();
    expect(document.activeElement).toBe(editable);
    await key("Delete", {}, editable);
    await key("d", { ctrlKey: true }, editable);
    expect(canvasIds()).toEqual(["elA", "elB"]);
    editable.remove();
  });

  it("Ctrl+K toggles the finder even while typing in an ordinary input", async () => {
    const { key } = await mountEditor();
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    const ev = await key("k", { ctrlKey: true }, input);
    expect(ev.defaultPrevented).toBe(true);
    expect(finderInput()).toBeTruthy();
    input.remove();
  });
});

describe("overlay priority", () => {
  it("Escape leaves full-screen canvas when no help or finder is open", async () => {
    const { key } = await mountEditor();
    fireEvent.click(screen.getByTitle("Toggle Full Screen Canvas"));
    await flush(2);
    expect(exitFullScreen()).toBeTruthy();
    const ev = await key("Escape");
    expect(ev.defaultPrevented).toBe(true);
    expect(exitFullScreen()).toBeNull();
  });

  it("with help open over full-screen, the first Escape closes help and the second leaves full-screen", async () => {
    const { key } = await mountEditor();
    fireEvent.click(screen.getByTitle("Toggle Full Screen Canvas"));
    await flush(2);
    (document.activeElement as HTMLElement | null)?.blur();
    await key("?");
    expect(screen.queryByText("Keyboard Shortcuts")).toBeTruthy();
    await key("Escape");
    expect([!!screen.queryByText("Keyboard Shortcuts"), !!exitFullScreen()]).toEqual([false, true]);
    await key("Escape");
    expect(exitFullScreen()).toBeNull();
  });
});
