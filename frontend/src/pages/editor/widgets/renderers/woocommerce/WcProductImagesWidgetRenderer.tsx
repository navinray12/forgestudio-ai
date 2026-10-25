/**
 * WcProductImagesWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState } from "react";
import { useWooCommerce } from "../../../../../context/WooCommerceContext";
import type { EditorElement, DeviceMode, ElementStyles, SiteProduct } from "../../../types";
import { getMergedStyles } from "../../../utils";

export const WcProductImagesWidgetRenderer: React.FC<{ el: EditorElement; getMergedStyles?: any; activeDevice?: DeviceMode; isPreview?: boolean; mergedStyles?: React.CSSProperties | ElementStyles | any; siteProducts?: SiteProduct[] }> = ({ el, getMergedStyles, activeDevice, isPreview, mergedStyles, siteProducts }) => {
  const wc = useWooCommerce();
  const styles = mergedStyles || (getMergedStyles ? getMergedStyles(el, activeDevice) : {});
  const prodList = siteProducts && siteProducts.length > 0 ? siteProducts : wc.products;
  const connected = prodList.find((p) => p.id === el.productId) || prodList[0];
  const imgSrc = el.src || el.productImage || connected?.image || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800";
  const [activeImg, setActiveImg] = useState(imgSrc);

  const handleLocalImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      el.src = url;
      el.productImage = url;
      el.content = url;
      setActiveImg(url);
    }
  };

  return (
    <div style={styles as React.CSSProperties} className="relative group overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-xs space-y-3">
      <div className="relative overflow-hidden rounded-xl bg-slate-50 aspect-square">
        <img src={activeImg} alt={el.alt || connected?.name || "Product Image"} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        {connected?.badge && (
          <span className="absolute top-3 left-3 px-3 py-1 bg-indigo-600 text-white font-extrabold text-[10px] uppercase rounded-full shadow-md">
            {connected.badge}
          </span>
        )}
      </div>

      <div className="flex gap-2 justify-center">
        {[imgSrc, "https://images.unsplash.com/photo-1545454675-3531b543be5d?w=400", "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400"].map((thumb, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setActiveImg(thumb)}
            className={`h-12 w-12 rounded-lg border-2 overflow-hidden transition ${activeImg === thumb ? "border-indigo-600 scale-105" : "border-slate-200 opacity-70 hover:opacity-100"}`}
          >
            <img src={thumb} alt={`Thumbnail ${idx + 1}`} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>

      {!isPreview && (
        <div className="absolute inset-3 rounded-xl bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-2 p-2 z-10">
          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-800 rounded-lg text-xs font-bold shadow-md hover:bg-slate-100 cursor-pointer transition active:scale-95">
            <span>📁 Upload Custom Product Image</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleLocalImageSelect} />
          </label>
        </div>
      )}
    </div>
  );
};
