import { FontPickerControl } from "../../../components/FontPickerControl";
import { FontService } from "../../../features/fonts/FontService";
import { getControlStyleValue, isControlStyleConfigured } from "../utils";
import type { DeviceMode, ElementState, ElementStyles } from "../types";

/** What buildTypographySection reads: the editor values and callbacks the inline helper closed over. */
export interface TypographySectionDeps {
  activeDevice: DeviceMode;
  activeElementState: ElementState;
  handleOpenFontPicker: (onSelect?: (family: string) => void) => void;
  resetSelectedStyle: (key: keyof ElementStyles) => void;
  selectedElementAny: any;
  updateSelectedStyle: (key: keyof ElementStyles, value: any) => void;
}

/**
 * The Typography section of the element inspector (font family picker, size, weight, line height, spacing, transform, alignment, colour, per device and element state).
 * Moved verbatim from WebsiteEditor.tsx (renderTypographySection). A plain function, not a component: the editor
 * calls it during its own render through a same-named wrapper, so the output is part of the editor's
 * element tree exactly as before (no extra component boundary, no remounting, same input focus).
 */
export function buildTypographySection({
  activeDevice,
  activeElementState,
  handleOpenFontPicker,
  resetSelectedStyle,
  selectedElementAny,
  updateSelectedStyle,
}: TypographySectionDeps) {
    if (!selectedElementAny || !selectedElementAny.type) return null;
    const textTypes = ["heading", "text", "button", "paragraph", "blockquote"];
    if (!textTypes.includes(selectedElementAny.type)) return null;

    const currentFontFamily = getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "fontFamily");
    const supportedWeights = FontService.getSupportedWeights(currentFontFamily);
    const hasItalic = FontService.hasItalic(currentFontFamily);

    const weightLabels: Record<number, string> = {
      100: "100 Thin",
      200: "200 Extra Light",
      300: "300 Light",
      400: "400 Normal",
      500: "500 Medium",
      600: "600 Semi-Bold",
      700: "700 Bold",
      800: "800 Extra Bold",
      900: "900 Black",
    };

    return (
      <div className="space-y-3 p-3 bg-slate-50/80 rounded-lg border border-slate-200/80 mt-2 mb-3">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-slate-800">
            Typography
          </label>
          {(isControlStyleConfigured(selectedElementAny, activeDevice, activeElementState, "fontFamily") ||
            isControlStyleConfigured(selectedElementAny, activeDevice, activeElementState, "fontSize") ||
            isControlStyleConfigured(selectedElementAny, activeDevice, activeElementState, "fontWeight") ||
            isControlStyleConfigured(selectedElementAny, activeDevice, activeElementState, "lineHeight") ||
            isControlStyleConfigured(selectedElementAny, activeDevice, activeElementState, "textAlign")) && (
              <button
                type="button"
                onClick={() => {
                  resetSelectedStyle("fontFamily");
                  resetSelectedStyle("fontSize");
                  resetSelectedStyle("fontWeight");
                  resetSelectedStyle("lineHeight");
                  resetSelectedStyle("textAlign");
                }}
                title="Reset typography to defaults"
                className="text-[10px] font-semibold text-slate-500 hover:text-blue-600 hover:underline"
              >
                ↺ Reset All
              </button>
            )}
        </div>

        {/* Font Family */}
        <FontPickerControl
          value={currentFontFamily}
          onChange={(fam) => updateSelectedStyle("fontFamily", fam)}
          onOpenModal={() => handleOpenFontPicker((fam) => updateSelectedStyle("fontFamily", fam))}
          onReset={() => resetSelectedStyle("fontFamily")}
          isConfigured={isControlStyleConfigured(selectedElementAny, activeDevice, activeElementState, "fontFamily")}
        />

        {/* Font Size & Weight */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">Font Size</label>
              {isControlStyleConfigured(selectedElementAny, activeDevice, activeElementState, "fontSize") && (
                <button
                  type="button"
                  onClick={() => resetSelectedStyle("fontSize")}
                  title="Reset font size"
                  className="text-[10px] text-slate-400 hover:text-blue-600"
                >
                  ↺
                </button>
              )}
            </div>
            <input
              type="text"
              value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "fontSize") || ""}
              onChange={(e) => {
                const val = e.target.value.trim();
                updateSelectedStyle(
                  "fontSize",
                  val === "" ? undefined : (val.endsWith("px") || val.endsWith("rem") || val.endsWith("em") || val.endsWith("%") ? val : `${val}px`)
                );
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
              placeholder="e.g. 16px"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">Font Weight</label>
              {isControlStyleConfigured(selectedElementAny, activeDevice, activeElementState, "fontWeight") && (
                <button
                  type="button"
                  onClick={() => resetSelectedStyle("fontWeight")}
                  title="Reset font weight"
                  className="text-[10px] text-slate-400 hover:text-blue-600"
                >
                  ↺
                </button>
              )}
            </div>
            <select
              value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "fontWeight") || "inherit"}
              onChange={(e) => updateSelectedStyle("fontWeight", e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
            >
              <option value="inherit">Default</option>
              {supportedWeights.map((w) => (
                <option key={w} value={String(w)}>
                  {weightLabels[w] || `${w}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Line Height & Text Align */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">Line Height</label>
              {isControlStyleConfigured(selectedElementAny, activeDevice, activeElementState, "lineHeight") && (
                <button
                  type="button"
                  onClick={() => resetSelectedStyle("lineHeight")}
                  title="Reset line height"
                  className="text-[10px] text-slate-400 hover:text-blue-600"
                >
                  ↺
                </button>
              )}
            </div>
            <input
              type="text"
              value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "lineHeight") || ""}
              onChange={(e) => updateSelectedStyle("lineHeight", e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
              placeholder="e.g. 1.5 or 24px"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Text Align</label>
            <div className="grid grid-cols-4 gap-0.5 rounded-lg bg-slate-100 p-0.5 border border-slate-200">
              {(["left", "center", "right", "justify"] as const).map((align) => {
                const currentAlign = getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "textAlign") || "left";
                const isActive = currentAlign === align;
                return (
                  <button
                    key={align}
                    type="button"
                    onClick={() => updateSelectedStyle("textAlign", align)}
                    className={`py-1 text-[10px] font-semibold capitalize rounded transition-colors ${isActive ? "bg-white text-blue-600 shadow-sm font-bold" : "text-slate-600 hover:bg-slate-200"
                      }`}
                    title={`Align ${align}`}
                  >
                    {align.slice(0, 1).toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
}
