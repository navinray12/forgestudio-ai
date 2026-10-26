import { ScrubbableNumberInput } from "../components/ScrubbableNumberInput";
import { getControlStyleValue, hasHoverStyleOverride, hasStyleOverride, parseSpacingUnit } from "../utils";
import type { DeviceMode, EditorElement, ElementState, ElementStyles } from "../types";

/** What buildPositioningControls reads: the editor values and callbacks the inline helper closed over. */
export interface PositioningControlsDeps {
  activeDevice: DeviceMode;
  activeElementState: ElementState;
  resetSelectedStyle: (key: keyof ElementStyles) => void;
  selectedElement: EditorElement | null;
  updateSelectedStyle: (key: keyof ElementStyles, value: any) => void;
}

/**
 * The Positioning controls of the element inspector (position mode, top / right / bottom / left offsets, z-index), per device and element state.
 * Moved verbatim from WebsiteEditor.tsx (renderPositioningControls). A plain function, not a component: the editor
 * calls it during its own render through a same-named wrapper, so the output is part of the editor's
 * element tree exactly as before (no extra component boundary, no remounting, same input focus).
 */
export function buildPositioningControls({
  activeDevice,
  activeElementState,
  resetSelectedStyle,
  selectedElement,
  updateSelectedStyle,
}: PositioningControlsDeps) {
    if (!selectedElement) return null;

    const currentPos = getControlStyleValue(selectedElement, activeDevice, activeElementState, "position") || "static";

    const rawTop = String(getControlStyleValue(selectedElement, activeDevice, activeElementState, "top") || "");
    const rawRight = String(getControlStyleValue(selectedElement, activeDevice, activeElementState, "right") || "");
    const rawBottom = String(getControlStyleValue(selectedElement, activeDevice, activeElementState, "bottom") || "");
    const rawLeft = String(getControlStyleValue(selectedElement, activeDevice, activeElementState, "left") || "");

    const currentZIndex = getControlStyleValue(selectedElement, activeDevice, activeElementState, "zIndex");
    const zIndexStr = currentZIndex !== undefined && currentZIndex !== null ? String(currentZIndex) : "";

    const parsedTop = parseSpacingUnit(rawTop);
    const parsedRight = parseSpacingUnit(rawRight);
    const parsedBottom = parseSpacingUnit(rawBottom);
    const parsedLeft = parseSpacingUnit(rawLeft);

    const activeOffsetUnit = parsedTop.unit || parsedRight.unit || parsedBottom.unit || parsedLeft.unit || "px";

    const isPosOverridden = activeElementState === "hover" ? hasHoverStyleOverride(selectedElement, activeDevice, "position") : hasStyleOverride(selectedElement, activeDevice, "position");
    const isOffsetsOverridden = activeElementState === "hover"
      ? hasHoverStyleOverride(selectedElement, activeDevice, "top") ||
      hasHoverStyleOverride(selectedElement, activeDevice, "right") ||
      hasHoverStyleOverride(selectedElement, activeDevice, "bottom") ||
      hasHoverStyleOverride(selectedElement, activeDevice, "left")
      : hasStyleOverride(selectedElement, activeDevice, "top") ||
      hasStyleOverride(selectedElement, activeDevice, "right") ||
      hasStyleOverride(selectedElement, activeDevice, "bottom") ||
      hasStyleOverride(selectedElement, activeDevice, "left");
    const isZIndexOverridden = activeElementState === "hover" ? hasHoverStyleOverride(selectedElement, activeDevice, "zIndex") : hasStyleOverride(selectedElement, activeDevice, "zIndex");

    const handleOffsetChange = (key: keyof ElementStyles, numVal: string, unitVal: string) => {
      const formattedVal = numVal.trim() === "" ? "" : `${numVal}${unitVal}`;
      updateSelectedStyle(key, formattedVal);
    };

    const handleUnitChange = (newUnit: string) => {
      const convertUnit = (parsed: { num: string; unit: string }, sideKey: keyof ElementStyles) => {
        if (parsed.num) {
          updateSelectedStyle(sideKey, `${parsed.num}${newUnit}`);
        }
      };
      convertUnit(parsedTop, "top");
      convertUnit(parsedRight, "right");
      convertUnit(parsedBottom, "bottom");
      convertUnit(parsedLeft, "left");
    };

    return (
      <div className="space-y-4 pt-4 border-t border-slate-200">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Positioning & Layering
        </h3>

        {/* 1. Position Type Dropdown */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-slate-700">
              Position Type
              {isPosOverridden && (
                <span className="ml-1 rounded bg-blue-100 px-1 py-0.5 text-[9px] font-bold text-blue-700 uppercase">
                  {activeDevice}
                </span>
              )}
            </label>
            {(selectedElement?.styles?.position || isPosOverridden) && (
              <button
                type="button"
                onClick={() => resetSelectedStyle("position")}
                title="Reset Position Type to Default"
                className="text-[10px] font-semibold text-slate-500 hover:text-blue-600 hover:underline"
              >
                ↺ Reset
              </button>
            )}
          </div>
          <select
            value={currentPos}
            onChange={(e) => updateSelectedStyle("position", e.target.value as any)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
          >
            <option value="static">Default (Static)</option>
            <option value="relative">Relative</option>
            <option value="absolute">Absolute</option>
            <option value="fixed">Fixed</option>
            <option value="sticky">Sticky</option>
          </select>
        </div>

        {/* 2. Position Offsets (Top, Right, Bottom, Left) */}
        {currentPos !== "static" && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700">
                Position Offsets
                {isOffsetsOverridden && (
                  <span className="ml-1 rounded bg-blue-100 px-1 py-0.5 text-[9px] font-bold text-blue-700 uppercase">
                    {activeDevice}
                  </span>
                )}
              </label>

              <div className="flex items-center gap-1.5">
                <select
                  value={activeOffsetUnit}
                  onChange={(e) => handleUnitChange(e.target.value)}
                  className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-700 outline-none focus:border-blue-500"
                >
                  <option value="px">px</option>
                  <option value="%">%</option>
                  <option value="rem">rem</option>
                  <option value="em">em</option>
                </select>

                {(selectedElement?.styles?.top || selectedElement?.styles?.right || selectedElement?.styles?.bottom || selectedElement?.styles?.left || isOffsetsOverridden) && (
                  <button
                    type="button"
                    onClick={() => {
                      resetSelectedStyle("top");
                      resetSelectedStyle("right");
                      resetSelectedStyle("bottom");
                      resetSelectedStyle("left");
                    }}
                    title="Reset Offsets to Default"
                    className="text-[10px] font-semibold text-slate-500 hover:text-blue-600 hover:underline"
                  >
                    ↺ Reset
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              <div>
                <span className="block text-[9px] font-semibold text-slate-400 text-center mb-0.5">
                  Top
                </span>
                <ScrubbableNumberInput
                  value={parsedTop.num}
                  onChange={(val) => handleOffsetChange("top", val, activeOffsetUnit)}
                  placeholder="auto"
                  className="w-full rounded-lg border border-slate-300 bg-white px-1.5 py-1 text-center text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <span className="block text-[9px] font-semibold text-slate-400 text-center mb-0.5">
                  Right
                </span>
                <ScrubbableNumberInput
                  value={parsedRight.num}
                  onChange={(val) => handleOffsetChange("right", val, activeOffsetUnit)}
                  placeholder="auto"
                  className="w-full rounded-lg border border-slate-300 bg-white px-1.5 py-1 text-center text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <span className="block text-[9px] font-semibold text-slate-400 text-center mb-0.5">
                  Bottom
                </span>
                <ScrubbableNumberInput
                  value={parsedBottom.num}
                  onChange={(val) => handleOffsetChange("bottom", val, activeOffsetUnit)}
                  placeholder="auto"
                  className="w-full rounded-lg border border-slate-300 bg-white px-1.5 py-1 text-center text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <span className="block text-[9px] font-semibold text-slate-400 text-center mb-0.5">
                  Left
                </span>
                <ScrubbableNumberInput
                  value={parsedLeft.num}
                  onChange={(val) => handleOffsetChange("left", val, activeOffsetUnit)}
                  placeholder="auto"
                  className="w-full rounded-lg border border-slate-300 bg-white px-1.5 py-1 text-center text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* 3. Z-Index Control */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-slate-700">
              Z-Index
              {isZIndexOverridden && (
                <span className="ml-1 rounded bg-blue-100 px-1 py-0.5 text-[9px] font-bold text-blue-700 uppercase">
                  {activeDevice}
                </span>
              )}
            </label>
            {(selectedElement?.styles?.zIndex !== undefined || isZIndexOverridden) && (
              <button
                type="button"
                onClick={() => resetSelectedStyle("zIndex")}
                title="Reset Z-Index to Default"
                className="text-[10px] font-semibold text-slate-500 hover:text-blue-600 hover:underline"
              >
                ↺ Reset
              </button>
            )}
          </div>
          <ScrubbableNumberInput
            value={zIndexStr}
            onChange={(val) =>
              updateSelectedStyle(
                "zIndex",
                val !== "" ? Number(val) : undefined
              )
            }
            placeholder="0"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
          />
        </div>
      </div>
    );
}
