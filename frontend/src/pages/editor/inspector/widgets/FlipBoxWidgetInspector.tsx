/**
 * FlipBoxWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement } from "../../types";
import { ImagePickerControl } from "../shared/imagePicker";

// 20. Flip Box Inspector (F-185)
export function FlipBoxWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Card Configuration */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
        <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          Flip Animation & Card Layout
        </span>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Flip Direction
            </label>
            <select
              value={el.flipDirection || "flip-right"}
              onChange={(e) => updateProp("flipDirection", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-indigo-500"
            >
              <option value="flip-right">Flip Right →</option>
              <option value="flip-left">Flip Left ←</option>
              <option value="flip-up">Flip Up ↑</option>
              <option value="flip-down">Flip Down ↓</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Flip Speed
            </label>
            <select
              value={el.flipDuration || "0.6s"}
              onChange={(e) => updateProp("flipDuration", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-indigo-500"
            >
              <option value="0.3s">Fast (0.3s)</option>
              <option value="0.6s">Normal (0.6s)</option>
              <option value="1.0s">Slow (1.0s)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Card Height
            </label>
            <input
              type="text"
              value={el.flipCardHeight || "320px"}
              onChange={(e) => updateProp("flipCardHeight", e.target.value)}
              placeholder="e.g. 320px"
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Corner Radius
            </label>
            <input
              type="text"
              value={el.flipBorderRadius || "20px"}
              onChange={(e) => updateProp("flipBorderRadius", e.target.value)}
              placeholder="e.g. 20px"
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none"
            />
          </div>
        </div>

        {/* Manual Flip Inspector Mode */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 bg-indigo-50/60 -mx-3 -mb-3 p-3 rounded-b-xl border-indigo-100">
          <div>
            <span className="block text-xs font-bold text-indigo-900">Inspect Back Side</span>
            <span className="block text-[10px] text-indigo-600">Keep card flipped open in editor canvas</span>
          </div>
          <button
            type="button"
            onClick={() => updateProp("flipIsFlippedManual", !el.flipIsFlippedManual)}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
              el.flipIsFlippedManual
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            }`}
          >
            {el.flipIsFlippedManual ? "Showing Back 🔄" : "Show Front 👁️"}
          </button>
        </div>
      </div>

      {/* Front Side Manager */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
        <span className="block text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
          <span>FRONT SIDE CONTENT</span>
        </span>

        <div>
          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Title</label>
          <input
            type="text"
            value={el.flipFrontTitle || ""}
            onChange={(e) => updateProp("flipFrontTitle", e.target.value)}
            placeholder="Front Card Title..."
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Description</label>
          <textarea
            rows={2}
            value={el.flipFrontDescription || ""}
            onChange={(e) => updateProp("flipFrontDescription", e.target.value)}
            placeholder="Front Card Description..."
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Icon / Emoji</label>
            <input
              type="text"
              value={el.flipFrontIcon || ""}
              onChange={(e) => updateProp("flipFrontIcon", e.target.value)}
              placeholder="e.g. 🚀"
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Text Color</label>
            <input
              type="color"
              value={el.flipFrontTextColor || "#ffffff"}
              onChange={(e) => updateProp("flipFrontTextColor", e.target.value)}
              className="h-7 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-0.5"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Background (Color / CSS Gradient)</label>
          <input
            type="text"
            value={el.flipFrontBg || ""}
            onChange={(e) => updateProp("flipFrontBg", e.target.value)}
            placeholder="linear-gradient(135deg, #1e293b 0%, #0f172a 100%)"
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-mono text-slate-700"
          />
        </div>

        <ImagePickerControl
          label="Front Image (Optional)"
          value={el.flipFrontImage || ""}
          onChange={(url) => updateProp("flipFrontImage", url)}
        />
      </div>

      {/* Back Side Manager */}
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 space-y-2.5">
        <span className="block text-[11px] font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1">
          <span>BACK SIDE CONTENT</span>
        </span>

        <div>
          <label className="block text-[10px] font-semibold text-indigo-700 mb-0.5">Title</label>
          <input
            type="text"
            value={el.flipBackTitle || ""}
            onChange={(e) => updateProp("flipBackTitle", e.target.value)}
            placeholder="Back Card Title..."
            className="w-full rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-indigo-700 mb-0.5">Description</label>
          <textarea
            rows={2}
            value={el.flipBackDescription || ""}
            onChange={(e) => updateProp("flipBackDescription", e.target.value)}
            placeholder="Back Card Description..."
            className="w-full rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs text-slate-700"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-indigo-200/60">
          <div>
            <label className="block text-[10px] font-semibold text-indigo-700 mb-0.5">Text Color</label>
            <input
              type="color"
              value={el.flipBackTextColor || "#ffffff"}
              onChange={(e) => updateProp("flipBackTextColor", e.target.value)}
              className="h-7 w-full cursor-pointer rounded-lg border border-indigo-200 bg-white p-0.5"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-indigo-700 mb-0.5">Background (CSS / Color)</label>
            <input
              type="text"
              value={el.flipBackBg || ""}
              onChange={(e) => updateProp("flipBackBg", e.target.value)}
              placeholder="linear-gradient(...)"
              className="w-full rounded-lg border border-indigo-200 bg-white px-2 py-1 text-[10px] font-mono text-slate-700"
            />
          </div>
        </div>

        {/* CTA Button Controls */}
        <div className="pt-2 border-t border-indigo-200/60 space-y-2">
          <span className="block text-[10px] font-bold text-indigo-900 uppercase">CTA Button & Link</span>
          
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-indigo-700 mb-0.5">Button Text</label>
              <input
                type="text"
                value={el.flipBackBtnText || ""}
                onChange={(e) => updateProp("flipBackBtnText", e.target.value)}
                placeholder="e.g. Get Started Now"
                className="w-full rounded-lg border border-indigo-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-indigo-700 mb-0.5">Link URL</label>
              <input
                type="text"
                value={el.flipBackBtnUrl || "#"}
                onChange={(e) => updateProp("flipBackBtnUrl", e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-indigo-200 bg-white px-2 py-1 text-xs font-mono text-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-indigo-700 mb-0.5">Button Background</label>
              <input
                type="color"
                value={el.flipBackBtnBg || "#ffffff"}
                onChange={(e) => updateProp("flipBackBtnBg", e.target.value)}
                className="h-7 w-full cursor-pointer rounded-lg border border-indigo-200 bg-white p-0.5"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-indigo-700 mb-0.5">Button Text Color</label>
              <input
                type="color"
                value={el.flipBackBtnTextColor || "#4f46e5"}
                onChange={(e) => updateProp("flipBackBtnTextColor", e.target.value)}
                className="h-7 w-full cursor-pointer rounded-lg border border-indigo-200 bg-white p-0.5"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
