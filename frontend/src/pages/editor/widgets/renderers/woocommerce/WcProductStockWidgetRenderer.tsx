/**
 * WcProductStockWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useWooCommerce } from "../../../../../context/WooCommerceContext";
import type { EditorElement, DeviceMode, SiteProduct } from "../../../types";
import { getMergedStyles } from "../../../utils";

export const WcProductStockWidgetRenderer: React.FC<{ el: EditorElement; getMergedStyles?: any; activeDevice?: DeviceMode; mergedStyles?: any; siteProducts?: SiteProduct[] }> = ({ el, getMergedStyles, activeDevice, mergedStyles, siteProducts }) => {
  const wc = useWooCommerce();
  const styles = mergedStyles || (getMergedStyles ? getMergedStyles(el, activeDevice) : {});
  const prodList = siteProducts && siteProducts.length > 0 ? siteProducts : wc.products;
  const prod = prodList.find((p) => p.id === el.productId) || prodList[0];
  const inStock = prod?.inStock ?? true;

  const threshold = el.stockThreshold ?? 5;
  const isLowStock = inStock && threshold > 0 && typeof (prod as any)?.stock === "number" && (prod as any).stock <= threshold;

  const label = !inStock
    ? (el.outOfStockLabel || "Out of Stock")
    : isLowStock
    ? (el.lowStockLabel || `Low Stock - Only ${(prod as any).stock} left!`)
    : (el.inStockLabel || "In Stock (Ready to Ship)");

  const badgeBg = !inStock
    ? (el.outOfStockColor ? `${el.outOfStockColor}15` : undefined)
    : isLowStock
    ? (el.lowStockColor ? `${el.lowStockColor}15` : undefined)
    : (el.inStockColor ? `${el.inStockColor}15` : undefined);

  const badgeColor = !inStock
    ? (el.outOfStockColor || "#be123c")
    : isLowStock
    ? (el.lowStockColor || "#b45309")
    : (el.inStockColor || "#047857");

  const badgeBorder = !inStock
    ? (el.outOfStockColor ? `${el.outOfStockColor}30` : undefined)
    : isLowStock
    ? (el.lowStockColor ? `${el.lowStockColor}30` : undefined)
    : (el.inStockColor ? `${el.inStockColor}30` : undefined);

  return (
    <div
      style={{
        ...styles,
        backgroundColor: badgeBg || (inStock ? (isLowStock ? "#fffbeb" : "#ecfdf5") : "#fff1f2"),
        color: badgeColor,
        borderColor: badgeBorder || (inStock ? (isLowStock ? "#fde68a" : "#a7f3d0") : "#fecdd3"),
      } as React.CSSProperties}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-extrabold border"
    >
      <span
        style={{ backgroundColor: badgeColor }}
        className={`h-2.5 w-2.5 rounded-full ${inStock ? "animate-pulse" : ""}`}
      />
      <span>{label}</span>
    </div>
  );
};
