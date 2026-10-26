/**
 * Deterministic inputs for the renderer characterization (renderer-characterization.golden.json).
 * Each case: [case name, exported renderer, props, callback props to record]. Populated cases reuse the
 * item data pinned in the committed inspector goldens (same element model), so item-level renderer paths
 * are exercised. Changing anything here invalidates the golden file.
 */
import items3 from "../inspectors/inspector-extracted3-items.golden.json";
import items2 from "../inspectors/inspector-extracted2.golden.json";

const el = (id: string, type: string, extra: Record<string, unknown> = {}) => ({ id, type, content: "", styles: {}, ...extra });
const populated = (key: keyof typeof items3) => (items3[key] as { props: { el: Record<string, unknown> } }).props.el;

export const PAGES = [
  { id: "home", name: "Home", slug: "/", isHome: true },
  { id: "about", name: "About Us", slug: "/about" },
];

const preview = { isPreview: true, mergedStyles: {} };
const legacyPreview = { _isPreview: true, mergedStyles: {} };
const wc = { getMergedStyles: (e: { styles?: unknown }) => e.styles ?? {}, activeDevice: "desktop", mergedStyles: {} };
const nav = { pages: PAGES, homePageId: "home", activePageId: "home" };
const children = () => <div data-probe-children="" />;

export const NAV_CALLBACKS = ["onNavigatePage", "onSwitchPage"] as const;
type Case = [string, string, Record<string, unknown>, readonly string[]];

/** Representative renderers in their default state, one per props shape and behaviour family. */
export const DEFAULT_CASES: Case[] = [
  ["slides", "SlidesWidgetRenderer", { el: el("r-slides", "slides"), ...preview }, []],
  ["form", "FormWidgetRenderer", { el: el("r-form", "form"), ...preview, websiteId: "site-1" }, []],
  ["login", "LoginWidgetRenderer", { el: el("r-login", "login"), ...legacyPreview }, []],
  ["nav-menu", "NavMenuWidgetRenderer", { el: el("r-nav", "nav-menu"), ...preview, ...nav }, NAV_CALLBACKS],
  ["animated-headline", "AnimatedHeadlineWidgetRenderer", { el: el("r-ah", "animated-headline"), ...legacyPreview }, []],
  ["price-table", "PriceTableWidgetRenderer", { el: el("r-pt", "price-table"), ...preview }, []],
  ["price-list", "PriceListWidgetRenderer", { el: el("r-pl", "price-list"), ...legacyPreview }, []],
  ["gallery", "GalleryWidgetRenderer", { el: el("r-gal", "gallery"), ...legacyPreview }, []],
  ["flip-box", "FlipBoxWidgetRenderer", { el: el("r-flip", "flip-box"), ...preview }, []],
  ["cta", "CtaWidgetRenderer", { el: el("r-cta", "call-to-action", { ctaButtonLink: "/about" }), ...preview, pages: PAGES }, NAV_CALLBACKS],
  ["media-carousel", "MediaCarouselWidgetRenderer", { el: el("r-mc", "media-carousel"), ...legacyPreview }, []],
  ["testimonial-carousel", "TestimonialCarouselWidgetRenderer", { el: el("r-tc", "testimonial-carousel"), ...legacyPreview }, []],
  ["loop-carousel", "LoopCarouselWidgetRenderer", { el: el("r-lc", "loop-carousel"), ...preview }, []],
  ["countdown", "CountdownWidgetRenderer", { el: el("r-cd", "countdown", { countdownTargetDate: "2026-01-16T12:00:00.000Z" }), mergedStyles: {} }, []],
  ["blockquote", "BlockquoteWidgetRenderer", { el: el("r-bq", "blockquote", { content: "Quote" }), mergedStyles: {} }, []],
  ["reviews", "ReviewsWidgetRenderer", { el: el("r-rev", "reviews"), ...legacyPreview }, ["onUpdateElement"]],
  ["code-highlight", "CodeHighlightWidgetRenderer", { el: el("r-code", "code-highlight", { content: "const a = 1;" }), ...preview }, []],
  ["share-buttons", "ShareButtonsWidgetRenderer", { el: el("r-share", "share-buttons"), ...preview, pages: PAGES, activePageId: "home" }, NAV_CALLBACKS],
  ["audio-playlist", "AudioPlaylistWidgetRenderer", { el: el("r-ap", "audio-playlist"), ...preview }, ["onUpdateTracks"]],
  ["nested-tabs", "NestedTabsWidgetRenderer", { el: el("r-tabs", "nested-tabs"), ...legacyPreview }, []],
  ["nested-accordion", "NestedAccordionWidgetRenderer", { el: el("r-acc", "nested-accordion"), ...legacyPreview }, []],
  ["off-canvas", "OffCanvasWidgetRenderer", { el: el("r-oc", "off-canvas"), ...legacyPreview, renderChildren: children }, []],
  ["search-bar", "SearchBarWidgetRenderer", { el: el("r-search", "search-bar"), ...preview }, []],
  ["icon-library", "IconLibraryWidgetRenderer", { el: el("r-icon", "icon", { iconName: "Star" }), ...legacyPreview }, []],
  ["custom-svg", "CustomSvgWidgetRenderer", { el: el("r-svg", "custom-svg", { svgCode: "<svg viewBox=\"0 0 10 10\"><circle cx=\"5\" cy=\"5\" r=\"4\"/></svg>" }), ...legacyPreview }, []],
  ["toc", "TocWidgetRenderer", { el: el("r-toc", "table-of-contents"), elements: [el("h1", "heading", { content: "Intro" }), el("h2", "heading", { content: "Details" })], ...preview }, []],
  ["mega-menu", "MegaMenuWidgetRenderer", { el: el("r-mega", "mega-menu"), ...preview, pages: PAGES }, [...NAV_CALLBACKS, "onUpdateElement"]],
  ["paypal", "PayPalButtonWidgetRenderer", { el: el("r-pp", "paypal"), ...preview }, []],
  ["wc-product-title", "WcProductTitleWidgetRenderer", { el: el("r-wct", "wc-product-title"), ...wc }, []],
  ["wc-add-to-cart", "WcAddToCartWidgetRenderer", { el: el("r-wcc", "wc-add-to-cart"), ...wc }, []],
  ["wc-cart", "WcCartWidgetRenderer", { el: el("r-wccart", "wc-cart"), ...wc }, []],
];

/** Same renderers with two populated items each (item data from the inspector goldens). */
export const POPULATED_CASES: Case[] = [
  ["slides+items", "SlidesWidgetRenderer", { el: populated("slides"), ...preview }, []],
  ["form+fields", "FormWidgetRenderer", { el: populated("form"), ...preview, websiteId: "site-1" }, []],
  ["nav-menu+items", "NavMenuWidgetRenderer", { el: populated("nav-menu"), ...preview, ...nav }, NAV_CALLBACKS],
  ["price-list+items", "PriceListWidgetRenderer", { el: populated("price-list"), ...legacyPreview }, []],
  ["media-carousel+items", "MediaCarouselWidgetRenderer", { el: populated("media-carousel"), ...legacyPreview }, []],
  ["testimonial-carousel+items", "TestimonialCarouselWidgetRenderer", { el: populated("testimonial-carousel"), ...legacyPreview }, []],
  ["loop-carousel+items", "LoopCarouselWidgetRenderer", { el: populated("loop-carousel"), ...preview }, []],
  ["reviews+items", "ReviewsWidgetRenderer", { el: populated("reviews"), ...legacyPreview }, ["onUpdateElement"]],
  ["share-buttons+items", "ShareButtonsWidgetRenderer", { el: populated("share-buttons"), ...preview, pages: PAGES, activePageId: "home" }, NAV_CALLBACKS],
  ["audio-playlist+items", "AudioPlaylistWidgetRenderer", { el: populated("audio-playlist"), ...preview }, ["onUpdateTracks"]],
  ["gallery+items", "GalleryWidgetRenderer", { el: (items2 as any).gallery ? { ...el("r-gal2", "gallery"), galleryImages: [
    { id: "g1", url: "https://example.com/1.jpg", caption: "One", altText: "One" },
    { id: "g2", url: "https://example.com/2.jpg", caption: "Two", altText: "Two" },
  ] } : {}, ...legacyPreview }, []],
];

/** Editor-mode (not preview) variants where behaviour differs for navigation and forms. */
export const EDITOR_MODE_CASES: Case[] = [
  ["nav-menu+items@editor", "NavMenuWidgetRenderer", { el: populated("nav-menu"), isPreview: false, mergedStyles: {}, ...nav }, NAV_CALLBACKS],
  ["form+fields@editor", "FormWidgetRenderer", { el: populated("form"), isPreview: false, mergedStyles: {}, websiteId: "site-1" }, []],
];

export const ALL_CASES: Case[] = [...DEFAULT_CASES, ...POPULATED_CASES, ...EDITOR_MODE_CASES];
