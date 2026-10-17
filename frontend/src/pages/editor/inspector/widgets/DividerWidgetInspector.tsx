/**
 * DividerWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement } from "../../types";

// Divider Inspector (F-169)
export function DividerWidgetInspector({
  el,
  updateProp,
  updateStyle
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
  updateStyle: (key: string, val: any) => void;
}) {
  return (
    <div className="space-y-3 pt-2 border-t border-slate-100">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
        <span>➖</span> Divider Settings
      </h3>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Style</label>
          <select
            value={el.dividerStyle || "solid"}
            onChange={(e) => updateProp("dividerStyle", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
          >
            <option value="solid">Solid Line</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
            <option value="double">Double Line</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Thickness (px)</label>
          <input
            type="number"
            min={1}
            max={20}
            value={el.dividerWeight ?? 2}
            onChange={(e) => updateProp("dividerWeight", Number(e.target.value))}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Color</label>
          <input
            type="color"
            value={el.dividerColor || "#cbd5e1"}
            onChange={(e) => updateProp("dividerColor", e.target.value)}
            className="h-8 w-full rounded cursor-pointer border border-slate-300 p-0.5"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Width (%)</label>
          <input
            type="text"
            value={el.dividerWidth || "100%"}
            onChange={(e) => updateProp("dividerWidth", e.target.value)}
            placeholder="100% or 500px"
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
          />
        </div>
      </div>
    </div>
  );
}
