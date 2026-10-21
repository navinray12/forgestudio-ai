import { WcAddToCartWidgetRenderer, WcAdditionalInfoWidgetRenderer, WcBuilderWidgetRenderer, WcCartWidgetRenderer, WcCheckoutWidgetRenderer, WcCustomAddToCartWidgetRenderer, WcMenuCartWidgetRenderer, WcMyAccountWidgetRenderer, WcNoticesWidgetRenderer, WcProductAddOnsWidgetRenderer, WcProductArchiveTemplatesWidgetRenderer, WcProductArchiveWidgetRenderer, WcProductCategoriesWidgetRenderer, WcProductContentWidgetRenderer, WcProductDataTabsWidgetRenderer, WcProductImagesWidgetRenderer, WcProductMetaWidgetRenderer, WcProductPageTemplatesWidgetRenderer, WcProductPriceWidgetRenderer, WcProductRatingWidgetRenderer, WcProductStockWidgetRenderer, WcProductTitleWidgetRenderer, WcProductWidgetRenderer, WcProductsWidgetRenderer, WcPurchaseSummaryWidgetRenderer, WcRelatedProductsWidgetRenderer, WcShopLayoutsWidgetRenderer, WcShortDescriptionWidgetRenderer, WcUpsellsWidgetRenderer } from "../../widgets";
import type { EditorElement, ElementStyles } from "../../types";

/** What renderWooCommerceElements reads: renderElementTree's per-element values, then the editor values it closed over. */
export interface WooCommerceElementsContext {
  el: EditorElement;
  mergedStyles: ElementStyles;
  isPreview: boolean;
}

/**
 * Canvas renderers: WooCommerce product, cart, checkout and account widgets.
 * Moved verbatim from renderElementTree's leaf wrapper in WebsiteEditor.tsx (the element-renderer
 * slots for wc-product-title, wc-product-price, wc-product-images, wc-add-to-cart, wc-product-rating, wc-builder, wc-product, wc-product-stock, wc-product-meta, wc-product-content, wc-short-description, wc-product-data-tabs, wc-additional-info, wc-related-products, wc-upsells, wc-products, wc-custom-add-to-cart, wc-product-categories, wc-menu-cart, wc-cart, wc-checkout, wc-my-account, wc-purchase-summary, wc-notices, wc-shop-layouts, wc-product-archive, wc-product-page-templates, wc-product-archive-templates, wc-product-addons). A plain function, called in one slot of the wrapper during
 * the editor's render: it returns a fragment of the original slot expressions in their original order,
 * of which only the slot for el.type renders.
 */
export function renderWooCommerceElements({
  el,
  mergedStyles,
  isPreview,
}: WooCommerceElementsContext) {
  return (
    <>
        {el.type === "wc-product-title" && (
          <WcProductTitleWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}

        {el.type === "wc-product-price" && (
          <WcProductPriceWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}

        {el.type === "wc-product-images" && (
          <WcProductImagesWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}

        {el.type === "wc-add-to-cart" && (
          <WcAddToCartWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}

        {el.type === "wc-product-rating" && (
          <WcProductRatingWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}

        {el.type === "wc-builder" && <WcBuilderWidgetRenderer el={el} mergedStyles={mergedStyles} />}
        {el.type === "wc-product" && <WcProductWidgetRenderer el={el} mergedStyles={mergedStyles} />}
        {el.type === "wc-product-stock" && <WcProductStockWidgetRenderer el={el} mergedStyles={mergedStyles} />}
        {el.type === "wc-product-meta" && <WcProductMetaWidgetRenderer el={el} mergedStyles={mergedStyles} />}
        {el.type === "wc-product-content" && <WcProductContentWidgetRenderer el={el} mergedStyles={mergedStyles} />}
        {el.type === "wc-short-description" && <WcShortDescriptionWidgetRenderer el={el} mergedStyles={mergedStyles} />}
        {el.type === "wc-product-data-tabs" && <WcProductDataTabsWidgetRenderer el={el} mergedStyles={mergedStyles} />}
        {el.type === "wc-additional-info" && <WcAdditionalInfoWidgetRenderer el={el} mergedStyles={mergedStyles} />}
        {el.type === "wc-related-products" && <WcRelatedProductsWidgetRenderer el={el} mergedStyles={mergedStyles} />}
        {el.type === "wc-upsells" && <WcUpsellsWidgetRenderer el={el} mergedStyles={mergedStyles} />}
        {el.type === "wc-products" && <WcProductsWidgetRenderer el={el} mergedStyles={mergedStyles} />}
        {el.type === "wc-custom-add-to-cart" && <WcCustomAddToCartWidgetRenderer el={el} mergedStyles={mergedStyles} />}
        {el.type === "wc-product-categories" && <WcProductCategoriesWidgetRenderer el={el} mergedStyles={mergedStyles} />}
        {el.type === "wc-menu-cart" && <WcMenuCartWidgetRenderer el={el} mergedStyles={mergedStyles} />}
        {el.type === "wc-cart" && <WcCartWidgetRenderer el={el} mergedStyles={mergedStyles} />}
        {el.type === "wc-checkout" && <WcCheckoutWidgetRenderer el={el} mergedStyles={mergedStyles} />}
        {el.type === "wc-my-account" && <WcMyAccountWidgetRenderer el={el} mergedStyles={mergedStyles} />}
        {el.type === "wc-purchase-summary" && <WcPurchaseSummaryWidgetRenderer el={el} mergedStyles={mergedStyles} />}
        {el.type === "wc-notices" && <WcNoticesWidgetRenderer el={el} mergedStyles={mergedStyles} />}
        {el.type === "wc-shop-layouts" && <WcShopLayoutsWidgetRenderer el={el} mergedStyles={mergedStyles} />}
        {el.type === "wc-product-archive" && <WcProductArchiveWidgetRenderer el={el} mergedStyles={mergedStyles} />}
        {el.type === "wc-product-page-templates" && <WcProductPageTemplatesWidgetRenderer el={el} mergedStyles={mergedStyles} />}
        {el.type === "wc-product-archive-templates" && <WcProductArchiveTemplatesWidgetRenderer el={el} mergedStyles={mergedStyles} />}
        {el.type === "wc-product-addons" && <WcProductAddOnsWidgetRenderer el={el} mergedStyles={mergedStyles} />}
    </>
  );
}
