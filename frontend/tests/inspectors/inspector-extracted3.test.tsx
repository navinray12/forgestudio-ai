// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Characterization of the last 16 inspectors moved out of DynamicWidgetInspectors.tsx (groups E-H),
 * plus validateDisplayConditionsData and handleImageFileUpload. inspector-extracted3.golden.json was
 * captured once from the source before the move and is never regenerated here. Imports go through the
 * original public path, so this also proves import compatibility.
 */
import { act, cleanup, waitFor } from "@testing-library/react";
import * as Inspectors from "../../src/pages/editor/inspector/DynamicWidgetInspectors";
import golden from "./inspector-extracted3.golden.json";
import { EXTRACTED_GROUP_E, EXTRACTED_GROUP_F, EXTRACTED_GROUP_G, EXTRACTED_GROUP_H, VALIDATOR_INPUTS } from "./inspector-extracted3.fixtures";
import { PROBE_NOW, PROBE_RANDOM, probeInspector } from "./inspector-probe";

const g = golden as Record<string, any>;
const ALL = [...EXTRACTED_GROUP_E, ...EXTRACTED_GROUP_F, ...EXTRACTED_GROUP_G, ...EXTRACTED_GROUP_H];

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("extracted3 golden file", () => {
  it("covers exactly the 16 inspector cases and the validator", () => {
    expect(Object.keys(g).sort()).toEqual([...ALL.map(([name]) => name), "validator"].sort());
  });
});

for (const [group, cases] of [["E (media / item manager)", EXTRACTED_GROUP_E], ["F (form / navigation)", EXTRACTED_GROUP_F],
  ["G (display conditions)", EXTRACTED_GROUP_G], ["H (button / share)", EXTRACTED_GROUP_H]] as const) {
  describe(`group ${group}: markup and callbacks unchanged`, () => {
    for (const [name, comp, props, extra] of cases) {
      it(`${comp} (${name})`, () => {
        const C = (Inspectors as any)[comp];
        expect(typeof C, `${comp} exported from DynamicWidgetInspectors`).toBe("function");
        const result = JSON.parse(JSON.stringify(probeInspector(C, props, extra)));
        expect(result.markup).toBe(g[name].markup);
        expect(result.trace).toEqual(g[name].trace);
      }, 120_000);
    }
  });
}

describe("helpers", () => {
  it("validateDisplayConditionsData results are unchanged", () => {
    vi.useFakeTimers({ now: PROBE_NOW, toFake: ["Date"] });
    vi.spyOn(Math, "random").mockReturnValue(PROBE_RANDOM);
    expect(VALIDATOR_INPUTS.map((input) => Inspectors.validateDisplayConditionsData(input as any))).toEqual(g.validator);
  });

  it("handleImageFileUpload reads the chosen file as a data URL", async () => {
    const callback = vi.fn();
    const file = new File(["hi"], "a.txt", { type: "text/plain" });
    await act(async () => {
      Inspectors.handleImageFileUpload({ target: { files: [file] } } as any, callback);
    });
    // FileReader is asynchronous; wait for its result instead of a fixed delay (load-sensitive).
    await waitFor(() => expect(callback.mock.calls).toEqual([["data:text/plain;base64,aGk="]]));
  });

  it("handleImageFileUpload ignores an empty selection", async () => {
    const callback = vi.fn();
    Inspectors.handleImageFileUpload({ target: { files: [] } } as any, callback);
    await new Promise((r) => setTimeout(r, 20));
    expect(callback).not.toHaveBeenCalled();
  });

  it("FS_DISPLAY_CONDITIONS_CLIPBOARD_KEY is unchanged", () => {
    expect(Inspectors.FS_DISPLAY_CONDITIONS_CLIPBOARD_KEY).toBe("fs_clipboard_display_conditions");
  });
});
