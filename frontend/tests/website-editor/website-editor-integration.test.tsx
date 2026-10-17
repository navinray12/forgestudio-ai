// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * End-to-end equivalence for the Phase 5A extraction: the mounted editor must render the styled and
 * embedded elements, send the manual save and the publish request, and write the publish draft
 * exactly as the unmodified editor did (website-editor-integration.golden.json).
 */
import { cleanup } from "@testing-library/react";
import golden from "./website-editor-integration.golden.json";
import { captureIntegration } from "./website-editor-integration.compute";

vi.setConfig({ testTimeout: 30000 });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* ignore */ }
});

describe("WebsiteEditor integration golden", () => {
  it("rendering, save request, publish request and publish draft match the unmodified editor", async () => {
    const result = await captureIntegration();
    expect(result.consoleErrors).toEqual([]);
    expect(result.rendered).toEqual(golden.rendered);
    expect(result.save).toEqual(golden.save);
    expect(result.publish).toEqual(golden.publish);
    expect(result.localStorageDraft).toEqual(golden.localStorageDraft);
  });

  it("KNOWN DEFECT 4 (characterised): a header disabled in the document is saved disabled but published enabled", () => {
    const saveParts = (golden.save.body as any).editorData.siteParts;
    const pubParts = (golden.publish.body as any).editorData.siteParts;
    expect(saveParts.header.enabled).toBe(false);
    expect(pubParts.header).not.toHaveProperty("enabled");
    expect(pubParts.header.isEnabled).toBe(true);
    // The loader keeps only `enabled`, so the stored footer `isEnabled: false` is lost before publish.
    expect(pubParts.footer.isEnabled).toBe(true);
  });

  it("KNOWN DEFECT 5 (characterised): the publish draft is mirrored into localStorage", () => {
    expect(golden.localStorageDraft).toEqual((golden.publish.body as any).editorData);
  });
});
