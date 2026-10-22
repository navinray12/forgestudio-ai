/**
 * Inputs for renderer-extracted2.golden.json: Phase 4B renderers not covered by earlier renderer
 * goldens (NestedCarousel, BasicMediaCarousel, ImageCarousel, Template, ImportAsset, FavoriteWidgets,
 * DynamicLightbox, LoopGrid), in default and populated states. Each case: [case name, exported
 * renderer, props, callbacks to record]. localStorage is cleared before every probe.
 * Changing anything here invalidates the golden file.
 */
const el = (id: string, type: string, extra: Record<string, unknown> = {}) => ({ id, type, content: "", styles: {}, ...extra });
type Case = [string, string, Record<string, unknown>, readonly string[]];
const PAGES = [{ id: "home", name: "Home", slug: "/", isHome: true }, { id: "blog", name: "Blog", slug: "/blog" }];
const tree = (child: { id: string }) => <div data-probe-child={child.id} />;

const MEDIA = [
  { id: "m1", type: "image", url: "https://example.com/1.jpg", title: "One", caption: "First", altText: "One" },
  { id: "m2", type: "video", url: "https://www.youtube.com/watch?v=abc123", title: "Two", caption: "Second" },
];
const IMAGES = [
  { id: "i1", url: "https://example.com/a.jpg", alt: "A", caption: "Alpha", title: "Alpha", linkUrl: "https://example.com/a" },
  { id: "i2", url: "https://example.com/b.jpg", alt: "B", caption: "Bravo", title: "Bravo" },
  { id: "i3", url: "https://example.com/c.jpg", alt: "C", caption: "Charlie", title: "Charlie" },
];
const POSTS = [
  { id: "p1", title: "First post", slug: "first-post", excerpt: "Hello", featuredImage: "/img/1.png", date: "2026-01-01", author: "Ada", category: "news" },
  { id: "p2", title: "Second post", slug: "second-post", excerpt: "World", featuredImage: "/img/2.png", date: "2026-01-02", author: "Bob", category: "tips" },
];

export const EXTRACTED2_CASES: Case[] = [
  ["nested-carousel", "NestedCarouselWidgetRenderer", { el: el("y-nc", "nested-carousel"), _isPreview: true, mergedStyles: {}, renderElementTree: tree }, []],
  ["nested-carousel+children", "NestedCarouselWidgetRenderer", { el: el("y-nc2", "nested-carousel", {
    children: [el("c1", "container"), el("c2", "container"), el("c3", "container")], nestedCarouselAutoplay: true, nestedCarouselAutoplaySpeed: 2000, nestedCarouselShowDots: true, nestedCarouselShowNav: true,
  }), _isPreview: true, mergedStyles: {}, renderElementTree: tree }, []],
  ["basic-media-carousel", "BasicMediaCarouselWidgetRenderer", { el: el("y-bmc", "basic-media-carousel"), _isPreview: true, mergedStyles: {} }, []],
  ["basic-media-carousel+items", "BasicMediaCarouselWidgetRenderer", { el: el("y-bmc2", "basic-media-carousel", { mediaCarouselItems: MEDIA, mediaCarouselAutoplay: true, mediaCarouselShowNav: true, mediaCarouselShowDots: true }), _isPreview: true, mergedStyles: {} }, []],
  ["image-carousel", "ImageCarouselWidgetRenderer", { el: el("y-ic", "image-carousel"), isPreview: true, mergedStyles: {} }, []],
  ["image-carousel+items", "ImageCarouselWidgetRenderer", { el: el("y-ic2", "image-carousel", { imageCarouselItems: IMAGES, imageCarouselAutoplay: true, imageCarouselLoop: true, imageCarouselShowNav: true, imageCarouselShowDots: true }), isPreview: true, mergedStyles: {} }, []],
  ["template", "TemplateWidgetRenderer", { el: el("y-tpl", "template"), components: {}, isPreview: true, mergedStyles: {} }, ["onUnpackTemplate", "onSelectTemplate"]],
  ["template+preset", "TemplateWidgetRenderer", { el: el("y-tpl2", "template", { templateId: "hero", templatePresetName: "Hero" }), components: { hero: { name: "Hero", element: el("hero-root", "container") } }, isPreview: false, mergedStyles: {} }, ["onUnpackTemplate", "onSelectTemplate"]],
  ["import-asset", "ImportAssetWidgetRenderer", { el: el("y-ia", "import-asset"), isPreview: true, mergedStyles: {} }, []],
  ["import-asset+image", "ImportAssetWidgetRenderer", { el: el("y-ia2", "import-asset", { assetType: "image", src: "https://example.com/asset.png", alt: "Asset", href: "https://example.com" }), isPreview: true, mergedStyles: {} }, []],
  ["favorite-widgets", "FavoriteWidgetsWidgetRenderer", { _el: el("y-fav", "favorite-widgets"), _isPreview: true, mergedStyles: {} }, []],
  ["dynamic-lightbox", "DynamicLightboxWidgetRenderer", { el: el("y-lb", "dynamic-lightbox"), _isPreview: true, mergedStyles: {} }, []],
  ["dynamic-lightbox+items", "DynamicLightboxWidgetRenderer", { el: el("y-lb2", "dynamic-lightbox", { lightboxItems: IMAGES.map(({ id, url, caption, alt }) => ({ id, url, caption, altText: alt })), lightboxTriggerText: "Open" }), _isPreview: true, mergedStyles: {} }, []],
  ["loop-grid", "LoopGridWidgetRenderer", { el: el("y-lg", "loop-grid"), isPreview: true, mergedStyles: {}, activeDevice: "desktop", pages: PAGES, apiUrl: "" }, ["onSwitchPage"]],
  ["loop-grid+posts@editor", "LoopGridWidgetRenderer", { el: el("y-lg2", "loop-grid", { posts: POSTS, querySource: "manual", loopColumns: 2, paginationType: "numbers" }), isPreview: false, mergedStyles: {}, activeDevice: "desktop", pages: PAGES, apiUrl: "" }, ["onSwitchPage"]],
];
