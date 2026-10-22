/**
 * WcPurchaseSummaryWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useWooCommerce } from "../../../../../context/WooCommerceContext";
import type { EditorElement, DeviceMode } from "../../../types";
import { getMergedStyles } from "../../../utils";

export const WcPurchaseSummaryWidgetRenderer: React.FC<{ el: EditorElement; getMergedStyles?: any; activeDevice?: DeviceMode; mergedStyles?: any }> = ({ el, getMergedStyles, activeDevice, mergedStyles }) => {
  const wc = useWooCommerce();
  const styles = mergedStyles || (getMergedStyles ? getMergedStyles(el, activeDevice) : {});
  const order = wc.lastOrder;

  return (
    <div style={styles as React.CSSProperties} className="rounded-2xl border border-emerald-300 bg-emerald-50/90 p-6 shadow-sm space-y-4 text-xs">
      <div className="flex items-center gap-3 text-emerald-950 font-extrabold text-base border-b border-emerald-200 pb-3">
        <span className="text-2xl">🎉</span> Order Receipt & Confirmation
      </div>
      <p className="text-emerald-900 leading-relaxed font-medium">
        Thank you for your purchase! Your order has been placed and is currently being processed by our fulfillment team.
      </p>

      {order ? (
        <div className="space-y-2 bg-white/80 p-4 rounded-xl border border-emerald-200 text-slate-800">
          <p><strong>Order ID:</strong> <span className="font-mono text-indigo-700">{order.id}</span></p>
          <p><strong>Status:</strong> <span className="text-emerald-700 font-extrabold uppercase">{order.status}</span></p>
          <p><strong>Total Paid:</strong> <span className="text-emerald-600 font-extrabold">${order.total.toFixed(2)}</span></p>
          <p><strong>Items:</strong> {order.items.map((i) => i.name).join(", ")}</p>
        </div>
      ) : (
        <div className="p-3 bg-white/60 rounded-xl text-slate-600 italic">
          Sample Receipt: Order #WC-89240 • Total: $199.99
        </div>
      )}
    </div>
  );
};
