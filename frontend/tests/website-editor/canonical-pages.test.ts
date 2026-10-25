/* global describe, it, expect -- vitest globals (globals: true); declared for `eslint .` */
/**
 * core/buildCanonicalPages must reproduce canonical-pages.golden.json, recorded from the canonicalPages
 * useMemo body while it was still inline in WebsiteEditor (values and reference identity). The
 * mounted-editor suites cover the wiring through autosave and the save/publish payload goldens.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import golden from "./canonical-pages.golden.json";
import { computeCanonicalPages } from "./canonical-pages.compute";
import { CANONICAL_CASES } from "./canonical-pages.fixtures";
import { buildCanonicalPages } from "../../src/pages/editor/core/canonicalPages";

const GOLDEN_SHA256 = "be68161c3508dc7529aeff0f843df0673dfad12518ef8f336d7d78deac19ef00"; // as captured

describe("buildCanonicalPages", () => {
  it("the golden is the one captured from the inline original", () => {
    const text = readFileSync(fileURLToPath(new URL("./canonical-pages.golden.json", import.meta.url)), "utf8").replace(/\r\n/g, "\n");
    expect(createHash("sha256").update(text).digest("hex")).toBe(GOLDEN_SHA256);
  });

  it("matches the golden for every case (values and reference identity)", () => {
    expect(computeCanonicalPages(buildCanonicalPages as any)).toEqual(golden);
  });

  it("merges only the active page in page mode, by reference, keeping order and ids", () => {
    const input = CANONICAL_CASES.find(([l]) => l === "multi-page, middle page active")![1]();
    const out = buildCanonicalPages(input as any);
    expect(out.map((p) => p.id)).toEqual(["home", "about", "contact"]);
    expect(out[0]).toBe(input.pages[0]);
    expect(out[2]).toBe(input.pages[2]);
    expect(out[1].elements).toBe(input.elements);
    expect(out[1].pageSettings).toBe(input.pageSettings);
    expect([out[1].name, out[1].slug]).toEqual(["Edited Title", "/edited"]);
  });

  it("outside page mode every page is returned unchanged (same objects, new array)", () => {
    const input = CANONICAL_CASES.find(([l]) => l === "canvas mode header: no merge")![1]();
    const out = buildCanonicalPages(input as any);
    expect(out).not.toBe(input.pages);
    out.forEach((p, i) => expect(p).toBe(input.pages[i]));
  });

  it("empty settings title/path fall back to the page's own name/slug", () => {
    const input = CANONICAL_CASES.find(([l]) => l === "empty title and path fall back to the page name and slug")![1]();
    const merged = buildCanonicalPages(input as any)[1];
    expect([merged.name, merged.slug]).toEqual(["Name about", "/about"]);
  });
});
