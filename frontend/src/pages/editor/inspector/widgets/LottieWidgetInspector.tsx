/**
 * LottieWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement } from "../../types";

// 12. Lottie Inspector
export function LottieWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  return (
    <div className="space-y-3 pt-2 border-t border-slate-100">
      <h3 className="text-xs font-bold uppercase tracking-wider text-pink-600 flex items-center gap-1.5">
        <span>🎨</span> Lottie Vector Animation
      </h3>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Animation JSON URL
        </label>
        <input
          type="text"
          value={el.lottieUrl || ""}
          onChange={(e) => updateProp("lottieUrl", e.target.value)}
          placeholder="https://assets.lottiefiles.com/.../data.json"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={el.lottieAutoplay !== false}
            onChange={(e) => updateProp("lottieAutoplay", e.target.checked)}
            className="rounded border-slate-300 text-blue-600"
          />
          <span>Autoplay</span>
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={el.lottieLoop !== false}
            onChange={(e) => updateProp("lottieLoop", e.target.checked)}
            className="rounded border-slate-300 text-blue-600"
          />
          <span>Loop</span>
        </label>
      </div>
    </div>
  );
}
