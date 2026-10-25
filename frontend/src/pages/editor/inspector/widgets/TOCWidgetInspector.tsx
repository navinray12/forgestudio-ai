/**
 * TOCWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement } from "../../types";

// 25. Table of Contents Inspector (F-191)
export function TOCWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Settings & Header */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
        <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          Table of Contents Settings
        </span>

        <div>
          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
            Header Title
          </label>
          <input
            type="text"
            value={el.tocTitle !== undefined ? el.tocTitle : "Table of Contents"}
            onChange={(e) => updateProp("tocTitle", e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-teal-500"
          />
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
          <label className="text-[11px] font-semibold text-slate-700 cursor-pointer">Show Title Header</label>
          <input
            type="checkbox"
            checked={el.tocShowTitle !== false}
            onChange={(e) => updateProp("tocShowTitle", e.target.checked)}
            className="accent-teal-600 rounded cursor-pointer"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Marker Style
            </label>
            <select
              value={el.tocMarkerStyle || "bullet"}
              onChange={(e) => updateProp("tocMarkerStyle", e.target.value as "none" | "bullet" | "number" | "line" | "badge")}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-teal-500"
            >
              <option value="bullet">Bullet Dots</option>
              <option value="number">Numbers (1, 2, 3)</option>
              <option value="line">Accent Line</option>
              <option value="badge">Tag Badge (H1, H2)</option>
              <option value="none">Plain Text</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Alignment
            </label>
            <select
              value={el.tocAlignment || "left"}
              onChange={(e) => updateProp("tocAlignment", e.target.value as "left" | "center" | "right")}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-teal-500"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Indent / Level (px)
            </label>
            <input
              type="number"
              value={el.tocIndentPerLevel ?? 14}
              onChange={(e) => updateProp("tocIndentPerLevel", Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Item Gap (px)
            </label>
            <input
              type="number"
              value={el.tocItemGap ?? 8}
              onChange={(e) => updateProp("tocItemGap", Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-teal-500"
            />
          </div>
        </div>
      </div>

      {/* Included Heading Levels */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
        <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
          Included Heading Tags
        </span>
        <div className="grid grid-cols-3 gap-2">
          {(["h1", "h2", "h3", "h4", "h5", "h6"] as const).map((lvl) => {
            const currentIncluded = el.tocIncludedLevels || ["h1", "h2", "h3", "h4", "h5", "h6"];
            const isChecked = currentIncluded.includes(lvl);
            return (
              <label key={lvl} className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => {
                    let nextLevels: ("h1" | "h2" | "h3" | "h4" | "h5" | "h6")[];
                    if (e.target.checked) {
                      nextLevels = [...currentIncluded, lvl];
                    } else {
                      nextLevels = currentIncluded.filter((l) => l !== lvl);
                    }
                    updateProp("tocIncludedLevels", nextLevels);
                  }}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer accent-teal-600"
                />
                <span className="uppercase">{lvl}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Colors & Appearance */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
        <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          Color Customization
        </span>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Card Background</label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={el.tocCardBg || "#f8fafc"}
                onChange={(e) => updateProp("tocCardBg", e.target.value)}
                className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
              />
              <input
                type="text"
                value={el.tocCardBg || "#f8fafc"}
                onChange={(e) => updateProp("tocCardBg", e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Border Color</label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={el.tocBorderColor || "#e2e8f0"}
                onChange={(e) => updateProp("tocBorderColor", e.target.value)}
                className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
              />
              <input
                type="text"
                value={el.tocBorderColor || "#e2e8f0"}
                onChange={(e) => updateProp("tocBorderColor", e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Text Color</label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={el.tocTextColor || "#334155"}
                onChange={(e) => updateProp("tocTextColor", e.target.value)}
                className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
              />
              <input
                type="text"
                value={el.tocTextColor || "#334155"}
                onChange={(e) => updateProp("tocTextColor", e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Accent / Marker</label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={el.tocHoverColor || "#2563eb"}
                onChange={(e) => updateProp("tocHoverColor", e.target.value)}
                className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
              />
              <input
                type="text"
                value={el.tocHoverColor || "#2563eb"}
                onChange={(e) => updateProp("tocHoverColor", e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
