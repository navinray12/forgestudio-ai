/**
 * GoogleMapsWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement } from "../../types";

// Google Maps Inspector (F-167)
export function GoogleMapsWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  return (
    <div className="space-y-3 pt-2 border-t border-slate-100">
      <h3 className="text-xs font-bold uppercase tracking-wider text-red-600 flex items-center gap-1.5">
        <span>📍</span> Google Maps Settings
      </h3>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Address or Location</label>
        <input
          type="text"
          value={el.mapAddress || "San Francisco, CA"}
          onChange={(e) => updateProp("mapAddress", e.target.value)}
          placeholder="1600 Amphitheatre Pkwy, Mountain View, CA"
          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Zoom Level (1-20)</label>
          <input
            type="number"
            min={1}
            max={20}
            value={el.mapZoom ?? 14}
            onChange={(e) => updateProp("mapZoom", Number(e.target.value))}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Height (px)</label>
          <input
            type="number"
            step={10}
            value={el.mapHeight ?? 350}
            onChange={(e) => updateProp("mapHeight", Number(e.target.value))}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
          />
        </div>
      </div>
    </div>
  );
}
