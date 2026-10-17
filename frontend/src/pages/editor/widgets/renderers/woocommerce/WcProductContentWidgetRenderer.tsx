/**
 * WcProductContentWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useWooCommerce } from "../../../../../context/WooCommerceContext";
import type { EditorElement, DeviceMode, SiteProduct } from "../../../types";
import { getMergedStyles } from "../../../utils";

export const WcProductContentWidgetRenderer: React.FC<{ el: EditorElement; getMergedStyles?: any; activeDevice?: DeviceMode; mergedStyles?: any; siteProducts?: SiteProduct[] }> = ({ el, getMergedStyles, activeDevice, mergedStyles, siteProducts }) => {
  const wc = useWooCommerce();
  const styles = mergedStyles || (getMergedStyles ? getMergedStyles(el, activeDevice) : {});
  const prodList = siteProducts && siteProducts.length > 0 ? siteProducts : wc.products;
  const prod = prodList.find((p) => p.id === el.productId) || prodList[0];
  const description = el.productDescriptionOverride || el.content || prod?.description || "Experience crystal-clear acoustic fidelity with custom dynamic drivers, memory foam cushions, active noise cancellation, and up to 40 hours of continuous wireless playback.";

  return (
    <div
      style={{
        ...styles,
        color: el.productTextColor || (styles as any)?.color || undefined,
        fontFamily: el.productTypography || (styles as any)?.fontFamily || undefined,
      } as React.CSSProperties}
      className="prose prose-slate text-xs leading-relaxed text-slate-600 bg-white p-4 rounded-xl border border-slate-100"
    >
      <p>{description}</p>
    </div>
  );
};
