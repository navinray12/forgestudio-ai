/**
 * WcProductArchiveWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useWooCommerce } from "../../../../../context/WooCommerceContext";
import type { EditorElement, DeviceMode, SiteProduct } from "../../../types";
import { getMergedStyles } from "../../../utils";
import { WcProductsWidgetRenderer } from "./WcProductsWidgetRenderer";
import { WcShopLayoutsWidgetRenderer } from "./WcShopLayoutsWidgetRenderer";

export const WcProductArchiveWidgetRenderer: React.FC<{ el: EditorElement; getMergedStyles?: any; activeDevice?: DeviceMode; mergedStyles?: any; siteProducts?: SiteProduct[] }> = ({ el, getMergedStyles, activeDevice, mergedStyles, siteProducts }) => {
  const wc = useWooCommerce();
  const styles = mergedStyles || (getMergedStyles ? getMergedStyles(el, activeDevice) : {});

  return (
    <div style={styles as React.CSSProperties} className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200 pb-3 gap-2">
        <div>
          <h3 className="font-extrabold text-base text-slate-900">Product Archive Catalog</h3>
          <p className="text-xs text-slate-500">Showing {wc.products.length} store items</p>
        </div>
        <WcShopLayoutsWidgetRenderer el={el} />
      </div>
      <WcProductsWidgetRenderer el={el} mergedStyles={{}} siteProducts={siteProducts} />
    </div>
  );
};
