/**
 * WcMyAccountWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState } from "react";
import { useWooCommerce } from "../../../../../context/WooCommerceContext";
import type { EditorElement, DeviceMode } from "../../../types";
import { getMergedStyles } from "../../../utils";

export const WcMyAccountWidgetRenderer: React.FC<{ el: EditorElement; getMergedStyles?: any; activeDevice?: DeviceMode; mergedStyles?: any }> = ({ el, getMergedStyles, activeDevice, mergedStyles }) => {
  const wc = useWooCommerce();
  const styles = mergedStyles || (getMergedStyles ? getMergedStyles(el, activeDevice) : {});
  const [tab, setTab] = useState<"orders" | "addresses" | "account">("orders");

  return (
    <div style={styles as React.CSSProperties} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5 text-xs">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 font-extrabold text-indigo-700 text-xl shadow-xs">👤</span>
        <div>
          <h4 className="font-extrabold text-slate-900 text-sm">Customer Dashboard</h4>
          <p className="text-slate-500 text-[11px]">Welcome back! Manage your active orders and profile settings.</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setTab("orders")} className={`px-4 py-2 rounded-xl font-extrabold transition ${tab === "orders" ? "bg-indigo-600 text-white shadow-xs" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
          📦 Orders ({wc.lastOrder ? 1 : 0})
        </button>
        <button type="button" onClick={() => setTab("addresses")} className={`px-4 py-2 rounded-xl font-extrabold transition ${tab === "addresses" ? "bg-indigo-600 text-white shadow-xs" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
          📍 Shipping Addresses
        </button>
        <button type="button" onClick={() => setTab("account")} className={`px-4 py-2 rounded-xl font-extrabold transition ${tab === "account" ? "bg-indigo-600 text-white shadow-xs" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
          ⚙️ Account Settings
        </button>
      </div>

      {tab === "orders" && (
        <div>
          {wc.lastOrder ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex justify-between font-extrabold text-slate-900">
                <span>Order #{wc.lastOrder.id.slice(-6)}</span>
                <span className="text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full text-[10px]">{wc.lastOrder.status}</span>
              </div>
              <p className="text-slate-600">Placed on: {new Date(wc.lastOrder.createdAt).toLocaleDateString()}</p>
              <p className="font-extrabold text-slate-900">Total: ${wc.lastOrder.total.toFixed(2)}</p>
            </div>
          ) : (
            <p className="text-slate-500 italic py-3">No orders placed yet.</p>
          )}
        </div>
      )}

      {tab === "addresses" && (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
          <p className="font-bold text-slate-900">Default Shipping Address</p>
          <p className="text-slate-600">123 Innovation Way, Tech Suite 400, San Francisco, CA</p>
        </div>
      )}

      {tab === "account" && (
        <div className="space-y-2">
          <input type="text" defaultValue="John Doe" className="w-full p-2.5 rounded-xl border border-slate-200" />
          <input type="email" defaultValue="customer@forgestudio.com" className="w-full p-2.5 rounded-xl border border-slate-200" />
        </div>
      )}
    </div>
  );
};
