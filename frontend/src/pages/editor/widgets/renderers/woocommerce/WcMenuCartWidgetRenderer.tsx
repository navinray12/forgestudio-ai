/**
 * WcMenuCartWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState } from "react";
import { useWooCommerce } from "../../../../../context/WooCommerceContext";
import type { EditorElement, DeviceMode } from "../../../types";
import { getMergedStyles } from "../../../utils";

export const WcMenuCartWidgetRenderer: React.FC<{ el: EditorElement; getMergedStyles?: any; activeDevice?: DeviceMode; mergedStyles?: any }> = ({ el, getMergedStyles, activeDevice, mergedStyles }) => {
  const wc = useWooCommerce();
  const styles = mergedStyles || (getMergedStyles ? getMergedStyles(el, activeDevice) : {});
  const [open, setOpen] = useState(false);

  return (
    <div style={styles as React.CSSProperties} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="View shopping cart"
        className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-900 text-white font-extrabold text-xs shadow-md hover:bg-slate-800 transition active:scale-95 cursor-pointer"
      >
        <span className="text-sm">🛒</span>
        <span>Cart</span>
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-slate-950 font-black text-[10px]">
          {wc.cartCount}
        </span>
        <span className="text-slate-300 font-mono pl-1 border-l border-slate-700">${wc.cartSubtotal.toFixed(2)}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl z-50 space-y-3 text-xs">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <span className="font-extrabold text-slate-900">Your Cart ({wc.cartCount})</span>
            <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer">✕</button>
          </div>
          {wc.cart.length === 0 ? (
            <p className="text-slate-500 text-center py-4 italic">Your cart is currently empty</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {wc.cart.map((item) => (
                <div key={item.product.id} className="flex justify-between items-center py-1">
                  <div>
                    <p className="font-bold text-slate-900">{item.product.name}</p>
                    <p className="text-[11px] text-slate-500">Qty: {item.quantity} × {item.customPrice ? `$${item.customPrice.toFixed(2)}` : item.product.price}</p>
                  </div>
                  <button type="button" onClick={() => wc.removeFromCart(item.product.id)} className="text-rose-500 text-xs font-bold hover:underline cursor-pointer">Remove</button>
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-slate-100 pt-2 flex justify-between items-center font-extrabold text-slate-900">
            <span>Total</span>
            <span className="text-emerald-600">${wc.cartSubtotal.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
};
