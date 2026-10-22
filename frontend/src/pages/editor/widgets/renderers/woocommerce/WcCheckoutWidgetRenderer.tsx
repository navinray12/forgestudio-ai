/**
 * WcCheckoutWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState } from "react";
import { useWooCommerce } from "../../../../../context/WooCommerceContext";
import type { EditorElement, DeviceMode } from "../../../types";
import { getMergedStyles } from "../../../utils";

export const WcCheckoutWidgetRenderer: React.FC<{ el: EditorElement; getMergedStyles?: any; activeDevice?: DeviceMode; mergedStyles?: any }> = ({ el, getMergedStyles, activeDevice, mergedStyles }) => {
  const wc = useWooCommerce();
  const styles = mergedStyles || (getMergedStyles ? getMergedStyles(el, activeDevice) : {});
  const [email, setEmail] = useState("customer@forgestudio.com");
  const [name, setName] = useState("John Doe");
  const [loading, setLoading] = useState(false);

  const accentColor = el.checkoutAccentColor || "#10b981";
  const btnLabel = el.checkoutButtonLabel || "Place Order";
  const showShippingCalc = el.checkoutShowShippingCalc ?? true;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await wc.placeOrder({ customerEmail: email, customerName: name, billingAddress: "123 Innovation Way, Tech City" });
    setLoading(false);
  };

  return (
    <form style={styles as React.CSSProperties} onSubmit={handleCheckout} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 text-xs">
      <h3 className="font-extrabold text-base text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
        <span>💳</span> Live Store Checkout
      </h3>

      <div className="space-y-3">
        <label className="block space-y-1 font-bold text-slate-700">
          Full Name
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-normal focus:bg-white focus:ring-2 focus:ring-indigo-500 transition outline-none" />
        </label>
        <label className="block space-y-1 font-bold text-slate-700">
          Email Address
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-normal focus:bg-white focus:ring-2 focus:ring-indigo-500 transition outline-none" />
        </label>
      </div>

      <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 space-y-1">
        <div className="flex justify-between font-bold text-slate-700"><span>Order Subtotal:</span><span>${wc.cartSubtotal.toFixed(2)}</span></div>
        {showShippingCalc && (
          <div className="flex justify-between font-bold text-slate-700"><span>Shipping:</span><span className="text-emerald-600 font-extrabold">{wc.cartSubtotal > 50 ? "FREE" : "$9.99"}</span></div>
        )}
        <div className="flex justify-between font-extrabold text-sm text-slate-900 pt-1 border-t border-slate-200"><span>Total Due:</span><span className="text-emerald-600">${wc.cartSubtotal.toFixed(2)}</span></div>
      </div>

      <button
        type="submit"
        disabled={loading || wc.cart.length === 0}
        style={{ backgroundColor: accentColor }}
        className="w-full py-3.5 rounded-xl text-white font-extrabold text-xs shadow-md disabled:opacity-50 cursor-pointer active:scale-95 transition"
      >
        {loading ? "Processing Order..." : `${btnLabel} ($${wc.cartSubtotal.toFixed(2)})`}
      </button>
    </form>
  );
};
