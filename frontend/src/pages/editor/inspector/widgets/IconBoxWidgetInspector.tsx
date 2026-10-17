/**
 * IconBoxWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement } from "../../types";

// Icon Box Inspector (F-151)
export function IconBoxWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  return (
    <div className="space-y-3 pt-2 border-t border-slate-100">
      <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
        <span>⭐</span> Icon Box Settings
      </h3>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Icon (Emoji/SVG Name)</label>
          <input
            type="text"
            value={el.iconName || el.icon || "⚡"}
            onChange={(e) => {
              updateProp("iconName", e.target.value);
              updateProp("icon", e.target.value);
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Icon Position</label>
          <select
            value={el.iconBoxPosition || "top"}
            onChange={(e) => updateProp("iconBoxPosition", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
          >
            <option value="top">Top</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Title</label>
        <input
          type="text"
          value={el.title || ""}
          onChange={(e) => updateProp("title", e.target.value)}
          placeholder="Icon Box Heading..."
          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
        <textarea
          rows={3}
          value={el.content || ""}
          onChange={(e) => updateProp("content", e.target.value)}
          placeholder="Descriptive details..."
          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
        />
      </div>
    </div>
  );
}
