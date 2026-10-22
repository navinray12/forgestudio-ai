/**
 * WcShopLayoutsWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useWooCommerce } from "../../../../../context/WooCommerceContext";
import type { EditorElement, DeviceMode } from "../../../types";
import { getMergedStyles } from "../../../utils";

export const WcShopLayoutsWidgetRenderer: React.FC<{ el: EditorElement; getMergedStyles?: any; activeDevice?: DeviceMode; mergedStyles?: any }> = ({ el, getMergedStyles, activeDevice, mergedStyles }) => {
  const wc = useWooCommerce();
  const styles = mergedStyles || (getMergedStyles ? getMergedStyles(el, activeDevice) : {});

  return (
    <div style={styles as React.CSSProperties} className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-bold">
      <button
        type="button"
        onClick={() => wc.setActiveShopLayout("grid")}
        className={`px-3 py-1.5 rounded-lg transition active:scale-95 cursor-pointer ${
          wc.activeShopLayout === "grid" ? "bg-white text-indigo-600 shadow-xs font-extrabold" : "text-slate-600 hover:bg-slate-200"
        }`}
      >
        <span>▦ Grid View</span>
      </button>
      <button
        type="button"
        onClick={() => wc.setActiveShopLayout("list")}
        className={`px-3 py-1.5 rounded-lg transition active:scale-95 cursor-pointer ${
          wc.activeShopLayout === "list" ? "bg-white text-indigo-600 shadow-xs font-extrabold" : "text-slate-600 hover:bg-slate-200"
        }`}
      >
        <span>☰ List View</span>
      </button>
    </div>
  );
};
