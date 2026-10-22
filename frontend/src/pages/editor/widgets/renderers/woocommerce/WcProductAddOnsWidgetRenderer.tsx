/**
 * WcProductAddOnsWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState } from "react";
import { useWooCommerce } from "../../../../../context/WooCommerceContext";
import type { EditorElement, DeviceMode, SiteProduct, ProductAddonItem } from "../../../types";
import { getMergedStyles } from "../../../utils";

export const WcProductAddOnsWidgetRenderer: React.FC<{
  el: EditorElement;
  getMergedStyles?: any;
  activeDevice?: DeviceMode;
  mergedStyles?: any;
  siteProducts?: SiteProduct[];
}> = ({ el, getMergedStyles, activeDevice, mergedStyles, siteProducts }) => {
  const wc = useWooCommerce();
  const styles = mergedStyles || (getMergedStyles ? getMergedStyles(el, activeDevice) : {});
  const prodList = siteProducts && siteProducts.length > 0 ? siteProducts : wc.products;
  const connected = prodList.find((p) => p.id === el.productId) || prodList[0];

  const defaultAddons: ProductAddonItem[] = [
    { id: "addon-gift", label: "Luxury Gift Wrapping & Ribbon", type: "checkbox", priceAdjustment: 4.99 },
    { id: "addon-warranty", label: "2-Year Extended Hardware Protection", type: "checkbox", priceAdjustment: 19.99 },
    { id: "addon-engrave", label: "Custom Laser Name Engraving", type: "text", priceAdjustment: 9.99 },
    { id: "addon-cable", label: "Audio Cable Upgrade", type: "select", priceAdjustment: 14.99, options: ["Braided Silver-Plated 3.5mm (+$14.99)", "Balanced 4.4mm Pentaconn (+$24.99)"] },
  ];

  const addons: ProductAddonItem[] = el.productAddons && el.productAddons.length > 0
    ? el.productAddons
    : defaultAddons;

  const [selectedAddons, setSelectedAddons] = useState<Record<string, any>>({});
  const [quantity, setQuantity] = useState<number>(1);
  const [added, setAdded] = useState(false);

  const parsePrice = (p?: string) => {
    if (!p) return 0;
    return parseFloat(p.replace(/[^0-9.]/g, "")) || 0;
  };

  const basePrice = connected ? parsePrice(connected.price) : (el.wooPrice ? parsePrice(el.wooPrice) : 199.99);

  // Compute add-ons total
  const addOnsTotal = addons.reduce((sum, addon) => {
    const val = selectedAddons[addon.id];
    if (!val) return sum;
    if (addon.type === "checkbox" && val === true) {
      return sum + (addon.priceAdjustment || 0);
    }
    if (addon.type === "text" && typeof val === "string" && val.trim().length > 0) {
      return sum + (addon.priceAdjustment || 0);
    }
    if (addon.type === "select" && typeof val === "string" && val) {
      const match = val.match(/\+\s*\$?([0-9.]+)/);
      const optPrice = match ? parseFloat(match[1]) : (addon.priceAdjustment || 0);
      return sum + optPrice;
    }
    if (addon.type === "radio" && val) {
      return sum + (addon.priceAdjustment || 0);
    }
    return sum;
  }, 0);

  const effectivePrice = Math.round((basePrice + addOnsTotal) * 100) / 100;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (connected) {
      wc.addToCart(connected, quantity, selectedAddons, effectivePrice);
      setAdded(true);
      setTimeout(() => setAdded(false), 2200);
    }
  };

  return (
    <div style={styles as React.CSSProperties} className="rounded-2xl border border-indigo-200/80 bg-white p-5 shadow-sm space-y-4 text-xs font-sans">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 text-base font-extrabold">🧩</span>
          <div>
            <h4 className="font-extrabold text-slate-900 text-sm">{el.content || "Custom Options & Add-Ons"}</h4>
            <p className="text-[11px] text-slate-500">Configure personalization & optional hardware extensions</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Effective Price</span>
          <span className="text-base font-extrabold text-emerald-600">${effectivePrice.toFixed(2)}</span>
        </div>
      </div>

      <div className="space-y-3">
        {addons.map((addon) => {
          const isSelected = !!selectedAddons[addon.id];
          return (
            <div key={addon.id} className={`p-3 rounded-xl border transition ${isSelected ? "border-indigo-500 bg-indigo-50/40" : "border-slate-200 bg-slate-50/50"}`}>
              {addon.type === "checkbox" && (
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={!!selectedAddons[addon.id]}
                      onChange={(e) => {
                        setSelectedAddons((prev) => ({
                          ...prev,
                          [addon.id]: e.target.checked,
                        }));
                      }}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                    />
                    <span className="font-bold text-slate-800">{addon.label}</span>
                  </div>
                  <span className="font-extrabold text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-md text-[11px]">
                    +{addon.priceAdjustment > 0 ? `$${addon.priceAdjustment.toFixed(2)}` : "FREE"}
                  </span>
                </label>
              )}

              {addon.type === "text" && (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800">{addon.label}</span>
                    <span className="font-extrabold text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-md text-[11px]">
                      +{addon.priceAdjustment > 0 ? `$${addon.priceAdjustment.toFixed(2)}` : "FREE"}
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Enter custom text..."
                    value={selectedAddons[addon.id] || ""}
                    onChange={(e) => {
                      setSelectedAddons((prev) => ({
                        ...prev,
                        [addon.id]: e.target.value,
                      }));
                    }}
                    className="w-full p-2 text-xs rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
              )}

              {addon.type === "select" && (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800">{addon.label}</span>
                  </div>
                  <select
                    value={selectedAddons[addon.id] || ""}
                    onChange={(e) => {
                      setSelectedAddons((prev) => ({
                        ...prev,
                        [addon.id]: e.target.value,
                      }));
                    }}
                    className="w-full p-2 text-xs rounded-lg border border-slate-200 bg-white font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Select an option (Standard) --</option>
                    {(addon.options || []).map((opt, i) => (
                      <option key={i} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              )}

              {addon.type === "radio" && (
                <div className="space-y-1.5">
                  <span className="font-bold text-slate-800 block">{addon.label}</span>
                  <div className="flex flex-wrap gap-2">
                    {(addon.options || ["Standard (+ $0.00)", "Pro Upgrade (+ $10.00)"]).map((opt, i) => (
                      <label key={i} className="inline-flex items-center gap-1.5 cursor-pointer bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                        <input
                          type="radio"
                          name={`addon-radio-${addon.id}`}
                          value={opt}
                          checked={selectedAddons[addon.id] === opt}
                          onChange={(e) => {
                            setSelectedAddons((prev) => ({
                              ...prev,
                              [addon.id]: e.target.value,
                            }));
                          }}
                          className="text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span className="text-[11px] font-medium text-slate-700">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-3">
        <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-slate-50">
          <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="px-2.5 py-1 text-slate-600 font-bold hover:bg-slate-200 cursor-pointer">-</button>
          <span className="px-2.5 py-1 font-extrabold text-slate-900">{quantity}</span>
          <button type="button" onClick={() => setQuantity((q) => q + 1)} className="px-2.5 py-1 text-slate-600 font-bold hover:bg-slate-200 cursor-pointer">+</button>
        </div>

        <button
          type="button"
          onClick={handleAddToCart}
          className={`flex-1 py-3 px-4 rounded-xl text-white font-extrabold text-xs shadow-md transition active:scale-95 cursor-pointer flex items-center justify-center gap-2 ${
            added ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          <span>{added ? "✓" : "🛒"}</span>
          <span>{added ? "Added with Customizations!" : `Add to Cart • $${(effectivePrice * quantity).toFixed(2)}`}</span>
        </button>
      </div>
    </div>
  );
};
