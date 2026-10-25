/**
 * WcProductsWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useWooCommerce } from "../../../../../context/WooCommerceContext";
import type { EditorElement, DeviceMode, SiteProduct } from "../../../types";
import { getMergedStyles } from "../../../utils";

export const WcProductsWidgetRenderer: React.FC<{ el: EditorElement; getMergedStyles?: any; activeDevice?: DeviceMode; mergedStyles?: any; siteProducts?: SiteProduct[] }> = ({ el, getMergedStyles, activeDevice, mergedStyles, siteProducts }) => {
  const wc = useWooCommerce();
  const styles = mergedStyles || (getMergedStyles ? getMergedStyles(el, activeDevice) : {});
  let list = siteProducts && siteProducts.length > 0 ? [...siteProducts] : [...wc.products];

  if (wc.activeCategory) {
    list = list.filter((p) => p.category === wc.activeCategory);
  }

  // Handle orderBy
  const orderBy = el.productsOrderBy || "date";
  if (orderBy === "price_asc") {
    list.sort((a, b) => (parseFloat(a.price.replace(/[^0-9.]/g, "")) || 0) - (parseFloat(b.price.replace(/[^0-9.]/g, "")) || 0));
  } else if (orderBy === "price_desc") {
    list.sort((a, b) => (parseFloat(b.price.replace(/[^0-9.]/g, "")) || 0) - (parseFloat(a.price.replace(/[^0-9.]/g, "")) || 0));
  } else if (orderBy === "rating") {
    list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }

  const perPage = el.productsPerPage || 8;
  const displayList = list.slice(0, perPage);
  const layout = el.productsLayout || wc.activeShopLayout || "grid";

  return (
    <div style={styles as React.CSSProperties} className={`grid gap-4 ${layout === "list" ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"}`}>
      {displayList.map((p) => (
        <div key={p.id} className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition ${layout === "list" ? "flex items-center gap-4" : "flex flex-col justify-between space-y-3"}`}>
          <img src={p.image || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400"} alt={p.name} className={`${layout === "list" ? "h-24 w-24 rounded-xl object-cover shrink-0" : "w-full h-36 rounded-xl object-cover"}`} />
          <div className="flex-1 space-y-1">
            <h4 className="font-extrabold text-xs text-slate-900 line-clamp-1">{p.name}</h4>
            <p className="text-[11px] text-slate-500 line-clamp-1">{p.description}</p>
            <div className="flex items-center justify-between pt-1">
              <span className="font-extrabold text-xs text-emerald-600">{p.price}</span>
              <button type="button" onClick={() => wc.addToCart(p, 1)} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold text-[11px] hover:bg-indigo-700 transition active:scale-95 cursor-pointer">Add to Cart</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
