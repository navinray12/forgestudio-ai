// @vitest-environment jsdom
/* global describe, it, expect, beforeEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Characterization of Phase 4B renderers not covered by earlier renderer goldens, in default and
 * populated states, against renderer-extracted2.golden.json (captured once from the unmodified source,
 * never regenerated here). localStorage is cleared before every probe, as it was during capture.
 */
import * as Renderers from "../../src/pages/editor/widgets/renderers";
import golden from "./renderer-extracted2.golden.json";
import { EXTRACTED2_CASES } from "./renderer-extracted2.fixtures";
import { probeRenderer } from "./renderer-probe";

const g = golden as Record<string, any>;

beforeEach(() => localStorage.clear());

describe("renderer-extracted2 golden file", () => {
  it("covers exactly the fixture cases, all cleaning up on unmount", () => {
    expect(Object.keys(g).sort()).toEqual(EXTRACTED2_CASES.map(([n]) => n).sort());
    expect(Object.entries(g).filter(([, v]) => v.cleanup.pendingTimers || v.cleanup.leakedWindowListeners.length).map(([k]) => k)).toEqual([]);
  });
});

describe("Phase 4B renderers: markup, timers, cleanup and interactions unchanged", () => {
  for (const [name, comp, props, callbacks] of EXTRACTED2_CASES) {
    it(`${comp} (${name})`, async () => {
      const C = (Renderers as any)[comp];
      expect(typeof C, `${comp} exported from renderers`).toBe("function");
      const result = JSON.parse(JSON.stringify(await probeRenderer(C, props, callbacks)));
      expect(result).toEqual(g[name]);
    }, 120_000);
  }
});
