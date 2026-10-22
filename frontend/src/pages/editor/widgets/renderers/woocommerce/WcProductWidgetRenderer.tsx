/**
 * WcProductWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useWooCommerce } from "../../../../../context/WooCommerceContext";
import type { EditorElement, DeviceMode, SiteProduct } from "../../../types";
import { getMergedStyles } from "../../../utils";

export const WcProductWidgetRenderer: React.FC<{ el: EditorElement; getMergedStyles?: any; activeDevice?: DeviceMode; mergedStyles?: any; siteProducts?: SiteProduct[] }> = ({ el, getMergedStyles, activeDevice, mergedStyles, siteProducts }) => {
  const wc = useWooCommerce();
  const styles = mergedStyles || (getMergedStyles ? getMergedStyles(el, activeDevice) : {});
  const prodList = siteProducts && siteProducts.length > 0 ? siteProducts : wc.products;
  const prod = prodList.find((p) => p.id === el.productId) || prodList[0];

  return (
    <div style={styles as React.CSSProperties} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition space-y-3.5 max-w-sm">
      <div className="relative overflow-hidden rounded-xl bg-slate-50 aspect-video">
        <img src={prod?.image || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600"} alt={prod?.name} className="w-full h-full object-cover" />
        {prod?.badge && (
          <span className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-extrabold uppercase">
            {prod.badge}
          </span>
        )}
      </div>
      <h3 className="font-extrabold text-slate-900 text-sm line-clamp-1">{prod?.name || "Aura Pro Headphones"}</h3>
      <div className="flex items-center justify-between pt-1">
        <span className="text-lg font-extrabold text-emerald-600">{prod?.price || "$199.99"}</span>
        <button
          type="button"
          onClick={() => prod && wc.addToCart(prod, 1)}
          className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition active:scale-95"
        >
          Add to Cart
        </button>
      </div>
    </div>
  );
};
