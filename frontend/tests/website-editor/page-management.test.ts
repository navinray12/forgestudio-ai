/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * core/pageManagement helpers vs the inline expressions they replaced in WebsiteEditor (copied
 * verbatim from commit c47744c): values, key order and the id format. The handlers using them are
 * covered end to end in page-handlers.
 */
import { buildNewPage, findStarterPage, newPageId, pageSettingsOf, previewPageParam, slugFromName, starterElementsOf } from "../../src/pages/editor/core/pageManagement";
import { createStarterPages } from "../../src/pages/editor/utils/pageManagerService";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const NAMES = ["About Us", "Team Roster 2026!", "  spaced  ", "Ünïcode Café", "---", "", "UPPER lower", "a/b\\c", "Contact"];

describe("pageManagement helpers equal the inline originals", () => {
  it("slugFromName", () => {
    for (const pageName of NAMES) expect(slugFromName(pageName)).toBe(`/${pageName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`);
  });

  it("newPageId: same format, same Date.now / Math.random use", () => {
    vi.spyOn(Date, "now").mockReturnValue(1767225600000);
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);
    expect(newPageId()).toBe(`page_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
    expect(newPageId()).toMatch(/^page_1767225600000_[a-z0-9]{1,4}$/);
  });

  it("findStarterPage and starterElementsOf", () => {
    const starters = createStarterPages("Site");
    for (const [slug, name] of [["/services", "Services"], ["/SERVICES", "x"], ["/nope", "con"], ["/nope", "zzz"], ["/", "Home"], ["", ""]]) {
      const inline = starters.find((s) => s.slug.toLowerCase() === slug.toLowerCase() || s.name.toLowerCase().includes(name.toLowerCase()));
      expect(findStarterPage(starters, slug, name)).toBe(inline);
      const inlineEls = inline?.elements && inline.elements.length > 0 ? inline.elements : [];
      expect(starterElementsOf(inline)).toEqual(inlineEls);
      if (inline?.elements?.length) expect(starterElementsOf(inline)).toBe(inline.elements); // by reference
    }
    expect(starterElementsOf({ id: "x", name: "x", slug: "/x", elements: [] } as any)).toEqual([]);
  });

  it("buildNewPage: the same object, in the same key order, as the inline literal", () => {
    vi.useFakeTimers({ now: new Date("2026-05-01T10:00:00.000Z"), toFake: ["Date"] });
    const elements = [{ id: "e1" }] as any;
    const inline = {
      id: "page_1", name: "Pricing", slug: "/pricing", elements,
      pageSettings: { title: "Pricing", path: "/pricing", description: "Pricing page", backgroundColor: "#ffffff", isMaintenanceMode: false, siteLanguage: "en" },
      isHome: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    const built = buildNewPage({ id: "page_1", name: "Pricing", slug: "/pricing", elements, description: "Pricing page", isHome: false });
    expect(JSON.stringify(built)).toBe(JSON.stringify(inline));
    expect(built.elements).toBe(elements);
  });

  it("pageSettingsOf and previewPageParam", () => {
    const own = { title: "T", path: "/t" };
    const withSettings = { id: "a", name: "A", slug: "/a", elements: [], pageSettings: own } as any;
    const without = { id: "b", name: "B", slug: "/b", elements: [] } as any;
    expect(pageSettingsOf(withSettings)).toBe(own);
    expect(pageSettingsOf(without)).toEqual({ title: "B", path: "/b" });
    const cases: Array<[any, string]> = [[without, "home"], [without, "b"], [{ ...without, slug: "/" }, "x"], [{ ...without, slug: "/nested/path" }, "x"], [{ ...without, slug: "noslash" }, "x"]];
    for (const [targetPage, homePageId] of cases) {
      const inline = targetPage.id === homePageId || targetPage.slug === "/" ? "home" : targetPage.slug.replace(/^\//, "");
      expect(previewPageParam(targetPage, homePageId)).toBe(inline);
    }
  });
});
