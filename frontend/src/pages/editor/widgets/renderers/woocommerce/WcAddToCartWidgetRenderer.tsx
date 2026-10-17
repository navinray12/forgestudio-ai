/**
 * WcAddToCartWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState } from "react";
import { useWooCommerce } from "../../../../../context/WooCommerceContext";
import type { EditorElement, DeviceMode, ElementStyles, SiteProduct } from "../../../types";
import { getMergedStyles } from "../../../utils";

export const WcAddToCartWidgetRenderer: React.FC<{ el: EditorElement; getMergedStyles?: any; activeDevice?: DeviceMode; isPreview?: boolean; mergedStyles?: React.CSSProperties | ElementStyles | any; siteProducts?: SiteProduct[] }> = ({ el, getMergedStyles, activeDevice, mergedStyles, siteProducts }) => {
  const wc = useWooCommerce();
  const styles = mergedStyles || (getMergedStyles ? getMergedStyles(el, activeDevice) : {});
  const prodList = siteProducts && siteProducts.length > 0 ? siteProducts : wc.products;
  const connected = prodList.find((p) => p.id === el.productId) || prodList[0];
  const [added, setAdded] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (connected) {
      wc.addToCart(connected, 1);
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    }
  };

  return (
    <button
      type="button"
      style={styles as React.CSSProperties}
      onClick={handleClick}
      aria-label={`Add ${connected?.name || "Product"} to cart`}
      className={`inline-flex items-center justify-center gap-2.5 rounded-xl px-6 py-3.5 font-bold text-white shadow-md transition-all active:scale-95 cursor-pointer ${
        added ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-900 hover:bg-slate-800"
      }`}
    >
      <span className="text-base">{added ? "✓" : "🛒"}</span>
      <span>{added ? "Added to Cart!" : el.content || el.buttonText || "Add to Cart"}</span>
    </button>
  );
};
