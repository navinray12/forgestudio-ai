/**
 * AlertWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement } from "../../types";

// Alert Inspector (F-161)
export function AlertWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  return (
    <div className="space-y-3 pt-2 border-t border-slate-100">
      <h3 className="text-xs font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1.5">
        <span>🔔</span> Alert Settings
      </h3>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Alert Variant</label>
          <select
            value={el.alertType || "info"}
            onChange={(e) => updateProp("alertType", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
          >
            <option value="info">ℹ️ Info (Blue)</option>
            <option value="success">✅ Success (Green)</option>
            <option value="warning">⚠️ Warning (Yellow)</option>
            <option value="danger">🚨 Danger (Red)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Dismissible Close</label>
          <select
            value={el.alertDismissible ? "true" : "false"}
            onChange={(e) => updateProp("alertDismissible", e.target.value === "true")}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Alert Title</label>
        <input
          type="text"
          value={el.alertTitle || "Notice"}
          onChange={(e) => updateProp("alertTitle", e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Alert Message</label>
        <textarea
          rows={2}
          value={el.content || ""}
          onChange={(e) => updateProp("content", e.target.value)}
          placeholder="Detailed alert message..."
          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
        />
      </div>
    </div>
  );
}
