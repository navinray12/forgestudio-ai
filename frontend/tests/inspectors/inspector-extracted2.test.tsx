// @vitest-environment jsdom
/* global describe, it, expect -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Characterization of inspectors in groups C (standalone) and D (depend only on the shared controls),
 * moved out of DynamicWidgetInspectors.tsx. inspector-extracted2.golden.json was captured once from the
 * source before the move and is never regenerated here; it pins each inspector's initial markup and,
 * per control, the exact callback calls (updateProp / updateStyle / updateLayout and the listed extra
 * callbacks) for one deterministic event. Imports go through the original public path.
 */
import * as Inspectors from "../../src/pages/editor/inspector/DynamicWidgetInspectors";
import golden from "./inspector-extracted2.golden.json";
import { EXTRACTED_GROUP_C, EXTRACTED_GROUP_D } from "./inspector-extracted2.fixtures";
import { probeInspector } from "./inspector-probe";

const g = golden as Record<string, { markup: string; trace: Array<[string, unknown[]]> }>;

describe("extracted2 golden file", () => {
  it("covers exactly the 16 cases", () => {
    expect(Object.keys(g).sort()).toEqual([...EXTRACTED_GROUP_C, ...EXTRACTED_GROUP_D].map(([name]) => name).sort());
  });
});

for (const [group, cases] of [["C", EXTRACTED_GROUP_C], ["D", EXTRACTED_GROUP_D]] as const) {
  describe(`group ${group}: markup and callbacks unchanged`, () => {
    for (const [name, comp, props, extra] of cases) {
      it(`${comp} (${name})`, () => {
        const C = (Inspectors as any)[comp];
        expect(typeof C, `${comp} exported from DynamicWidgetInspectors`).toBe("function");
        const result = probeInspector(C, props, extra);
        expect(result.markup).toBe(g[name].markup);
        expect(result.trace).toEqual(g[name].trace);
      }, 120_000);
    }
  });
}
