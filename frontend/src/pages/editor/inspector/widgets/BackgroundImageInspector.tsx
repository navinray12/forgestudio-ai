/**
 * BackgroundImageInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement } from "../../types";
import { ImagePickerControl } from "../shared/imagePicker";

// 2. Background Image Inspector
export function BackgroundImageInspector({
  el,
  updateStyle
}: {
  el: EditorElement;
  updateStyle: (key: string, val: any) => void;
}) {
  const bgImg = el.styles?.backgroundImage || "";
  const cleanUrl = bgImg.replace(/^url\(['"]?/, "").replace(/['"]?\)$/, "");

  return (
    <div className="space-y-3 pt-2">
      <ImagePickerControl
        label="Background Image Source"
        value={cleanUrl}
        onChange={(url) => updateStyle("backgroundImage", url ? `url("${url}")` : "")}
      />

      {cleanUrl && (
        <button
          type="button"
          onClick={() => updateStyle("backgroundImage", "")}
          className="w-full text-center rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 py-1.5 text-xs font-semibold text-red-600 transition cursor-pointer"
        >
          🗑️ Remove Background Image
        </button>
      )}

      {cleanUrl && (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Size</label>
            <select
              value={el.styles?.backgroundSize || "cover"}
              onChange={(e) => updateStyle("backgroundSize", e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium"
            >
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
              <option value="auto">Auto</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Position</label>
            <select
              value={el.styles?.backgroundPosition || "center"}
              onChange={(e) => updateStyle("backgroundPosition", e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium"
            >
              <option value="center">Center</option>
              <option value="top">Top</option>
              <option value="bottom">Bottom</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Repeat</label>
            <select
              value={el.styles?.backgroundRepeat || "no-repeat"}
              onChange={(e) => updateStyle("backgroundRepeat", e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium"
            >
              <option value="no-repeat">No Repeat</option>
              <option value="repeat">Repeat</option>
              <option value="repeat-x">Repeat X</option>
              <option value="repeat-y">Repeat Y</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
