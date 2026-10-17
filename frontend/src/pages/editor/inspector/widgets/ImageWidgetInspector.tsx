/**
 * ImageWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement } from "../../types";
import { ImagePickerControl } from "../shared/imagePicker";

// 1. Single Image Inspector
export function ImageWidgetInspector({
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
        <span>🖼️</span> Image Settings
      </h3>

      {/* Image Source & Upload */}
      <ImagePickerControl
        label="Image Source URL"
        value={el.src || ""}
        onChange={(url) => updateProp("src", url)}
      />

      {el.src && (
        <button
          type="button"
          onClick={() => updateProp("src", "")}
          className="w-full text-center rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 py-1.5 text-xs font-semibold text-red-600 transition cursor-pointer"
        >
          🗑️ Remove Image
        </button>
      )}

      {/* Alt Text & Title */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Alt Text</label>
          <input
            type="text"
            value={el.alt || ""}
            onChange={(e) => updateProp("alt", e.target.value)}
            placeholder="Description..."
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Object Fit</label>
          <select
            value={el.styles?.objectFit || "cover"}
            onChange={(e) => updateStyle("objectFit", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
          >
            <option value="cover">Cover (Fill)</option>
            <option value="contain">Contain (Fit)</option>
            <option value="fill">Fill (Stretch)</option>
            <option value="auto">Auto (Natural)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
