/**
 * WcProductMetaWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useWooCommerce } from "../../../../../context/WooCommerceContext";
import type { EditorElement, DeviceMode, SiteProduct } from "../../../types";
import { getMergedStyles } from "../../../utils";

export const WcProductMetaWidgetRenderer: React.FC<{ el: EditorElement; getMergedStyles?: any; activeDevice?: DeviceMode; mergedStyles?: any; siteProducts?: SiteProduct[] }> = ({ el, getMergedStyles, activeDevice, mergedStyles, siteProducts }) => {
  const wc = useWooCommerce();
  const styles = mergedStyles || (getMergedStyles ? getMergedStyles(el, activeDevice) : {});
  const prodList = siteProducts && siteProducts.length > 0 ? siteProducts : wc.products;
  const prod = prodList.find((p) => p.id === el.productId) || prodList[0];

  const showSku = el.metaShowSku ?? true;
  const showCategory = el.metaShowCategory ?? true;
  const showTags = el.metaShowTags ?? true;
  const separator = el.metaSeparator || " • ";

  return (
    <div style={styles as React.CSSProperties} className="text-xs space-y-1.5 text-slate-600 border-t border-slate-200 pt-3">
      {showSku && (
        <p>
          <strong className="text-slate-900 font-extrabold">SKU:</strong>{" "}
          <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">{prod?.id || "WC-PROD-101"}</span>
        </p>
      )}
      {showCategory && (
        <p>
          <strong className="text-slate-900 font-extrabold">Category:</strong>{" "}
          <button type="button" onClick={() => wc.setActiveCategory(prod?.category || null)} className="text-indigo-600 font-bold hover:underline ml-1">
            {prod?.category || "Audio & Sound"}
          </button>
        </p>
      )}
      {showTags && (
        <p>
          <strong className="text-slate-900 font-extrabold">Tags:</strong>{" "}
          <span className="text-slate-500 font-medium">Electronics{separator}Wireless{separator}Studio Audio</span>
        </p>
      )}
    </div>
  );
};
