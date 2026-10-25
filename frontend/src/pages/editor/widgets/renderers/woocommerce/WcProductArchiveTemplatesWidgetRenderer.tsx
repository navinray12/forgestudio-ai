/**
 * WcProductArchiveTemplatesWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import type { EditorElement, DeviceMode } from "../../../types";
import { getMergedStyles } from "../../../utils";

export const WcProductArchiveTemplatesWidgetRenderer: React.FC<{ el: EditorElement; getMergedStyles?: any; activeDevice?: DeviceMode; mergedStyles?: any }> = ({ el, getMergedStyles, activeDevice, mergedStyles }) => {
  const styles = mergedStyles || (getMergedStyles ? getMergedStyles(el, activeDevice) : {});
  return (
    <div style={styles as React.CSSProperties} className="rounded-2xl border border-purple-200 bg-purple-50/60 p-4 text-xs font-extrabold text-purple-900 flex items-center gap-2">
      <span>🗄️ Product Archive Template Activated • Full pagination & filters enabled</span>
    </div>
  );
};
