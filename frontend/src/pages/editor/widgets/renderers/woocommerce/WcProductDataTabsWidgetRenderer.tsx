/**
 * WcProductDataTabsWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState } from "react";
import { useWooCommerce } from "../../../../../context/WooCommerceContext";
import type { EditorElement, DeviceMode, SiteProduct } from "../../../types";
import { getMergedStyles } from "../../../utils";

export const WcProductDataTabsWidgetRenderer: React.FC<{ el: EditorElement; getMergedStyles?: any; activeDevice?: DeviceMode; mergedStyles?: any; siteProducts?: SiteProduct[] }> = ({ el, getMergedStyles, activeDevice, mergedStyles, siteProducts }) => {
  const wc = useWooCommerce();
  const styles = mergedStyles || (getMergedStyles ? getMergedStyles(el, activeDevice) : {});
  const prodList = siteProducts && siteProducts.length > 0 ? siteProducts : wc.products;
  const prod = prodList.find((p) => p.id === el.productId) || prodList[0];

  const customTabs = el.tabsData && el.tabsData.length > 0 ? el.tabsData : [
    { id: "desc", title: "Description", content: prod?.description || "Crafted with surgical-grade aluminum and plush protein leather ear cushions, this product delivers uncompromised performance and active noise cancellation." },
    { id: "specs", title: "Additional Info", content: "Driver Size: 40mm Neodymium • Battery Life: 40 Hours • Warranty: 2 Years Global" },
    { id: "reviews", title: "Customer Reviews", content: "★★★★★ Alex M. — Exceptional clarity, studio bass, and incredible battery stamina!" },
  ];

  const [activeTabId, setActiveTabId] = useState<string>(customTabs[0]?.id || "desc");
  const currentTab = customTabs.find((t) => t.id === activeTabId) || customTabs[0];

  return (
    <div style={styles as React.CSSProperties} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 text-xs">
      <div className="flex border-b border-slate-200 gap-4 overflow-x-auto font-bold text-slate-600">
        {customTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTabId(t.id)}
            className={`pb-2.5 transition whitespace-nowrap border-b-2 cursor-pointer ${
              activeTabId === t.id ? "border-indigo-600 text-indigo-600 font-extrabold" : "border-transparent hover:text-slate-900"
            }`}
          >
            {t.title}
          </button>
        ))}
      </div>

      <div className="text-slate-600 leading-relaxed min-h-[60px]">
        {currentTab?.content}
      </div>
    </div>
  );
};
