// @vitest-environment jsdom
/* global describe, it, expect -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Characterization of representative renderers (default, populated and editor-mode states) against
 * renderer-characterization.golden.json, captured once from the unmodified renderers.tsx and never
 * regenerated here. Pins initial markup, markup after 6s of timers, post-unmount cleanup (pending
 * timers, window listeners) and, per control, callbacks, fetch / window.open / clipboard / media calls
 * and the resulting markup. Imports go through the public renderers module.
 */
import * as Renderers from "../../src/pages/editor/widgets/renderers";
import golden from "./renderer-characterization.golden.json";
import { ALL_CASES } from "./renderer.fixtures";
import { probeRenderer } from "./renderer-probe";

const g = golden as Record<string, any>;

describe("renderer golden file", () => {
  it("covers exactly the fixture cases", () => {
    expect(Object.keys(g).sort()).toEqual(ALL_CASES.map(([name]) => name).sort());
  });

  it("every captured renderer cleaned up completely on unmount (no timers, no window listeners)", () => {
    const leaks = Object.entries(g).filter(([, v]) => v.cleanup.pendingTimers !== 0 || v.cleanup.leakedWindowListeners.length !== 0).map(([k]) => k);
    expect(leaks).toEqual([]);
  });
});

describe("renderers: markup, timers, cleanup and interactions unchanged", () => {
  for (const [name, comp, props, callbacks] of ALL_CASES) {
    it(`${comp} (${name})`, async () => {
      const C = (Renderers as any)[comp];
      expect(typeof C, `${comp} exported from renderers`).toBe("function");
      const result = JSON.parse(JSON.stringify(await probeRenderer(C, props, callbacks)));
      expect(result.markup).toBe(g[name].markup);
      expect(result.tick).toBe(g[name].tick);
      expect(result.cleanup).toEqual(g[name].cleanup);
      expect(result.trace).toEqual(g[name].trace);
    }, 120_000);
  }
});
