/**
 * Deterministic inputs for the DynamicWidgetInspectors regression tests. Shared by the tests and by the
 * one-off capture of inspector-markup.golden.json. Changing anything here invalidates the golden markup.
 */

/** Fixed clock for handlers that derive ids from Date.now(). */
export const FIXED_NOW = Date.UTC(2026, 0, 15, 12, 0, 0);
/** Math.random() value used while the clock is fixed; "0.123456789".toString(36) is stable. */
export const FIXED_RANDOM = 0.123456789;

export const PAGES = [
  { id: "home", name: "Home", slug: "/", isHome: true },
  { id: "about", name: "About", slug: "/about" },
];

export const GALLERY_IMAGES = [
  { id: "g1", url: "https://example.com/1.jpg", caption: "First", altText: "One" },
  { id: "g2", url: "https://example.com/2.jpg", caption: "Second", altText: "Two" },
];

export const ELEMENTS: Record<string, any> = {
  countdown: { id: "el-countdown", type: "countdown", content: "" },
  countdownSet: {
    id: "el-countdown-set", type: "countdown", content: "",
    countdownTargetDate: "2027-05-01T09:30", countdownExpiredMessage: "Sale over",
  },
  image: { id: "el-image", type: "image", content: "", src: "https://example.com/hero.png", alt: "Hero", styles: { objectFit: "contain" } },
  imageEmpty: { id: "el-image-empty", type: "image", content: "", styles: {} },
  gallery: { id: "el-gallery", type: "gallery", content: "", galleryImages: GALLERY_IMAGES, galleryColumns: 3 },
  button: { id: "el-button", type: "button", content: "Go", href: "/about", destinationType: "url", styles: { backgroundColor: "#2563eb" } },
  displayConditions: {
    id: "el-dc", type: "container", content: "",
    displayConditions: [
      { id: "r1", type: "INCLUDE", condition: "ENTIRE_SITE" },
      { id: "r2", type: "EXCLUDE", condition: "PAGE:/about" },
    ],
  },
  spacer: { id: "el-spacer", type: "spacer", content: "", styles: { height: "40px" } },
  divider: { id: "el-divider", type: "divider", content: "", styles: {} },
  counter: { id: "el-counter", type: "counter", content: "" },
  rating: { id: "el-rating", type: "rating", content: "" },
  alert: { id: "el-alert", type: "alert", content: "Heads up" },
};

/**
 * Markup cases: [case name, exported component name, element key, extra props].
 * Every case is rendered with no-op updateProp/updateStyle callbacks.
 */
export const MARKUP_CASES: Array<[string, string, string, Record<string, unknown>?]> = [
  ["countdown-defaults", "CountdownWidgetInspector", "countdown"],
  ["countdown-set", "CountdownWidgetInspector", "countdownSet"],
  ["image", "ImageWidgetInspector", "image"],
  ["image-empty", "ImageWidgetInspector", "imageEmpty"],
  ["gallery", "GalleryWidgetInspector", "gallery"],
  ["button", "ButtonWidgetInspector", "button", { pages: PAGES, activePageId: "home" }],
  ["display-conditions", "DisplayConditionsWidgetInspector", "displayConditions"],
  ["spacer", "SpacerWidgetInspector", "spacer"],
  ["divider", "DividerWidgetInspector", "divider"],
  ["counter", "CounterWidgetInspector", "counter"],
  ["rating", "RatingWidgetInspector", "rating"],
  ["alert", "AlertWidgetInspector", "alert"],
];
