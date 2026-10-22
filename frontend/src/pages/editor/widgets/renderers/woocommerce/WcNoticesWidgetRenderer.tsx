/**
 * WcNoticesWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useWooCommerce } from "../../../../../context/WooCommerceContext";
import type { EditorElement, DeviceMode } from "../../../types";
import { getMergedStyles } from "../../../utils";

export const WcNoticesWidgetRenderer: React.FC<{ el: EditorElement; getMergedStyles?: any; activeDevice?: DeviceMode; mergedStyles?: any }> = ({ el, getMergedStyles, activeDevice, mergedStyles }) => {
  const wc = useWooCommerce();
  const styles = mergedStyles || (getMergedStyles ? getMergedStyles(el, activeDevice) : {});

  return (
    <div style={styles as React.CSSProperties} className="space-y-2">
      {wc.notices.length === 0 ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3.5 text-xs text-blue-900 font-bold flex items-center justify-between shadow-2xs">
          <span className="flex items-center gap-2"><span>ℹ️</span> Free Express Shipping on all orders over $50!</span>
        </div>
      ) : (
        wc.notices.map((notice) => (
          <div
            key={notice.id}
            className={`rounded-xl p-3.5 text-xs font-extrabold flex items-center justify-between shadow-2xs ${
              notice.type === "error" ? "bg-rose-50 text-rose-900 border border-rose-200" : notice.type === "info" ? "bg-blue-50 text-blue-900 border border-blue-200" : "bg-emerald-50 text-emerald-900 border border-emerald-200"
            }`}
          >
            <span>{notice.message}</span>
            <button type="button" onClick={() => wc.dismissNotice(notice.id)} className="ml-2 opacity-70 hover:opacity-100 font-extrabold">✕</button>
          </div>
        ))
      )}
    </div>
  );
};
