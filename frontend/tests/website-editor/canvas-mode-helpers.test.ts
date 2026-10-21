/* global describe, it, expect -- vitest globals (globals: true); declared for `eslint .` */
/**
 * core/canvasMode, core/sitePartScopes and the page sync helpers vs the inline code they replaced in
 * WebsiteEditor (copied verbatim from before the extraction and run with recording setters): same
 * values, key order and references, for every scope, empty and non-empty parts, legacy enabled /
 * isEnabled flags, conditions and customCss.
 */
import { canvasModeTarget, storeCanvasIntoActivePage } from "../../src/pages/editor/core/canvasMode";
import { SITE_PART_KEY_BY_SCOPE, sitePartKeyForScope, withSitePartElements } from "../../src/pages/editor/core/sitePartScopes";
import { previewPageIdFromUrl, syncActivePageIntoPages } from "../../src/pages/editor/core/pageManagement";
import {
  createDefaultHeaderElements, createDefaultSinglePostElements, createDefaultArchiveElements, createDefault404Elements, createDefaultSearchResultsElements,
} from "../../src/pages/editor/navigation/navigationDefaults";

const el = (id: string) => ({ id, type: "heading", content: id, styles: {} }) as any;
const SCOPES = ["page", "header", "footer", "single", "archive", "404", "search-results"] as const;
const parts = (filled: boolean): any => ({
  header: { enabled: true, elements: filled ? [el("h")] : [], conditions: [{ type: "all" }], customCss: ".h{}" },
  footer: { isEnabled: false, elements: filled ? [el("f")] : [] },
  single: filled ? { elements: [el("s")], enabled: false } : undefined,
  archive: { elements: filled ? [el("a")] : [] },
  notFound404: filled ? { elements: [el("n")] } : undefined,
  searchResults: { elements: filled ? [el("r")] : [], customCss: ".r{}" },
});
const pages = [{ id: "home", name: "Home", slug: "/", elements: [el("p1")] }, { id: "about", name: "About", slug: "/about", elements: [el("p2")] }] as any[];
const json = (v: unknown) => JSON.stringify(v);
const apply = (state: any, updater: any) => (typeof updater === "function" ? updater(state) : updater);

/** The inline store step of handleSwitchCanvasMode, verbatim, with recording setters. */
function inlineStore(canvasMode: string, siteParts: any, activePageId: string, elements: any, pageSettings: any) {
  let pagesOut = pages, partsOut = siteParts;
  const setPages = (u: any) => { pagesOut = apply(pagesOut, u); };
  const setSiteParts = (u: any) => { partsOut = apply(partsOut, u); };
  if (canvasMode === "page") {
    setPages((prev: any[]) =>
      prev.map((p) => (p.id === activePageId ? { ...p, elements, pageSettings } : p))
    );
  } else if (canvasMode === "header") {
    setSiteParts((prev: any) => ({ ...prev, header: { ...prev.header, elements } }));
  } else if (canvasMode === "footer") {
    setSiteParts((prev: any) => ({ ...prev, footer: { ...prev.footer, elements } }));
  } else if (canvasMode === "single") {
    setSiteParts((prev: any) => ({ ...prev, single: { ...prev.single, elements } }));
  } else if (canvasMode === "archive") {
    setSiteParts((prev: any) => ({ ...prev, archive: { ...prev.archive, elements } }));
  } else if (canvasMode === "404") {
    setSiteParts((prev: any) => ({ ...prev, notFound404: { ...prev.notFound404, elements } }));
  } else if (canvasMode === "search-results") {
    setSiteParts((prev: any) => ({ ...prev, searchResults: { ...prev.searchResults, elements } }));
  }
  return { pagesOut, partsOut };
}

/** The inline load step, verbatim (the default creators are deterministic), with recording setters. */
function inlineLoad(mode: string, siteParts: any, activePageId: string, siteName: string) {
  let partsOut = siteParts, loaded: any = null;
  const setSiteParts = (u: any) => { partsOut = apply(partsOut, u); };
  const setElements = (v: any) => { loaded = v; };
  const resetHistoryTo = () => {};
  const website = { name: siteName }, globalSettings = {};
  if (mode === "page") {
    const activePage = pages.find((p) => p.id === activePageId);
    const targetEls = activePage?.elements || [];
    setElements(targetEls); resetHistoryTo();
  } else if (mode === "header") {
    let targetEls = siteParts.header?.elements || [];
    if (targetEls.length === 0) {
      targetEls = createDefaultHeaderElements(website?.name || (globalSettings as any)?.siteIdentity?.name || "ForgeStudio", pages);
      setSiteParts((prev: any) => ({ ...prev, header: { ...prev.header, elements: targetEls } }));
    }
    setElements(targetEls); resetHistoryTo();
  } else if (mode === "footer") {
    const targetEls = siteParts.footer?.elements || [];
    setElements(targetEls); resetHistoryTo();
  } else if (mode === "single") {
    let targetEls = siteParts.single?.elements || [];
    if (targetEls.length === 0) {
      targetEls = createDefaultSinglePostElements();
      setSiteParts((prev: any) => ({ ...prev, single: { ...prev.single, elements: targetEls, isEnabled: true } }));
    }
    setElements(targetEls); resetHistoryTo();
  } else if (mode === "archive") {
    let targetEls = siteParts.archive?.elements || [];
    if (targetEls.length === 0) {
      targetEls = createDefaultArchiveElements();
      setSiteParts((prev: any) => ({ ...prev, archive: { ...prev.archive, elements: targetEls, isEnabled: true } }));
    }
    setElements(targetEls); resetHistoryTo();
  } else if (mode === "404") {
    let targetEls = siteParts.notFound404?.elements || [];
    if (targetEls.length === 0) {
      targetEls = createDefault404Elements();
      setSiteParts((prev: any) => ({ ...prev, notFound404: { ...prev.notFound404, elements: targetEls, isEnabled: true } }));
    }
    setElements(targetEls); resetHistoryTo();
  } else if (mode === "search-results") {
    let targetEls = siteParts.searchResults?.elements || [];
    if (targetEls.length === 0) {
      targetEls = createDefaultSearchResultsElements();
      setSiteParts((prev: any) => ({ ...prev, searchResults: { ...prev.searchResults, elements: targetEls, isEnabled: true } }));
    }
    setElements(targetEls); resetHistoryTo();
  }
  return { partsOut, loaded };
}

function helperLoad(mode: any, siteParts: any, activePageId: string, siteName: string) {
  const target = canvasModeTarget(mode, { pages, activePageId, siteParts, siteName: () => siteName });
  let partsOut = siteParts;
  if (target?.seed) partsOut = withSitePartElements(partsOut, target.seed.part, target.elements, target.seed.extra);
  return { partsOut, loaded: target ? target.elements : null };
}

describe("canvas mode store step", () => {
  for (const scope of SCOPES) for (const filled of [true, false]) {
    it(`${scope}, ${filled ? "filled" : "empty"} parts`, () => {
      const siteParts = parts(filled), canvas = [el("c1")], settings = { title: "T", path: "/t" };
      const inline = inlineStore(scope, siteParts, "about", canvas, settings);
      let pagesOut = pages, partsOut = siteParts;
      if (scope === "page") pagesOut = storeCanvasIntoActivePage(pages, "about", canvas, settings);
      else { const part = sitePartKeyForScope(scope); if (part) partsOut = withSitePartElements(siteParts, part, canvas); }
      expect(json(pagesOut)).toBe(json(inline.pagesOut));
      expect(json(partsOut)).toBe(json(inline.partsOut));
      if (scope === "page") { expect(pagesOut[0]).toBe(pages[0]); expect(pagesOut[1].elements).toBe(canvas); }
      else expect(partsOut === siteParts).toBe(false);
    });
  }
  it("maps every site-part scope and nothing else", () => {
    expect(SCOPES.filter((s) => sitePartKeyForScope(s)).map((s) => sitePartKeyForScope(s))).toEqual(["header", "footer", "single", "archive", "notFound404", "searchResults"]);
    expect(sitePartKeyForScope("page")).toBeUndefined();
    expect(sitePartKeyForScope("toString" as any)).toBeUndefined();
    expect(Object.keys(SITE_PART_KEY_BY_SCOPE)).toHaveLength(6);
  });
});

describe("canvas mode load step", () => {
  for (const scope of SCOPES) for (const filled of [true, false]) {
    it(`${scope}, ${filled ? "filled" : "empty"} parts`, () => {
      const siteParts = parts(filled);
      const inline = inlineLoad(scope, siteParts, "about", "Acme");
      const helper = helperLoad(scope, siteParts, "about", "Acme");
      expect(json(helper.loaded)).toBe(json(inline.loaded));
      expect(json(helper.partsOut)).toBe(json(inline.partsOut));
      expect(helper.partsOut === siteParts).toBe(inline.partsOut === siteParts); // seeded exactly when the inline code seeded
      if (filled) expect(helper.loaded).toBe(inline.loaded); // existing elements by reference
    });
  }
});

describe("active page sync updater", () => {
  it("returns the same array without pages or without the active page; the same page object when unchanged", () => {
    expect(syncActivePageIntoPages([], "home", [], {})).toEqual([]);
    const noPages: any[] = [];
    expect(syncActivePageIntoPages(noPages, "home", [], {})).toBe(noPages);
    expect(syncActivePageIntoPages(pages, "gone", [], {})).toBe(pages);
    const settings = { title: "Home", path: "/" };
    const current = [{ id: "home", name: "Home", slug: "/", elements: pages[0].elements, pageSettings: settings }, pages[1]];
    const same = syncActivePageIntoPages(current as any, "home", pages[0].elements, settings);
    expect(same).not.toBe(current);
    expect(same[0]).toBe(current[0]);
    const changed = syncActivePageIntoPages(current as any, "home", [el("x")], { title: "", path: "" });
    expect(Object.keys(changed[0])).toEqual(["id", "name", "slug", "elements", "pageSettings"]);
    expect([changed[0].name, changed[0].slug]).toEqual(["Home", "/"]);
    expect(changed[1]).toBe(pages[1]);
  });
});

describe("preview page from URL", () => {
  const inline = (list: any[], homePageId: string, search: string) => {
    let set: string | undefined;
    const setActivePreviewPageId = (id: string) => { set = id; };
    const searchParams = new URLSearchParams(search);
    const urlPageParam = searchParams.get("page") || searchParams.get("previewPage");
    if (urlPageParam) {
      const found = list.find((p) => p.id === urlPageParam || p.slug === urlPageParam || p.slug === `/${urlPageParam}` || p.name.toLowerCase() === urlPageParam.toLowerCase());
      if (found) { setActivePreviewPageId(found.id); return set; }
    }
    const homePage = list.find((p) => p.id === homePageId || p.isHome || p.slug === "/" || p.id === "home") || list[0];
    if (homePage) setActivePreviewPageId(homePage.id);
    return set;
  };
  it("matches by id, slug with and without '/', name; falls back to home, then the first page", () => {
    const list = [{ id: "p1", name: "Start", slug: "/start" }, { id: "p2", name: "About Us", slug: "/about" }, { id: "p3", name: "Blog", slug: "blog" }] as any[];
    for (const search of ["", "?page=p2", "?page=about", "?page=/about", "?page=blog", "?page=ABOUT%20US", "?previewPage=p3", "?page=missing", "?page=&previewPage=about"]) {
      for (const home of ["p3", "none"]) expect(previewPageIdFromUrl(list, home, search), `${search} ${home}`).toBe(inline(list, home, search));
    }
    expect(previewPageIdFromUrl([], "x", "?page=a")).toBeUndefined();
  });
});
