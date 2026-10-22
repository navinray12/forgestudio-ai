/**
 * AnimatedTextWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement } from "../../types";

// 17. Animated Text Inspector
export function AnimatedTextWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  return (
    <div className="space-y-3 pt-2 border-t border-slate-100">
      <h3 className="text-xs font-bold uppercase tracking-wider text-purple-600 flex items-center gap-1.5">
        <span>✨</span> Animated Text Settings
      </h3>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Animation Style</label>
          <select
            value={el.animatedStyle || "typed"}
            onChange={(e) => updateProp("animatedStyle", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
          >
            <option value="typed">Typing Effect</option>
            <option value="rotate">Rotating Flip</option>
            <option value="fade">Fade In/Out</option>
            <option value="slide">Slide Up</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Prefix Text</label>
          <input
            type="text"
            value={el.animatedPrefix || "We Build "}
            onChange={(e) => updateProp("animatedPrefix", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Rotating Words (Comma Separated)</label>
        <input
          type="text"
          value={(el.animatedWords || ["Websites", "Applications", "Experiences"]).join(", ")}
          onChange={(e) => updateProp("animatedWords", e.target.value.split(",").map(s => s.trim()))}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
        />
      </div>
    </div>
  );
}
