/* global describe, it, expect -- vitest globals (globals: true); declared for `eslint .` */
/**
 * buildSavePayload / buildPublishDraftSnapshot (core/documentPayloads) must reproduce
 * editor-payloads.golden.json, recorded from the payload code while it was still inline in
 * WebsiteEditor's handleSave / handlePublishWebsite, across every canvas mode and site-part flag form.
 */
import golden from "./editor-payloads.golden.json";
import { computePayloads } from "./editor-payloads.compute";
import { makeState, SITE_PART_VARIANTS } from "./editor-payloads.fixtures";
import { buildPublishDraftSnapshot, buildSavePayload } from "../../src/pages/editor/core/documentPayloads";

describe("document payload builders", () => {
  it("match the golden recorded from the inline originals", () => {
    expect(computePayloads({ buildSavePayload, buildPublishDraftSnapshot })).toEqual(golden);
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

  it("KNOWN DEFECT 4 (characterised): save writes `enabled`, publish writes `isEnabled`, so a part disabled via `enabled` publishes as enabled", () => {
    const state = makeState({ siteParts: SITE_PART_VARIANTS[0][1]() }); // every part { enabled: false }
    const saveParts = buildSavePayload(state as any).payload.editorData.siteParts as Record<string, Record<string, unknown>>;
    const pubParts = (buildPublishDraftSnapshot(state as any) as { siteParts: Record<string, Record<string, unknown>> }).siteParts;
    for (const name of ["header", "footer", "single", "archive", "notFound404", "searchResults"]) {
      expect(Object.keys(saveParts[name])).toEqual(["enabled", "elements"]);
      expect(saveParts[name].enabled).toBe(false);
      expect(Object.keys(pubParts[name])).toEqual(["isEnabled", "elements"]);
      expect(pubParts[name].isEnabled).toBe(true);
    }
  });
});
