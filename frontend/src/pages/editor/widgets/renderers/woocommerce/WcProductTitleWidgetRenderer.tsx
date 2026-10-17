/**
 * WcProductTitleWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useWooCommerce } from "../../../../../context/WooCommerceContext";
import type { EditorElement, DeviceMode, ElementStyles, SiteProduct } from "../../../types";
import { getMergedStyles } from "../../../utils";

// Colorful placeholder icon inside empty image box

// ==========================================
// WOOCOMMERCE STORE WIDGET RENDERERS
// ==========================================

export const WcProductTitleWidgetRenderer: React.FC<{ el: EditorElement; getMergedStyles?: any; activeDevice?: DeviceMode; isPreview?: boolean; mergedStyles?: React.CSSProperties | ElementStyles | any; siteProducts?: SiteProduct[] }> = ({ el, getMergedStyles, activeDevice, mergedStyles, siteProducts }) => {
  const wc = useWooCommerce();
  const styles = mergedStyles || (getMergedStyles ? getMergedStyles(el, activeDevice) : {});
  const prodList = siteProducts && siteProducts.length > 0 ? siteProducts : wc.products;
  const connected = prodList.find((p) => p.id === el.productId) || prodList[0];
  const title = (el.productSource as string) === "existing" && connected ? connected.name : (el.wooProductTitle || el.content || "Aura Pro Wireless Headphones");

  return (
    <h1 style={styles as React.CSSProperties} className="font-extrabold text-2xl tracking-tight text-slate-900" id={`wc-title-${el.id}`}>
      {title}
    </h1>
  );
};
