// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Listener lifecycle of the editor's keyboard shortcuts (captured before the useEditorShortcuts
 * extraction and kept as its contract). Other editor components register window keydown listeners
 * of their own (6 are active while mounted), so only the shortcut handler is tracked: the one whose
 * source references both setIsShortcutsHelpOpen and handleReorderElement (moved verbatim by the
 * extraction). Contract: one such listener while mounted; it is replaced
 * (removed + added) exactly when a value in the effect's dependency list changes, not on unrelated
 * renders; the replacement sees the new state; unmount removes it.
 */
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { flush, heading, mountEditor, siteFixture } from "./editor-harness";

vi.setConfig({ testTimeout: 60000 }); // heavy real-editor mounts; generous under full-suite CPU load

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* ignore */ }
});

const isShortcutHandler = (l: unknown) => typeof l === "function" && String(l).includes("setIsShortcutsHelpOpen") && String(l).includes("handleReorderElement");

function trackKeydownListeners() {
  const active = new Map<unknown, number>();
  let added = 0, removed = 0;
  const realAdd = window.addEventListener.bind(window);
  const realRemove = window.removeEventListener.bind(window);
  vi.spyOn(window, "addEventListener").mockImplementation(((t: string, l: any, o?: any) => { if (t === "keydown" && isShortcutHandler(l)) { added++; active.set(l, (active.get(l) ?? 0) + 1); } realAdd(t, l, o); }) as typeof window.addEventListener);
  vi.spyOn(window, "removeEventListener").mockImplementation(((t: string, l: any, o?: any) => { if (t === "keydown" && isShortcutHandler(l)) { removed++; active.set(l, (active.get(l) ?? 0) - 1); } realRemove(t, l, o); }) as typeof window.removeEventListener);
  return {
    activeCount: () => [...active.values()].filter((n) => n > 0).length,
    counts: () => ({ added, removed }),
  };
}

describe("keyboard shortcut listener lifecycle", () => {
  it("exactly one window keydown listener is active while the editor is mounted", async () => {
    const t = trackKeydownListeners();
    await mountEditor();
    expect(t.activeCount()).toBe(1);
  });

  it("a dependency change (selection) replaces the listener: one removed, one added, still one active", async () => {
    const t = trackKeydownListeners();
    const { select } = await mountEditor();
    const before = t.counts();
    await select("elA");
    const after = t.counts();
    expect(after.added - before.added).toBe(1);
    expect(after.removed - before.removed).toBe(1);
    expect(t.activeCount()).toBe(1);
  });

  it("a render that changes nothing in the dependency list does not re-register the listener", async () => {
    const t = trackKeydownListeners();
    await mountEditor();
    const before = t.counts();
    fireEvent.click(screen.getByTitle("Tablet View")); // device mode is not a shortcut dependency
    await flush(3);
    expect(t.counts()).toEqual(before);
    expect(t.activeCount()).toBe(1);
  });

  it("the replaced listener acts on the new state (selection made after mount)", async () => {
    const { select, key, canvasIds } = await mountEditor();
    await select("elB");
    await key("Delete");
    expect(canvasIds()).toEqual(["elA"]);
  });

  it("a selectedId-only change (breadcrumb to the parent) replaces the listener, so Delete acts on the new selection", async () => {
    // The breadcrumb on a selected child calls only setSelectedId(parent): selectedIds stays [child]
    // and nothing else in the dependency list changes. This is the one path that isolates the
    // selectedId dependency (an ordinary selection always changes selectedIds as well).
    const site = siteFixture({}, [{ id: "home", name: "Home", slug: "/", elements: [
      { id: "box", type: "container", content: "", styles: {}, layout: {}, children: [heading("inner", "Inner heading")] },
      heading("elB", "Bravo heading"),
    ] }]);
    const t = trackKeydownListeners();
    const { select, key, canvasIds } = await mountEditor(site);
    await select("inner");
    const parentCrumb = screen.getAllByRole("button").find((b) => b.textContent === "container" && b.className.includes("hover:underline"));
    expect(parentCrumb).toBeTruthy();
    const before = t.counts();
    fireEvent.click(parentCrumb!);
    await flush(3);
    expect(t.counts().added - before.added).toBe(1); // re-registered for the selectedId change alone
    await key("Delete");
    expect(canvasIds()).toEqual(["elB"]); // the parent (with its child) was deleted, not only the child
  });

  it("unmount removes the listener", async () => {
    const t = trackKeydownListeners();
    const { view } = await mountEditor();
    view.unmount();
    expect(t.activeCount()).toBe(0);
  });
});
