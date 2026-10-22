import React from "react";
import { FontPickerControl } from "../../../../components/FontPickerControl";
import { FontService } from "../../../../features/fonts/FontService";
import type { DeviceMode, ElementState, ElementStyles } from "../../types";
import { getControlStyleValue, isControlStyleConfigured } from "../../utils";

/** What renderTypographyAccordion reads: the editor values and callbacks the inline JSX used. */
export interface TypographyAccordionDeps {
  activeDevice: DeviceMode;
  activeElementState: ElementState;
  handleOpenFontPicker: (onSelect?: ((family: string) => void) | undefined) => void;
  renderAccordion: (title: string, id: string, children: React.ReactNode) => React.JSX.Element;
  renderResponsiveLabel: (label: string) => React.JSX.Element;
  resetSelectedStyle: (key: keyof ElementStyles) => void;
  selectedElementAny: any;
  updateSelectedStyle: (key: keyof ElementStyles, value: any) => void;
}

/**
 * Selected-element inspector: the Typography & Colors accordion.
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 5461-5668 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderTypographyAccordion({
  activeDevice,
  activeElementState,
  handleOpenFontPicker,
  renderAccordion,
  renderResponsiveLabel,
  resetSelectedStyle,
  selectedElementAny,
  updateSelectedStyle,
}: TypographyAccordionDeps): React.ReactNode {
  return (
                    renderAccordion(
                      "Typography & Colors",
                      "typography",
                      (() => {
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
                          900: "900 Black"
                        };

                        return (
                          <div className="space-y-3">
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
                                {renderResponsiveLabel("Font Size")}
                                <input
                                  type="text"
                                  value={
                                    getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "fontSize") || "16px"
                                  }
                                  onChange={(e) =>
                                    updateSelectedStyle(
                                      "fontSize",
                                      e.target.value.endsWith("px") || e.target.value.endsWith("rem")
                                        ? e.target.value
                                        : `${e.target.value}px`
                                    )
                                  }
                                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                                  placeholder="16px"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                  Font Weight
                                </label>
                                <select
                                  value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "fontWeight") || "normal"}
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

                            {/* Font Style & Alignment */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                  Font Style
                                </label>
                                <select
                                  value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "fontStyle") || "normal"}
                                  onChange={(e) => updateSelectedStyle("fontStyle", e.target.value as any)}
                                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                                >
                                  <option value="normal">Normal</option>
                                  <option value="italic" disabled={!hasItalic}>
                                    Italic {!hasItalic ? "(N/A)" : ""}
                                  </option>
                                </select>
                              </div>
                            </div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Text Align
                            </label>
                            <div className="grid grid-cols-4 gap-0.5 rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                              {(["left", "center", "right", "justify"] as const).map((align) => {
                                const currentAlign = getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "textAlign") || "left";
                                const isActive = currentAlign === align;
                                return (
                                  <button
                                    key={align}
                                    type="button"
                                    onClick={() => updateSelectedStyle("textAlign", align)}
                                    className={`rounded py-1 text-[10px] font-bold uppercase transition ${isActive
                                      ? "bg-white text-blue-600 shadow-xs"
                                      : "text-slate-500 hover:text-slate-900"
                                      }`}
                                  >
                                    {align.slice(0, 1).toUpperCase()}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Line Height & Letter Spacing */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                  Line Height
                                </label>
                                <input
                                  type="text"
                                  value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "lineHeight") || ""}
                                  onChange={(e) => updateSelectedStyle("lineHeight", e.target.value)}
                                  placeholder="e.g. 1.5 or 24px"
                                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                  Letter Spacing
                                </label>
                                <input
                                  type="text"
                                  value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "letterSpacing") || ""}
                                  onChange={(e) => updateSelectedStyle("letterSpacing", e.target.value)}
                                  placeholder="e.g. 0.5px"
                                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                                />
                              </div>
                            </div>

                            {/* Text Transform & Decoration */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                  Text Transform
                                </label>
                                <select
                                  value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "textTransform") || "none"}
                                  onChange={(e) => updateSelectedStyle("textTransform", e.target.value as any)}
                                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                                >
                                  <option value="none">None</option>
                                  <option value="capitalize">Capitalize</option>
                                  <option value="uppercase">Uppercase</option>
                                  <option value="lowercase">Lowercase</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                  Decoration
                                </label>
                                <select
                                  value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "textDecoration") || "none"}
                                  onChange={(e) => updateSelectedStyle("textDecoration", e.target.value as any)}
                                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                                >
                                  <option value="none">None</option>
                                  <option value="underline">Underline</option>
                                  <option value="line-through">Line-Through</option>
                                </select>
                              </div>
                            </div>

                            {/* Text Color Picker */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="block text-xs font-semibold text-slate-700">
                                  Text Color
                                </label>
                                {isControlStyleConfigured(selectedElementAny, activeDevice, activeElementState, "color") && (
                                  <button
                                    type="button"
                                    onClick={() => resetSelectedStyle("color")}
                                    className="text-[10px] font-semibold text-slate-500 hover:text-blue-600 hover:underline"
                                  >
                                    ↺ Reset
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "color") || "#0f172a"}
                                  onChange={(e) => updateSelectedStyle("color", e.target.value)}
                                  className="h-8 w-10 cursor-pointer rounded border border-slate-300 bg-transparent p-0.5"
                                />
                                <input
                                  type="text"
                                  value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "color") || "#0f172a"}
                                  onChange={(e) => updateSelectedStyle("color", e.target.value)}
                                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-medium text-slate-800 outline-none focus:border-blue-500"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    )
  );
}
