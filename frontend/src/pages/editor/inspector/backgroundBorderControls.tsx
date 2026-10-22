import { getControlStyleValue, hasHoverStyleOverride, hasStyleOverride, isControlStyleConfigured, parseSpacingUnit } from "../utils";
import type { DeviceMode, EditorElement, ElementState, ElementStyles } from "../types";
import type { Dispatch, RefObject, SetStateAction } from "react";

/** What buildBackgroundAndBorderControls reads: the editor values and callbacks the inline helper closed over. */
export interface BackgroundAndBorderControlsDeps {
  activeDevice: DeviceMode;
  activeElementState: ElementState;
  bgFileInputRef: RefObject<HTMLInputElement | null>;
  handleBgImageFileSelect: (file: File) => Promise<void>;
  handleSampleColor: (onColorPicked: (hex: string) => void) => Promise<void>;
  isBorderRadiusLinked: boolean;
  isUploading: boolean;
  resetSelectedStyle: (key: keyof ElementStyles) => void;
  selectedElement: EditorElement | null;
  setIsBorderRadiusLinked: Dispatch<SetStateAction<boolean>>;
  updateSelectedStyle: (key: keyof ElementStyles, value: any) => void;
}

/**
 * The Background & Border controls of the element inspector (background colour / image / position / size / repeat, border style / width / colour, linked corner radius, box shadow), per device and element state.
 * Moved verbatim from WebsiteEditor.tsx (renderBackgroundAndBorderControls). A plain function, not a component: the editor
 * calls it during its own render through a same-named wrapper, so the output is part of the editor's
 * element tree exactly as before (no extra component boundary, no remounting, same input focus).
 */
export function buildBackgroundAndBorderControls({
  activeDevice,
  activeElementState,
  bgFileInputRef,
  handleBgImageFileSelect,
  handleSampleColor,
  isBorderRadiusLinked,
  isUploading,
  resetSelectedStyle,
  selectedElement,
  setIsBorderRadiusLinked,
  updateSelectedStyle,
}: BackgroundAndBorderControlsDeps) {
    if (!selectedElement) return null;

    const currentBgColor = getControlStyleValue(selectedElement, activeDevice, activeElementState, "backgroundColor") || "";
    const currentBgImage = getControlStyleValue(selectedElement, activeDevice, activeElementState, "backgroundImage") || "";
    const currentBgPos = getControlStyleValue(selectedElement, activeDevice, activeElementState, "backgroundPosition") || "center";
    const currentBgSize = getControlStyleValue(selectedElement, activeDevice, activeElementState, "backgroundSize") || "cover";
    const currentBgRepeat = getControlStyleValue(selectedElement, activeDevice, activeElementState, "backgroundRepeat") || "no-repeat";

    const currentBorderStyle = getControlStyleValue(selectedElement, activeDevice, activeElementState, "borderStyle") || "none";
    const currentBorderWidth = getControlStyleValue(selectedElement, activeDevice, activeElementState, "borderWidth") || "1px";
    const currentBorderColor = getControlStyleValue(selectedElement, activeDevice, activeElementState, "borderColor") || "#cbd5e1";

    const currentTLRadius = getControlStyleValue(selectedElement, activeDevice, activeElementState, "borderTopLeftRadius") || getControlStyleValue(selectedElement, activeDevice, activeElementState, "borderRadius") || "";
    const currentTRRadius = getControlStyleValue(selectedElement, activeDevice, activeElementState, "borderTopRightRadius") || getControlStyleValue(selectedElement, activeDevice, activeElementState, "borderRadius") || "";
    const currentBRRadius = getControlStyleValue(selectedElement, activeDevice, activeElementState, "borderBottomRightRadius") || getControlStyleValue(selectedElement, activeDevice, activeElementState, "borderRadius") || "";
    const currentBLRadius = getControlStyleValue(selectedElement, activeDevice, activeElementState, "borderBottomLeftRadius") || getControlStyleValue(selectedElement, activeDevice, activeElementState, "borderRadius") || "";

    const currentBoxShadow = getControlStyleValue(selectedElement, activeDevice, activeElementState, "boxShadow") || "";

    const shadowMatch = currentBoxShadow.match(/(-?\d+px)\s+(-?\d+px)\s+(-?\d+px)\s+(-?\d+px)\s+(.*)/);
    const shadowX = shadowMatch ? shadowMatch[1].replace("px", "") : "0";
    const shadowY = shadowMatch ? shadowMatch[2].replace("px", "") : "0";
    const shadowBlur = shadowMatch ? shadowMatch[3].replace("px", "") : "0";
    const shadowSpread = shadowMatch ? shadowMatch[4].replace("px", "") : "0";
    const shadowColor = shadowMatch ? shadowMatch[5] : "rgba(0,0,0,0.25)";

    const parsedTL = parseSpacingUnit(currentTLRadius, "px");
    const parsedTR = parseSpacingUnit(currentTRRadius, "px");
    const parsedBR = parseSpacingUnit(currentBRRadius, "px");
    const parsedBL = parseSpacingUnit(currentBLRadius, "px");
    const activeRadiusUnit = parsedTL.unit || "px";

    const isBgColorOverridden = activeElementState === "hover" ? hasHoverStyleOverride(selectedElement, activeDevice, "backgroundColor") : hasStyleOverride(selectedElement, activeDevice, "backgroundColor");
    const isBgImageOverridden = activeElementState === "hover" ? hasHoverStyleOverride(selectedElement, activeDevice, "backgroundImage") : hasStyleOverride(selectedElement, activeDevice, "backgroundImage");
    const isBorderOverridden = activeElementState === "hover" ? hasHoverStyleOverride(selectedElement, activeDevice, "borderStyle") : hasStyleOverride(selectedElement, activeDevice, "borderStyle");
    const isRadiusOverridden = activeElementState === "hover" ? (hasHoverStyleOverride(selectedElement, activeDevice, "borderTopLeftRadius") || hasHoverStyleOverride(selectedElement, activeDevice, "borderRadius")) : (hasStyleOverride(selectedElement, activeDevice, "borderTopLeftRadius") || hasStyleOverride(selectedElement, activeDevice, "borderRadius"));
    const isShadowOverridden = activeElementState === "hover" ? hasHoverStyleOverride(selectedElement, activeDevice, "boxShadow") : hasStyleOverride(selectedElement, activeDevice, "boxShadow");

    const updateCornerRadius = (cornerKey: keyof ElementStyles, valStr: string) => {
      if (isBorderRadiusLinked) {
        updateSelectedStyle("borderTopLeftRadius", valStr);
        updateSelectedStyle("borderTopRightRadius", valStr);
        updateSelectedStyle("borderBottomRightRadius", valStr);
        updateSelectedStyle("borderBottomLeftRadius", valStr);
        updateSelectedStyle("borderRadius", valStr);
      } else {
        updateSelectedStyle(cornerKey, valStr);
      }
    };

    return (
      <div className="space-y-4 pt-4 border-t border-slate-200">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Background & Border
        </h3>

        {/* 1. Background Color */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-slate-700">
              Background Color
              {isBgColorOverridden && (
                <span className="ml-1 rounded bg-blue-100 px-1 py-0.5 text-[9px] font-bold text-blue-700 uppercase">
                  {activeDevice}
                </span>
              )}
            </label>
            {(isControlStyleConfigured(selectedElement, activeDevice, activeElementState, "backgroundColor") || isBgColorOverridden) && (
              <button
                type="button"
                onClick={() => resetSelectedStyle("backgroundColor")}
                title="Reset Background Color to Default"
                className="text-[10px] font-semibold text-slate-500 hover:text-blue-600 hover:underline"
              >
                ↺ Reset
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={currentBgColor.startsWith("#") ? currentBgColor : "#ffffff"}
              onChange={(e) => updateSelectedStyle("backgroundColor", e.target.value)}
              className="h-8 w-10 cursor-pointer rounded border border-slate-300 bg-transparent p-0.5"
            />
            <input
              type="text"
              value={currentBgColor}
              onChange={(e) => updateSelectedStyle("backgroundColor", e.target.value)}
              placeholder="transparent / #ffffff / rgba(...)"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono font-medium text-slate-800 outline-none focus:border-blue-500"
            />
            <button
              type="button"
              onClick={() => handleSampleColor((hex) => updateSelectedStyle("backgroundColor", hex))}
              title="Sample Color from Screen / Image"
              className="h-8 px-2 rounded border border-slate-300 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-xs font-bold text-slate-700 hover:text-blue-600 transition flex items-center gap-1 shrink-0"
            >
              <span>🧪</span>
              <span className="text-[10px]">Sample</span>
            </button>
          </div>
        </div>

        {/* 2. Background Image & Settings */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-700">
              Background Image
              {isBgImageOverridden && (
                <span className="ml-1 rounded bg-blue-100 px-1 py-0.5 text-[9px] font-bold text-blue-700 uppercase">
                  {activeDevice}
                </span>
              )}
            </label>
            {currentBgImage && (
              <button
                type="button"
                onClick={() => {
                  updateSelectedStyle("backgroundImage", "");
                  if (activeDevice !== "desktop") resetSelectedStyle("backgroundImage");
                }}
                className="text-[10px] font-semibold text-red-500 hover:underline"
              >
                Remove
              </button>
            )}
          </div>

          <input
            ref={bgFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleBgImageFileSelect(e.target.files[0]);
              }
            }}
          />

          <div className="flex gap-2">
            <button
              type="button"
              disabled={isUploading}
              onClick={() => bgFileInputRef.current?.click()}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
            >
              {isUploading ? "Uploading..." : "Upload Image"}
            </button>
            <input
              type="text"
              value={currentBgImage}
              onChange={(e) => updateSelectedStyle("backgroundImage", e.target.value)}
              placeholder="Or enter Image URL"
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
            />
          </div>

          {currentBgImage && (
            <div className="space-y-2 pt-2 border-t border-slate-200">
              {/* Background Position */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  Position
                </label>
                <select
                  value={currentBgPos}
                  onChange={(e) => updateSelectedStyle("backgroundPosition", e.target.value as any)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                >
                  <option value="center">Center</option>
                  <option value="top">Top</option>
                  <option value="bottom">Bottom</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </div>

              {/* Background Size */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  Size
                </label>
                <select
                  value={currentBgSize}
                  onChange={(e) => updateSelectedStyle("backgroundSize", e.target.value as any)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                >
                  <option value="cover">Cover</option>
                  <option value="contain">Contain</option>
                  <option value="auto">Auto</option>
                </select>
              </div>

              {/* Background Repeat */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  Repeat
                </label>
                <select
                  value={currentBgRepeat}
                  onChange={(e) => updateSelectedStyle("backgroundRepeat", e.target.value as any)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
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

        {/* 3. Border Controls */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-slate-700">
              Border Style
              {isBorderOverridden && (
                <span className="ml-1 rounded bg-blue-100 px-1 py-0.5 text-[9px] font-bold text-blue-700 uppercase">
                  {activeDevice}
                </span>
              )}
            </label>
            {(selectedElement?.styles?.borderStyle || selectedElement?.styles?.borderColor || selectedElement?.styles?.borderWidth || isBorderOverridden) && (
              <button
                type="button"
                onClick={() => {
                  resetSelectedStyle("borderStyle");
                  resetSelectedStyle("borderWidth");
                  resetSelectedStyle("borderColor");
                }}
                title="Reset Border to Default"
                className="text-[10px] font-semibold text-slate-500 hover:text-blue-600 hover:underline"
              >
                ↺ Reset
              </button>
            )}
          </div>
          <select
            value={currentBorderStyle}
            onChange={(e) => updateSelectedStyle("borderStyle", e.target.value as any)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 mb-2"
          >
            <option value="none">None</option>
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </select>

          {currentBorderStyle !== "none" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  Width (px)
                </label>
                <input
                  type="number"
                  value={currentBorderWidth.replace("px", "")}
                  onChange={(e) =>
                    updateSelectedStyle(
                      "borderWidth",
                      e.target.value ? `${e.target.value}px` : "1px"
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  Color
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={currentBorderColor.startsWith("#") ? currentBorderColor : "#cbd5e1"}
                    onChange={(e) => updateSelectedStyle("borderColor", e.target.value)}
                    className="h-7 w-8 cursor-pointer rounded border border-slate-300 bg-transparent p-0.5"
                  />
                  <input
                    type="text"
                    value={currentBorderColor}
                    onChange={(e) => updateSelectedStyle("borderColor", e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-mono font-medium text-slate-800 outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleSampleColor((hex) => updateSelectedStyle("borderColor", hex))}
                    title="Sample Color from Screen / Image"
                    className="h-7 px-1.5 rounded border border-slate-300 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-xs font-bold text-slate-700 hover:text-blue-600 transition flex items-center gap-0.5 shrink-0"
                  >
                    <span>🧪</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. Border Radius (4 Corners) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <label className="block text-xs font-semibold text-slate-700">
                Border Radius
              </label>
              {isRadiusOverridden && (
                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700 uppercase">
                  {activeDevice}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsBorderRadiusLinked(!isBorderRadiusLinked)}
                className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold transition ${isBorderRadiusLinked
                  ? "bg-blue-100 text-blue-700 border border-blue-200"
                  : "bg-slate-100 text-slate-600 border border-slate-200"
                  }`}
                title={isBorderRadiusLinked ? "Unlink Corners" : "Link Corners"}
              >
                <span>{isBorderRadiusLinked ? "🔗" : "🔓"}</span>
                <span className="text-[10px]">
                  {isBorderRadiusLinked ? "Linked" : "Unlinked"}
                </span>
              </button>

              {activeDevice !== "desktop" && isRadiusOverridden && (
                <button
                  type="button"
                  onClick={() => {
                    resetSelectedStyle("borderTopLeftRadius");
                    resetSelectedStyle("borderTopRightRadius");
                    resetSelectedStyle("borderBottomRightRadius");
                    resetSelectedStyle("borderBottomLeftRadius");
                    resetSelectedStyle("borderRadius");
                  }}
                  className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 underline transition"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            <div>
              <span className="block text-[9px] font-semibold text-slate-400 text-center mb-0.5">
                TL
              </span>
              <input
                type="number"
                value={parsedTL.num}
                onChange={(e) =>
                  updateCornerRadius(
                    "borderTopLeftRadius",
                    e.target.value ? `${e.target.value}${activeRadiusUnit}` : ""
                  )
                }
                placeholder="0"
                className="w-full rounded-lg border border-slate-300 bg-white px-1.5 py-1 text-center text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <span className="block text-[9px] font-semibold text-slate-400 text-center mb-0.5">
                TR
              </span>
              <input
                type="number"
                value={parsedTR.num}
                onChange={(e) =>
                  updateCornerRadius(
                    "borderTopRightRadius",
                    e.target.value ? `${e.target.value}${activeRadiusUnit}` : ""
                  )
                }
                placeholder="0"
                className="w-full rounded-lg border border-slate-300 bg-white px-1.5 py-1 text-center text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <span className="block text-[9px] font-semibold text-slate-400 text-center mb-0.5">
                BR
              </span>
              <input
                type="number"
                value={parsedBR.num}
                onChange={(e) =>
                  updateCornerRadius(
                    "borderBottomRightRadius",
                    e.target.value ? `${e.target.value}${activeRadiusUnit}` : ""
                  )
                }
                placeholder="0"
                className="w-full rounded-lg border border-slate-300 bg-white px-1.5 py-1 text-center text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <span className="block text-[9px] font-semibold text-slate-400 text-center mb-0.5">
                BL
              </span>
              <input
                type="number"
                value={parsedBL.num}
                onChange={(e) =>
                  updateCornerRadius(
                    "borderBottomLeftRadius",
                    e.target.value ? `${e.target.value}${activeRadiusUnit}` : ""
                  )
                }
                placeholder="0"
                className="w-full rounded-lg border border-slate-300 bg-white px-1.5 py-1 text-center text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* 5. Box Shadow */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">
              Box Shadow
              {isShadowOverridden && (
                <span className="ml-1 rounded bg-blue-100 px-1 py-0.5 text-[9px] font-bold text-blue-700 uppercase">
                  {activeDevice}
                </span>
              )}
            </span>
            {currentBoxShadow && (
              <button
                type="button"
                onClick={() => {
                  updateSelectedStyle("boxShadow", "");
                  if (activeDevice !== "desktop") resetSelectedStyle("boxShadow");
                }}
                className="text-[10px] font-semibold text-red-500 hover:underline"
              >
                Clear
              </button>
            )}
          </div>

          <div className="grid grid-cols-4 gap-1.5 text-[10px]">
            <div>
              <span className="text-slate-400">X (px)</span>
              <input
                type="number"
                value={shadowX}
                onChange={(e) =>
                  updateSelectedStyle(
                    "boxShadow",
                    `${e.target.value}px ${shadowY}px ${shadowBlur}px ${shadowSpread}px ${shadowColor}`
                  )
                }
                className="w-full rounded border border-slate-200 bg-white p-1 text-center text-xs"
              />
            </div>
            <div>
              <span className="text-slate-400">Y (px)</span>
              <input
                type="number"
                value={shadowY}
                onChange={(e) =>
                  updateSelectedStyle(
                    "boxShadow",
                    `${shadowX}px ${e.target.value}px ${shadowBlur}px ${shadowSpread}px ${shadowColor}`
                  )
                }
                className="w-full rounded border border-slate-200 bg-white p-1 text-center text-xs"
              />
            </div>
            <div>
              <span className="text-slate-400">Blur</span>
              <input
                type="number"
                value={shadowBlur}
                onChange={(e) =>
                  updateSelectedStyle(
                    "boxShadow",
                    `${shadowX}px ${shadowY}px ${e.target.value}px ${shadowSpread}px ${shadowColor}`
                  )
                }
                className="w-full rounded border border-slate-200 bg-white p-1 text-center text-xs"
              />
            </div>
            <div>
              <span className="text-slate-400">Spread</span>
              <input
                type="number"
                value={shadowSpread}
                onChange={(e) =>
                  updateSelectedStyle(
                    "boxShadow",
                    `${shadowX}px ${shadowY}px ${shadowBlur}px ${e.target.value}px ${shadowColor}`
                  )
                }
                className="w-full rounded border border-slate-200 bg-white p-1 text-center text-xs"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <span className="text-[10px] font-medium text-slate-500">Color</span>
            <input
              type="color"
              value={shadowColor.startsWith("#") ? shadowColor : "#000000"}
              onChange={(e) =>
                updateSelectedStyle(
                  "boxShadow",
                  `${shadowX}px ${shadowY}px ${shadowBlur}px ${shadowSpread}px ${e.target.value}`
                )
              }
              className="h-6 w-8 cursor-pointer rounded border border-slate-200 bg-transparent p-0.5"
            />
            <input
              type="text"
              value={shadowColor}
              onChange={(e) =>
                updateSelectedStyle(
                  "boxShadow",
                  `${shadowX}px ${shadowY}px ${shadowBlur}px ${shadowSpread}px ${e.target.value}`
                )
              }
              placeholder="rgba(0,0,0,0.25)"
              className="w-full rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-mono"
            />
          </div>
        </div>
      </div>
    );
}
