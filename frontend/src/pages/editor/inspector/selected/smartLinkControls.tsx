import React from "react";

/** What renderSmartLinkControls reads: the editor values and callbacks the inline JSX used. */
export interface SmartLinkControlsDeps {
  popups: any[];
  selectedElementAny: any;
  updateSelectedProp: (key: string, value: any) => void;
}

/**
 * Selected-element inspector: Smart Link & URL controls (for linkable element types other than buttons).
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 5413-5460 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderSmartLinkControls({
  popups,
  selectedElementAny,
  updateSelectedProp,
}: SmartLinkControlsDeps): React.ReactNode {
  return (
                    selectedElementAny.type !== "button" && (selectedElementAny.type === "image" || selectedElementAny.href !== undefined) && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2">
                        <label className="block text-[10px] font-bold text-slate-600 uppercase">
                          Link & Smart Actions
                        </label>
                        <input
                          type="text"
                          value={selectedElementAny.href || ""}
                          onChange={(e) => updateSelectedProp("href", e.target.value)}
                          placeholder="https://..., popup:open(id), scroll:to(id)"
                          className="w-full rounded-lg border border-slate-300 p-1.5 text-xs font-mono"
                        />
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {popups.length > 0 && (
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  updateSelectedProp("href", `popup:open(${e.target.value})`);
                                  e.target.value = "";
                                }
                              }}
                              className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700"
                            >
                              <option value="">+ Open Popup...</option>
                              {popups.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          )}
                          <button
                            type="button"
                            onClick={() => updateSelectedProp("href", "popup:close")}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Close Popup
                          </button>
                          <button
                            type="button"
                            onClick={() => updateSelectedProp("href", "scroll:to(top)")}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Scroll to Top
                          </button>
                        </div>
                      </div>
                    )
  );
}
