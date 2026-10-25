/**
 * Inputs for the second extracted-inspector characterization (inspector-extracted2.golden.json).
 * Each case: [case name, exported component name, props (without the recorded callbacks), extra
 * callback props to record]. Changing anything here invalidates the golden file.
 *  - Group C: standalone inspectors with no dependency on other code in DynamicWidgetInspectors.tsx.
 *  - Group D: inspectors whose only internal dependencies are the shared controls in inspector/shared/.
 */
const el = (id: string, type: string, extra: Record<string, unknown> = {}) => ({ id, type, content: "", styles: {}, ...extra });
type Case = [string, string, Record<string, unknown>, string[]];

export const EXTRACTED_GROUP_C: Case[] = [
  ["price-table", "PriceTableWidgetInspector", { el: el("c-price", "price-table") }, []],
  ["woocommerce", "WooCommerceWidgetInspector", { el: el("c-woo", "woocommerce") }, []],
  ["paypal", "PayPalWidgetInspector", { el: el("c-paypal", "paypal") }, []],
  ["facebook", "FacebookWidgetInspector", { el: el("c-fb", "facebook") }, []],
  ["nested-carousel", "NestedCarouselWidgetInspector", { el: el("c-nc", "nested-carousel") }, ["setSelectedId"]],
  ["query-builder", "QueryBuilderWidgetInspector", { el: el("c-qb", "query-builder") }, []],
];

export const EXTRACTED_GROUP_D: Case[] = [
  ["image", "ImageWidgetInspector", { el: el("d-image", "image", { src: "https://example.com/i.png", alt: "Alt" }) }, []],
  ["background-image", "BackgroundImageInspector", { el: el("d-bg", "container", { styles: { backgroundImage: "url(https://example.com/bg.png)" } }) }, []],
  ["flip-box", "FlipBoxWidgetInspector", { el: el("d-flip", "flip-box") }, []],
  ["cta", "CTAWidgetInspector", { el: el("d-cta", "call-to-action") }, []],
  ["image-box", "ImageBoxWidgetInspector", { el: el("d-ibox", "image-box") }, []],
  ["icon-library", "IconLibraryWidgetInspector", { el: el("d-icon", "icon", { iconName: "Star" }) }, ["onOpenIconPicker"]],
  ["icon-list", "IconListWidgetInspector", { el: el("d-ilist", "icon-list") }, []],
  ["nested-tabs", "NestedTabsWidgetInspector", { el: el("d-tabs", "nested-tabs") }, []],
  ["nested-accordion", "NestedAccordionWidgetInspector", { el: el("d-acc", "nested-accordion") }, []],
  ["gallery", "GalleryWidgetInspector", {
    el: el("d-gallery", "gallery", { galleryImages: [{ id: "g1", url: "https://example.com/1.jpg", caption: "One", altText: "One" }] }),
  }, []],
];
