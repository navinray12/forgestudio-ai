/**
 * WcShortDescriptionWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useWooCommerce } from "../../../../../context/WooCommerceContext";
import type { EditorElement, DeviceMode, SiteProduct } from "../../../types";
import { getMergedStyles } from "../../../utils";

export const WcShortDescriptionWidgetRenderer: React.FC<{ el: EditorElement; getMergedStyles?: any; activeDevice?: DeviceMode; mergedStyles?: any; siteProducts?: SiteProduct[] }> = ({ el, getMergedStyles, activeDevice, mergedStyles, siteProducts }) => {
  const wc = useWooCommerce();
  const styles = mergedStyles || (getMergedStyles ? getMergedStyles(el, activeDevice) : {});
  const prodList = siteProducts && siteProducts.length > 0 ? siteProducts : wc.products;
  const prod = prodList.find((p) => p.id === el.productId) || prodList[0];
  const shortDesc = el.productDescriptionOverride || el.content || prod?.description || "Ultra-lightweight wireless headphones engineered for studio acoustic purity and all-day comfort.";

  return (
    <p
      style={{
        ...styles,
        color: el.productTextColor || (styles as any)?.color || undefined,
        fontFamily: el.productTypography || (styles as any)?.fontFamily || undefined,
      } as React.CSSProperties}
      className="text-xs text-slate-600 font-medium leading-normal italic border-l-2 border-indigo-500 pl-3 py-1"
    >
      {shortDesc}
    </p>
  );
};
