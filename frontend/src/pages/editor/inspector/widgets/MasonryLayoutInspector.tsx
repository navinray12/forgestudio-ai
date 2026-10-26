/**
 * MasonryLayoutInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement } from "../../types";

// F-051 Masonry Layout Inspector
export function MasonryLayoutInspector({
  el,
  updateProp,
  updateLayout
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
  updateLayout: (key: string, val: any) => void;
}) {
  const isMasonry = el.layout?.layoutType === "masonry" || el.masonryMode || false;
  const cols = el.layout?.masonryColumns || el.masonryColumns || 3;
  const gap = el.layout?.masonryGap ?? el.masonryGap ?? 16;
  const engine = el.layout?.masonryEngine || el.masonryEngine || "css-columns";

  const toggleMasonry = (enabled: boolean) => {
    updateLayout("layoutType", enabled ? "masonry" : "flex");
    updateProp("masonryMode", enabled);
  };

  return (
    <div className="space-y-3 pt-3 border-t border-slate-200" id="masonry-layout-inspector">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <span>🧱</span> Masonry Layout (F-051)
        </h4>
        <input
          type="checkbox"
          checked={isMasonry}
          onChange={(e) => toggleMasonry(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
        />
      </div>

      {isMasonry && (
        <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Columns Count</label>
              <select
                value={cols}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  updateLayout("masonryColumns", val);
                  updateProp("masonryColumns", val);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800"
              >
                <option value={1}>1 Column</option>
                <option value={2}>2 Columns</option>
                <option value={3}>3 Columns</option>
                <option value={4}>4 Columns</option>
                <option value={5}>5 Columns</option>
                <option value={6}>6 Columns</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Gap Spacing (px)</label>
              <input
                type="number"
                min={0}
                max={60}
                value={gap}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  updateLayout("masonryGap", val);
                  updateProp("masonryGap", val);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Masonry Flow Engine</label>
            <select
              value={engine}
              onChange={(e) => {
                updateLayout("masonryEngine", e.target.value);
                updateProp("masonryEngine", e.target.value);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800"
            >
              <option value="css-columns">CSS Multi-Column Auto-Wrap</option>
              <option value="js-auto-flow">Dynamic JS Height Auto-Pack Engine</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
