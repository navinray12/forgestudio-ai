import { escapeHtml } from "./htmlSafety.js";
import type { StaticElementContext } from "./elementContext.js";
import { renderHeadingElement, renderTextElement, renderButtonElement, renderImageElement, renderDividerElement, renderSpacerElement, renderIconElement, renderCustomSvgElement, renderCodeHighlightElement, renderAlertElement, renderBlockquoteElement, renderCustomHtmlElement } from "./elements/basicElements.js";
import { renderNavMenuElement, renderMegaMenuElement, renderMenuAnchorElement, renderSearchBarElement, renderTaxonomyFilterElement, renderPostNavElement, renderBreadcrumbsElement } from "./elements/navigationElements.js";
import { renderContainerElement, renderColumnsElement, renderFallbackElement } from "./elements/layoutElements.js";
import { renderFormElement } from "./elements/formElements.js";
import { renderSlidesElement, renderPriceTableElement, renderPriceListElement, renderGalleryElement, renderFlipBoxElement, renderCallToActionElement, renderCountdownElement, renderReviewsElement, renderMediaCarouselElement, renderSocialIconsElement, renderCounterElement, renderProgressBarElement } from "./elements/contentWidgetElements.js";
import { renderGoogleMapsElement, renderLottieElement, renderVideoElement, renderAudioPlaylistElement } from "./elements/mediaElements.js";
import { renderWcProductTitleElement, renderWcProductPriceElement, renderWcProductImagesElement, renderWcAddToCartElement, renderWcProductRatingElement, renderWcBuilderElement, renderWcProductStockElement, renderWcProductMetaElement, renderWcProductContentElement, renderWcShortDescriptionElement, renderWcProductDataTabsElement, renderWcAdditionalInfoElement, renderWcRelatedProductsElement, renderWcProductsElement, renderWcCustomAddToCartElement, renderWcProductCategoriesElement, renderWcMenuCartElement, renderWcCartElement, renderWcCheckoutElement, renderWcMyAccountElement, renderWcPurchaseSummaryElement, renderWcNoticesElement, renderWcProductPageTemplatesElement, renderWcProductAddonsElement } from "./elements/wooCommerceElements.js";
import { renderLoopGridElement } from "./elements/dynamicContentElements.js";

// Static HTML for one element (and, through the layout / WooCommerce builders, its children). The prelude
// and the dispatch are the original renderElementToHtml from staticCompiler.ts; each case now returns the
// matching function from ./elements/, which holds that case's original code.
export function renderElementToHtml(el: any, allPages: any[], websiteId?: string): string {
  if (!el) return "";

  const styleObj = el.styles || {};
  const inlineCss = Object.entries(styleObj)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}: ${v}`)
    .join("; ");
  const styleAttr = inlineCss ? ` style="${escapeHtml(inlineCss)}"` : "";
  const classAttr = el.className ? ` class="${escapeHtml(el.className)}"` : "";
  const idAttr = el.id ? ` id="${escapeHtml(el.id)}"` : "";
  const ctx: StaticElementContext = { el, allPages, websiteId, styleObj, inlineCss, styleAttr, classAttr, idAttr, renderElementToHtml };

  switch (el.type) {
    case "heading":
      return renderHeadingElement(ctx);
    case "text":
    case "paragraph":
      return renderTextElement(ctx);
    case "button":
      return renderButtonElement(ctx);
    case "image":
      return renderImageElement(ctx);
    case "divider":
      return renderDividerElement(ctx);
    case "spacer":
      return renderSpacerElement(ctx);
    case "icon":
    case "icon-library":
      return renderIconElement(ctx);
    case "custom-svg":
      return renderCustomSvgElement(ctx);
    case "nav-menu":
      return renderNavMenuElement(ctx);
    case "mega-menu":
      return renderMegaMenuElement(ctx);
    case "menu-anchor":
      return renderMenuAnchorElement(ctx);
    case "search-bar":
    case "search-form":
    case "site-search":
      return renderSearchBarElement(ctx);
    case "taxonomy-filter":
      return renderTaxonomyFilterElement(ctx);
    case "post-nav":
      return renderPostNavElement(ctx);
    case "container":
    case "section":
    case "div":
    case "div-block":
      return renderContainerElement(ctx);
    case "columns":
      return renderColumnsElement(ctx);
    case "form":
      return renderFormElement(ctx);
    case "slides":
      return renderSlidesElement(ctx);
    case "price-table":
    case "pricing":
      return renderPriceTableElement(ctx);
    case "price-list":
      return renderPriceListElement(ctx);
    case "gallery":
    case "basic-gallery":
      return renderGalleryElement(ctx);
    case "flip-box":
      return renderFlipBoxElement(ctx);
    case "call-to-action":
    case "cta":
      return renderCallToActionElement(ctx);
    case "countdown":
      return renderCountdownElement(ctx);
    case "reviews":
      return renderReviewsElement(ctx);
    case "media-carousel":
    case "testimonial-carousel":
    case "nested-carousel":
    case "loop-carousel":
    case "image-carousel":
      return renderMediaCarouselElement(ctx);
    case "social-icons":
    case "share-buttons":
      return renderSocialIconsElement(ctx);
    case "google-maps":
      return renderGoogleMapsElement(ctx);
    case "lottie":
      return renderLottieElement(ctx);
    case "code-highlight":
    case "code":
      return renderCodeHighlightElement(ctx);
    case "breadcrumbs":
      return renderBreadcrumbsElement(ctx);
    case "counter":
    case "animated-counter":
      return renderCounterElement(ctx);
    case "progress-bar":
      return renderProgressBarElement(ctx);
    case "alert":
      return renderAlertElement(ctx);
    case "blockquote":
      return renderBlockquoteElement(ctx);
    case "video":
    case "video-playlist":
      return renderVideoElement(ctx);
    case "audio-playlist":
      return renderAudioPlaylistElement(ctx);
    case "wc-product-title":
      return renderWcProductTitleElement(ctx);
    case "wc-product-price":
      return renderWcProductPriceElement(ctx);
    case "wc-product-images":
      return renderWcProductImagesElement(ctx);
    case "wc-add-to-cart":
      return renderWcAddToCartElement(ctx);
    case "wc-product-rating":
      return renderWcProductRatingElement(ctx);
    case "wc-builder":
    case "wc-product":
      return renderWcBuilderElement(ctx);
    case "wc-product-stock":
      return renderWcProductStockElement(ctx);
    case "wc-product-meta":
      return renderWcProductMetaElement(ctx);
    case "wc-product-content":
      return renderWcProductContentElement(ctx);
    case "wc-short-description":
      return renderWcShortDescriptionElement(ctx);
    case "wc-product-data-tabs":
      return renderWcProductDataTabsElement(ctx);
    case "wc-additional-info":
      return renderWcAdditionalInfoElement(ctx);
    case "wc-related-products":
    case "wc-upsells":
      return renderWcRelatedProductsElement(ctx);
    case "wc-products":
    case "wc-product-archive":
    case "wc-shop-layouts":
      return renderWcProductsElement(ctx);
    case "wc-custom-add-to-cart":
      return renderWcCustomAddToCartElement(ctx);
    case "wc-product-categories":
      return renderWcProductCategoriesElement(ctx);
    case "wc-menu-cart":
      return renderWcMenuCartElement(ctx);
    case "wc-cart":
      return renderWcCartElement(ctx);
    case "wc-checkout":
      return renderWcCheckoutElement(ctx);
    case "wc-my-account":
      return renderWcMyAccountElement(ctx);
    case "wc-purchase-summary":
      return renderWcPurchaseSummaryElement(ctx);
    case "wc-notices":
      return renderWcNoticesElement(ctx);
    case "wc-product-page-templates":
    case "wc-product-archive-templates":
      return renderWcProductPageTemplatesElement(ctx);
    case "wc-product-addons":
      return renderWcProductAddonsElement(ctx);
    case "customHtml":
    case "rawHtml":
    case "html":
    case "shortcode":
      return renderCustomHtmlElement(ctx);
    case "loop-grid":
      return renderLoopGridElement(ctx);
    default:
      return renderFallbackElement(ctx);
  }
}
