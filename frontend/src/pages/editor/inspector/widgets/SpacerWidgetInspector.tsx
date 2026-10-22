/**
 * SpacerWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement } from "../../types";

// Spacer Inspector (F-170)
export function SpacerWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  return (
    <div className="space-y-3 pt-2 border-t border-slate-100">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
        <span>↕️</span> Spacer Settings
      </h3>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Height (px)</label>
        <input
          type="number"
          min={5}
          max={400}
          value={el.spacerHeight ?? 40}
          onChange={(e) => updateProp("spacerHeight", Number(e.target.value))}
          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
        />
      </div>
    </div>
  );
}
