// @vitest-environment jsdom
/* global describe, it, expect -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Pure renderer helpers (link resolution, share URLs/actions, embed URLs, button hrefs, brand colors,
 * network icons, default loop items) against renderer-helpers.golden.json, captured once from the
 * unmodified renderers.tsx and never regenerated here.
 */
import * as Renderers from "../../src/pages/editor/widgets/renderers";
import golden from "./renderer-helpers.golden.json";
import { computeHelperResults } from "./renderer-helpers.compute";

describe("pure renderer helpers", () => {
  const actual = JSON.parse(JSON.stringify(computeHelperResults(Renderers)));
  for (const key of Object.keys(golden)) {
    it(key, () => {
      expect(actual[key]).toEqual((golden as Record<string, unknown>)[key]);
    });
  }
  it("covers the same helpers as the golden", () => {
    expect(Object.keys(actual).sort()).toEqual(Object.keys(golden).sort());
  });
});
