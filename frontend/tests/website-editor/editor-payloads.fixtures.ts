/**
 * Editor state matrix for the save payload / publish draft snapshot builders
 * (editor-payloads.golden.json). Builders return fresh objects per call. Site-part flags cover both
 * spellings the editor uses: `enabled` (save, load) and `isEnabled` (publish).
 */
const els = (tag: string) => [{ id: `${tag}El`, type: "heading", content: `${tag} content`, styles: {} }];
const part = (tag: string, flags: Record<string, unknown>) => ({ ...flags, elements: els(tag) });

export const CANVAS_MODES = ["page", "header", "footer", "single", "archive", "404", "search-results"];

export const SITE_PART_VARIANTS: Array<[string, () => any]> = [
  ["enabledFalse", () => ({ header: part("hdr", { enabled: false }), footer: part("ftr", { enabled: false }), single: part("sgl", { enabled: false }), archive: part("arc", { enabled: false }), notFound404: part("nf", { enabled: false }), searchResults: part("srch", { enabled: false }) })],
  ["isEnabledFalse", () => ({ header: part("hdr", { isEnabled: false }), footer: part("ftr", { isEnabled: false }), single: part("sgl", { isEnabled: false }), archive: part("arc", { isEnabled: false }), notFound404: part("nf", { isEnabled: false }), searchResults: part("srch", { isEnabled: false }) })],
  ["conflicting", () => ({ header: part("hdr", { enabled: false, isEnabled: true }), footer: part("ftr", { enabled: true, isEnabled: false }) })],
  ["headerFooterOnly", () => ({ header: part("hdr", { enabled: true }), footer: { enabled: false } })],
  ["empty", () => ({})],
];

export function makeState(overrides: Record<string, unknown> = {}) {
  return {
    canvasMode: "page",
    elements: els("canvas"),
    siteParts: SITE_PART_VARIANTS[0][1](),
    pages: [
      { id: "home", name: "Home", slug: "/", elements: els("homeStale"), pageSettings: { title: "Home", path: "/" }, isHome: true },
      { id: "about", name: "About", slug: "/about", elements: els("about"), pageSettings: { title: "About", path: "/about" } },
    ],
    activePageId: "home",
    pageSettings: { title: "Home edited", path: "/", description: "Desc" },
    homePageId: "home",
    publishing: { status: "DRAFT", version: 2 },
    deployment: { provider: "none" },
    breakpoints: [{ id: "desktop", width: 1200 }],
    globalSettings: { globalStyles: { primaryColor: "#123456" }, fontFamily: "Inter" },
    globalVariables: [{ id: "var1", value: "8px" }],
    globalClasses: [{ id: "cls1", name: "card" }],
    popups: [{ id: "popup1" }],
    pageCss: ".hero { color: red; }",
    publishedDataRef: { current: null as unknown },
    ...overrides,
  };
}

/** [label, () => state] */
export const STATES: Array<[string, () => any]> = [
  ...CANVAS_MODES.flatMap((mode) => SITE_PART_VARIANTS.map(([v, sp]) => [`${mode} ${v}`, () => makeState({ canvasMode: mode, siteParts: sp() })] as [string, () => any])),
  ["activePageMissing header", () => makeState({ canvasMode: "header", activePageId: "gone" })],
  ["activePageMissing page", () => makeState({ activePageId: "gone" })],
  ["about active", () => makeState({ activePageId: "about" })],
  ["publishedData present", () => makeState({ publishedDataRef: { current: { version: 3, pages: [] } } })],
  ["globalSettings undefined", () => makeState({ globalSettings: undefined })],
  ["globalSettings no styles", () => makeState({ globalSettings: { fontFamily: "Inter" } })],
  ["no pages", () => makeState({ pages: [] })],
  ["empty canvas", () => makeState({ elements: [] })],
];
