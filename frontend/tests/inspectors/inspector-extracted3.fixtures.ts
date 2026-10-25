/**
 * Inputs for the third extracted-inspector characterization (inspector-extracted3.golden.json): the
 * last 16 inspectors in DynamicWidgetInspectors.tsx. Each case: [case name, exported component, props
 * (without the recorded callbacks), extra callback props to record]. Changing anything here invalidates
 * the golden file. onCreatePage is deliberately not passed: callers rely on its return value, which a
 * recording stub cannot provide (that path is covered by inspector-behavior.test.tsx).
 */
const el = (id: string, type: string, extra: Record<string, unknown> = {}) => ({ id, type, content: "", styles: {}, ...extra });
type Case = [string, string, Record<string, unknown>, string[]];

const PAGES = [
  { id: "home", name: "Home", slug: "/", isHome: true },
  { id: "about", name: "About", slug: "/about" },
];

export const EXTRACTED_GROUP_E: Case[] = [
  ["video", "VideoWidgetInspector", { el: el("e-video", "video", { src: "https://example.com/v.mp4" }) }, []],
  ["slides", "SlidesWidgetInspector", { el: el("e-slides", "slides", { slidesItems: [{ id: "s1", title: "One", description: "First" }] }) }, []],
  ["reviews", "ReviewsWidgetInspector", { el: el("e-reviews", "reviews") }, []],
  ["video-playlist", "VideoPlaylistInspector", { el: el("e-vpl", "video-playlist") }, []],
  ["portfolio", "PortfolioWidgetInspector", { el: el("e-portfolio", "portfolio") }, []],
  ["audio-playlist", "AudioPlaylistInspector", { el: el("e-apl", "audio-playlist") }, []],
  ["price-list", "PriceListWidgetInspector", { el: el("e-plist", "price-list") }, []],
  ["media-carousel", "MediaCarouselWidgetInspector", { el: el("e-mc", "media-carousel") }, []],
  ["testimonial-carousel", "TestimonialCarouselWidgetInspector", { el: el("e-tc", "testimonial-carousel") }, []],
  ["loop-carousel", "LoopCarouselWidgetInspector", { el: el("e-lc", "loop-carousel") }, []],
  ["link-in-bio", "LinkInBioWidgetInspector", { el: el("e-lib", "link-in-bio") }, []],
];

export const EXTRACTED_GROUP_F: Case[] = [
  ["form", "FormWidgetInspector", { el: el("f-form", "form") }, []],
  ["nav-menu", "NavMenuWidgetInspector", { el: el("f-nav", "nav-menu"), pages: PAGES }, []],
];

export const EXTRACTED_GROUP_G: Case[] = [
  ["display-conditions", "DisplayConditionsWidgetInspector", {
    el: el("g-dc", "container", { displayConditions: [{ id: "r1", type: "INCLUDE", condition: "ENTIRE_SITE" }] }),
  }, []],
];

export const EXTRACTED_GROUP_H: Case[] = [
  ["button", "ButtonWidgetInspector", { el: el("h-button", "button", { content: "Go", href: "/about" }), pages: PAGES, activePageId: "home" }, ["onOpenIconPicker"]],
  ["share-buttons", "ShareButtonsInspector", { el: el("h-share", "share-buttons"), pages: PAGES, activePageId: "home" }, []],
];

/** validateDisplayConditionsData inputs (results captured under a fixed clock and random value). */
export const VALIDATOR_INPUTS: unknown[] = [
  null, "", "not json", "[]", [], [{ type: "INCLUDE", condition: "ENTIRE_SITE" }],
  JSON.stringify([{ type: "EXCLUDE", condition: "  PAGE:/x  " }, { type: "NOPE", condition: "y" }, { type: "INCLUDE", condition: " " }]),
];
