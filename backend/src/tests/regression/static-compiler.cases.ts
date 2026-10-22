/**
 * Inputs for static-compiler-characterization.test.ts (static, deterministic): the element fixtures
 * generated from the unmodified compiler, the hand-written site cases and the helper inputs.
 */
import { readFileSync } from "node:fs";

export const fixtures = JSON.parse(readFileSync(new URL("./static-compiler.fixtures.json", import.meta.url), "utf8"));
export const FIXED_NOW = new Date("2026-01-15T12:00:00.000Z");

export const PAGES = [
  { id: "home", title: "Home", slug: "", isHome: true },
  { id: "p-about", title: "About", slug: "/about" },
  { id: "blog", title: "Blog", slug: "blog" },
];
const site = (elements: any[], extra: Record<string, unknown> = {}) => ({
  name: "Fixture Site",
  pages: [{ ...PAGES[0], elements }, { ...PAGES[1], elements: [] }, { ...PAGES[2], elements: [] }],
  ...extra,
});

export const CASES: Record<string, () => any> = {
  // One page per element fixture: isolates each type's markup in its own index.html
  ...Object.fromEntries((fixtures.elements as any[]).map((el) => [`element:${el.id}`, () => site([el])])),
  recursionAndLayouts: () => site([
    { id: "outer", type: "section", className: "outer", styles: { padding: "8px" }, layout: { direction: "row", justifyContent: "center", alignItems: "center", gap: 12, rowGap: 4, columnGap: "2rem", scrollSnapType: "x mandatory", overflowX: "auto", overflowY: "hidden" }, children: [
      { id: "grid", type: "container", layout: { layoutType: "grid", gridTemplateColumns: "1fr 2fr", gridTemplateRows: "auto", gridAutoFlow: "row", justifyItems: "center", alignItems: "end", gap: 10, rowGap: 6, columnGap: 8 }, elements: [
        { id: "g1", type: "heading", level: 0, content: "Level clamps to 1" },
        { id: "g2", type: "heading", level: 9, text: "Level clamps to 6" },
        { id: "masonry", type: "div", layout: { layoutType: "masonry", masonryColumns: 4, columnGap: 20 }, children: [{ id: "m1", type: "image", src: "/a.png", alt: "A & B", href: "page:p-about", target: "_blank" }] },
        { id: "masonry2", type: "div-block", layout: { layoutType: "masonry", gap: 5 }, children: [] },
      ] },
      { id: "cols", type: "columns", children: [{ id: "c1", type: "text", content: "col 1" }, { id: "c2", type: "button", content: "Go", pageId: "blog" }] },
      { id: "unknown", type: "made-up-widget", className: "u", children: [{ id: "u1", type: "paragraph", text: "inside unknown" }, null, { id: "u2", type: "another-unknown", content: "<script>alert(1)</script>" }] },
      { id: "wcb", type: "wc-builder", children: [{ id: "w1", type: "wc-product-title", content: "Product" }] },
    ] },
  ]),
  malformedElements: () => site([
    null, undefined, {}, { type: "text" }, { id: "s", type: "text", styles: null, content: 0 },
    { id: "n", type: "container", elements: "not-an-array", children: { not: "array" } },
    { id: "nm", type: "nav-menu", navMenuItems: "nope", items: [{ label: "Only items", url: "javascript:void(0)" }, { title: "Sub", pageId: "p-about", submenu: [{ label: "Child", pageId: "missing" }, {}] }] },
    { id: "esc", type: "heading", content: `<img src=x onerror="alert('x')"> & ' "` , className: `a" onclick="x`, styles: { fontFamily: `"Inter", sans-serif`, "--custom": "1" } },
    { id: "raw", type: "customHtml", content: "<div onclick=\"x()\">raw <b>kept</b></div>" },
    { id: "code", type: "code", content: "<script>if (a < b && c > d) {}</script>" },
  ]),
  sitePartsAndSeo: () => ({
    id: "site-from-data",
    name: "Parts Site",
    homePageId: "p-about",
    siteSettings: {
      siteName: "Parts & Co", metaDescription: "Site <desc>", favicon: "/fav.png", ogImage: "/og.png", twitterCard: "summary", siteLanguage: "de",
      customHead: `<meta name="x" content="1"><iframe src="evil"></iframe><script onload="bad()" src="ok.js"></script><a href="javascript:alert(1)">x</a><base href="/"><object data="o"></object><embed src="e"><form action="/p"><input></form>`,
      schemaType: "Organization",
    },
    pages: [
      { id: "home", title: "Home", isHome: false, slug: "start", pageSettings: { noindex: true, nofollow: true, canonicalUrl: "https://canon.test/", ogTitle: "OG <t>", twitterImage: "/tw.png", customHead: "<link rel=\"preload\" href=\"/f.woff2\">" }, elements: [{ id: "h", type: "heading", content: "{{site.name}} / {{page.title}}" }] },
      { id: "p-about", title: "About {{site.name}}", slug: "/about", pageSettings: { title: "About Page", description: "About desc", structuredData: { "@type": "AboutPage", name: "</script><script>x</script>" } }, elements: [{ id: "t", type: "text", content: "About" }] },
      { id: "nopage", name: "Unnamed", elements: [] },
    ],
    siteParts: {
      header: { enabled: true, elements: [{ id: "hd", type: "nav-menu", navMenuItems: [{ label: "Home", url: "/" }, { label: "About", url: "/about#team" }] }] },
      footer: { isEnabled: true, conditions: { include: [{ type: "page", value: "p-about" }] }, elements: [{ id: "ft", type: "text", content: "Footer {{site.name}}" }] },
      notFound404: { elements: [{ id: "nf", type: "heading", content: "Not found" }] },
      archive: { enabled: false, isEnabled: true, elements: [{ id: "ar", type: "text", content: "hidden archive" }] },
      searchResults: { isEnabled: true, elements: [{ id: "sr", type: "search-form", content: "Find" }] },
    },
    globalStyles: { colors: { primary: "#123456", secondary: "#abcdef", text: "#000" }, typography: { fontFamily: "Inter", headingFont: "Lora", baseFontSize: 17 } },
  }),
  legacyElementsNoPages: () => ({ homePageId: "legacy-home", elements: [{ id: "legacy", type: "text", content: "Legacy elements without pages" }], editorData: { globalStyles: { colors: { primary: "red" } } } }),
  emptySite: () => ({}),
  designTokens: () => site([{ id: "tok", type: "text", className: "btn-primary", content: "tokens" }], {
    globalStyles: { colors: { primary: "#111" } },
    variables: [{ name: "brand", value: "#f00", type: "color" }, { name: "bad name!", value: "x" }],
    classes: [{ name: "btn-primary", styles: { color: "var(--brand)", padding: "4px" } }, { name: "1bad", styles: {} }],
    designSystem: { variables: [{ name: "spacing-sm", value: "4px" }], classes: [{ name: "card", styles: { borderRadius: "8px" } }] },
  }),
};


export const HEADS = ["", "   ", undefined, 42, `<script src="a.js"></script><IFRAME src=x>inner</IFRAME><img src=x onerror=alert(1)><a href='vbscript:x'>v</a><applet code="a"></applet>`];
export const HREFS: Array<[string | undefined, any[]]> = [
  [undefined, []], ["", []], ["  #  ", []], ["#", []], ["javascript:alert(1)", []], ["DATA:text/html,x", []], ["vbscript:x", []],
  ["https://x.test/a", []], ["//cdn.test/x", []], ["mailto:a@b.test", []], ["tel:+1", []], ["#section", []],
  ["page:p-about", PAGES], ["page:home", PAGES], ["page:missing", PAGES], ["/about?x=1", PAGES], ["about#top", PAGES], ["/", PAGES],
  ["blog", PAGES], ["/unknown-path", PAGES], ["relative/thing.html", PAGES], ["home", [{ id: "home", slug: "home" }]],
];
