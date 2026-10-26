/**
 * Inputs for buildCanonicalPages (canonical-pages.golden.json). Builders return fresh objects per call
 * so reference identity can be recorded. Changing anything here invalidates the golden file.
 */
const el = (id: string) => ({ id, type: "heading", content: id, styles: {} });
const page = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: `Name ${id}`, slug: `/${id}`, elements: [el(`${id}El`)], ...extra });

export interface CanonicalInput { pages: any[]; activePageId: string; canvasMode: string; elements: any[]; pageSettings: Record<string, any> }

const base = (over: Partial<CanonicalInput> = {}): CanonicalInput => ({
  pages: [page("home", { isHome: true, slug: "/" }), page("about"), page("contact")],
  activePageId: "about",
  canvasMode: "page",
  elements: [el("canvas1"), el("canvas2")],
  pageSettings: { title: "Edited Title", path: "/edited", description: "d" },
  ...over,
});

/** [label, () => input] */
export const CANONICAL_CASES: Array<[string, () => CanonicalInput]> = [
  ["empty pages", () => base({ pages: [] })],
  ["single page, active", () => base({ pages: [page("home", { slug: "/" })], activePageId: "home" })],
  ["multi-page, middle page active", () => base()],
  ["multi-page, first page active", () => base({ activePageId: "home" })],
  ["active page id not present", () => base({ activePageId: "gone" })],
  ...["header", "footer", "single", "archive", "404", "search-results"].map((mode) => [`canvas mode ${mode}: no merge`, () => base({ canvasMode: mode })] as [string, () => CanonicalInput]),
  ["empty title and path fall back to the page name and slug", () => base({ pageSettings: { title: "", path: "" } })],
  ["undefined title and path fall back", () => base({ pageSettings: {} })],
  ["extra pageSettings keys are carried", () => base({ pageSettings: { title: "T", path: "/p", seoTitle: "S", noindex: true } })],
  ["page without name or slug", () => base({ pages: [{ id: "about", elements: [] }], pageSettings: { title: "", path: "" } })],
  ["page with its own pageSettings is replaced by the editor's", () => base({ pages: [page("about", { pageSettings: { title: "Old", path: "/old", custom: 1 } })] })],
  ["legacy single home page", () => base({ pages: [{ id: "home", name: "Home", slug: "/", elements: [el("old1")], pageSettings: { title: "Home", path: "/" }, isHome: true }], activePageId: "home" })],
  ["duplicate ids: every match is merged", () => base({ pages: [page("about"), page("about", { slug: "/about-2" }), page("home")] })],
  ["empty canvas elements", () => base({ elements: [] })],
  ["page extra fields (customCss, isHome) are kept", () => base({ pages: [page("about", { customCss: ".x{}", isHome: false, seo: { a: 1 } })] })],
];
