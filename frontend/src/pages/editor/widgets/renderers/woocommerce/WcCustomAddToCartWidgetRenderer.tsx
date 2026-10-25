/**
 * WcCustomAddToCartWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState } from "react";
import { useWooCommerce } from "../../../../../context/WooCommerceContext";
import type { EditorElement, DeviceMode, SiteProduct } from "../../../types";
import { getMergedStyles } from "../../../utils";

export const WcCustomAddToCartWidgetRenderer: React.FC<{ el: EditorElement; getMergedStyles?: any; activeDevice?: DeviceMode; mergedStyles?: any; siteProducts?: SiteProduct[] }> = ({ el, getMergedStyles, activeDevice, mergedStyles, siteProducts }) => {
  const wc = useWooCommerce();
  const styles = mergedStyles || (getMergedStyles ? getMergedStyles(el, activeDevice) : {});
  const prodList = siteProducts && siteProducts.length > 0 ? siteProducts : wc.products;
  const targetId = el.customAddToCartProductId || el.productId;
  const prod = prodList.find((p) => p.id === targetId) || prodList[0];
  const [qty, setQty] = useState(1);

  return (
    <div style={styles as React.CSSProperties} className="inline-flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs">
      <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-slate-50">
        <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-200 cursor-pointer">-</button>
        <span className="px-3 py-1.5 font-extrabold text-xs text-slate-900">{qty}</span>
        <button type="button" onClick={() => setQty((q) => q + 1)} className="px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-200 cursor-pointer">+</button>
      </div>
      <button
        type="button"
        onClick={() => prod && wc.addToCart(prod, qty)}
        className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-extrabold text-xs shadow-md hover:bg-indigo-700 transition active:scale-95 cursor-pointer"
      >
        🛒 Add ({qty}) to Cart
      </button>
    </div>
  );
};
