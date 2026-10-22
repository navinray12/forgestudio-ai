/* global describe, it, expect -- vitest globals (globals: true); declared for `eslint .` */
/**
 * handleSwitchEditingPage, handleCreateNewPage and handleQuickCreateOrSwitchPage each merged the active
 * page inline before they were changed to call buildCanonicalPages. The inline expressions are copied
 * here verbatim (from commit c47744c) and compared with the helper over every canonical-pages fixture:
 * same values, same key order, and the same object references (unmerged pages are the same objects,
 * the array is new). The non-equivalent variants (handleSwitchCanvasMode, the active-page sync
 * effect) were not changed and are not covered here.
 */
import { CANONICAL_CASES, type CanonicalInput } from "./canonical-pages.fixtures";
import { buildCanonicalPages } from "../../src/pages/editor/core/canonicalPages";

// handleCreateNewPage and handleQuickCreateOrSwitchPage (identical text in both handlers).
function inlineSnapshot({ pages, activePageId, canvasMode, elements, pageSettings }: CanonicalInput) {
  let currentPagesSnapshot = [...pages];
  if (canvasMode === "page") {
    currentPagesSnapshot = currentPagesSnapshot.map((p) =>
      p.id === activePageId
        ? {
            ...p,
            elements,
            pageSettings,
            name: pageSettings.title || p.name,
            slug: pageSettings.path || p.slug,
          }
        : p
    );
  }
  return currentPagesSnapshot;
}

// handleSwitchEditingPage: the functional setPages updater, applied only in page mode.
function inlineSwitchUpdate({ activePageId, elements, pageSettings }: CanonicalInput) {
  return (prev: any[]) =>
    prev.map((p) =>
      p.id === activePageId
        ? {
          ...p,
          elements,
          pageSettings,
          name: pageSettings.title || p.name,
          slug: pageSettings.path || p.slug,
        }
        : p
    );
}

function expectSame(actual: any[], expected: any[], input: CanonicalInput) {
  expect(actual).toEqual(expected);
  expect(actual).not.toBe(input.pages); // a new array in both
  actual.forEach((p, i) => {
    expect(Object.keys(p)).toEqual(Object.keys(expected[i])); // key order (visible in the JSON payloads)
    if (expected[i] === input.pages[i]) expect(p).toBe(input.pages[i]); // unmerged pages: same object
    else {
      expect(p).not.toBe(input.pages[i]);
      expect(p.elements).toBe(expected[i].elements); // merged: the canvas elements / settings by reference
      expect(p.pageSettings).toBe(expected[i].pageSettings);
    }
  });
}

describe("page handlers: inline merge vs buildCanonicalPages", () => {
  for (const [label, make] of CANONICAL_CASES) {
    it(`create / quick-create snapshot: ${label}`, () => {
      const input = make();
      expectSame(buildCanonicalPages(input as any), inlineSnapshot(input), input);
    });

    it(`switch-page updater (page mode only): ${label}`, () => {
      const input = make();
      if (input.canvasMode !== "page") return; // the handler does not call setPages outside page mode
      const prev = input.pages;
      expectSame(buildCanonicalPages({ ...input, pages: prev } as any), inlineSwitchUpdate(input)(prev), input);
    });
  }

  it("covers both page and non-page modes", () => {
    const modes = new Set(CANONICAL_CASES.map(([, make]) => make().canvasMode));
    expect(modes.has("page")).toBe(true);
    expect(modes.size).toBeGreaterThan(1);
  });
});
