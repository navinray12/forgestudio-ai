/**
 * WcRelatedProductsWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useWooCommerce } from "../../../../../context/WooCommerceContext";
import type { EditorElement, DeviceMode, SiteProduct } from "../../../types";
import { getMergedStyles } from "../../../utils";

export const WcRelatedProductsWidgetRenderer: React.FC<{ el: EditorElement; getMergedStyles?: any; activeDevice?: DeviceMode; mergedStyles?: any; siteProducts?: SiteProduct[] }> = ({ el, getMergedStyles, activeDevice, mergedStyles, siteProducts }) => {
  const wc = useWooCommerce();
  const styles = mergedStyles || (getMergedStyles ? getMergedStyles(el, activeDevice) : {});
  let list = siteProducts && siteProducts.length > 0 ? siteProducts : wc.products;
  const connected = list.find((p) => p.id === el.productId);

  if (el.relatedCriteria === "category" && connected?.category) {
    const filtered = list.filter((p) => p.id !== connected.id && p.category === connected.category);
    if (filtered.length > 0) list = filtered;
  }

  const limit = Math.min(Math.max(el.relatedLimit || 3, 2), 8);
  const displayItems = list.slice(0, limit);
  const cols = Math.min(Math.max(el.relatedColumns || 3, 1), 6);

  return (
    <div style={styles as React.CSSProperties} className="space-y-3">
      <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
        <span>🔄 Related Products</span>
      </h4>
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {displayItems.map((p) => (
          <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2 shadow-2xs hover:shadow-md transition">
            <img src={p.image} alt={p.name} className="h-24 w-full rounded-lg object-cover" />
            <p className="font-bold text-xs text-slate-900 line-clamp-1">{p.name}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-emerald-600">{p.price}</span>
              <button type="button" onClick={() => wc.addToCart(p, 1)} className="px-2.5 py-1 rounded-md bg-indigo-600 text-white font-bold text-[10px] hover:bg-indigo-700 cursor-pointer">Add</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
