/**
 * Input matrix for the pure renderer helpers (renderer-helpers.golden.json). Changing anything here
 * invalidates the golden file.
 */
export const PAGES = [
  { id: "home", name: "Home", slug: "/", isHome: true },
  { id: "about", name: "About Us", slug: "/about" },
  { id: "pricing", name: "Pricing", slug: "pricing" },
];

/** [rawLink, pageId, destinationType, options] */
export const FORGE_LINK_CASES: Array<[string | undefined, string | undefined, string | undefined, Record<string, unknown>]> = [
  [undefined, undefined, undefined, {}],
  ["", undefined, undefined, { pages: PAGES, homePageId: "home" }],
  ["#features", undefined, undefined, { pages: PAGES }],
  ["javascript:alert(1)", undefined, undefined, { pages: PAGES }],
  ["data:text/html,hi", undefined, undefined, {}],
  ["https://example.com/x?y=1", undefined, undefined, { pages: PAGES }],
  ["mailto:hi@example.com", undefined, undefined, {}],
  ["tel:+123", undefined, undefined, {}],
  ["/about", undefined, undefined, { pages: PAGES }],
  ["about", undefined, undefined, { pages: PAGES }],
  ["/about#team", undefined, undefined, { pages: PAGES }],
  ["/about?ref=nav", undefined, undefined, { pages: PAGES }],
  ["page:pricing", undefined, undefined, { pages: PAGES }],
  [undefined, "about", "page", { pages: PAGES }],
  [undefined, "missing", "page", { pages: PAGES }],
  ["/", undefined, undefined, { pages: PAGES, homePageId: "home" }],
  ["/about", undefined, undefined, { pages: PAGES, websiteId: "site-1", isPublicSite: true }],
  ["/about", undefined, undefined, { pages: PAGES, websiteId: "site-1", isPublicSite: false }],
  ["/unknown-page", undefined, undefined, { pages: PAGES }],
  ["About Us", undefined, undefined, { pages: PAGES }],
];

export const SAFE_URL_CASES = ["https://a.com", "http://a.com", "mailto:x@y.z", "javascript:alert(1)", "data:x", "", "/relative", "ftp://a.com", "  https://padded.com  "];

export const EMBED_CASES = [
  "https://www.youtube.com/watch?v=abc123", "https://youtu.be/abc123", "https://vimeo.com/123456",
  "https://example.com/video.mp4", "", "not a url",
];

export const SHARE_NETWORKS = ["facebook", "twitter", "x", "linkedin", "whatsapp", "telegram", "pinterest", "reddit", "email", "copy-link", "native", "unknown"];

export const BUTTON_ELEMENTS: Array<Record<string, unknown>> = [
  { id: "b1", type: "button", content: "Go", href: "/about" },
  { id: "b2", type: "button", content: "Go", destinationType: "page", pageId: "about" },
  { id: "b3", type: "button", content: "Go", destinationType: "page", pageId: "gone" },
  { id: "b4", type: "button", content: "Go", destinationType: "url", href: "https://example.com" },
  { id: "b5", type: "button", content: "Go", linkUrl: "#contact" },
  { id: "b6", type: "button", content: "Go" },
];

export const SHARE_ELEMENTS: Array<Record<string, unknown>> = [
  { id: "s1", type: "share-buttons", content: "" },
  { id: "s2", type: "share-buttons", content: "", shareUrlSource: "custom", shareUrl: "https://example.com/post", shareText: "Hello", shareHashtags: "a,b" },
  { id: "s3", type: "share-buttons", content: "", shareUrlSource: "custom", shareUrl: "javascript:alert(1)" },
];
