/**
 * WooCommerceWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import React from "react";
import type { EditorElement, SiteProduct, ProductAddonItem } from "../../types";

// 27. WooCommerce Widget Inspector (Dynamic & Data-Bound for All wc-* Elements)
export function WooCommerceWidgetInspector({
  el,
  updateProp,
  siteProducts,
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
  siteProducts?: SiteProduct[];
}) {
  const currentImg = el.src || el.productImage || (el.type === "wc-product-images" ? el.content : "") || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600";
  const productSource = el.productSource || (el.productId ? "site" : "manual");
  const connectedProduct = siteProducts?.find(p => p.id === el.productId);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      updateProp("src", url);
      updateProp("productImage", url);
      updateProp("content", url);
    }
  };

  return (
    <div className="space-y-4 pt-2 border-t border-slate-100">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-purple-700 flex items-center gap-1.5">
          <span>🛍️</span> E-Commerce Controls
        </h3>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold">
          {el.type}
        </span>
      </div>

      {/* Universal Product Connection Mode */}
      <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3 space-y-2.5">
        <label className="block text-[10px] font-bold text-purple-900 uppercase tracking-wider">
          Catalog Binding Mode
        </label>
        <select
          value={productSource}
          onChange={(e) => {
            const mode = e.target.value as "site" | "manual";
            updateProp("productSource", mode);
          }}
          className="w-full rounded-lg border border-purple-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-purple-900 outline-none cursor-pointer"
        >
          <option value="site">🔗 Connected Store Product (Dynamic)</option>
          <option value="manual">✏️ Custom / Static Override Data</option>
        </select>

        {productSource === "site" && (
          <div className="space-y-2 pt-1">
            <label className="block text-[10px] font-bold text-slate-700 uppercase">
              Target Product
            </label>
            <select
              value={el.productId || ""}
              onChange={(e) => {
                const prodId = e.target.value;
                updateProp("productId", prodId);
                const prod = siteProducts?.find(p => p.id === prodId);
                if (prod) {
                  if (prod.image) {
                    updateProp("src", prod.image);
                    updateProp("productImage", prod.image);
                  }
                  updateProp("wooProductTitle", prod.name);
                  updateProp("wooPrice", prod.price);
                  if (prod.rating) updateProp("wooRating", prod.rating);
                }
              }}
              className="w-full rounded-lg border border-purple-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value="">-- Choose Product --</option>
              {(siteProducts || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.price})
                </option>
              ))}
            </select>

            {connectedProduct ? (
              <div className="flex items-center gap-2 bg-purple-100/70 p-2 rounded-lg border border-purple-200 text-xs">
                <span className="text-emerald-600 font-extrabold text-sm">✓</span>
                <div>
                  <span className="font-bold text-purple-900 block">{connectedProduct.name}</span>
                  <span className="text-[10px] text-purple-700">{connectedProduct.price} • Rating: {connectedProduct.rating || 5}★</span>
                </div>
              </div>
            ) : el.productId ? (
              <div className="bg-amber-50 p-2 rounded-lg border border-amber-200 text-[11px] font-bold text-amber-700">
                ⚠️ Connected product ID "{el.productId}" not found.
              </div>
            ) : (
              <p className="text-[10px] text-purple-600 italic">Select a product to bind widget data dynamically.</p>
            )}
          </div>
        )}
      </div>

      {/* Product Image Controls (for image-enabled widgets) */}
      {(el.type === "wc-product-images" || el.type === "wc-product") && (
        <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3 space-y-2.5">
          <label className="block text-[11px] font-bold text-purple-900 uppercase tracking-wider flex items-center justify-between">
            <span>🖼️ Product Image</span>
            <span className="text-[10px] text-purple-600 font-normal">File / URL</span>
          </label>

          {currentImg && (
            <div className="relative group w-full h-24 rounded-lg overflow-hidden border border-purple-200 bg-white">
              <img src={currentImg} alt="Product Preview" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                <label className="px-2.5 py-1 text-[11px] font-bold bg-white text-slate-800 rounded-md shadow cursor-pointer hover:bg-slate-100">
                  Change Image
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageFileChange} />
                </label>
              </div>
            </div>
          )}

          <div>
            <label className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-purple-300 bg-white px-3 py-2 text-xs font-semibold text-purple-700 hover:border-purple-400 hover:bg-purple-50 cursor-pointer transition">
              <span>📁 Upload Local Image File</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageFileChange} />
            </label>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Or Image URL</label>
            <input
              type="text"
              value={el.src || el.productImage || ""}
              onChange={(e) => {
                const val = e.target.value;
                updateProp("src", val);
                updateProp("productImage", val);
                updateProp("content", val);
              }}
              placeholder="https://example.com/product.jpg"
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-purple-500"
            />
          </div>
        </div>
      )}

      {/* Title & Price Controls */}
      {(el.type === "wc-product-title" || el.type === "wc-product-price" || el.type === "wc-product") && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Title / Text Content</label>
            <input
              type="text"
              value={el.content && !el.content.startsWith("http") && !el.content.startsWith("blob:") ? el.content : (el.wooProductTitle || "Aura Pro Wireless Headphones")}
              onChange={(e) => {
                updateProp("wooProductTitle", e.target.value);
                if (el.type !== "wc-product-images") {
                  updateProp("content", e.target.value);
                }
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium outline-none focus:border-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Price</label>
              <input
                type="text"
                value={el.wooPrice || "$199.99"}
                onChange={(e) => updateProp("wooPrice", e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Rating</label>
              <select
                value={el.wooRating || 5}
                onChange={(e) => updateProp("wooRating", parseInt(e.target.value, 10))}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium outline-none cursor-pointer"
              >
                <option value={5}>5 Stars</option>
                <option value={4}>4 Stars</option>
                <option value={3}>3 Stars</option>
                <option value={2}>2 Stars</option>
                <option value={1}>1 Star</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* F-297: wc-product-stock */}
      {el.type === "wc-product-stock" && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">📦 Stock Status Settings</h4>
          <div>
            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Low Stock Alert Threshold</label>
            <input
              type="number"
              min={0}
              max={100}
              value={el.stockThreshold ?? 5}
              onChange={(e) => updateProp("stockThreshold", parseInt(e.target.value, 10) || 0)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-600 mb-1">In Stock Label</label>
            <input
              type="text"
              value={el.inStockLabel || "In Stock (Ready to Ship)"}
              onChange={(e) => updateProp("inStockLabel", e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Low Stock Warning Label</label>
            <input
              type="text"
              value={el.lowStockLabel || "Low Stock - Only few left"}
              onChange={(e) => updateProp("lowStockLabel", e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Out of Stock Label</label>
            <input
              type="text"
              value={el.outOfStockLabel || "Out of Stock"}
              onChange={(e) => updateProp("outOfStockLabel", e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
            />
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div>
              <label className="block text-[9px] font-bold text-emerald-700 mb-0.5">In Stock</label>
              <input
                type="color"
                value={el.inStockColor || "#047857"}
                onChange={(e) => updateProp("inStockColor", e.target.value)}
                className="w-full h-7 rounded border border-slate-200 cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-amber-700 mb-0.5">Low Stock</label>
              <input
                type="color"
                value={el.lowStockColor || "#b45309"}
                onChange={(e) => updateProp("lowStockColor", e.target.value)}
                className="w-full h-7 rounded border border-slate-200 cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-rose-700 mb-0.5">Out Stock</label>
              <input
                type="color"
                value={el.outOfStockColor || "#be123c"}
                onChange={(e) => updateProp("outOfStockColor", e.target.value)}
                className="w-full h-7 rounded border border-slate-200 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* F-298: wc-product-meta */}
      {el.type === "wc-product-meta" && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">🔖 Metadata Visibility</h4>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={el.metaShowSku ?? true}
                onChange={(e) => updateProp("metaShowSku", e.target.checked)}
                className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <span>Show SKU Code</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={el.metaShowCategory ?? true}
                onChange={(e) => updateProp("metaShowCategory", e.target.checked)}
                className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <span>Show Category Link</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={el.metaShowTags ?? true}
                onChange={(e) => updateProp("metaShowTags", e.target.checked)}
                className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <span>Show Product Tags</span>
            </label>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Custom Tags Separator</label>
            <input
              type="text"
              value={el.metaSeparator || " • "}
              onChange={(e) => updateProp("metaSeparator", e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
            />
          </div>
        </div>
      )}

      {/* F-299 & F-300: wc-product-content & wc-short-description */}
      {(el.type === "wc-product-content" || el.type === "wc-short-description") && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">📄 Content & Typography</h4>
          <div>
            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Custom Description Override</label>
            <textarea
              rows={3}
              value={el.productDescriptionOverride || el.content || ""}
              onChange={(e) => {
                updateProp("productDescriptionOverride", e.target.value);
                updateProp("content", e.target.value);
              }}
              placeholder="Enter rich custom product description..."
              className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs font-medium outline-none focus:border-purple-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-1">Text Color</label>
              <input
                type="color"
                value={el.productTextColor || "#475569"}
                onChange={(e) => updateProp("productTextColor", e.target.value)}
                className="w-full h-8 rounded border border-slate-200 cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-1">Font Family</label>
              <select
                value={el.productTypography || ""}
                onChange={(e) => updateProp("productTypography", e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium"
              >
                <option value="">Default (Inherit)</option>
                <option value="Inter, sans-serif">Inter</option>
                <option value="Roboto, sans-serif">Roboto</option>
                <option value="Outfit, sans-serif">Outfit</option>
                <option value="Georgia, serif">Georgia</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* F-301: wc-product-data-tabs */}
      {el.type === "wc-product-data-tabs" && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">🗂️ Dynamic Tab Builder</h4>
            <button
              type="button"
              onClick={() => {
                const existing = el.tabsData || [
                  { id: "desc", title: "Description", content: "Comprehensive overview and technical summary." },
                  { id: "specs", title: "Specifications", content: "Dimensions, drivers, battery life, and materials." },
                  { id: "reviews", title: "Reviews", content: "Customer ratings and verified owner feedback." }
                ];
                const newTab = { id: `tab-${Date.now()}`, title: `New Tab ${existing.length + 1}`, content: "Custom tab content goes here." };
                updateProp("tabsData", [...existing, newTab]);
              }}
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
            >
              + Add Tab
            </button>
          </div>

          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {(el.tabsData || [
              { id: "desc", title: "Description", content: "Comprehensive overview and technical summary." },
              { id: "specs", title: "Specifications", content: "Dimensions, drivers, battery life, and materials." },
              { id: "reviews", title: "Reviews", content: "Customer ratings and verified owner feedback." }
            ]).map((tab, idx) => (
              <div key={tab.id} className="p-2.5 rounded-lg border border-slate-200 bg-white space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={tab.title}
                    onChange={(e) => {
                      const updated = [...(el.tabsData || [])];
                      if (!updated[idx]) return;
                      updated[idx] = { ...updated[idx], title: e.target.value };
                      updateProp("tabsData", updated);
                    }}
                    className="font-bold text-xs border border-slate-200 rounded px-2 py-1 flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const updated = (el.tabsData || []).filter((_, i) => i !== idx);
                      updateProp("tabsData", updated);
                    }}
                    className="text-rose-500 font-bold text-xs hover:text-rose-700 px-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={tab.content}
                  onChange={(e) => {
                    const updated = [...(el.tabsData || [])];
                    if (!updated[idx]) return;
                    updated[idx] = { ...updated[idx], content: e.target.value };
                    updateProp("tabsData", updated);
                  }}
                  className="w-full text-xs border border-slate-200 rounded p-1.5 font-normal"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* F-302: wc-additional-info */}
      {el.type === "wc-additional-info" && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">📋 Specification Attributes</h4>
            <button
              type="button"
              onClick={() => {
                const existing = el.additionalInfoAttributes || [
                  { key: "Weight", value: "250g" },
                  { key: "Dimensions", value: "18 x 15 x 8 cm" },
                  { key: "Warranty", value: "2 Years" }
                ];
                updateProp("additionalInfoAttributes", [...existing, { key: "Attribute", value: "Value" }]);
              }}
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
            >
              + Add Attribute
            </button>
          </div>

          <div className="space-y-2 max-h-52 overflow-y-auto">
            {(el.additionalInfoAttributes || [
              { key: "Weight", value: "250g" },
              { key: "Dimensions", value: "18 x 15 x 8 cm" },
              { key: "Warranty", value: "2 Years" }
            ]).map((attr, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Key"
                  value={attr.key}
                  onChange={(e) => {
                    const updated = [...(el.additionalInfoAttributes || [])];
                    if (!updated[idx]) return;
                    updated[idx] = { ...updated[idx], key: e.target.value };
                    updateProp("additionalInfoAttributes", updated);
                  }}
                  className="w-2/5 p-1.5 text-xs rounded border border-slate-300 font-bold bg-white"
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={attr.value}
                  onChange={(e) => {
                    const updated = [...(el.additionalInfoAttributes || [])];
                    if (!updated[idx]) return;
                    updated[idx] = { ...updated[idx], value: e.target.value };
                    updateProp("additionalInfoAttributes", updated);
                  }}
                  className="flex-1 p-1.5 text-xs rounded border border-slate-300 bg-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    const updated = (el.additionalInfoAttributes || []).filter((_, i) => i !== idx);
                    updateProp("additionalInfoAttributes", updated);
                  }}
                  className="text-rose-500 font-bold text-xs hover:text-rose-700 px-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* F-303 & F-304: wc-related-products & wc-upsells */}
      {(el.type === "wc-related-products" || el.type === "wc-upsells") && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">🔄 Slicing & Grid Layout</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-1">Item Limit (2-8)</label>
              <input
                type="number"
                min={2}
                max={8}
                value={el.relatedLimit ?? el.upsellsLimit ?? 3}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 3;
                  updateProp("relatedLimit", val);
                  updateProp("upsellsLimit", val);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-1">Columns</label>
              <select
                value={el.relatedColumns ?? el.upsellsColumns ?? 3}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 3;
                  updateProp("relatedColumns", val);
                  updateProp("upsellsColumns", val);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
              >
                <option value={1}>1 Column</option>
                <option value={2}>2 Columns</option>
                <option value={3}>3 Columns</option>
                <option value={4}>4 Columns</option>
              </select>
            </div>
          </div>
          {el.type === "wc-related-products" && (
            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-1">Matching Criteria</label>
              <select
                value={el.relatedCriteria || "category"}
                onChange={(e) => updateProp("relatedCriteria", e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
              >
                <option value="category">Matching Category</option>
                <option value="all">Global Catalog / Top Items</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* F-305: wc-products */}
      {el.type === "wc-products" && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">🛍️ Query Catalog Settings</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-1">Order By</label>
              <select
                value={el.productsOrderBy || "date"}
                onChange={(e) => updateProp("productsOrderBy", e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium"
              >
                <option value="date">Date (Newest)</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="rating">Top Rated</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-1">Layout</label>
              <select
                value={el.productsLayout || "grid"}
                onChange={(e) => updateProp("productsLayout", e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium"
              >
                <option value="grid">Grid View</option>
                <option value="list">List View</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Products Per Page ({el.productsPerPage || 8})</label>
            <input
              type="range"
              min={2}
              max={24}
              step={2}
              value={el.productsPerPage || 8}
              onChange={(e) => updateProp("productsPerPage", parseInt(e.target.value, 10))}
              className="w-full cursor-pointer accent-purple-600"
            />
          </div>
        </div>
      )}

      {/* F-306: wc-custom-add-to-cart */}
      {el.type === "wc-custom-add-to-cart" && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">➕ Target Product Binding</h4>
          <div>
            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Select Specific Product / SKU</label>
            <select
              value={el.customAddToCartProductId || el.productId || ""}
              onChange={(e) => {
                updateProp("customAddToCartProductId", e.target.value);
                updateProp("productId", e.target.value);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800"
            >
              <option value="">-- Choose Store SKU --</option>
              {(siteProducts || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} [{p.id}] - {p.price}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* F-314: wc-shop-layouts */}
      {el.type === "wc-shop-layouts" && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">📐 Grid Layout Switcher</h4>
          <div>
            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Columns</label>
            <select
              value={el.shopLayoutColumns || 3}
              onChange={(e) => updateProp("shopLayoutColumns", parseInt(e.target.value, 10))}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
            >
              <option value={2}>2 Columns</option>
              <option value={3}>3 Columns</option>
              <option value={4}>4 Columns</option>
              <option value={5}>5 Columns</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Responsive Gap: {el.shopLayoutGap || 16}px</label>
            <input
              type="range"
              min={8}
              max={48}
              step={4}
              value={el.shopLayoutGap || 16}
              onChange={(e) => updateProp("shopLayoutGap", parseInt(e.target.value, 10))}
              className="w-full cursor-pointer accent-purple-600"
            />
          </div>
        </div>
      )}

      {/* F-309 & F-310: wc-cart & wc-checkout */}
      {(el.type === "wc-cart" || el.type === "wc-checkout") && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">💳 Cart & Checkout Styling</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-1">Button / Accent Color</label>
              <input
                type="color"
                value={el.type === "wc-checkout" ? (el.checkoutAccentColor || "#10b981") : (el.cartAccentColor || "#4f46e5")}
                onChange={(e) => {
                  if (el.type === "wc-checkout") updateProp("checkoutAccentColor", e.target.value);
                  else updateProp("cartAccentColor", e.target.value);
                }}
                className="w-full h-8 rounded border border-slate-200 cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-1">Button Label</label>
              <input
                type="text"
                value={el.type === "wc-checkout" ? (el.checkoutButtonLabel || "Place Order") : (el.cartButtonLabel || "Apply")}
                onChange={(e) => {
                  if (el.type === "wc-checkout") updateProp("checkoutButtonLabel", e.target.value);
                  else updateProp("cartButtonLabel", e.target.value);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium"
              />
            </div>
          </div>
          <div className="space-y-1.5 pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={el.type === "wc-checkout" ? (el.checkoutShowCoupons ?? true) : (el.cartShowCoupons ?? true)}
                onChange={(e) => {
                  if (el.type === "wc-checkout") updateProp("checkoutShowCoupons", e.target.checked);
                  else updateProp("cartShowCoupons", e.target.checked);
                }}
                className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <span>Enable Coupon Discount Field</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={el.type === "wc-checkout" ? (el.checkoutShowShippingCalc ?? true) : (el.cartShowShippingCalc ?? true)}
                onChange={(e) => {
                  if (el.type === "wc-checkout") updateProp("checkoutShowShippingCalc", e.target.checked);
                  else updateProp("cartShowShippingCalc", e.target.checked);
                }}
                className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <span>Enable Shipping Calculator Display</span>
            </label>
          </div>
        </div>
      )}

      {/* X-799: wc-product-addons */}
      {el.type === "wc-product-addons" && (
        <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
              <span>🧩</span> Product Add-Ons Manager
            </h4>
            <button
              type="button"
              onClick={() => {
                const existing: ProductAddonItem[] = el.productAddons || [
                  { id: "addon-gift", label: "Luxury Gift Wrapping & Ribbon", type: "checkbox", priceAdjustment: 4.99 },
                  { id: "addon-warranty", label: "2-Year Extended Hardware Protection", type: "checkbox", priceAdjustment: 19.99 },
                  { id: "addon-engrave", label: "Custom Laser Name Engraving", type: "text", priceAdjustment: 9.99 },
                ];
                const newAddon: ProductAddonItem = {
                  id: `addon-${Date.now()}`,
                  label: "New Add-On Option",
                  type: "checkbox",
                  priceAdjustment: 5.0,
                  required: false,
                };
                updateProp("productAddons", [...existing, newAddon]);
              }}
              className="px-2 py-1 bg-purple-600 text-white rounded-md text-[10px] font-bold shadow-xs hover:bg-purple-700 cursor-pointer"
            >
              + Add Add-On
            </button>
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {((el.productAddons && el.productAddons.length > 0 ? el.productAddons : [
              { id: "addon-gift", label: "Luxury Gift Wrapping & Ribbon", type: "checkbox", priceAdjustment: 4.99 },
              { id: "addon-warranty", label: "2-Year Extended Hardware Protection", type: "checkbox", priceAdjustment: 19.99 },
              { id: "addon-engrave", label: "Custom Laser Name Engraving", type: "text", priceAdjustment: 9.99 },
              { id: "addon-cable", label: "Audio Cable Upgrade", type: "select", priceAdjustment: 14.99, options: ["Braided Silver 3.5mm (+$14.99)", "Balanced 4.4mm (+$24.99)"] },
            ]) as ProductAddonItem[]).map((addon: ProductAddonItem, idx: number) => (
              <div key={addon.id} className="p-2.5 rounded-lg border border-purple-200 bg-white space-y-2 shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={addon.label}
                    placeholder="Add-on Label"
                    onChange={(e) => {
                      const updated = [...(el.productAddons || [])];
                      if (!updated[idx]) return;
                      updated[idx] = { ...updated[idx], label: e.target.value };
                      updateProp("productAddons", updated);
                    }}
                    className="font-bold text-xs border border-slate-200 rounded px-2 py-1 flex-1 outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const updated = (el.productAddons || []).filter((_, i) => i !== idx);
                      updateProp("productAddons", updated);
                    }}
                    className="text-rose-500 font-bold text-xs hover:text-rose-700 px-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Input Type</label>
                    <select
                      value={addon.type}
                      onChange={(e) => {
                        const updated = [...(el.productAddons || [])];
                        if (!updated[idx]) return;
                        updated[idx] = { ...updated[idx], type: e.target.value as any };
                        updateProp("productAddons", updated);
                      }}
                      className="w-full text-xs border border-slate-200 rounded px-2 py-1 bg-white font-medium"
                    >
                      <option value="checkbox">Checkbox</option>
                      <option value="select">Dropdown Select</option>
                      <option value="radio">Radio Group</option>
                      <option value="text">Text Input</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Price Adjustment (+₹/$)</label>
                    <input
                      type="number"
                      step={0.5}
                      value={addon.priceAdjustment}
                      onChange={(e) => {
                        const updated = [...(el.productAddons || [])];
                        if (!updated[idx]) return;
                        updated[idx] = { ...updated[idx], priceAdjustment: parseFloat(e.target.value) || 0 };
                        updateProp("productAddons", updated);
                      }}
                      className="w-full text-xs border border-slate-200 rounded px-2 py-1 font-bold text-emerald-700 bg-white"
                    />
                  </div>
                </div>

                {(addon.type === "select" || addon.type === "radio") && (
                  <div>
                    <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Options (comma-separated)</label>
                    <input
                      type="text"
                      placeholder="Option 1 (+ $5), Option 2 (+ $10)"
                      value={(addon.options || []).join(", ")}
                      onChange={(e) => {
                        const updated = [...(el.productAddons || [])];
                        if (!updated[idx]) return;
                        const opts = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                        updated[idx] = { ...updated[idx], options: opts };
                        updateProp("productAddons", updated);
                      }}
                      className="w-full text-xs border border-slate-200 rounded px-2 py-1 bg-white"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
