import React from "react";

/** What renderNonContainerSpacingSection reads: the editor values and callbacks the inline JSX used. */
export interface NonContainerSpacingSectionDeps {
  selectedElementAny: any;
  updateSelectedProp: (key: string, value: any) => void;
}

/**
 * Selected-element inspector: the section shown for non-container, non-media elements (just before Smart Link).
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 5389-5411 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderNonContainerSpacingSection({
  selectedElementAny,
  updateSelectedProp,
}: NonContainerSpacingSectionDeps): React.ReactNode {
  return (
                    selectedElementAny.type !== "container" && selectedElementAny.type !== "image" && selectedElementAny.type !== "video" && selectedElementAny.type !== "spacer" && selectedElementAny.type !== "divider" && selectedElementAny.type !== "icon" && selectedElementAny.type !== "counter" && selectedElementAny.type !== "gallery" && selectedElementAny.type !== "basic-gallery" && selectedElementAny.type !== "slides" && selectedElementAny.type !== "share-buttons" && selectedElementAny.type !== "form" && selectedElementAny.type !== "reviews" && selectedElementAny.type !== "testimonial-carousel" && selectedElementAny.type !== "video-playlist" && selectedElementAny.type !== "nav-menu" && selectedElementAny.type !== "countdown" && selectedElementAny.type !== "lottie" && selectedElementAny.type !== "code-highlight" && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide">
                          {selectedElementAny.type === "html" ? "Raw HTML Editor" : selectedElementAny.type === "shortcode" ? "Dynamic Shortcode" : "Content"}
                        </label>
                        {selectedElementAny.type === "html" || selectedElementAny.type === "text" || selectedElementAny.type === "shortcode" ? (
                          <textarea
                            value={selectedElementAny.content || ""}
                            onChange={(e) => updateSelectedProp("content", e.target.value)}
                            rows={selectedElementAny.type === "html" ? 8 : selectedElementAny.type === "shortcode" ? 3 : 4}
                            className={`w-full rounded-lg border border-slate-200 px-3 py-2 text-[12px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${selectedElementAny.type === "html" || selectedElementAny.type === "shortcode" ? "font-mono bg-[#1E1E1E] text-slate-300 resize-y" : "bg-white text-slate-800"}`}
                            placeholder={selectedElementAny.type === "html" ? "<div class=\"custom\">\n  Your HTML\n</div>" : selectedElementAny.type === "shortcode" ? "wp_plugin_id='xyz'" : "Enter text..."}
                          />
                        ) : (
                          <input
                            type="text"
                            value={selectedElementAny.content || ""}
                            onChange={(e) => updateSelectedProp("content", e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm bg-white"
                          />
                        )}
                      </div>
                    )
  );
}
