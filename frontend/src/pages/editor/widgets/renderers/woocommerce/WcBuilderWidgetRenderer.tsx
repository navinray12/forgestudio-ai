/**
 * WcBuilderWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useWooCommerce } from "../../../../../context/WooCommerceContext";
import type { EditorElement, DeviceMode } from "../../../types";
import { getMergedStyles } from "../../../utils";

export const WcBuilderWidgetRenderer: React.FC<{ el: EditorElement; getMergedStyles?: any; activeDevice?: DeviceMode; mergedStyles?: any }> = ({ el, getMergedStyles, activeDevice, mergedStyles }) => {
  const wc = useWooCommerce();
  const styles = mergedStyles || (getMergedStyles ? getMergedStyles(el, activeDevice) : {});
  return (
    <div style={styles as React.CSSProperties} className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/80 via-purple-50/60 to-white p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white text-xl font-extrabold shadow-md">🏪</span>
          <div>
            <h3 className="font-extrabold text-sm text-slate-900">{el.content || "WooCommerce Engine Core"}</h3>
            <p className="text-[11px] text-slate-500">Full Parity WooCommerce Architecture • {wc.products.length} Products Active</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-extrabold text-emerald-800">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" /> Synchronized
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center text-xs font-bold">
        <div className="rounded-xl bg-white p-3 border border-slate-200/80 shadow-2xs">
          <span className="block text-lg">📦</span> {wc.products.length} Products
        </div>
        <div className="rounded-xl bg-white p-3 border border-slate-200/80 shadow-2xs">
          <span className="block text-lg">🛒</span> {wc.cartCount} Cart Items
        </div>
        <div className="rounded-xl bg-white p-3 border border-slate-200/80 shadow-2xs">
          <span className="block text-lg">💳</span> Live Checkout Ready
        </div>
      </div>
    </div>
  );
};
