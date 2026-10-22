/**
 * WcProductPriceWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useWooCommerce } from "../../../../../context/WooCommerceContext";
import type { EditorElement, DeviceMode, ElementStyles, SiteProduct } from "../../../types";
import { getMergedStyles } from "../../../utils";

export const WcProductPriceWidgetRenderer: React.FC<{ el: EditorElement; getMergedStyles?: any; activeDevice?: DeviceMode; isPreview?: boolean; mergedStyles?: React.CSSProperties | ElementStyles | any; siteProducts?: SiteProduct[] }> = ({ el, getMergedStyles, activeDevice, mergedStyles, siteProducts }) => {
  const wc = useWooCommerce();
  const styles = mergedStyles || (getMergedStyles ? getMergedStyles(el, activeDevice) : {});
  const prodList = siteProducts && siteProducts.length > 0 ? siteProducts : wc.products;
  const connected = prodList.find((p) => p.id === el.productId) || prodList[0];
  const price = (el.productSource as string) === "existing" && connected ? connected.price : (el.wooPrice || el.content || "$199.99");
  const regularPrice = connected?.regularPrice || "$249.99";

  return (
    <div style={styles as React.CSSProperties} className="inline-flex items-baseline gap-2 font-bold" aria-label={`Price ${price}`}>
      <span className="text-2xl font-extrabold text-emerald-600">{price}</span>
      {regularPrice && <span className="text-sm text-slate-400 line-through font-normal">{regularPrice}</span>}
      <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
        In Stock
      </span>
    </div>
  );
};
