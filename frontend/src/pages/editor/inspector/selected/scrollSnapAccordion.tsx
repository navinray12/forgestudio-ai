import React from "react";
import type { DeviceMode, ElementState, ElementStyles } from "../../types";
import { getControlStyleValue, isControlStyleConfigured } from "../../utils";

/** What renderScrollSnapAccordion reads: the editor values and callbacks the inline JSX used. */
export interface ScrollSnapAccordionDeps {
  activeDevice: DeviceMode;
  activeElementState: ElementState;
  renderAccordion: (title: string, id: string, children: React.ReactNode) => React.JSX.Element;
  resetSelectedStyle: (key: keyof ElementStyles) => void;
  selectedElementAny: any;
  updateSelectedStyle: (key: keyof ElementStyles, value: any) => void;
}

/**
 * Selected-element inspector: Scroll Snap & Overflow (F-050) accordion, for the element types it applies to.
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 5496-5626 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderScrollSnapAccordion({
  activeDevice,
  activeElementState,
  renderAccordion,
  resetSelectedStyle,
  selectedElementAny,
  updateSelectedStyle,
}: ScrollSnapAccordionDeps): React.ReactNode {
  return (
                    (selectedElementAny.type === "container" || selectedElementAny.type === "section" || selectedElementAny.type === "row" || Boolean(selectedElementAny.layout)) && renderAccordion(
                      "Scroll Snap & Overflow (F-050)",
                      "scroll-snap",
                      (() => {
                        const snapType = getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "scrollSnapType") || "none";
                        const snapAlign = getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "scrollSnapAlign") || "none";
                        const snapStop = getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "scrollSnapStop") || "normal";
                        const overflowX = getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "overflowX") || "visible";
                        const overflowY = getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "overflowY") || "visible";

                        return (
                          <div className="space-y-3">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="block text-xs font-semibold text-slate-700">
                                  Scroll Snap Type (Container)
                                </label>
                                {isControlStyleConfigured(selectedElementAny, activeDevice, activeElementState, "scrollSnapType") && (
                                  <button
                                    type="button"
                                    onClick={() => resetSelectedStyle("scrollSnapType")}
                                    className="text-[10px] text-slate-400 hover:text-blue-600"
                                    title="Reset snap type"
                                  >
                                    ↺ Reset
                                  </button>
                                )}
                              </div>
                              <select
                                value={snapType}
                                onChange={(e) => updateSelectedStyle("scrollSnapType", e.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                              >
                                <option value="none">None</option>
                                <option value="x mandatory">Horizontal Mandatory (x mandatory)</option>
                                <option value="y mandatory">Vertical Mandatory (y mandatory)</option>
                                <option value="both mandatory">Both Mandatory</option>
                                <option value="x proximity">Horizontal Proximity</option>
                                <option value="y proximity">Vertical Proximity</option>
                              </select>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="block text-xs font-semibold text-slate-700">
                                    Snap Align
                                  </label>
                                  {isControlStyleConfigured(selectedElementAny, activeDevice, activeElementState, "scrollSnapAlign") && (
                                    <button
                                      type="button"
                                      onClick={() => resetSelectedStyle("scrollSnapAlign")}
                                      className="text-[10px] text-slate-400 hover:text-blue-600"
                                    >
                                      ↺
                                    </button>
                                  )}
                                </div>
                                <select
                                  value={snapAlign}
                                  onChange={(e) => updateSelectedStyle("scrollSnapAlign", e.target.value)}
                                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                                >
                                  <option value="none">None</option>
                                  <option value="start">Start</option>
                                  <option value="center">Center</option>
                                  <option value="end">End</option>
                                </select>
                              </div>
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="block text-xs font-semibold text-slate-700">
                                    Snap Stop
                                  </label>
                                  {isControlStyleConfigured(selectedElementAny, activeDevice, activeElementState, "scrollSnapStop") && (
                                    <button
                                      type="button"
                                      onClick={() => resetSelectedStyle("scrollSnapStop")}
                                      className="text-[10px] text-slate-400 hover:text-blue-600"
                                    >
                                      ↺
                                    </button>
                                  )}
                                </div>
                                <select
                                  value={snapStop}
                                  onChange={(e) => updateSelectedStyle("scrollSnapStop", e.target.value)}
                                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                                >
                                  <option value="normal">Normal</option>
                                  <option value="always">Always</option>
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                              <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                  Overflow X
                                </label>
                                <select
                                  value={overflowX}
                                  onChange={(e) => updateSelectedStyle("overflowX", e.target.value)}
                                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                                >
                                  <option value="visible">Visible</option>
                                  <option value="hidden">Hidden</option>
                                  <option value="auto">Auto</option>
                                  <option value="scroll">Scroll</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                  Overflow Y
                                </label>
                                <select
                                  value={overflowY}
                                  onChange={(e) => updateSelectedStyle("overflowY", e.target.value)}
                                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                                >
                                  <option value="visible">Visible</option>
                                  <option value="hidden">Hidden</option>
                                  <option value="auto">Auto</option>
                                  <option value="scroll">Scroll</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    )
  );
}
