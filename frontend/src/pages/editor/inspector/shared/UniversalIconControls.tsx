/**
 * UniversalIconControls. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import { IconRenderer } from "../../widgets/icons";
import type { EditorElement } from "../../types";

// ==========================================
// UNIVERSAL ICON CONTROLS & INSPECTOR
// ==========================================

export function UniversalIconControls({
  el,
  updateProp,
  onOpenIconPicker,
  showContainerControls = false,
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
  updateStyle?: (key: string, val: any) => void;
  onOpenIconPicker?: () => void;
  showContainerControls?: boolean;
}) {
  const currentIconName = el.iconName || el.icon || "Star";
  const iconSize = el.iconSize || 24;
  const iconColor = el.iconColor || el.styles?.color || "#2563eb";
  const iconGap = el.iconGap ?? el.iconSpacing ?? 8;
  const iconPosition = el.iconPosition || "left";
  const iconRotate = el.iconRotate || 0;
  const iconFlipH = Boolean(el.iconFlipH);
  const iconFlipV = Boolean(el.iconFlipV);
  const iconStrokeWidth = el.iconStrokeWidth || 2;
  const iconBgColor = el.iconBgColor || "#eff6ff";
  const iconBorderRadius = el.iconBorderRadius || "8px";
  const iconPadding = el.iconPadding || 8;

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      {/* Icon Picker Trigger */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <span>🎨</span> Icon Selector
        </label>
        <span className="text-[10px] font-mono text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200 truncate max-w-[110px]">
          {currentIconName}
        </span>
      </div>

      <div className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-slate-200 shadow-xs">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 shrink-0">
          <IconRenderer
            iconName={currentIconName}
            size={Math.min(iconSize, 32)}
            color={iconColor}
            rotate={iconRotate}
            flipH={iconFlipH}
            flipV={iconFlipV}
            strokeWidth={iconStrokeWidth}
          />
        </div>

        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenIconPicker}
              className="w-full rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer flex items-center justify-center gap-1"
            >
              <span>✨</span> Change Icon
            </button>
            {(el.iconName || el.icon) && (
              <button
                type="button"
                onClick={() => {
                  updateProp("iconName", "");
                  updateProp("icon", "");
                }}
                title="Remove Icon"
                className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 transition cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
          <p className="text-[10px] text-slate-400 leading-tight">
            Select vector icon from 100+ organized categories.
          </p>
        </div>
      </div>

      {/* Icon Position */}
      <div>
        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
          Icon Position
        </label>
        <div className="grid grid-cols-4 gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {(["left", "right", "top", "bottom"] as const).map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => updateProp("iconPosition", pos)}
              className={`rounded py-1 text-[11px] font-bold capitalize transition cursor-pointer ${
                iconPosition === pos ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      {/* Icon Size & Spacing (Gap) */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Size (px)</label>
            <button
              type="button"
              onClick={() => updateProp("iconSize", 24)}
              className="text-[9px] font-bold text-blue-600 hover:underline cursor-pointer"
            >
              Reset
            </button>
          </div>
          <input
            type="number"
            min={10}
            max={120}
            value={iconSize}
            onChange={(e) => updateProp("iconSize", Number(e.target.value))}
            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Spacing (px)</label>
            <button
              type="button"
              onClick={() => {
                updateProp("iconGap", 8);
                updateProp("iconSpacing", 8);
              }}
              className="text-[9px] font-bold text-blue-600 hover:underline cursor-pointer"
            >
              Reset
            </button>
          </div>
          <input
            type="number"
            min={0}
            max={64}
            value={iconGap}
            onChange={(e) => {
              const val = Number(e.target.value);
              updateProp("iconGap", val);
              updateProp("iconSpacing", val);
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Icon Color */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Icon Color</label>
          <button
            type="button"
            onClick={() => updateProp("iconColor", "#2563eb")}
            className="text-[9px] font-bold text-blue-600 hover:underline cursor-pointer"
          >
            Reset Color
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={iconColor.startsWith("#") ? iconColor : "#2563eb"}
            onChange={(e) => updateProp("iconColor", e.target.value)}
            className="h-7 w-9 rounded border border-slate-300 bg-white p-0.5 cursor-pointer"
          />
          <input
            type="text"
            value={iconColor}
            onChange={(e) => updateProp("iconColor", e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-mono font-semibold text-slate-800 outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Rotation & Flips */}
      <div className="pt-2 border-t border-slate-200/80 space-y-2">
        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          Rotation & Flip Transforms
        </label>
        <div className="grid grid-cols-5 gap-1">
          {[0, 45, 90, 180, 270].map((deg) => (
            <button
              key={deg}
              type="button"
              onClick={() => updateProp("iconRotate", deg)}
              className={`rounded py-1 text-[10px] font-bold transition cursor-pointer ${
                iconRotate === deg ? "bg-blue-600 text-white shadow-xs" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {deg}°
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => updateProp("iconFlipH", !iconFlipH)}
            className={`rounded-lg border px-2 py-1 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 ${
              iconFlipH ? "border-blue-600 bg-blue-50 text-blue-600" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            <span>↔️</span> Flip Horiz
          </button>
          <button
            type="button"
            onClick={() => updateProp("iconFlipV", !iconFlipV)}
            className={`rounded-lg border px-2 py-1 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 ${
              iconFlipV ? "border-blue-600 bg-blue-50 text-blue-600" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            <span>↕️</span> Flip Vert
          </button>
        </div>
      </div>

      {/* Stroke Width */}
      <div>
        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
          Stroke Width
        </label>
        <div className="grid grid-cols-5 gap-1">
          {[1, 1.5, 2, 2.5, 3].map((sw) => (
            <button
              key={sw}
              type="button"
              onClick={() => updateProp("iconStrokeWidth", sw)}
              className={`rounded py-1 text-[10px] font-bold transition cursor-pointer ${
                iconStrokeWidth === sw ? "bg-blue-600 text-white shadow-xs" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {sw}px
            </button>
          ))}
        </div>
      </div>

      {/* Container controls */}
      {showContainerControls && (
        <div className="pt-2 border-t border-slate-200/80 space-y-2">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Icon Container Styling
          </label>
          <div>
            <label className="block text-[10px] text-slate-500 mb-0.5">Container Background</label>
            <input
              type="color"
              value={iconBgColor.startsWith("#") ? iconBgColor : "#eff6ff"}
              onChange={(e) => updateProp("iconBgColor", e.target.value)}
              className="h-7 w-full rounded border border-slate-300 bg-white p-0.5 cursor-pointer"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-slate-500 mb-0.5">Border Radius</label>
              <input
                type="text"
                value={iconBorderRadius}
                onChange={(e) => updateProp("iconBorderRadius", e.target.value)}
                placeholder="8px"
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-0.5">Padding (px)</label>
              <input
                type="number"
                value={iconPadding}
                onChange={(e) => updateProp("iconPadding", Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
