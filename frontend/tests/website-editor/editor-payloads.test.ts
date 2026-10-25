/* global describe, it, expect -- vitest globals (globals: true); declared for `eslint .` */
/**
 * buildSavePayload / buildPublishDraftSnapshot (core/documentPayloads) must reproduce
 * editor-payloads.golden.json, recorded from the payload code while it was still inline in
 * WebsiteEditor's handleSave / handlePublishWebsite, across every canvas mode and site-part flag form.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import golden from "./editor-payloads.golden.json";
import { computePayloads } from "./editor-payloads.compute";
import { makeState, SITE_PART_VARIANTS, STATES } from "./editor-payloads.fixtures";
import { buildPublishDraftSnapshot, buildSavePayload } from "../../src/pages/editor/core/documentPayloads";

const GOLDEN_SHA256 = "cd28b9168301f506eb0a9a9fa9eaf5074bb4573c392dc7f7b5667f6689e06881"; // as captured in Phase 5A
// The site-part enablement rule, written out independently of the implementation under test.
const expectedEnabled = (part: any) => part?.enabled ?? part?.isEnabled ?? true;

/**
 * The Phase 5A golden (pre-fix evidence, unchanged) with exactly one correction applied: each saved
 * `enabled` and published `isEnabled` flag becomes the resolved value of the input part. Everything
 * else must still match the golden exactly.
 */
function goldenWithEnablementFix() {
  const expected = JSON.parse(JSON.stringify(golden)) as Record<string, any>;
  let corrected = 0;
  for (const [label, make] of STATES) {
    const input = make().siteParts as Record<string, unknown>;
    const save = expected[`save ${label}`].value.payload.editorData.siteParts;
    const pub = expected[`publish ${label}`].value.siteParts;
    for (const name of Object.keys(save)) {
      const want = expectedEnabled(input[name]);
      if (save[name].enabled !== want) corrected++;
      if (pub[name].isEnabled !== want) corrected++;
      save[name].enabled = want;
      pub[name].isEnabled = want;
    }
  }
  return { expected, corrected };
}

describe("document payload builders", () => {
  it("the Phase 5A golden is preserved unchanged as pre-fix evidence", () => {
    const text = readFileSync(fileURLToPath(new URL("./editor-payloads.golden.json", import.meta.url)), "utf8").replace(/\r\n/g, "\n");
    expect(createHash("sha256").update(text).digest("hex")).toBe(GOLDEN_SHA256);
  });

  it("match the golden except for the site-part enablement fix", () => {
    const { expected, corrected } = goldenWithEnablementFix();
    expect(corrected).toBeGreaterThan(0); // the golden really did record the defect
    expect(computePayloads({ buildSavePayload, buildPublishDraftSnapshot })).toEqual(expected);
  });

  it("the canvas elements replace the part being edited; other parts and pages keep their stored elements", () => {
    const state = makeState({ canvasMode: "footer" });
    const { payload, canonicalPageElements } = buildSavePayload(state as any);
    expect(payload.editorData.siteParts.footer.elements).toBe(state.elements);
    expect(payload.editorData.siteParts.header.elements).toBe(state.siteParts.header.elements);
    expect(canonicalPageElements).toBe(state.pages[0].elements);
    expect(payload.editorData.pages[0]).toBe(state.pages[0]); // not merged outside page mode
  });

  it("in page mode the active page is merged with the canvas and page settings", () => {
    const state = makeState();
    const { payload } = buildSavePayload(state as any);
    expect(payload.editorData.pages[0]).toEqual({ ...state.pages[0], elements: state.elements, pageSettings: state.pageSettings });
    expect(payload.editorData.pages[1]).toBe(state.pages[1]);
    expect(payload.editorData.version).toBe(1);
  });

  it("save carries publishing, globalVariables/Classes and publishedData; publish does not", () => {
    const state = makeState({ publishedDataRef: { current: { version: 3 } } });
    const save = buildSavePayload(state as any).payload.editorData as Record<string, unknown>;
    const pub = buildPublishDraftSnapshot(state as any) as Record<string, unknown>;
    expect(Object.keys(save)).toEqual(["version", "elements", "pages", "homePageId", "siteParts", "publishing", "deployment", "breakpoints", "globalSettings", "globalStyles", "globalVariables", "globalClasses", "popups", "pageCss", "pageSettings", "publishedData"]);
    expect(Object.keys(pub)).toEqual(["version", "elements", "pages", "homePageId", "siteParts", "deployment", "breakpoints", "globalSettings", "popups", "pageCss", "pageSettings"]);
    expect(Object.keys(buildSavePayload(makeState() as any).payload.editorData)).not.toContain("publishedData");
  });

  it("pre-fix evidence (Phase 5A golden): a part disabled via `enabled` was published as enabled", () => {
    const pub = (golden as Record<string, any>)["publish page enabledFalse"].value.siteParts;
    const save = (golden as Record<string, any>)["save page enabledFalse"].value.payload.editorData.siteParts;
    expect([save.header.enabled, pub.header.isEnabled]).toEqual([false, true]);
  });

  it("FIXED (was KNOWN DEFECT 4): save keeps `enabled`, publish keeps `isEnabled`, and both carry the same resolved value", () => {
    for (const [, variant] of SITE_PART_VARIANTS) {
      const state = makeState({ siteParts: variant() });
      const saveParts = buildSavePayload(state as any).payload.editorData.siteParts as Record<string, Record<string, unknown>>;
      const pubParts = (buildPublishDraftSnapshot(state as any) as { siteParts: Record<string, Record<string, unknown>> }).siteParts;
      for (const name of ["header", "footer", "single", "archive", "notFound404", "searchResults"]) {
        const want = expectedEnabled((state.siteParts as Record<string, unknown>)[name]);
        expect(Object.keys(saveParts[name])).toEqual(["enabled", "elements"]);
        expect(Object.keys(pubParts[name])).toEqual(["isEnabled", "elements"]);
        expect([saveParts[name].enabled, pubParts[name].isEnabled]).toEqual([want, want]);
      }
    }
  });
});
