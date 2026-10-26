/**
 * CountdownWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement } from "../../types";

// 11. Countdown Inspector
export function CountdownWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  return (
    <div className="space-y-3 pt-2 border-t border-slate-100">
      <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
        <span>⏱️</span> Countdown Timer Configuration
      </h3>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Target Launch Date & Time
        </label>
        <input
          type="datetime-local"
          value={el.countdownTargetDate || "2026-12-31T23:59"}
          onChange={(e) => updateProp("countdownTargetDate", e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Expiration Message
        </label>
        <input
          type="text"
          value={el.countdownExpiredMessage || "Special Offer Has Ended!"}
          onChange={(e) => updateProp("countdownExpiredMessage", e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
        />
      </div>
    </div>
  );
}
