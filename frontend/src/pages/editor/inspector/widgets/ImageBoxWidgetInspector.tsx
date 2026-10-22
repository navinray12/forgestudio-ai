/**
 * ImageBoxWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement } from "../../types";
import { ImagePickerControl } from "../shared/imagePicker";

// Image Box Inspector (F-148)
export function ImageBoxWidgetInspector({
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
      <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
        <span>🖼️</span> Image Box Settings
      </h3>

      <ImagePickerControl
        label="Image Source"
        value={el.src || ""}
        onChange={(url) => updateProp("src", url)}
      />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Image Position</label>
          <select
            value={el.imageBoxPosition || "top"}
            onChange={(e) => updateProp("imageBoxPosition", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
          >
            <option value="top">Top</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Hover Scale Effect</label>
          <select
            value={el.imageBoxHoverEffect || "zoom"}
            onChange={(e) => updateProp("imageBoxHoverEffect", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
          >
            <option value="zoom">Zoom Scale</option>
            <option value="lift">Lift Card</option>
            <option value="none">None</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Title</label>
        <input
          type="text"
          value={el.title || ""}
          onChange={(e) => updateProp("title", e.target.value)}
          placeholder="Feature Title..."
          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
        <textarea
          rows={3}
          value={el.content || ""}
          onChange={(e) => updateProp("content", e.target.value)}
          placeholder="Feature description text..."
          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Link URL</label>
        <input
          type="text"
          value={el.href || ""}
          onChange={(e) => updateProp("href", e.target.value)}
          placeholder="https://..."
          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
        />
      </div>
    </div>
  );
}
