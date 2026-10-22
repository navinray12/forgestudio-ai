import React from "react";
import { ScrubbableNumberInput } from "../../components/ScrubbableNumberInput";
import type { ContainerLayout, DeviceMode } from "../../types";
import { getEffectiveLayout } from "../../utils";

/** What renderContainerLayoutControls reads: the editor values and callbacks the inline JSX used. */
export interface ContainerLayoutControlsDeps {
  activeDevice: DeviceMode;
  selectedElementAny: any;
  updateSelectedLayout: (key: keyof ContainerLayout, value: any) => void;
}

/**
 * Selected-element inspector: container layout controls (flexbox, CSS grid, masonry).
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 4191-4508 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderContainerLayoutControls({
  activeDevice,
  selectedElementAny,
  updateSelectedLayout,
}: ContainerLayoutControlsDeps): React.ReactNode {
  return (
                    selectedElementAny.type === "container" && (() => {
                      const effectiveLayoutType = getEffectiveLayout(selectedElementAny, activeDevice, "layoutType") ?? selectedElementAny.layout?.layoutType ?? "flex";
                      const isGrid = effectiveLayoutType === "grid";
                      const effectiveGridCols = getEffectiveLayout(selectedElementAny, activeDevice, "gridTemplateColumns") ?? selectedElementAny.layout?.gridTemplateColumns ?? "repeat(2, minmax(0, 1fr))";
                      const effectiveGridFlow = getEffectiveLayout(selectedElementAny, activeDevice, "gridAutoFlow") ?? selectedElementAny.layout?.gridAutoFlow ?? "row";
                      const effectiveJustifyItems = getEffectiveLayout(selectedElementAny, activeDevice, "justifyItems") ?? selectedElementAny.layout?.justifyItems ?? "stretch";
                      const effectiveAlignItems = getEffectiveLayout(selectedElementAny, activeDevice, "alignItems") ?? selectedElementAny.layout?.alignItems ?? "stretch";
                      const effectiveDirection = getEffectiveLayout(selectedElementAny, activeDevice, "direction") ?? selectedElementAny.layout?.direction ?? "column";
                      const effectiveJustifyContent = getEffectiveLayout(selectedElementAny, activeDevice, "justifyContent") ?? selectedElementAny.layout?.justifyContent ?? "flex-start";
                      const effectiveGap = getEffectiveLayout(selectedElementAny, activeDevice, "gap") ?? selectedElementAny.layout?.gap ?? 10;
                      const effectiveRowGap = getEffectiveLayout(selectedElementAny, activeDevice, "rowGap") ?? selectedElementAny.layout?.rowGap ?? "";
                      const effectiveColGap = getEffectiveLayout(selectedElementAny, activeDevice, "columnGap") ?? selectedElementAny.layout?.columnGap ?? "";

                      const isMasonry = effectiveLayoutType === "masonry";
                      const effectiveMasonryCols = getEffectiveLayout(selectedElementAny, activeDevice, "masonryColumns") ?? selectedElementAny.layout?.masonryColumns ?? 3;
                      const effectiveMasonryGap = getEffectiveLayout(selectedElementAny, activeDevice, "masonryGap") ?? selectedElementAny.layout?.masonryGap ?? 16;

                      return (
                        <div className="space-y-4">
                          {/* Layout Type Toggle (F-041, F-042, F-043, F-051) */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-xs font-semibold text-slate-700">
                                Layout Type
                              </label>
                              <span className="text-[10px] font-bold text-blue-600 uppercase bg-blue-50 px-1.5 py-0.5 rounded">
                                {activeDevice}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 border border-slate-200">
                              <button
                                type="button"
                                onClick={() => updateSelectedLayout("layoutType", "flex")}
                                className={`py-1.5 text-xs font-bold rounded transition-colors ${!isGrid && !isMasonry ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:bg-slate-200"
                                  }`}
                              >
                                ⚡ Flexbox
                              </button>
                              <button
                                type="button"
                                onClick={() => updateSelectedLayout("layoutType", "grid")}
                                className={`py-1.5 text-xs font-bold rounded transition-colors ${isGrid ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:bg-slate-200"
                                  }`}
                              >
                                ▦ CSS Grid
                              </button>
                              <button
                                type="button"
                                onClick={() => updateSelectedLayout("layoutType", "masonry")}
                                className={`py-1.5 text-xs font-bold rounded transition-colors ${isMasonry ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:bg-slate-200"
                                  }`}
                              >
                                🧱 Masonry
                              </button>
                            </div>
                          </div>

                          {/* Masonry Setup Controls (F-051) */}
                          {isMasonry ? (
                            <div className="space-y-3 p-3 bg-slate-50/80 rounded-lg border border-slate-200/80">
                              <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                  Masonry Columns (2 - 6)
                                </label>
                                <div className="grid grid-cols-5 gap-1 mb-2">
                                  {[2, 3, 4, 5, 6].map((cols) => {
                                    const isSelected = Number(effectiveMasonryCols) === cols;
                                    return (
                                      <button
                                        key={cols}
                                        type="button"
                                        onClick={() => updateSelectedLayout("masonryColumns", cols)}
                                        className={`py-1 text-xs font-bold rounded border ${isSelected
                                          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                                          }`}
                                      >
                                        {cols} Col
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                  Masonry Column Gap (px)
                                </label>
                                <ScrubbableNumberInput
                                  value={effectiveMasonryGap}
                                  onChange={(val) => updateSelectedLayout("masonryGap", Number(val))}
                                  min={0}
                                  max={100}
                                  step={1}
                                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                                />
                              </div>
                            </div>
                          ) : isGrid ? (
                            /* CSS Grid Setup Controls (F-041, F-043, F-038) */
                            <div className="space-y-3 p-3 bg-slate-50/80 rounded-lg border border-slate-200/80">
                              <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                  Equal Columns (F-038)
                                </label>
                                <div className="grid grid-cols-6 gap-1 mb-2">
                                  {[1, 2, 3, 4, 6, 12].map((cols) => {
                                    const template = `repeat(${cols}, minmax(0, 1fr))`;
                                    const isSelected = effectiveGridCols === template;
                                    return (
                                      <button
                                        key={cols}
                                        type="button"
                                        onClick={() => updateSelectedLayout("gridTemplateColumns", template)}
                                        className={`py-1 text-xs font-bold rounded border ${isSelected
                                          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                                          }`}
                                        title={`${cols} Column${cols > 1 ? "s" : ""}`}
                                      >
                                        {cols}c
                                      </button>
                                    );
                                  })}
                                </div>

                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                  Column Split Ratios (F-038)
                                </label>
                                <div className="grid grid-cols-3 gap-1 mb-2">
                                  {[
                                    { label: "50 / 50", val: "repeat(2, minmax(0, 1fr))" },
                                    { label: "33 / 66", val: "1fr 2fr" },
                                    { label: "66 / 33", val: "2fr 1fr" },
                                    { label: "33 / 33 / 33", val: "repeat(3, minmax(0, 1fr))" },
                                    { label: "1:2:1", val: "1fr 2fr 1fr" },
                                    { label: "4 Equal", val: "repeat(4, minmax(0, 1fr))" },
                                  ].map((preset) => {
                                    const isSelected = effectiveGridCols === preset.val;
                                    return (
                                      <button
                                        key={preset.label}
                                        type="button"
                                        onClick={() => updateSelectedLayout("gridTemplateColumns", preset.val)}
                                        className={`py-1 px-1 text-[10px] font-bold rounded border ${isSelected
                                          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                                          }`}
                                      >
                                        {preset.label}
                                      </button>
                                    );
                                  })}
                                </div>

                                <label className="block text-[11px] text-slate-500 mb-1">
                                  Custom Template (grid-template-columns)
                                </label>
                                <input
                                  type="text"
                                  value={effectiveGridCols}
                                  onChange={(e) => updateSelectedLayout("gridTemplateColumns", e.target.value)}
                                  placeholder="e.g. repeat(3, minmax(0, 1fr)) or 1fr 2fr"
                                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono text-slate-800 outline-none focus:border-blue-500"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Auto Flow
                                  </label>
                                  <select
                                    value={effectiveGridFlow}
                                    onChange={(e) => updateSelectedLayout("gridAutoFlow", e.target.value as any)}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                                  >
                                    <option value="row">Row</option>
                                    <option value="column">Column</option>
                                    <option value="dense">Dense</option>
                                    <option value="row dense">Row Dense</option>
                                    <option value="column dense">Column Dense</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Justify Items
                                  </label>
                                  <select
                                    value={effectiveJustifyItems}
                                    onChange={(e) => updateSelectedLayout("justifyItems", e.target.value as any)}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                                  >
                                    <option value="stretch">Stretch</option>
                                    <option value="start">Start</option>
                                    <option value="center">Center</option>
                                    <option value="end">End</option>
                                  </select>
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                  Align Items
                                </label>
                                <select
                                  value={effectiveAlignItems}
                                  onChange={(e) => updateSelectedLayout("alignItems", e.target.value as any)}
                                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                                >
                                  <option value="stretch">Stretch</option>
                                  <option value="flex-start">Start</option>
                                  <option value="center">Center</option>
                                  <option value="flex-end">End</option>
                                </select>
                              </div>
                            </div>
                          ) : (
                            /* Flexbox Controls (F-042) */
                            <div className="space-y-4">
                              {/* Direction */}
                              <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                  Direction (F-039, F-040)
                                </label>
                                <select
                                  value={effectiveDirection}
                                  onChange={(e) => updateSelectedLayout("direction", e.target.value as any)}
                                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                                >
                                  <option value="column">Column (Vertical Stack)</option>
                                  <option value="row">Row (Horizontal)</option>
                                </select>
                              </div>

                              {/* Justify Content */}
                              <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                  Justify Content (F-045)
                                </label>
                                <select
                                  value={effectiveJustifyContent}
                                  onChange={(e) => updateSelectedLayout("justifyContent", e.target.value as any)}
                                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                                >
                                  <option value="flex-start">Start (flex-start)</option>
                                  <option value="center">Center</option>
                                  <option value="flex-end">End (flex-end)</option>
                                  <option value="space-between">Space Between</option>
                                  <option value="space-around">Space Around</option>
                                  <option value="space-evenly">Space Evenly</option>
                                </select>
                              </div>

                              {/* Align Items */}
                              <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                  Align Items (F-045)
                                </label>
                                <select
                                  value={effectiveAlignItems}
                                  onChange={(e) => updateSelectedLayout("alignItems", e.target.value as any)}
                                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                                >
                                  <option value="stretch">Stretch</option>
                                  <option value="flex-start">Start (flex-start)</option>
                                  <option value="center">Center</option>
                                  <option value="flex-end">End (flex-end)</option>
                                </select>
                              </div>
                            </div>
                          )}

                          {/* Gap Controls (Common to Flex & Grid) */}
                          {!isMasonry && (
                            <div className="space-y-2 pt-1 border-t border-slate-200">
                              <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                  Gap (px)
                                </label>
                                <ScrubbableNumberInput
                                  value={effectiveGap}
                                  onChange={(val) => updateSelectedLayout("gap", Number(val))}
                                  min={0}
                                  step={1}
                                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                    Row Gap (px)
                                  </label>
                                  <input
                                    type="number"
                                    value={effectiveRowGap}
                                    onChange={(e) => updateSelectedLayout("rowGap", e.target.value ? Number(e.target.value) : undefined)}
                                    placeholder="Inherit gap"
                                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                    Col Gap (px)
                                  </label>
                                  <input
                                    type="number"
                                    value={effectiveColGap}
                                    onChange={(e) => updateSelectedLayout("columnGap", e.target.value ? Number(e.target.value) : undefined)}
                                    placeholder="Inherit gap"
                                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()
  );
}
