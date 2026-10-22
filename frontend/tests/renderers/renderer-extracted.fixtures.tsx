/**
 * Inputs for renderer-extracted.golden.json: renderers moved in Phase 4A that the first renderer
 * characterization did not cover (Facebook, Lottie, BasicGallery, Reusable, Stripe and the WooCommerce
 * family). Each case: [case name, exported renderer, props, callbacks to record]. Changing anything
 * here invalidates the golden file. WooCommerce renderers run without a provider, i.e. on the
 * useWooCommerce fallback catalog, exactly as an out-of-provider render does today.
 */
const el = (id: string, type: string, extra: Record<string, unknown> = {}) => ({ id, type, content: "", styles: {}, ...extra });
const wc = { getMergedStyles: (e: { styles?: unknown }) => e.styles ?? {}, activeDevice: "desktop", mergedStyles: {} };
type Case = [string, string, Record<string, unknown>, readonly string[]];

const WC = [
  "WcProductPrice", "WcProductImages", "WcProductRating", "WcBuilder", "WcProduct", "WcProductStock", "WcProductMeta",
  "WcProductContent", "WcShortDescription", "WcProductDataTabs", "WcAdditionalInfo", "WcRelatedProducts", "WcUpsells",
  "WcProducts", "WcCustomAddToCart", "WcProductCategories", "WcMenuCart", "WcCheckout", "WcMyAccount",
  "WcPurchaseSummary", "WcNotices", "WcShopLayouts", "WcProductArchive", "WcProductPageTemplates",
  "WcProductArchiveTemplates", "WcProductAddOns",
];

export const EXTRACTED_RENDERER_CASES: Case[] = [
  ["facebook-embed", "FacebookEmbedWidgetRenderer", { el: el("x-fbe", "facebook-embed"), _isPreview: true, mergedStyles: {} }, []],
  ["facebook-comments", "FacebookCommentsWidgetRenderer", { el: el("x-fbc", "facebook-comments"), _isPreview: true, mergedStyles: {} }, []],
  ["facebook-page", "FacebookPageWidgetRenderer", { el: el("x-fbp", "facebook-page"), mergedStyles: {} }, []],
  ["lottie", "LottieWidgetRenderer", { el: el("x-lottie", "lottie"), _isPreview: true, mergedStyles: {} }, []],
  ["basic-gallery", "BasicGalleryWidgetRenderer", { el: el("x-bg", "basic-gallery", { basicGalleryImages: [
    { id: "g1", url: "https://example.com/1.jpg", caption: "One" }, { id: "g2", url: "https://example.com/2.jpg", caption: "Two" },
  ] }), _isPreview: true, mergedStyles: {} }, []],
  ["reusable", "ReusableComponentWidgetRenderer", { el: el("x-reuse", "reusable-component"), _isPreview: true, mergedStyles: {} }, []],
  ["stripe", "StripeButtonWidgetRenderer", { el: el("x-stripe", "stripe-button"), isPreview: true, mergedStyles: {} }, []],
  ["stripe@editor", "StripeButtonWidgetRenderer", { el: el("x-stripe", "stripe-button"), isPreview: false, mergedStyles: {} }, []],
  ...WC.map((name): Case => [`wc:${name}`, `${name}WidgetRenderer`, { el: el(`x-${name}`, name.toLowerCase()), ...wc }, []]),
];
