// @vitest-environment jsdom
/* global describe, it, expect -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Characterization of the 20 independent widget inspectors (groups A and B) that are moved out of
 * DynamicWidgetInspectors.tsx into their own modules.
 *
 * For each inspector, inspector-extracted.golden.json (captured once from the unmodified source, never
 * regenerated here) pins:
 *  - the initial markup (structure, CSS classes, attributes, default values), byte-for-byte;
 *  - for every control, the exact updateProp / updateStyle / updateLayout calls (key and value) that one
 *    deterministic event produces.
 * Components are imported through the original public path, so this also proves import compatibility.
 */
import * as Inspectors from "../../src/pages/editor/inspector/DynamicWidgetInspectors";
import golden from "./inspector-extracted.golden.json";
import { EXTRACTED_GROUP_A, EXTRACTED_GROUP_B } from "./inspector-extracted.fixtures";
import { probeInspector } from "./inspector-probe";

const g = golden as Record<string, { markup: string; trace: Array<[string, unknown[]]> }>;

describe("extracted inspector golden file", () => {
  it("covers exactly the 20 cases", () => {
    expect(Object.keys(g).sort()).toEqual([...EXTRACTED_GROUP_A, ...EXTRACTED_GROUP_B].map(([name]) => name).sort());
  });
});

for (const [group, cases] of [["A", EXTRACTED_GROUP_A], ["B", EXTRACTED_GROUP_B]] as const) {
  describe(`group ${group}: markup and callbacks unchanged`, () => {
    for (const [name, comp, element] of cases) {
      it(`${comp} (${name})`, () => {
        const C = (Inspectors as any)[comp];
        expect(typeof C, `${comp} exported from DynamicWidgetInspectors`).toBe("function");
        const result = probeInspector(C, { el: element });
        expect(result.markup).toBe(g[name].markup);
        expect(result.trace).toEqual(g[name].trace);
      }, 30_000);
    }
  });
}
