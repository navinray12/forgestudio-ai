/**
 * WcProductRatingWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useWooCommerce } from "../../../../../context/WooCommerceContext";
import type { EditorElement, DeviceMode, ElementStyles, SiteProduct } from "../../../types";
import { getMergedStyles } from "../../../utils";

export const WcProductRatingWidgetRenderer: React.FC<{ el: EditorElement; getMergedStyles?: any; activeDevice?: DeviceMode; isPreview?: boolean; mergedStyles?: React.CSSProperties | ElementStyles | any; siteProducts?: SiteProduct[] }> = ({ el, getMergedStyles, activeDevice, mergedStyles, siteProducts }) => {
  const wc = useWooCommerce();
  const styles = mergedStyles || (getMergedStyles ? getMergedStyles(el, activeDevice) : {});
  const prodList = siteProducts && siteProducts.length > 0 ? siteProducts : wc.products;
  const connected = prodList.find((p) => p.id === el.productId) || prodList[0];
  const rating = connected?.rating ?? el.productRating ?? 4.9;
  const count = connected?.ratingCount ?? el.productRatingCount ?? 142;

  const fullStars = Math.floor(rating);
  const starColor = el.productStarColor || "#f59e0b";

  return (
    <div style={styles as React.CSSProperties} className="inline-flex items-center gap-1.5 font-bold" aria-label={`Rated ${rating} out of 5 stars from ${count} reviews`}>
      <div className="flex items-center text-amber-500 text-sm" style={{ color: starColor }}>
        {"★".repeat(fullStars)}
        {"☆".repeat(5 - fullStars)}
      </div>
      <span className="text-xs text-slate-900 font-extrabold">{rating.toFixed(1)}</span>
      <span className="text-xs text-slate-500 font-medium">({count} customer reviews)</span>
    </div>
  );
};
