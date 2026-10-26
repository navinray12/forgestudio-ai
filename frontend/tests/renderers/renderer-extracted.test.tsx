// @vitest-environment jsdom
/* global describe, it, expect -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Characterization of the Phase 4A renderers not covered by renderer-characterization (Facebook,
 * Lottie, BasicGallery, Reusable, Stripe, WooCommerce family) against renderer-extracted.golden.json,
 * captured once from the unmodified renderers.tsx and never regenerated here. Imports go through the
 * public renderers module, so this also proves import compatibility after the split.
 */
import * as Renderers from "../../src/pages/editor/widgets/renderers";
import golden from "./renderer-extracted.golden.json";
import { EXTRACTED_RENDERER_CASES } from "./renderer-extracted.fixtures";
import { probeRenderer } from "./renderer-probe";

const g = golden as Record<string, any>;

describe("renderer-extracted golden file", () => {
  it("covers exactly the fixture cases, all cleaning up on unmount", () => {
    expect(Object.keys(g).sort()).toEqual(EXTRACTED_RENDERER_CASES.map(([n]) => n).sort());
    expect(Object.entries(g).filter(([, v]) => v.cleanup.pendingTimers || v.cleanup.leakedWindowListeners.length).map(([k]) => k)).toEqual([]);
  });
});

describe("Phase 4A renderers: markup, timers, cleanup and interactions unchanged", () => {
  for (const [name, comp, props, callbacks] of EXTRACTED_RENDERER_CASES) {
    it(`${comp} (${name})`, async () => {
      const C = (Renderers as any)[comp];
      expect(typeof C, `${comp} exported from renderers`).toBe("function");
      const result = JSON.parse(JSON.stringify(await probeRenderer(C, props, callbacks)));
      expect(result).toEqual(g[name]);
    }, 120_000);
  }
});
