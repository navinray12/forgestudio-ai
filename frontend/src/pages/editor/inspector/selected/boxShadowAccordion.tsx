import React from "react";
import type { DeviceMode, ElementState, ElementStyles } from "../../types";
import { getControlStyleValue } from "../../utils";

/** What renderBoxShadowAccordion reads: the editor values and callbacks the inline JSX used. */
export interface BoxShadowAccordionDeps {
  activeDevice: DeviceMode;
  activeElementState: ElementState;
  renderAccordion: (title: string, id: string, children: React.ReactNode) => React.JSX.Element;
  selectedElementAny: any;
  updateSelectedStyle: (key: keyof ElementStyles, value: any) => void;
}

/**
 * Selected-element inspector: the Box Shadow & Effects accordion.
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 5757-5791 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderBoxShadowAccordion({
  activeDevice,
  activeElementState,
  renderAccordion,
  selectedElementAny,
  updateSelectedStyle,
}: BoxShadowAccordionDeps): React.ReactNode {
  return (
                    renderAccordion(
                      "Box Shadow & Effects",
                      "box-shadow",
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Box Shadow Presets
                          </label>
                          <select
                            value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "boxShadow") || "none"}
                            onChange={(e) => updateSelectedStyle("boxShadow", e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                          >
                            <option value="none">None</option>
                            <option value="0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)">Subtle (SM)</option>
                            <option value="0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)">Soft (MD)</option>
                            <option value="0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)">Medium (LG)</option>
                            <option value="0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)">Large (XL)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Opacity
                          </label>
                          <input
                            type="text"
                            value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "opacity") ?? "1"}
                            onChange={(e) => updateSelectedStyle("opacity", e.target.value)}
                            placeholder="0.0 - 1.0"
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    )
  );
}
