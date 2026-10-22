/**
 * CustomSVGWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement } from "../../types";

// Custom SVG Inspector (F-221)
export function CustomSVGWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  return (
    <div className="space-y-3 pt-2 border-t border-slate-100">
      <h3 className="text-xs font-bold uppercase tracking-wider text-purple-600 flex items-center gap-1.5">
        <span>🎨</span> Custom SVG Settings
      </h3>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Raw SVG Code</label>
        <textarea
          rows={6}
          value={el.svgCode || ""}
          onChange={(e) => updateProp("svgCode", e.target.value)}
          placeholder="<svg viewBox='0 0 24 24'>...</svg>"
          className="w-full rounded-lg border border-slate-300 bg-slate-900 font-mono text-[11px] text-emerald-400 p-2.5 outline-none"
        />
      </div>
    </div>
  );
}
