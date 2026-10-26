/* global describe, it, expect -- vitest globals (globals: true); declared for `eslint .` */
/**
 * core/elementStyles and core/elementSelection vs the inline code they replaced in the editor's
 * updateSelectedStyle, resetSelectedStyle and handleSelectElement. The two inline bodies below are the
 * original source text, embedded verbatim (generated from it), and are run over every element state,
 * device and element shape: same values, same key order, the same object returned for a no-op reset.
 */
import { applyStyleReset, applyStyleUpdate } from "../../src/pages/editor/core/elementStyles";
import { selectionRangeIds, toggleSelectedId } from "../../src/pages/editor/core/elementSelection";

function inlineUpdate(el: any, key: any, value: any, activeElementState: any, activeDevice: any): any {
  if (activeElementState === "hover") {
    if (activeDevice === "desktop") {
      const newHoverStyles = { ...(el.hoverStyles || {}), [key]: value };
      let newResponsiveHover = el.responsiveHoverStyles;
      if (newResponsiveHover?.desktop) {
        newResponsiveHover = {
          ...newResponsiveHover,
          desktop: { ...newResponsiveHover.desktop, [key]: value },
        };
      }
      return { ...el, hoverStyles: newHoverStyles, responsiveHoverStyles: newResponsiveHover };
    } else {
      const currentDeviceObj = el.responsiveHoverStyles?.[activeDevice] || {};
      const updatedDeviceObj = { ...currentDeviceObj, [key]: value };
      return {
        ...el,
        responsiveHoverStyles: {
          ...el.responsiveHoverStyles,
          [activeDevice]: updatedDeviceObj,
        },
      };
    }
  } else {
    if (activeDevice === "desktop") {
      const newStyles = { ...el.styles, [key]: value };
      let newResponsive = el.responsiveStyles;
      if (newResponsive?.desktop) {
        newResponsive = {
          ...newResponsive,
          desktop: { ...newResponsive.desktop, [key]: value },
        };
      }
      return { ...el, styles: newStyles, responsiveStyles: newResponsive };
    } else {
      const currentDeviceObj = el.responsiveStyles?.[activeDevice] || {};
      const updatedDeviceObj = { ...currentDeviceObj, [key]: value };
      return {
        ...el,
        responsiveStyles: {
          ...el.responsiveStyles,
          [activeDevice]: updatedDeviceObj,
        },
      };
    }
  }
}
function inlineReset(el: any, key: any, activeElementState: any, activeDevice: any): any {
  if (activeElementState === "hover") {
    if (activeDevice === "desktop") {
      const newHoverStyles = { ...(el.hoverStyles || {}) };
      delete newHoverStyles[key];
      let newResponsiveHover = el.responsiveHoverStyles;
      if (newResponsiveHover?.desktop) {
        const newDesktopResp = { ...newResponsiveHover.desktop };
        delete newDesktopResp[key];
        newResponsiveHover = { ...newResponsiveHover, desktop: newDesktopResp };
      }
      return {
        ...el,
        hoverStyles: Object.keys(newHoverStyles).length > 0 ? newHoverStyles : undefined,
        responsiveHoverStyles: newResponsiveHover,
      };
    } else {
      if (!el.responsiveHoverStyles?.[activeDevice]) return el;
      const currentDeviceObj = { ...el.responsiveHoverStyles[activeDevice] };
      delete currentDeviceObj[key];
      const newResponsiveHover = {
        ...el.responsiveHoverStyles,
        [activeDevice]: currentDeviceObj,
      };
      if (Object.keys(currentDeviceObj).length === 0) {
        delete newResponsiveHover[activeDevice];
      }
      return { ...el, responsiveHoverStyles: newResponsiveHover };
    }
  } else {
    if (activeDevice === "desktop") {
      const newStyles = { ...el.styles };
      delete newStyles[key];
      let newResponsive = el.responsiveStyles;
      if (newResponsive?.desktop) {
        const newDesktopResp = { ...newResponsive.desktop };
        delete newDesktopResp[key];
        newResponsive = { ...newResponsive, desktop: newDesktopResp };
      }
      return { ...el, styles: newStyles, responsiveStyles: newResponsive };
    } else {
      if (!el.responsiveStyles?.[activeDevice]) return el;
      const currentDeviceObj = { ...el.responsiveStyles[activeDevice] };
      delete currentDeviceObj[key];
      const newResponsive = {
        ...el.responsiveStyles,
        [activeDevice]: currentDeviceObj,
      };
      if (Object.keys(currentDeviceObj).length === 0) {
        delete newResponsive[activeDevice];
      }
      return { ...el, responsiveStyles: newResponsive };
    }
  }
}

const shapes: Record<string, () => any> = {
  plain: () => ({ id: "e", type: "heading", styles: { color: "red", fontSize: "12px" } }),
  withDesktopResponsive: () => ({ id: "e", type: "heading", styles: { color: "red" }, responsiveStyles: { desktop: { color: "blue", margin: "1px" }, mobile: { color: "green" } } }),
  withHover: () => ({ id: "e", type: "heading", styles: {}, hoverStyles: { color: "pink" }, responsiveHoverStyles: { desktop: { color: "black" }, tablet: { color: "gray" } } }),
  hoverOnlyKey: () => ({ id: "e", type: "heading", styles: {}, hoverStyles: { color: "pink" } }),
  mobileOnlyKey: () => ({ id: "e", type: "heading", styles: {}, responsiveStyles: { mobile: { color: "green" } }, responsiveHoverStyles: { mobile: { color: "teal" } } }),
  bare: () => ({ id: "e", type: "heading" }),
};
const states = ["normal", "hover"], devices = ["desktop", "tablet", "mobile"], keys = ["color", "margin", "fontSize"];

describe("applyStyleUpdate / applyStyleReset equal the inline updaters", () => {
  for (const [shape, make] of Object.entries(shapes)) for (const st of states) for (const dev of devices) {
    it(`${shape}, ${st}, ${dev}`, () => {
      for (const key of keys) {
        const a = make(), b = make();
        const u1 = applyStyleUpdate(a, key as any, "X", st as any, dev as any), u2 = inlineUpdate(b, key, "X", st, dev);
        expect(JSON.stringify(u1)).toBe(JSON.stringify(u2));
        expect(Object.keys(u1)).toEqual(Object.keys(u2));
        const c = make(), d = make();
        const r1 = applyStyleReset(c, key as any, st as any, dev as any), r2 = inlineReset(d, key, st, dev);
        expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
        expect(Object.keys(r1 ?? {})).toEqual(Object.keys(r2 ?? {}));
        expect(r1 === c).toBe(r2 === d); // the same element is returned exactly when the inline code returned it
        expect(JSON.stringify(c)).toBe(JSON.stringify(make())); // the input is not mutated
      }
    });
  }
});

describe("selection helpers equal the inline expressions", () => {
  it("toggleSelectedId", () => {
    for (const [prev, id] of [[[], "a"], [["a"], "a"], [["a", "b"], "a"], [["a", "b"], "c"], [["b", "a", "c"], "a"]] as Array<[string[], string]>) {
      const isAlreadySelected = prev.includes(id);
      const inline = isAlreadySelected ? prev.filter((item) => item !== id) : [...prev, id];
      expect(toggleSelectedId(prev, id)).toEqual(inline);
    }
  });
  it("selectionRangeIds", () => {
    const all = ["a", "b", "c", "d", "e"];
    for (const [from, to] of [["a", "c"], ["d", "b"], ["c", "c"], ["x", "b"], ["a", "x"]]) {
      const startIdx = all.indexOf(from), endIdx = all.indexOf(to);
      const inline = startIdx !== -1 && endIdx !== -1 ? all.slice(Math.min(startIdx, endIdx), Math.max(startIdx, endIdx) + 1) : null;
      expect(selectionRangeIds(all, from, to)).toEqual(inline);
    }
  });
});
