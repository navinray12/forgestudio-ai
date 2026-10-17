// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * End-to-end equivalence for the Phase 5A extraction: the mounted editor must render the styled and
 * embedded elements, send the manual save and the publish request, and write the publish draft
 * exactly as the unmodified editor did (website-editor-integration.golden.json), except for the
 * deliberate site-part enablement fix, which is applied to the expectation explicitly below.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup } from "@testing-library/react";
import golden from "./website-editor-integration.golden.json";
import { captureIntegration } from "./website-editor-integration.compute";

vi.setConfig({ testTimeout: 30000 });

const GOLDEN_SHA256 = "5ebb2cbb38278fe07275e15041f78ce9abb574b191259b1ccc7862b4da7a324c"; // as captured in Phase 5A

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* ignore */ }
});

/**
 * richSite() stores header { enabled: false, isEnabled: true } and footer { enabled: true,
 * isEnabled: false }. With `enabled` winning, the header must now publish disabled; the footer
 * stays enabled. Nothing else in the golden changes.
 */
function goldenWithEnablementFix() {
  const expected = JSON.parse(JSON.stringify(golden)) as any;
  expected.publish.body.editorData.siteParts.header.isEnabled = false;
  expected.localStorageDraft.siteParts.header.isEnabled = false;
  return expected;
}

describe("WebsiteEditor integration golden", () => {
  it("the Phase 5A golden is preserved unchanged as pre-fix evidence", () => {
    // Resolved from the working directory: under jsdom, import.meta.url is not a file URL.
    const text = readFileSync(resolve(process.cwd(), "tests/website-editor/website-editor-integration.golden.json"), "utf8").replace(/\r\n/g, "\n");
    expect(createHash("sha256").update(text).digest("hex")).toBe(GOLDEN_SHA256);
  });

  it("rendering, save request, publish request and publish draft match the golden except for the enablement fix", async () => {
    const expected = goldenWithEnablementFix();
    const result = await captureIntegration();
    expect(result.consoleErrors).toEqual([]);
    expect(result.rendered).toEqual(expected.rendered);
    expect(result.save).toEqual(expected.save);
    expect(result.publish).toEqual(expected.publish);
    expect(result.localStorageDraft).toEqual(expected.localStorageDraft);
  });

  it("pre-fix evidence (Phase 5A golden): a header disabled in the document was saved disabled but published enabled", () => {
    const saveParts = (golden.save.body as any).editorData.siteParts;
    const pubParts = (golden.publish.body as any).editorData.siteParts;
    expect(saveParts.header.enabled).toBe(false);
    expect(pubParts.header).not.toHaveProperty("enabled");
    expect(pubParts.header.isEnabled).toBe(true);
    expect(pubParts.footer.isEnabled).toBe(true);
  });

  it("KNOWN DEFECT 5 (characterised): the publish draft is mirrored into localStorage", async () => {
    const result = await captureIntegration();
    expect(result.localStorageDraft).toEqual((result.publish.body as any).editorData);
  });
});
