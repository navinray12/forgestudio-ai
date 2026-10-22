/**
 * PayPalWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import React from "react";
import type { EditorElement } from "../../types";

// 29. PayPal Widget Inspector (F-200 / F-217)
export function PayPalWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  const currentItemImg = el.paypalItemImage || el.productImage || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600";

  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      updateProp("paypalItemImage", url);
      updateProp("productImage", url);
    }
  };

  return (
    <div className="space-y-4 pt-2 border-t border-slate-100">
      <h3 className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
        <span>💳</span> PayPal Express Checkout Integration
      </h3>

      {/* 1. Environment & Mode */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-2.5">
        <label className="block text-[11px] font-bold text-amber-900 uppercase tracking-wider flex items-center justify-between">
          <span>⚡ Environment & Sandbox</span>
          <span className="text-[10px] text-amber-700 font-bold">{el.paypalEnv === "live" ? "🔴 LIVE PRODUCTION" : "🟡 SANDBOX DEV"}</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => updateProp("paypalEnv", "sandbox")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition ${
              el.paypalEnv !== "live"
                ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            🟡 Sandbox (Test Mode)
          </button>
          <button
            type="button"
            onClick={() => updateProp("paypalEnv", "live")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition ${
              el.paypalEnv === "live"
                ? "bg-red-600 text-white border-red-600 shadow-xs"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            🔴 Live (Production)
          </button>
        </div>
      </div>

      {/* 2. Product & Item Setup */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">📦 Product & Item Pricing</h4>

        {/* Manual Product Image Setup */}
        <div>
          <label className="block text-[10px] font-semibold text-slate-600 mb-1">Manual Product Image</label>
          <div className="flex items-center gap-2 mb-2">
            {currentItemImg && (
              <img src={currentItemImg} alt="Item Preview" className="h-10 w-10 rounded-lg object-cover border border-slate-200 shrink-0" />
            )}
            <label className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-100 cursor-pointer transition">
              <span>📁 Upload Local Image File</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleProductImageUpload} />
            </label>
          </div>
          <input
            type="text"
            value={el.paypalItemImage || ""}
            onChange={(e) => {
              updateProp("paypalItemImage", e.target.value);
              updateProp("productImage", e.target.value);
            }}
            placeholder="Or enter remote image URL (https://...)"
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Button Display Text</label>
          <input
            type="text"
            value={el.paypalText || "Pay Now with PayPal"}
            onChange={(e) => updateProp("paypalText", e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Product / Item Name</label>
          <input
            type="text"
            value={el.paypalItemName || "Digital Product"}
            onChange={(e) => updateProp("paypalItemName", e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Item Description</label>
          <input
            type="text"
            value={el.paypalItemDescription || ""}
            onChange={(e) => updateProp("paypalItemDescription", e.target.value)}
            placeholder="Short product description..."
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Amount</label>
            <input
              type="text"
              value={el.paypalAmount || "19.99"}
              onChange={(e) => updateProp("paypalAmount", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-mono text-slate-800 outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Currency</label>
            <select
              value={el.paypalCurrency || "USD"}
              onChange={(e) => updateProp("paypalCurrency", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1.5 text-xs font-semibold text-slate-800 outline-none"
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="CAD">CAD ($)</option>
              <option value="AUD">AUD ($)</option>
              <option value="INR">INR (₹)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Qty</label>
            <input
              type="number"
              min={1}
              value={el.paypalQuantity || 1}
              onChange={(e) => updateProp("paypalQuantity", Math.max(1, parseInt(e.target.value || "1", 10)))}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-800 outline-none"
            />
          </div>
        </div>
      </div>

      {/* 3. Button Styling */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">🎨 Button Styling</h4>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Shape</label>
            <select
              value={el.paypalButtonShape || "pill"}
              onChange={(e) => updateProp("paypalButtonShape", e.target.value as any)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
            >
              <option value="pill">Pill (Rounded)</option>
              <option value="rect">Rectangle</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Size</label>
            <select
              value={el.paypalButtonSize || "md"}
              onChange={(e) => updateProp("paypalButtonSize", e.target.value as any)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
            >
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Alignment</label>
            <select
              value={el.paypalAlignment || "left"}
              onChange={(e) => updateProp("paypalAlignment", e.target.value as any)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Background</label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={el.paypalBgColor || "#FFC439"}
                onChange={(e) => updateProp("paypalBgColor", e.target.value)}
                className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5 shrink-0"
              />
              <input
                type="text"
                value={el.paypalBgColor || "#FFC439"}
                onChange={(e) => updateProp("paypalBgColor", e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Post-Payment Behavior */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">🔔 Success & Cancellation Actions</h4>
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Success Action</label>
          <select
            value={el.paypalSuccessAction || "message"}
            onChange={(e) => updateProp("paypalSuccessAction", e.target.value as any)}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
          >
            <option value="message">Display Success Card in Page</option>
            <option value="redirect">Redirect to Thank You Page</option>
          </select>
        </div>

        {el.paypalSuccessAction === "redirect" ? (
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Redirect URL</label>
            <input
              type="text"
              value={el.paypalSuccessRedirectUrl || ""}
              onChange={(e) => updateProp("paypalSuccessRedirectUrl", e.target.value)}
              placeholder="https://example.com/thank-you"
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none"
            />
          </div>
        ) : (
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Success Message</label>
            <input
              type="text"
              value={el.paypalSuccessMessage || "🎉 Payment received! Thank you for your order."}
              onChange={(e) => updateProp("paypalSuccessMessage", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}
