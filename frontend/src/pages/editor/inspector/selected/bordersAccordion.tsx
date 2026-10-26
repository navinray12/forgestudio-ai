import React from "react";
import type { DeviceMode, ElementState, ElementStyles } from "../../types";
import { getControlStyleValue, isControlStyleConfigured } from "../../utils";

/** What renderBordersAccordion reads: the editor values and callbacks the inline JSX used. */
export interface BordersAccordionDeps {
  activeDevice: DeviceMode;
  activeElementState: ElementState;
  renderAccordion: (title: string, id: string, children: React.ReactNode) => React.JSX.Element;
  resetSelectedStyle: (key: keyof ElementStyles) => void;
  selectedElementAny: any;
  updateSelectedStyle: (key: keyof ElementStyles, value: any) => void;
}

/**
 * Selected-element inspector: the Borders & Radius accordion.
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 5670-5755 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderBordersAccordion({
  activeDevice,
  activeElementState,
  renderAccordion,
  resetSelectedStyle,
  selectedElementAny,
  updateSelectedStyle,
}: BordersAccordionDeps): React.ReactNode {
  return (
                    renderAccordion(
                      "Borders & Radius",
                      "borders",
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Border Style
                            </label>
                            <select
                              value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "borderStyle") || "none"}
                              onChange={(e) => updateSelectedStyle("borderStyle", e.target.value as any)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                            >
                              <option value="none">None</option>
                              <option value="solid">Solid</option>
                              <option value="dashed">Dashed</option>
                              <option value="dotted">Dotted</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Border Width
                            </label>
                            <input
                              type="text"
                              value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "borderWidth") || "1px"}
                              onChange={(e) =>
                                updateSelectedStyle(
                                  "borderWidth",
                                  e.target.value.endsWith("px") ? e.target.value : `${e.target.value}px`
                                )
                              }
                              placeholder="1px"
                              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>

                        {/* Border Color */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-semibold text-slate-700">
                              Border Color
                            </label>
                            {isControlStyleConfigured(selectedElementAny, activeDevice, activeElementState, "borderColor") && (
                              <button
                                type="button"
                                onClick={() => resetSelectedStyle("borderColor")}
                                className="text-[10px] font-semibold text-slate-500 hover:text-blue-600 hover:underline"
                              >
                                ↺ Reset
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "borderColor") || "#cbd5e1"}
                              onChange={(e) => updateSelectedStyle("borderColor", e.target.value)}
                              className="h-8 w-10 cursor-pointer rounded border border-slate-300 bg-transparent p-0.5"
                            />
                            <input
                              type="text"
                              value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "borderColor") || "#cbd5e1"}
                              onChange={(e) => updateSelectedStyle("borderColor", e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-medium text-slate-800 outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>

                        {/* Border Radius */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Border Radius
                          </label>
                          <input
                            type="text"
                            value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "borderRadius") || ""}
                            onChange={(e) => updateSelectedStyle("borderRadius", e.target.value)}
                            placeholder="e.g. 8px or 50%"
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    )
  );
}
