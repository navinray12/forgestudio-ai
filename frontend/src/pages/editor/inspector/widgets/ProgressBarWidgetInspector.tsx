/**
 * ProgressBarWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement } from "../../types";

// Progress Bar Inspector (F-157)
export function ProgressBarWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  return (
    <div className="space-y-3 pt-2 border-t border-slate-100">
      <h3 className="text-xs font-bold uppercase tracking-wider text-teal-600 flex items-center gap-1.5">
        <span>📊</span> Progress Bar Settings
      </h3>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Label</label>
        <input
          type="text"
          value={el.progressLabel || "Web Development Mastery"}
          onChange={(e) => updateProp("progressLabel", e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Percentage (0-100%)</label>
          <input
            type="number"
            min={0}
            max={100}
            value={el.progressValue ?? 85}
            onChange={(e) => updateProp("progressValue", Math.min(100, Math.max(0, Number(e.target.value))))}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Bar Height (px)</label>
          <input
            type="number"
            min={4}
            max={50}
            value={el.progressHeight ?? 12}
            onChange={(e) => updateProp("progressHeight", Number(e.target.value))}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
          />
        </div>
      </div>
    </div>
  );
}
