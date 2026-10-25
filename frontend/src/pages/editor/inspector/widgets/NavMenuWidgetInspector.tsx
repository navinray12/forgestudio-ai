/**
 * NavMenuWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement, PageConfig, SiteProduct, NavMenuItem, NavSubmenuItem } from "../../types";
import { UniversalItemManager } from "../shared/UniversalItemManager";

// 10. Nav Menu Inspector (F-180 & F-205 Dynamic)
export function NavMenuWidgetInspector({
  el,
  updateProp,
  pages,
  siteProducts,
  onCreatePage,
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
  pages?: PageConfig[];
  siteProducts?: SiteProduct[];
  onCreatePage?: (customName?: string) => PageConfig;
}) {
  const items = el.navMenuItems || [];
  const layout = el.navLayout || "horizontal";
  const alignment = el.navAlignment || "left";
  const gap = el.navGap ?? 24;

  const handleDuplicateItem = (item: NavMenuItem) => {
    const duplicated: NavMenuItem = {
      ...item,
      id: "nav_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      label: `${item.label} (Copy)`
    };
    updateProp("navMenuItems", [...items, duplicated]);
  };

  return (
    <div className="space-y-4">
      {/* Layout & Alignment */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-3">
        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
          <span>🧭</span> Layout & Alignment
        </h4>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Layout</label>
            <select
              value={layout}
              onChange={(e) => updateProp("navLayout", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium"
            >
              <option value="horizontal">Horizontal (Row)</option>
              <option value="vertical">Vertical (Column)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Alignment</label>
            <select
              value={alignment}
              onChange={(e) => updateProp("navAlignment", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
              {layout === "horizontal" && <option value="between">Space Between</option>}
            </select>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-0.5">
            <label className="text-[10px] font-semibold text-slate-500">Item Spacing (Gap)</label>
            <span className="text-[10px] font-bold text-blue-600">{gap}px</span>
          </div>
          <input
            type="range"
            min="0"
            max="64"
            value={gap}
            onChange={(e) => updateProp("navGap", parseInt(e.target.value, 10))}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>
      </div>

      {/* Typography & Styling */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-3">
        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
          <span>🎨</span> Typography & Colors
        </h4>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Font Size</label>
            <input
              type="text"
              value={el.navFontSize || "14px"}
              onChange={(e) => updateProp("navFontSize", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Font Weight</label>
            <select
              value={el.navFontWeight || "600"}
              onChange={(e) => updateProp("navFontWeight", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium"
            >
              <option value="400">Normal (400)</option>
              <option value="500">Medium (500)</option>
              <option value="600">Semi-Bold (600)</option>
              <option value="700">Bold (700)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Text Transform</label>
            <select
              value={el.navTextTransform || "none"}
              onChange={(e) => updateProp("navTextTransform", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium"
            >
              <option value="none">Normal</option>
              <option value="uppercase">UPPERCASE</option>
              <option value="capitalize">Capitalize</option>
            </select>
          </div>
        </div>

        {/* States Colors */}
        <div className="space-y-2 pt-2 border-t border-slate-200">
          <label className="block text-[10px] font-bold text-slate-600 uppercase">Item State Colors</label>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <span className="block text-[9px] text-slate-400 mb-0.5">Normal Color</span>
              <input
                type="color"
                value={el.navItemColor || "#334155"}
                onChange={(e) => updateProp("navItemColor", e.target.value)}
                className="h-6 w-full cursor-pointer rounded border border-slate-200 bg-transparent p-0.5"
              />
            </div>
            <div>
              <span className="block text-[9px] text-slate-400 mb-0.5">Hover Color</span>
              <input
                type="color"
                value={el.navItemHoverColor || "#2563eb"}
                onChange={(e) => updateProp("navItemHoverColor", e.target.value)}
                className="h-6 w-full cursor-pointer rounded border border-slate-200 bg-transparent p-0.5"
              />
            </div>
            <div>
              <span className="block text-[9px] text-slate-400 mb-0.5">Active Color</span>
              <input
                type="color"
                value={el.navItemActiveColor || "#2563eb"}
                onChange={(e) => updateProp("navItemActiveColor", e.target.value)}
                className="h-6 w-full cursor-pointer rounded border border-slate-200 bg-transparent p-0.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <span className="block text-[9px] text-slate-400 mb-0.5">Normal Bg</span>
              <input
                type="color"
                value={el.navItemBg && el.navItemBg !== "transparent" ? el.navItemBg : "#ffffff"}
                onChange={(e) => updateProp("navItemBg", e.target.value)}
                className="h-6 w-full cursor-pointer rounded border border-slate-200 bg-transparent p-0.5"
              />
            </div>
            <div>
              <span className="block text-[9px] text-slate-400 mb-0.5">Hover Bg</span>
              <input
                type="color"
                value={el.navItemHoverBg && !el.navItemHoverBg.startsWith("rgba") ? el.navItemHoverBg : "#f1f5f9"}
                onChange={(e) => updateProp("navItemHoverBg", e.target.value)}
                className="h-6 w-full cursor-pointer rounded border border-slate-200 bg-transparent p-0.5"
              />
            </div>
            <div>
              <span className="block text-[9px] text-slate-400 mb-0.5">Active Bg</span>
              <input
                type="color"
                value={el.navItemActiveBg && !el.navItemActiveBg.startsWith("rgba") ? el.navItemActiveBg : "#eff6ff"}
                onChange={(e) => updateProp("navItemActiveBg", e.target.value)}
                className="h-6 w-full cursor-pointer rounded border border-slate-200 bg-transparent p-0.5"
              />
            </div>
          </div>
        </div>

        {/* Submenu Dropdown Styling */}
        <div className="space-y-2 pt-2 border-t border-slate-200">
          <label className="block text-[10px] font-bold text-slate-600 uppercase">Submenu Dropdown Style</label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="block text-[9px] text-slate-400 mb-0.5">Submenu Background</span>
              <input
                type="color"
                value={el.navSubmenuBg || "#ffffff"}
                onChange={(e) => updateProp("navSubmenuBg", e.target.value)}
                className="h-6 w-full cursor-pointer rounded border border-slate-200 bg-transparent p-0.5"
              />
            </div>
            <div>
              <span className="block text-[9px] text-slate-400 mb-0.5">Submenu Text Color</span>
              <input
                type="color"
                value={el.navSubmenuTextColor || "#334155"}
                onChange={(e) => updateProp("navSubmenuTextColor", e.target.value)}
                className="h-6 w-full cursor-pointer rounded border border-slate-200 bg-transparent p-0.5"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Menu Items Manager */}
      <UniversalItemManager<NavMenuItem>
        title="Navigation Menu Items"
        items={items}
        onUpdate={(newItems) => updateProp("navMenuItems", newItems)}
        createDefaultItem={() => ({
          id: "nav_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
          label: "New Link",
          url: "#",
          linkType: "url",
          target: "_self"
        })}
        getItemHeaderLabel={(item) => {
          let destInfo = "";
          if (item.destinationType === "page" || item.linkType === "page") {
            const page = pages?.find(p => p.id === item.pageId);
            destInfo = page ? ` [Page: ${page.name}]` : ` [Page: Orphaned ⚠️]`;
          } else if (item.destinationType === "product" || item.linkType === "product") {
            const prod = siteProducts?.find(p => p.id === item.productId);
            destInfo = prod ? ` [Product: ${prod.name}]` : ` [Product: Orphaned ⚠️]`;
          }
          return `${item.label}${destInfo}${item.submenu && item.submenu.length > 0 ? ` (${item.submenu.length} sub-items)` : ""}`;
        }}
        renderItemFields={(item, idx, updateItem) => {
          const activeDest = item.destinationType || (item.linkType === "page" ? "page" : item.linkType === "product" ? "product" : "url");

          return (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Link Label</label>
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => updateItem({ label: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Destination Type</label>
                  <select
                    value={activeDest}
                    onChange={(e) => {
                      const typeVal = e.target.value as "url" | "page" | "product";
                      updateItem({
                        destinationType: typeVal,
                        linkType: typeVal === "url" ? "url" : typeVal
                      });
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                  >
                    <option value="url">Custom URL / Anchor</option>
                    <option value="page">📄 Site Page</option>
                    <option value="product">🛍️ Site Product</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Destination Inputs */}
              {activeDest === "url" && (
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Destination URL / Anchor</label>
                  <input
                    type="text"
                    value={item.url}
                    onChange={(e) => updateItem({ url: e.target.value })}
                    placeholder="/page or #section or https://..."
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
              )}

              {activeDest === "page" && (
                <div className="space-y-1 rounded-xl border border-blue-100 bg-blue-50/50 p-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-bold text-blue-900 uppercase">Target Page</label>
                    {onCreatePage && (
                      <button
                        type="button"
                        onClick={() => {
                          const created = onCreatePage();
                          updateItem({
                            pageId: created.id,
                            label: item.label === "New Link" ? created.name : item.label,
                            url: created.slug
                          });
                        }}
                        className="text-[10px] font-extrabold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                      >
                        + Create New Page
                      </button>
                    )}
                  </div>
                  <select
                    value={item.pageId || ""}
                    onChange={(e) => {
                      const selectedP = pages?.find(p => p.id === e.target.value);
                      updateItem({
                        pageId: e.target.value,
                        url: selectedP ? selectedP.slug : item.url,
                        label: item.label === "New Link" && selectedP ? selectedP.name : item.label
                      });
                    }}
                    className="w-full rounded-lg border border-blue-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                  >
                    <option value="">-- Select Page --</option>
                    {(pages || []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.slug}){p.isHome ? " [Home]" : ""}
                      </option>
                    ))}
                  </select>
                  {item.pageId && !pages?.some(p => p.id === item.pageId) && (
                    <span className="block text-[10px] font-bold text-amber-600 bg-amber-50 p-1 rounded border border-amber-200 mt-1">
                      ⚠️ Referenced page no longer exists. Select another or recreate.
                    </span>
                  )}
                </div>
              )}

              {activeDest === "product" && (
                <div className="space-y-1 rounded-xl border border-purple-100 bg-purple-50/50 p-2">
                  <label className="block text-[10px] font-bold text-purple-900 uppercase">Target Product</label>
                  <select
                    value={item.productId || ""}
                    onChange={(e) => {
                      const selectedProd = siteProducts?.find(p => p.id === e.target.value);
                      updateItem({
                        productId: e.target.value,
                        url: selectedProd ? (selectedProd.url || `#product-${selectedProd.id}`) : item.url,
                        label: item.label === "New Link" && selectedProd ? selectedProd.name : item.label
                      });
                    }}
                    className="w-full rounded-lg border border-purple-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                  >
                    <option value="">-- Select Product --</option>
                    {(siteProducts || []).map((prod) => (
                      <option key={prod.id} value={prod.id}>
                        {prod.name} ({prod.price})
                      </option>
                    ))}
                  </select>
                  {item.productId && !siteProducts?.some(p => p.id === item.productId) && (
                    <span className="block text-[10px] font-bold text-amber-600 bg-amber-50 p-1 rounded border border-amber-200 mt-1">
                      ⚠️ Referenced product no longer exists.
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-1.5 text-[11px] text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.target === "_blank"}
                    onChange={(e) => updateItem({ target: e.target.checked ? "_blank" : "_self" })}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>Open in new tab</span>
                </label>

                <button
                  type="button"
                  onClick={() => handleDuplicateItem(item)}
                  className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                >
                  Duplicate
                </button>
              </div>

              {/* Submenu Management */}
              <div className="mt-2 pt-2 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    Submenu Dropdown
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const currentSub = item.submenu || [];
                      const newSubItem: NavSubmenuItem = {
                        id: "sub_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
                        label: `Sub Item ${currentSub.length + 1}`,
                        url: "#"
                      };
                      updateItem({ submenu: [...currentSub, newSubItem] });
                    }}
                    className="px-2 py-0.5 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition cursor-pointer"
                  >
                    + ADD SUBMENU ITEM
                  </button>
                </div>

                {item.submenu && item.submenu.length > 0 ? (
                  <div className="space-y-1.5 pl-2 border-l-2 border-blue-200">
                    {item.submenu.map((sub) => (
                      <div key={sub.id} className="flex flex-col gap-1 bg-slate-50 p-2 rounded-md border border-slate-200">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={sub.label}
                            onChange={(e) => {
                              const newSub = item.submenu!.map((s) => (s.id === sub.id ? { ...s, label: e.target.value } : s));
                              updateItem({ submenu: newSub });
                            }}
                            placeholder="Sub Label"
                            className="w-full rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-medium"
                          />
                          <select
                            value={sub.destinationType || (sub.pageId ? "page" : sub.productId ? "product" : "url")}
                            onChange={(e) => {
                              const val = e.target.value as "url" | "page" | "product";
                              const newSub = item.submenu!.map((s) => (s.id === sub.id ? { ...s, destinationType: val } : s));
                              updateItem({ submenu: newSub });
                            }}
                            className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px] font-semibold"
                          >
                            <option value="url">URL</option>
                            <option value="page">Page</option>
                            <option value="product">Product</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              const newSub = item.submenu!.filter((s) => s.id !== sub.id);
                              updateItem({ submenu: newSub.length > 0 ? newSub : undefined });
                            }}
                            className="text-red-400 hover:text-red-600 text-xs px-1"
                            title="Delete Submenu Item"
                          >
                            ✕
                          </button>
                        </div>
                        {sub.destinationType === "page" ? (
                          <select
                            value={sub.pageId || ""}
                            onChange={(e) => {
                              const selectedP = pages?.find(p => p.id === e.target.value);
                              const newSub = item.submenu!.map((s) => (s.id === sub.id ? { ...s, pageId: e.target.value, url: selectedP?.slug || s.url } : s));
                              updateItem({ submenu: newSub });
                            }}
                            className="w-full rounded border border-blue-200 bg-blue-50/40 px-1.5 py-0.5 text-[10px] font-medium"
                          >
                            <option value="">-- Select Page --</option>
                            {(pages || []).map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        ) : sub.destinationType === "product" ? (
                          <select
                            value={sub.productId || ""}
                            onChange={(e) => {
                              const selectedProd = siteProducts?.find(p => p.id === e.target.value);
                              const newSub = item.submenu!.map((s) => (s.id === sub.id ? { ...s, productId: e.target.value, url: selectedProd?.url || s.url } : s));
                              updateItem({ submenu: newSub });
                            }}
                            className="w-full rounded border border-purple-200 bg-purple-50/40 px-1.5 py-0.5 text-[10px] font-medium"
                          >
                            <option value="">-- Select Product --</option>
                            {(siteProducts || []).map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={sub.url}
                            onChange={(e) => {
                              const newSub = item.submenu!.map((s) => (s.id === sub.id ? { ...s, url: e.target.value } : s));
                              updateItem({ submenu: newSub });
                            }}
                            placeholder="Sub URL"
                            className="w-full rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-mono text-slate-700"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 italic">No submenu items attached.</p>
                )}
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}
