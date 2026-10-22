/**
 * CounterWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement } from "../../types";

// Counter Inspector (F-156)
export function CounterWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  return (
    <div className="space-y-3 pt-2 border-t border-slate-100">
      <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
        <span>🔢</span> Counter Settings
      </h3>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Starting Value</label>
          <input
            type="number"
            value={el.counterStart ?? 0}
            onChange={(e) => updateProp("counterStart", Number(e.target.value))}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Ending Value</label>
          <input
            type="number"
            value={el.counterEnd ?? 100}
            onChange={(e) => updateProp("counterEnd", Number(e.target.value))}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Prefix String</label>
          <input
            type="text"
            value={el.counterPrefix || ""}
            onChange={(e) => updateProp("counterPrefix", e.target.value)}
            placeholder="$ or #"
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Suffix String</label>
          <input
            type="text"
            value={el.counterSuffix || ""}
            onChange={(e) => updateProp("counterSuffix", e.target.value)}
            placeholder="+ or %"
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Animation Duration (ms)</label>
          <input
            type="number"
            step={100}
            value={el.counterDuration ?? 2000}
            onChange={(e) => updateProp("counterDuration", Number(e.target.value))}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Title Label</label>
          <input
            type="text"
            value={el.counterTitle || ""}
            onChange={(e) => updateProp("counterTitle", e.target.value)}
            placeholder="Happy Customers"
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
          />
        </div>
      </div>
    </div>
  );
}
