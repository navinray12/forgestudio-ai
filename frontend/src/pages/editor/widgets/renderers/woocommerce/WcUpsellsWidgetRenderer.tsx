/**
 * WcUpsellsWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState } from "react";
import { useWooCommerce } from "../../../../../context/WooCommerceContext";
import type { EditorElement, DeviceMode, SiteProduct } from "../../../types";
import { getMergedStyles } from "../../../utils";

export const WcUpsellsWidgetRenderer: React.FC<{ el: EditorElement; getMergedStyles?: any; activeDevice?: DeviceMode; mergedStyles?: any; siteProducts?: SiteProduct[] }> = ({ el, getMergedStyles, activeDevice, mergedStyles, siteProducts }) => {
  const wc = useWooCommerce();
  const styles = mergedStyles || (getMergedStyles ? getMergedStyles(el, activeDevice) : {});
  const [added, setAdded] = useState(false);
  const limit = el.upsellsLimit || 2;

  return (
    <div style={styles as React.CSSProperties} className="rounded-2xl border border-amber-300 bg-amber-50/80 p-4 space-y-2.5 text-xs shadow-2xs">
      <div className="flex items-center justify-between text-amber-950 font-extrabold">
        <span className="flex items-center gap-1.5">🚀 Frequently Bought Together</span>
        <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-bold">Save 20%</span>
      </div>
      <p className="text-amber-900">Add 2-Year Full Damage Protection & Hard Travel Case bundle for only <strong>$29.99</strong>!</p>
      <button
        type="button"
        onClick={() => {
          wc.addNotice("success", "➕ Added Protection Plan & Travel Case to your order!");
          setAdded(true);
        }}
        className={`px-4 py-2 rounded-xl font-bold text-white transition active:scale-95 cursor-pointer ${added ? "bg-emerald-600" : "bg-amber-600 hover:bg-amber-700"}`}
      >
        {added ? "✓ Bundle Added to Order!" : "Add Protection Bundle ($29.99)"}
      </button>
    </div>
  );
};
