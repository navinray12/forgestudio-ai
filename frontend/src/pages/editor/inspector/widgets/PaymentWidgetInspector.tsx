/**
 * PaymentWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement } from "../../types";

// 26. Payment Widgets Inspector (PayPal & Stripe)
export function PaymentWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  return (
    <div className="space-y-3 pt-2 border-t border-slate-100">
      <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
        <span>💳</span> Payment Gateway Configuration ({el.type === "paypal" ? "PayPal" : "Stripe"})
      </h3>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Amount</label>
          <input
            type="text"
            value={el.paymentAmount || "49.00"}
            onChange={(e) => updateProp("paymentAmount", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Currency</label>
          <select
            value={el.paymentCurrency || "USD"}
            onChange={(e) => updateProp("paymentCurrency", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
          >
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="INR">INR (₹)</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Item / Product Title</label>
        <input
          type="text"
          value={el.paymentProductTitle || "Digital Access Pass"}
          onChange={(e) => updateProp("paymentProductTitle", e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Button Label</label>
        <input
          type="text"
          value={el.paymentButtonText || `Pay Now with ${el.type === "paypal" ? "PayPal" : "Stripe"}`}
          onChange={(e) => updateProp("paymentButtonText", e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
        />
      </div>
    </div>
  );
}
