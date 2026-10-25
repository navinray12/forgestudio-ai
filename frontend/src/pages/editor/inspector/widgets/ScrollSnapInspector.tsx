/**
 * ScrollSnapInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement } from "../../types";

// F-050 Scroll Snap Inspector
export function ScrollSnapInspector({
  el,
  updateProp,
  updateStyle,
  updateLayout
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
  updateStyle: (key: string, val: any) => void;
  updateLayout: (key: string, val: any) => void;
}) {
  const currentSnapType = el.layout?.scrollSnapType || el.scrollSnapType || el.styles?.scrollSnapType || "none";
  const currentSnapAlign = el.layout?.scrollSnapAlign || el.scrollSnapAlign || el.styles?.scrollSnapAlign || "none";
  const currentSnapStop = el.layout?.scrollSnapStop || el.scrollSnapStop || el.styles?.scrollSnapStop || "normal";

  const handleTypeChange = (val: string) => {
    updateLayout("scrollSnapType", val);
    updateProp("scrollSnapType", val);
    updateStyle("scrollSnapType", val === "none" ? "" : val);
  };

  const handleAlignChange = (val: string) => {
    updateLayout("scrollSnapAlign", val);
    updateProp("scrollSnapAlign", val);
    updateStyle("scrollSnapAlign", val === "none" ? "" : val);
  };

  const handleStopChange = (val: string) => {
    updateLayout("scrollSnapStop", val);
    updateProp("scrollSnapStop", val);
    updateStyle("scrollSnapStop", val);
  };

  return (
    <div className="space-y-3 pt-3 border-t border-slate-200" id="scroll-snap-inspector">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <span>🎯</span> Scroll Snap (F-050)
        </h4>
        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
          {currentSnapType !== "none" ? "ACTIVE" : "OFF"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Snap Type (Container)</label>
          <select
            value={currentSnapType}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-indigo-500"
          >
            <option value="none">Disabled (None)</option>
            <option value="y mandatory">Vertical Mandatory (y mandatory)</option>
            <option value="y proximity">Vertical Proximity (y proximity)</option>
            <option value="x mandatory">Horizontal Mandatory (x mandatory)</option>
            <option value="x proximity">Horizontal Proximity (x proximity)</option>
            <option value="both mandatory">Both Axes Mandatory</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Snap Alignment (Item)</label>
          <select
            value={currentSnapAlign}
            onChange={(e) => handleAlignChange(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-indigo-500"
          >
            <option value="none">Default (None)</option>
            <option value="start">Start (Top / Left)</option>
            <option value="center">Center</option>
            <option value="end">End (Bottom / Right)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Snap Stop Behavior</label>
          <select
            value={currentSnapStop}
            onChange={(e) => handleStopChange(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-indigo-500"
          >
            <option value="normal">Normal (Pass-through)</option>
            <option value="always">Always Stop (Trap Snap)</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Scroll Padding (Offset)</label>
          <input
            type="text"
            placeholder="e.g. 20px"
            value={el.styles?.scrollPadding || ""}
            onChange={(e) => updateStyle("scrollPadding", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-indigo-500"
          />
        </div>
      </div>
    </div>
  );
}
