/**
 * RatingWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement } from "../../types";

// Rating Inspector (F-160)
export function RatingWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  return (
    <div className="space-y-3 pt-2 border-t border-slate-100">
      <h3 className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
        <span>⭐</span> Rating Settings
      </h3>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Rating Score</label>
          <input
            type="number"
            step={0.1}
            min={0}
            max={el.ratingMax || 5}
            value={el.ratingValue ?? 4.8}
            onChange={(e) => updateProp("ratingValue", Number(e.target.value))}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Scale Max</label>
          <select
            value={el.ratingMax || 5}
            onChange={(e) => updateProp("ratingMax", Number(e.target.value))}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
          >
            <option value={5}>5 Stars</option>
            <option value={10}>10 Stars</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Star Icon Color</label>
          <input
            type="color"
            value={el.ratingColor || "#f59e0b"}
            onChange={(e) => updateProp("ratingColor", e.target.value)}
            className="h-8 w-full rounded cursor-pointer border border-slate-300 p-0.5"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Show Numerical Score</label>
          <select
            value={el.ratingShowText ? "true" : "false"}
            onChange={(e) => updateProp("ratingShowText", e.target.value === "true")}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
      </div>
    </div>
  );
}
