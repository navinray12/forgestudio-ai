import React from "react";
import type { ContainerLayout, DeviceMode, ElementState, ElementStyles } from "../../types";
import { getControlStyleValue, isControlStyleConfigured } from "../../utils";
import { BackgroundImageInspector } from "../DynamicWidgetInspectors";

/** What renderUniversalSizingControls reads: the editor values and callbacks the inline JSX used. */
export interface UniversalSizingControlsDeps {
  activeDevice: DeviceMode;
  activeElementState: ElementState;
  handleSampleColor: (onColorPicked: (hex: string) => void) => Promise<void>;
  isMarginLinked: boolean;
  isPaddingLinked: boolean;
  render4SideSpacingControl: (title: string, type: "padding" | "margin", isLinked: boolean, setIsLinked: (val: boolean) => void) => React.JSX.Element;
  resetSelectedStyle: (key: keyof ElementStyles) => void;
  selectedElementAny: any;
  setIsMarginLinked: React.Dispatch<React.SetStateAction<boolean>>;
  setIsPaddingLinked: React.Dispatch<React.SetStateAction<boolean>>;
  updateSelectedLayout: (key: keyof ContainerLayout, value: any) => void;
  updateSelectedProp: (key: string, value: any) => void;
  updateSelectedStyle: (key: keyof ElementStyles, value: any) => void;
}

/**
 * Selected-element inspector: universal sizing, background & spacing controls (all element types).
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 4510-4738 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderUniversalSizingControls({
  activeDevice,
  activeElementState,
  handleSampleColor,
  isMarginLinked,
  isPaddingLinked,
  render4SideSpacingControl,
  resetSelectedStyle,
  selectedElementAny,
  setIsMarginLinked,
  setIsPaddingLinked,
  updateSelectedLayout,
  updateSelectedProp,
  updateSelectedStyle,
}: UniversalSizingControlsDeps): React.ReactNode {
  return (
                    <div className="space-y-4 pt-2">
                      {/* Width & Height */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-semibold text-slate-700">
                              Width (F-052)
                            </label>
                            {isControlStyleConfigured(selectedElementAny, activeDevice, activeElementState, "width") && (
                              <button
                                type="button"
                                onClick={() => resetSelectedStyle("width")}
                                className="text-[10px] text-slate-400 hover:text-blue-600"
                                title="Reset width"
                              >
                                ↺ Reset
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "width") || ""}
                            onChange={(e) => updateSelectedStyle("width", e.target.value || undefined)}
                            placeholder="auto, 100%, 50vw"
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-semibold text-slate-700">
                              Height (F-052)
                            </label>
                            {isControlStyleConfigured(selectedElementAny, activeDevice, activeElementState, "height") && (
                              <button
                                type="button"
                                onClick={() => resetSelectedStyle("height")}
                                className="text-[10px] text-slate-400 hover:text-blue-600"
                                title="Reset height"
                              >
                                ↺ Reset
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "height") || ""}
                            onChange={(e) => updateSelectedStyle("height", e.target.value || undefined)}
                            placeholder="auto, 100vh, 400px"
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      {/* Min / Max Dimensions (F-052) */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[11px] font-medium text-slate-600">
                              Min Height
                            </label>
                            {isControlStyleConfigured(selectedElementAny, activeDevice, activeElementState, "minHeight") && (
                              <button
                                type="button"
                                onClick={() => resetSelectedStyle("minHeight")}
                                className="text-[10px] text-slate-400 hover:text-blue-600"
                              >
                                ↺
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "minHeight") || ""}
                            onChange={(e) => updateSelectedStyle("minHeight", e.target.value || undefined)}
                            placeholder="e.g. 100vh, 300px"
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[11px] font-medium text-slate-600">
                              Max Width
                            </label>
                            {isControlStyleConfigured(selectedElementAny, activeDevice, activeElementState, "maxWidth") && (
                              <button
                                type="button"
                                onClick={() => resetSelectedStyle("maxWidth")}
                                className="text-[10px] text-slate-400 hover:text-blue-600"
                              >
                                ↺
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "maxWidth") || ""}
                            onChange={(e) => updateSelectedStyle("maxWidth", e.target.value || undefined)}
                            placeholder="e.g. 1200px, 100%"
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      {/* Universal Alignment Control (For ALL Elements & Widgets including Mega Menu) */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Alignment
                        </label>
                        <div className="grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1 border border-slate-200">
                          {(["left", "center", "right", "justify"] as const).map((align) => {
                            const currentAlign =
                              getControlStyleValue(
                                selectedElementAny,
                                activeDevice,
                                activeElementState,
                                "textAlign"
                              ) || "left";
                            const isActive = currentAlign === align;
                            return (
                              <button
                                key={align}
                                type="button"
                                onClick={() => {
                                  updateSelectedStyle("textAlign", align);
                                  const flexJustify =
                                    align === "left"
                                      ? "flex-start"
                                      : align === "right"
                                        ? "flex-end"
                                        : align === "center"
                                          ? "center"
                                          : "space-between";
                                  updateSelectedStyle("justifyContent", flexJustify);
                                  if (selectedElementAny.type === "nav-menu") {
                                    updateSelectedProp("navAlignment", align as any);
                                  }
                                  if (selectedElementAny.type === "mega-menu") {
                                    updateSelectedProp("megaMenuAlignment", align as any);
                                  }
                                  if (selectedElementAny.type === "share-buttons") {
                                    updateSelectedProp("shareAlignment", align as any);
                                  }
                                  if (selectedElementAny.type === "posts") {
                                    updateSelectedProp("postsAlignment", align as any);
                                  }
                                  if (selectedElementAny.type === "portfolio") {
                                    updateSelectedProp("portfolioAlignment", align as any);
                                  }
                                  if (selectedElementAny.type === "slides") {
                                    updateSelectedProp("slidesAlignment", align as any);
                                  }
                                  if (selectedElementAny.type === "price-table") {
                                    updateSelectedProp("pricingAlignment", align as any);
                                  }
                                  if (selectedElementAny.type === "price-list") {
                                    updateSelectedProp("priceListAlignment", align as any);
                                  }
                                  if (selectedElementAny.type === "table-of-contents") {
                                    updateSelectedProp("tocAlignment", align as any);
                                  }
                                  if (selectedElementAny.type === "image-carousel") {
                                    updateSelectedProp("imageCarouselAlignment", align as any);
                                  }
                                  if (selectedElementAny.type === "container" || selectedElementAny.layout) {
                                    updateSelectedLayout("justifyContent", flexJustify);
                                  }
                                }}
                                className={`rounded py-1 text-xs font-bold capitalize transition ${isActive
                                  ? "bg-white text-blue-600 shadow-xs"
                                  : "text-slate-600 hover:text-slate-900"
                                  }`}
                              >
                                {align}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Background Color */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-slate-700">
                            Background Color
                          </label>
                          {isControlStyleConfigured(selectedElementAny, activeDevice, activeElementState, "backgroundColor") && (
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
                            value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "backgroundColor") || "#ffffff"}
                            onChange={(e) => updateSelectedStyle("backgroundColor", e.target.value)}
                            className="h-8 w-10 cursor-pointer rounded border border-slate-300 bg-transparent p-0.5"
                          />
                          <input
                            type="text"
                            value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "backgroundColor") || "#ffffff"}
                            onChange={(e) => updateSelectedStyle("backgroundColor", e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-medium text-slate-800 outline-none focus:border-blue-500"
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

                      {/* Background Image & Overlay Controls */}
                      <BackgroundImageInspector el={selectedElementAny} updateStyle={updateSelectedStyle} />

                      {/* Advanced Spacing Controls for ALL Elements */}
                      {render4SideSpacingControl("Margin", "margin", isMarginLinked, setIsMarginLinked)}
                      {render4SideSpacingControl("Padding", "padding", isPaddingLinked, setIsPaddingLinked)}
                    </div>
  );
}
