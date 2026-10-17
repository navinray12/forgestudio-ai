/**
 * WcCartWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState } from "react";
import { useWooCommerce } from "../../../../../context/WooCommerceContext";
import type { EditorElement, DeviceMode } from "../../../types";
import { getMergedStyles } from "../../../utils";

export const WcCartWidgetRenderer: React.FC<{ el: EditorElement; getMergedStyles?: any; activeDevice?: DeviceMode; mergedStyles?: any }> = ({ el, getMergedStyles, activeDevice, mergedStyles }) => {
  const wc = useWooCommerce();
  const styles = mergedStyles || (getMergedStyles ? getMergedStyles(el, activeDevice) : {});
  const [couponCode, setCouponCode] = useState("");
  const [applied, setApplied] = useState(false);

  const accentColor = el.cartAccentColor || "#4f46e5";
  const btnLabel = el.cartButtonLabel || "Apply";
  const showCoupons = el.cartShowCoupons ?? true;
  const showShippingCalc = el.cartShowShippingCalc ?? true;

  return (
    <div style={styles as React.CSSProperties} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
          <span>🛒</span> Shopping Cart
        </h3>
        {wc.cart.length > 0 && (
          <button type="button" onClick={wc.clearCart} className="text-xs text-rose-600 font-bold hover:underline cursor-pointer">Clear Cart</button>
        )}
      </div>

      {wc.cart.length === 0 ? (
        <div className="text-center py-8 space-y-2">
          <span className="text-4xl block">🛍️</span>
          <p className="font-bold text-slate-700 text-sm">Your cart is currently empty.</p>
          <p className="text-xs text-slate-500">Explore our catalog and add your favorite items!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {wc.cart.map((item) => (
            <div key={item.product.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-3">
                <img src={item.product.image} alt={item.product.name} className="h-12 w-12 rounded-lg object-cover" />
                <div>
                  <h4 className="font-bold text-xs text-slate-900">{item.product.name}</h4>
                  <span className="text-xs text-slate-500">{item.customPrice ? `$${item.customPrice.toFixed(2)}` : item.product.price}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white">
                  <button type="button" onClick={() => wc.updateCartQuantity(item.product.id, item.quantity - 1)} className="px-2 py-1 text-xs font-bold hover:bg-slate-100 cursor-pointer">-</button>
                  <span className="px-2 py-1 text-xs font-bold text-slate-900">{item.quantity}</span>
                  <button type="button" onClick={() => wc.updateCartQuantity(item.product.id, item.quantity + 1)} className="px-2 py-1 text-xs font-bold hover:bg-slate-100 cursor-pointer">+</button>
                </div>
                <button type="button" onClick={() => wc.removeFromCart(item.product.id)} className="text-rose-500 text-xs font-bold cursor-pointer">✕</button>
              </div>
            </div>
          ))}

          {showCoupons && (
            <div className="flex gap-2 pt-2">
              <input
                type="text"
                placeholder="Coupon Code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-slate-300 flex-1 font-mono uppercase"
              />
              <button
                type="button"
                style={{ backgroundColor: accentColor, color: "#fff" }}
                onClick={() => {
                  if (couponCode.trim()) {
                    setApplied(true);
                    wc.addNotice("success", `🎉 Coupon "${couponCode}" applied successfully! 10% discount applied.`);
                  }
                }}
                className="px-4 py-2 text-xs font-bold rounded-xl shadow-xs cursor-pointer hover:opacity-95"
              >
                {applied ? "Applied!" : btnLabel}
              </button>
            </div>
          )}

          <div className="border-t border-slate-200 pt-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600"><span>Subtotal:</span><span>${wc.cartSubtotal.toFixed(2)}</span></div>
            {showShippingCalc && (
              <div className="flex justify-between text-slate-600"><span>Estimated Shipping:</span><span className="text-emerald-600 font-bold">{wc.cartSubtotal > 50 ? "FREE" : "$9.99"}</span></div>
            )}
            {applied && <div className="flex justify-between text-emerald-600 font-bold"><span>Discount (10% OFF):</span><span>-${(wc.cartSubtotal * 0.1).toFixed(2)}</span></div>}
            <div className="flex justify-between font-extrabold text-sm text-slate-900 pt-2 border-t border-slate-100">
              <span>Total:</span>
              <span className="text-emerald-600">${(wc.cartSubtotal * (applied ? 0.9 : 1)).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
