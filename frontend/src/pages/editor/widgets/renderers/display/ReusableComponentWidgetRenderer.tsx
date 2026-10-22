/**
 * ReusableComponentWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import type { EditorElement, ElementStyles } from "../../../types";

// ==========================================
// REUSABLE COMPONENT WIDGET RENDERER
// ==========================================
export const ReusableComponentWidgetRenderer = ({
  el,
  isPreview: _isPreview,
  mergedStyles,
}: {
  el: EditorElement;
  isPreview?: boolean;
  mergedStyles?: ElementStyles | any;
}) => {
  const compName = el.componentName || el.content || "Saved Reusable Component";

  return (
    <div
      className="w-full rounded-2xl border border-purple-300 bg-purple-50/40 p-5 transition shadow-xs hover:border-purple-400"
      style={mergedStyles as React.CSSProperties}
    >
      <div className="flex items-center justify-between mb-3 border-b border-purple-200/60 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🧩</span>
          <span className="text-xs font-bold text-purple-900">{compName}</span>
        </div>
        <span className="text-[9px] font-extrabold uppercase tracking-wider text-purple-700 bg-purple-200/60 px-2 py-0.5 rounded-full">
          Reusable Block
        </span>
      </div>

      <div className="text-xs text-purple-800 leading-relaxed font-medium">
        {el.content || "Dynamic Reusable Component instance rendered on canvas."}
      </div>
    </div>
  );
};
