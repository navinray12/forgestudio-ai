/**
 * WcProductCategoriesWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useWooCommerce } from "../../../../../context/WooCommerceContext";
import type { EditorElement, DeviceMode } from "../../../types";
import { getMergedStyles } from "../../../utils";

export const WcProductCategoriesWidgetRenderer: React.FC<{ el: EditorElement; getMergedStyles?: any; activeDevice?: DeviceMode; mergedStyles?: any }> = ({ el, getMergedStyles, activeDevice, mergedStyles }) => {
  const wc = useWooCommerce();
  const styles = mergedStyles || (getMergedStyles ? getMergedStyles(el, activeDevice) : {});
  const cats = ["Audio & Sound", "Wearables", "Accessories", "All Products"];

  return (
    <div style={styles as React.CSSProperties} className="flex flex-wrap gap-2">
      {cats.map((c) => {
        const catValue = c === "All Products" ? null : c;
        const isActive = wc.activeCategory === catValue;
        return (
          <button
            key={c}
            type="button"
            onClick={() => wc.setActiveCategory(catValue)}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border transition active:scale-95 cursor-pointer ${
              isActive ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
            }`}
          >
            📂 {c}
          </button>
        );
      })}
    </div>
  );
};
