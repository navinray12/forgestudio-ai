import React from "react";
import type { DeveloperModalMode } from "../../components/DeveloperModal";
import { PRESET_SECTION_TEMPLATES } from "../../defaults";
import type { AnimatedHeadlineStyle, DeviceMode, EditorElement, ElementState, ElementStyles, FormFieldItem, FormFieldType, GalleryImageItem, ImageCarouselItem, MegaMenuColumn, MegaMenuColumnLink, MegaMenuItem, NavMenuItem, NavSubmenuItem, PageConfig, PlaylistItem, PriceListItem, ReviewItem, SiteProduct, SlideItem } from "../../types";
import { generateId, getControlStyleValue, isControlStyleConfigured, resolveImageUrl } from "../../utils";
import { CodeHighlightBoxIcon, FacebookButtonBoxIcon, FacebookCommentsBoxIcon, FacebookEmbedBoxIcon, LottieBoxIcon, MegaMenuBoxIcon, OffCanvasBoxIcon, StripeButtonBoxIcon, UploadCloudIcon, VideoPlaylistBoxIcon } from "../../widgets";
import { CTAWidgetInspector, LoopCarouselWidgetInspector, MediaCarouselWidgetInspector, NestedCarouselWidgetInspector, PayPalWidgetInspector, PriceTableWidgetInspector, TestimonialCarouselWidgetInspector, TOCWidgetInspector } from "../DynamicWidgetInspectors";

/** What renderAdvancedInspectorBranch reads: the editor values and callbacks the inline JSX used. */
export interface AdvancedInspectorBranchDeps {
  activeDevice: DeviceMode;
  activeElementState: ElementState;
  apiUrl: any;
  components: Record<string, { name: string; element: EditorElement; isFavorite?: boolean | undefined; }>;
  dragOver: boolean;
  extractedColors: string[];
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleCreatePageQuick: (customName?: string | undefined) => PageConfig;
  handleDrop: (e: React.DragEvent<Element>) => void;
  handleImageFileSelect: (file: File) => Promise<void>;
  handleSampleColor: (onColorPicked: (hex: string) => void) => Promise<void>;
  handleUnpackTemplate: (elementId: string) => void;
  handleVideoFileSelect: (file: File) => Promise<void>;
  handleVideoPosterSelect: (file: File) => Promise<void>;
  isMarginLinked: boolean;
  isPaddingLinked: boolean;
  isUploading: boolean;
  pages: PageConfig[];
  render4SideSpacingControl: (title: string, type: "padding" | "margin", isLinked: boolean, setIsLinked: (val: boolean) => void) => React.JSX.Element;
  renderBackgroundAndBorderControls: () => React.JSX.Element | null;
  renderPositioningControls: () => React.JSX.Element | null;
  renderTypographySection: () => React.JSX.Element | null;
  resetSelectedStyle: (key: keyof ElementStyles) => void;
  selectedElementAny: any;
  setDevModalMode: React.Dispatch<React.SetStateAction<DeveloperModalMode | null>>;
  setDragOver: React.Dispatch<React.SetStateAction<boolean>>;
  setIsMarginLinked: React.Dispatch<React.SetStateAction<boolean>>;
  setIsPaddingLinked: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  siteProducts: SiteProduct[];
  updateSelectedProp: (key: string, value: any) => void;
  updateSelectedStyle: (key: keyof ElementStyles, value: any) => void;
  uploadError: string;
}

/**
 * Extended widget controls, including developer options and panels for 42 element types.
 * The redesigned editor exposes these after the common Style controls; keep this module
 * so the UI redesign and the extracted renderer architecture share the same controls.
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 3537-10676 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderAdvancedInspectorBranch({
  activeDevice,
  activeElementState,
  apiUrl,
  components,
  dragOver,
  extractedColors,
  fileInputRef,
  handleCreatePageQuick,
  handleDrop,
  handleImageFileSelect,
  handleSampleColor,
  handleUnpackTemplate,
  handleVideoFileSelect,
  handleVideoPosterSelect,
  isMarginLinked,
  isPaddingLinked,
  isUploading,
  pages,
  render4SideSpacingControl,
  renderBackgroundAndBorderControls,
  renderPositioningControls,
  renderTypographySection,
  resetSelectedStyle,
  selectedElementAny,
  setDevModalMode,
  setDragOver,
  setIsMarginLinked,
  setIsPaddingLinked,
  setSelectedId,
  siteProducts,
  updateSelectedProp,
  updateSelectedStyle,
  uploadError,
}: AdvancedInspectorBranchDeps): React.ReactNode {
  return (
                  <div className="space-y-4">
                    {/* Developer Options for Element (F-102, F-105 to F-109) */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700">Custom CSS ID (F-105)</label>
                        <input type="text" value={selectedElementAny.customId || ""} onChange={e => updateSelectedProp("customId", e.target.value)} placeholder="e.g. hero-section" className="w-full rounded border px-2 py-1.5 text-xs font-mono mt-1" />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-700">Additional CSS Classes (F-106)</label>
                        <input type="text" value={selectedElementAny.customClass || ""} onChange={e => updateSelectedProp("customClass", e.target.value)} placeholder="e.g. shadow-lg hover:shadow-xl" className="w-full rounded border px-2 py-1.5 text-xs font-mono mt-1" />
                      </div>
                      <hr className="border-slate-200" />
                      <button onClick={() => setDevModalMode("element-css")} className="w-full rounded-lg bg-white border border-slate-300 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm flex items-center justify-center gap-2">
                        <span className="text-blue-500">{"</>"}</span> Edit Element CSS (F-102)
                      </button>
                      <button onClick={() => setDevModalMode("css-selectors")} className="w-full rounded-lg bg-white border border-slate-300 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm flex items-center justify-center gap-2">
                        <span className="text-pink-500">{""}</span> Edit Selectors & Pseudo (F-107)
                      </button>
                      <button onClick={() => setDevModalMode(selectedElementAny.type === "button" ? "custom-attributes" : "custom-attributes")} className="w-full rounded-lg bg-white border border-slate-300 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm flex items-center justify-center gap-2">
                        <span className="text-emerald-500">{""}</span> Manage DOM Attributes (F-108 & F-109)
                      </button>
                    </div>
                    {/* Slider Specific Controls */}
                    {selectedElementAny.type === "slider" && (
                      <div className="space-y-4 pt-2 border-t border-slate-100">
                        {/* Display Navigation Controls */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                          <span className="block text-[11px] font-bold text-slate-600 mb-1">
                            Navigation Controls
                          </span>
                          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedElementAny.slidesShowArrows !== false}
                              onChange={(e) => updateSelectedProp("slidesShowArrows", e.target.checked)}
                              className="rounded border-slate-300 text-pink-600 focus:ring-pink-500"
                            />
                            <span>Prev / Next Arrow Buttons</span>
                          </label>
                          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedElementAny.slidesShowDots !== false}
                              onChange={(e) => updateSelectedProp("slidesShowDots", e.target.checked)}
                              className="rounded border-slate-300 text-pink-600 focus:ring-pink-500"
                            />
                            <span>Bottom Dots Indicators</span>
                          </label>
                        </div>

                        {/* Slide Items Manager */}
                        <div className="pt-2 border-t border-slate-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700">Slide Items ({selectedElementAny.slidesItems?.length || 0})</span>
                            <button
                              type="button"
                              onClick={() => {
                                const newSlide: SlideItem = {
                                  id: generateId(),
                                  title: "New Highlight Slide",
                                  description: "Add custom tagline, promotional announcement or banner copy.",
                                  bgImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1600&auto=format&fit=crop&q=80",
                                  bgColor: "#0f172a",
                                  buttonText: "Learn More",
                                  buttonUrl: "#",
                                };
                                const updated = [...(selectedElementAny.slidesItems || []), newSlide];
                                updateSelectedProp("slidesItems", updated);
                                updateSelectedProp("slidesActiveIndex", updated.length - 1);
                              }}
                              className="text-[11px] font-bold text-pink-600 hover:text-pink-800"
                            >
                              + Add Slide
                            </button>
                          </div>

                          <div className="space-y-3">
                            {(selectedElementAny.slidesItems || []).map((slide, idx) => (
                              <div
                                key={slide.id}
                                className={`rounded-xl border p-3 shadow-xs space-y-2 transition ${(selectedElementAny.slidesActiveIndex ?? 0) === idx
                                  ? "border-pink-400 bg-pink-50/20 ring-1 ring-pink-400"
                                  : "border-slate-200 bg-white"
                                  }`}
                              >
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                  <button
                                    type="button"
                                    onClick={() => updateSelectedProp("slidesActiveIndex", idx)}
                                    className="text-xs font-bold text-slate-800 hover:text-pink-600 text-left truncate max-w-[150px]"
                                  >
                                    Slide #{idx + 1}: {slide.title}
                                  </button>
                                  <div className="flex items-center gap-1.5">
                                    {idx > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const items = [...(selectedElementAny.slidesItems || [])];
                                          const temp = items[idx];
                                          items[idx] = items[idx - 1];
                                          items[idx - 1] = temp;
                                          updateSelectedProp("slidesItems", items);
                                          updateSelectedProp("slidesActiveIndex", idx - 1);
                                        }}
                                        className="text-[10px] font-bold text-slate-500 hover:text-slate-800"
                                        title="Move Up"
                                      >
                                        ↑
                                      </button>
                                    )}
                                    {idx < (selectedElementAny.slidesItems?.length || 0) - 1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const items = [...(selectedElementAny.slidesItems || [])];
                                          const temp = items[idx];
                                          items[idx] = items[idx + 1];
                                          items[idx + 1] = temp;
                                          updateSelectedProp("slidesItems", items);
                                          updateSelectedProp("slidesActiveIndex", idx + 1);
                                        }}
                                        className="text-[10px] font-bold text-slate-500 hover:text-slate-800"
                                        title="Move Down"
                                      >
                                        ↓
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = (selectedElementAny.slidesItems || []).filter((s) => s.id !== slide.id);
                                        updateSelectedProp("slidesItems", updated);
                                        updateSelectedProp("slidesActiveIndex", Math.max(0, idx - 1));
                                      }}
                                      className="text-[10px] font-bold text-red-500 hover:text-red-700"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                    Slide Title
                                  </label>
                                  <input
                                    type="text"
                                    value={slide.title}
                                    onChange={(e) => {
                                      const updated = (selectedElementAny.slidesItems || []).map((s) =>
                                        s.id === slide.id ? { ...s, title: e.target.value } : s
                                      );
                                      updateSelectedProp("slidesItems", updated);
                                    }}
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-pink-500 focus:bg-white"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                    Description
                                  </label>
                                  <textarea
                                    rows={2}
                                    value={slide.description || ""}
                                    onChange={(e) => {
                                      const updated = (selectedElementAny.slidesItems || []).map((s) =>
                                        s.id === slide.id ? { ...s, description: e.target.value } : s
                                      );
                                      updateSelectedProp("slidesItems", updated);
                                    }}
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-pink-500 focus:bg-white"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                    Background Image URL
                                  </label>
                                  <input
                                    type="text"
                                    value={slide.bgImage || ""}
                                    onChange={(e) => {
                                      const updated = (selectedElementAny.slidesItems || []).map((s) =>
                                        s.id === slide.id ? { ...s, bgImage: e.target.value } : s
                                      );
                                      updateSelectedProp("slidesItems", updated);
                                    }}
                                    placeholder="https://images.unsplash.com/..."
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-mono text-slate-800 outline-none focus:border-pink-500 focus:bg-white"
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                      Background Color
                                    </label>
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="color"
                                        value={slide.bgColor || "#0f172a"}
                                        onChange={(e) => {
                                          const updated = (selectedElementAny.slidesItems || []).map((s) =>
                                            s.id === slide.id ? { ...s, bgColor: e.target.value } : s
                                          );
                                          updateSelectedProp("slidesItems", updated);
                                        }}
                                        className="h-6 w-7 cursor-pointer rounded border border-slate-200 bg-transparent p-0.5"
                                      />
                                      <input
                                        type="text"
                                        value={slide.bgColor || "#0f172a"}
                                        onChange={(e) => {
                                          const updated = (selectedElementAny.slidesItems || []).map((s) =>
                                            s.id === slide.id ? { ...s, bgColor: e.target.value } : s
                                          );
                                          updateSelectedProp("slidesItems", updated);
                                        }}
                                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-mono text-slate-800 outline-none focus:border-pink-500 focus:bg-white"
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                      Button Text
                                    </label>
                                    <input
                                      type="text"
                                      value={slide.buttonText || ""}
                                      onChange={(e) => {
                                        const updated = (selectedElementAny.slidesItems || []).map((s) =>
                                          s.id === slide.id ? { ...s, buttonText: e.target.value } : s
                                        );
                                        updateSelectedProp("slidesItems", updated);
                                      }}
                                      placeholder="Learn More"
                                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-pink-500 focus:bg-white"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Form Specific Properties (F-178) */}
                    {selectedElementAny.type === "form" && (
                      <div className="space-y-4">
                        {/* Header Title & Subtitle */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Form Header
                          </span>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Header Title
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.formTitle !== undefined ? selectedElementAny.formTitle : "Get in Touch"}
                              onChange={(e) => updateSelectedProp("formTitle", e.target.value)}
                              placeholder="e.g. Get in Touch"
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Header Subtitle
                            </label>
                            <textarea
                              rows={2}
                              value={selectedElementAny.formSubtitle !== undefined ? selectedElementAny.formSubtitle : "Fill out the form below and our team will get back to you within 24 hours."}
                              onChange={(e) => updateSelectedProp("formSubtitle", e.target.value)}
                              placeholder="Brief description..."
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>

                        {/* Layout Columns */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Form Grid Layout
                          </label>
                          <select
                            value={selectedElementAny.formLayoutColumns || 2}
                            onChange={(e) => updateSelectedProp("formLayoutColumns", Number(e.target.value))}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                          >
                            <option value={1}>1 Column (Stacked)</option>
                            <option value={2}>2 Columns (Grid)</option>
                          </select>
                        </div>

                        {/* Field Gap Spacing */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-semibold text-slate-700">
                              Field Spacing (Gap)
                            </label>
                            <span className="text-[11px] font-mono text-slate-500">
                              {selectedElementAny.formFieldGap ?? 16}px
                            </span>
                          </div>
                          <input
                            type="range"
                            min={8}
                            max={32}
                            step={2}
                            value={selectedElementAny.formFieldGap ?? 16}
                            onChange={(e) => updateSelectedProp("formFieldGap", Number(e.target.value))}
                            className="w-full accent-emerald-600"
                          />
                        </div>

                        {/* Show Labels Toggle */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                          <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                            <span className="font-bold text-slate-700">Display Field Labels</span>
                            <input
                              type="checkbox"
                              checked={selectedElementAny.formShowLabels !== false}
                              onChange={(e) => updateSelectedProp("formShowLabels", e.target.checked)}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                          </label>
                        </div>

                        {/* Submit Button & Messages */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Submit Button Settings
                          </span>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Button Text
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.formSubmitText || "Send Message"}
                              onChange={(e) => updateSelectedProp("formSubmitText", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Success Message
                            </label>
                            <textarea
                              rows={2}
                              value={selectedElementAny.formSubmitSuccessMsg || "Thank you! Your message has been sent successfully."}
                              onChange={(e) => updateSelectedProp("formSubmitSuccessMsg", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Button Background
                              </label>
                              <div className="flex items-center gap-1">
                                <input
                                  type="color"
                                  value={selectedElementAny.formSubmitBtnBg || "#2563eb"}
                                  onChange={(e) => updateSelectedProp("formSubmitBtnBg", e.target.value)}
                                  className="h-6 w-7 cursor-pointer rounded border border-slate-200 bg-transparent p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.formSubmitBtnBg || "#2563eb"}
                                  onChange={(e) => updateSelectedProp("formSubmitBtnBg", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Button Text Color
                              </label>
                              <div className="flex items-center gap-1">
                                <input
                                  type="color"
                                  value={selectedElementAny.formSubmitBtnColor || "#ffffff"}
                                  onChange={(e) => updateSelectedProp("formSubmitBtnColor", e.target.value)}
                                  className="h-6 w-7 cursor-pointer rounded border border-slate-200 bg-transparent p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.formSubmitBtnColor || "#ffffff"}
                                  onChange={(e) => updateSelectedProp("formSubmitBtnColor", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-1">
                            <input
                              type="checkbox"
                              checked={selectedElementAny.formSubmitBtnFullWidth !== false}
                              onChange={(e) => updateSelectedProp("formSubmitBtnFullWidth", e.target.checked)}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span>Full Width Button</span>
                          </label>
                        </div>

                        {/* Form Mode & Multi-Step (F-275) */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Form Mode & Steps
                          </span>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => updateSelectedProp("formMode", "standard")}
                              className={`rounded-lg py-1.5 text-xs font-bold transition ${
                                selectedElementAny.formMode !== "step-by-step"
                                  ? "bg-emerald-600 text-white shadow-xs"
                                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                              }`}
                            >
                              Standard
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                updateSelectedProp("formMode", "step-by-step");
                                if (!selectedElementAny.formSteps || selectedElementAny.formSteps.length === 0) {
                                  updateSelectedProp("formSteps", [
                                    { id: "step_1", title: "Step 1: Contact Info" },
                                    { id: "step_2", title: "Step 2: Details" },
                                  ]);
                                }
                              }}
                              className={`rounded-lg py-1.5 text-xs font-bold transition ${
                                selectedElementAny.formMode === "step-by-step"
                                  ? "bg-emerald-600 text-white shadow-xs"
                                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                              }`}
                            >
                              Step-by-Step
                            </button>
                          </div>

                          {selectedElementAny.formMode === "step-by-step" && (
                            <div className="space-y-2 pt-2 border-t border-slate-200">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-slate-700">Steps ({selectedElementAny.formSteps?.length || 0})</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const currentSteps = selectedElementAny.formSteps || [];
                                    const newStep = {
                                      id: `step_${Date.now()}`,
                                      title: `Step ${currentSteps.length + 1}: Details`,
                                    };
                                    updateSelectedProp("formSteps", [...currentSteps, newStep]);
                                  }}
                                  className="rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-emerald-700 cursor-pointer"
                                >
                                  + Add Step
                                </button>
                              </div>

                              <div className="space-y-1.5">
                                {(selectedElementAny.formSteps || []).map((step: any, sIdx: number) => (
                                  <div key={step.id} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-1.5 shadow-2xs">
                                    <span className="text-[10px] font-bold text-slate-400 w-4 text-center">{sIdx + 1}</span>
                                    <input
                                      type="text"
                                      value={step.title}
                                      onChange={(e) => {
                                        const updated = (selectedElementAny.formSteps || []).map((s: any) =>
                                          s.id === step.id ? { ...s, title: e.target.value } : s
                                        );
                                        updateSelectedProp("formSteps", updated);
                                      }}
                                      className="flex-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-800 outline-none focus:border-emerald-500"
                                    />
                                    {sIdx > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const steps = [...(selectedElementAny.formSteps || [])];
                                          const temp = steps[sIdx];
                                          steps[sIdx] = steps[sIdx - 1];
                                          steps[sIdx - 1] = temp;
                                          updateSelectedProp("formSteps", steps);
                                        }}
                                        className="text-[10px] font-bold text-slate-500 hover:text-slate-800 px-1 cursor-pointer"
                                        title="Move Step Up"
                                      >
                                        ↑
                                      </button>
                                    )}
                                    {sIdx < (selectedElementAny.formSteps?.length || 0) - 1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const steps = [...(selectedElementAny.formSteps || [])];
                                          const temp = steps[sIdx];
                                          steps[sIdx] = steps[sIdx + 1];
                                          steps[sIdx + 1] = temp;
                                          updateSelectedProp("formSteps", steps);
                                        }}
                                        className="text-[10px] font-bold text-slate-500 hover:text-slate-800 px-1 cursor-pointer"
                                        title="Move Step Down"
                                      >
                                        ↓
                                      </button>
                                    )}
                                    {(selectedElementAny.formSteps?.length || 0) > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = (selectedElementAny.formSteps || []).filter((s: any) => s.id !== step.id);
                                          updateSelectedProp("formSteps", updated);
                                        }}
                                        className="text-[10px] font-bold text-red-500 hover:text-red-700 px-1 cursor-pointer"
                                        title="Delete Step"
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Spam Protection (F-277) */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Spam Protection
                          </span>
                          <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                            <div>
                              <span className="font-semibold text-slate-800">Honeypot Anti-Spam Trap</span>
                              <p className="text-[10px] text-slate-500 mt-0.5">Injects an invisible trap input field that silently flags bot submissions.</p>
                            </div>
                            <input
                              type="checkbox"
                              checked={selectedElementAny.formEnableHoneypot !== false}
                              onChange={(e) => updateSelectedProp("formEnableHoneypot", e.target.checked)}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                          </label>
                        </div>

                        {/* Actions After Submit (F-274, F-276, F-278, F-280, F-281) */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Actions After Submit
                          </span>

                          {/* Save to Database */}
                          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedElementAny.formActions?.saveToDb !== false}
                              onChange={(e) =>
                                updateSelectedProp("formActions", {
                                  ...(selectedElementAny.formActions || {}),
                                  saveToDb: e.target.checked,
                                })
                              }
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="font-semibold text-slate-800">Save to Database (Leads Viewer)</span>
                          </label>

                          {/* Send Notification Email */}
                          <div className="space-y-1.5 pt-1.5 border-t border-slate-200/80">
                            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!selectedElementAny.formActions?.sendEmail}
                                onChange={(e) =>
                                  updateSelectedProp("formActions", {
                                    ...(selectedElementAny.formActions || {}),
                                    sendEmail: e.target.checked,
                                  })
                                }
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="font-semibold text-slate-800">Send Notification Email</span>
                            </label>
                            {selectedElementAny.formActions?.sendEmail && (
                              <div className="space-y-2 pl-6 pt-1">
                                <div>
                                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                    Recipient Email (toEmail)
                                  </label>
                                  <input
                                    type="email"
                                    value={selectedElementAny.formActions?.toEmail || ""}
                                    onChange={(e) =>
                                      updateSelectedProp("formActions", {
                                        ...(selectedElementAny.formActions || {}),
                                        toEmail: e.target.value,
                                      })
                                    }
                                    placeholder="admin@example.com"
                                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                    Email Subject
                                  </label>
                                  <input
                                    type="text"
                                    value={selectedElementAny.formActions?.emailSubject || ""}
                                    onChange={(e) =>
                                      updateSelectedProp("formActions", {
                                        ...(selectedElementAny.formActions || {}),
                                        emailSubject: e.target.value,
                                      })
                                    }
                                    placeholder="New Lead from Website Form"
                                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* External Webhook */}
                          <div className="space-y-1.5 pt-1.5 border-t border-slate-200/80">
                            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!selectedElementAny.formActions?.webhook}
                                onChange={(e) =>
                                  updateSelectedProp("formActions", {
                                    ...(selectedElementAny.formActions || {}),
                                    webhook: e.target.checked,
                                  })
                                }
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="font-semibold text-slate-800">External Webhook</span>
                            </label>
                            {selectedElementAny.formActions?.webhook && (
                              <div className="pl-6 pt-1">
                                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                  Webhook URL
                                </label>
                                <input
                                  type="url"
                                  value={selectedElementAny.formActions?.webhookUrl || ""}
                                  onChange={(e) =>
                                    updateSelectedProp("formActions", {
                                      ...(selectedElementAny.formActions || {}),
                                      webhookUrl: e.target.value,
                                    })
                                  }
                                  placeholder="https://hooks.zapier.com/..."
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                                />
                              </div>
                            )}
                          </div>

                          {/* Redirect URL */}
                          <div className="space-y-1.5 pt-1.5 border-t border-slate-200/80">
                            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!selectedElementAny.formActions?.redirect || !!selectedElementAny.formRedirectUrl}
                                onChange={(e) => {
                                  const enabled = e.target.checked;
                                  updateSelectedProp("formActions", {
                                    ...(selectedElementAny.formActions || {}),
                                    redirect: enabled,
                                  });
                                  if (!enabled) {
                                    updateSelectedProp("formRedirectUrl", "");
                                  }
                                }}
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="font-semibold text-slate-800">Redirect URL (Thank You Page)</span>
                            </label>
                            {(selectedElementAny.formActions?.redirect || selectedElementAny.formRedirectUrl) && (
                              <div className="pl-6 pt-1">
                                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                  Destination URL
                                </label>
                                <input
                                  type="text"
                                  value={selectedElementAny.formActions?.redirectUrl || selectedElementAny.formRedirectUrl || ""}
                                  onChange={(e) => {
                                    updateSelectedProp("formRedirectUrl", e.target.value);
                                    updateSelectedProp("formActions", {
                                      ...(selectedElementAny.formActions || {}),
                                      redirect: true,
                                      redirectUrl: e.target.value,
                                    });
                                  }}
                                  placeholder="/thank-you or https://..."
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Form Fields Manager */}
                        <div className="pt-2 border-t border-slate-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700">Form Fields ({selectedElementAny.formFields?.length || 0})</span>
                            <div className="flex items-center gap-1">
                              <select
                                defaultValue="text"
                                className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 outline-none"
                                onChange={(e) => {
                                  const newType = e.target.value as FormFieldType;
                                  const defaultLabels: Record<FormFieldType, string> = {
                                    text: "New Text Field",
                                    email: "Email Address",
                                    number: "Age / Quantity",
                                    tel: "Phone Number",
                                    textarea: "Additional Comments",
                                    select: "Choose Option",
                                    checkbox: "I agree to the terms",
                                    radio: "Select Preference",
                                    date: "Select Date",
                                    file: "Attachment / File",
                                  };
                                  const newField: FormFieldItem = {
                                    id: generateId(),
                                    type: newType,
                                    label: defaultLabels[newType] || "New Field",
                                    placeholder: newType === "checkbox" ? "" : "Enter value...",
                                    required: false,
                                    width: newType === "textarea" ? "full" : "half",
                                    options: newType === "select" || newType === "radio" ? ["Option 1", "Option 2", "Option 3"] : undefined,
                                  };
                                  updateSelectedProp("formFields", [...(selectedElementAny.formFields || []), newField]);
                                  e.target.value = "text";
                                }}
                              >
                                <option value="text">+ Text Field</option>
                                <option value="email">+ Email</option>
                                <option value="number">+ Number</option>
                                <option value="tel">+ Telephone</option>
                                <option value="date">+ Date Picker</option>
                                <option value="file">+ File Upload</option>
                                <option value="textarea">+ Textarea</option>
                                <option value="select">+ Dropdown Select</option>
                                <option value="checkbox">+ Checkbox</option>
                                <option value="radio">+ Radio Group</option>
                              </select>
                            </div>
                          </div>

                          <div className="space-y-3">
                            {(selectedElementAny.formFields || []).map((field, idx) => (
                              <div
                                key={field.id}
                                className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs space-y-2"
                              >
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                  <span className="text-xs font-bold text-slate-800 capitalize">
                                    #{idx + 1}: {field.label} ({field.type})
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    {idx > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const items = [...(selectedElementAny.formFields || [])];
                                          const temp = items[idx];
                                          items[idx] = items[idx - 1];
                                          items[idx - 1] = temp;
                                          updateSelectedProp("formFields", items);
                                        }}
                                        className="text-[10px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                                        title="Move Up"
                                      >
                                        ↑
                                      </button>
                                    )}
                                    {idx < (selectedElementAny.formFields?.length || 0) - 1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const items = [...(selectedElementAny.formFields || [])];
                                          const temp = items[idx];
                                          items[idx] = items[idx + 1];
                                          items[idx + 1] = temp;
                                          updateSelectedProp("formFields", items);
                                        }}
                                        className="text-[10px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                                        title="Move Down"
                                      >
                                        ↓
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = (selectedElementAny.formFields || []).filter((f) => f.id !== field.id);
                                        updateSelectedProp("formFields", updated);
                                      }}
                                      className="text-[10px] font-bold text-red-500 hover:text-red-700 cursor-pointer"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                      Label
                                    </label>
                                    <input
                                      type="text"
                                      value={field.label}
                                      onChange={(e) => {
                                        const updated = (selectedElementAny.formFields || []).map((f) =>
                                          f.id === field.id ? { ...f, label: e.target.value } : f
                                        );
                                        updateSelectedProp("formFields", updated);
                                      }}
                                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                      Field Type
                                    </label>
                                    <select
                                      value={field.type}
                                      onChange={(e) => {
                                        const newType = e.target.value as FormFieldType;
                                        const updated = (selectedElementAny.formFields || []).map((f) =>
                                          f.id === field.id
                                            ? {
                                                ...f,
                                                type: newType,
                                                options: newType === "select" || newType === "radio" ? (f.options || ["Option 1", "Option 2"]) : f.options,
                                              }
                                            : f
                                        );
                                        updateSelectedProp("formFields", updated);
                                      }}
                                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                                    >
                                      <option value="text">Text</option>
                                      <option value="email">Email</option>
                                      <option value="number">Number</option>
                                      <option value="tel">Telephone</option>
                                      <option value="date">Date Picker</option>
                                      <option value="file">File Upload</option>
                                      <option value="textarea">Textarea</option>
                                      <option value="select">Select Dropdown</option>
                                      <option value="checkbox">Checkbox</option>
                                      <option value="radio">Radio Group</option>
                                    </select>
                                  </div>
                                </div>

                                {selectedElementAny.formMode === "step-by-step" && (
                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                      Assign to Step
                                    </label>
                                    <select
                                      value={field.stepId || (selectedElementAny.formSteps?.[0]?.id || "")}
                                      onChange={(e) => {
                                        const updated = (selectedElementAny.formFields || []).map((f) =>
                                          f.id === field.id ? { ...f, stepId: e.target.value } : f
                                        );
                                        updateSelectedProp("formFields", updated);
                                      }}
                                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                                    >
                                      {(selectedElementAny.formSteps || []).map((st: any) => (
                                        <option key={st.id} value={st.id}>
                                          {st.title}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}

                                {field.type !== "checkbox" && field.type !== "file" && (
                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                      Placeholder Text
                                    </label>
                                    <input
                                      type="text"
                                      value={field.placeholder || ""}
                                      onChange={(e) => {
                                        const updated = (selectedElementAny.formFields || []).map((f) =>
                                          f.id === field.id ? { ...f, placeholder: e.target.value } : f
                                        );
                                        updateSelectedProp("formFields", updated);
                                      }}
                                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                                    />
                                  </div>
                                )}

                                {(field.type === "select" || field.type === "radio") && (
                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                      Options (Comma Separated)
                                    </label>
                                    <input
                                      type="text"
                                      value={(field.options || []).join(", ")}
                                      onChange={(e) => {
                                        const opts = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                                        const updated = (selectedElementAny.formFields || []).map((f) =>
                                          f.id === field.id ? { ...f, options: opts } : f
                                        );
                                        updateSelectedProp("formFields", updated);
                                      }}
                                      placeholder="Option 1, Option 2, Option 3"
                                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                                    />
                                  </div>
                                )}

                                <div className="flex items-center justify-between pt-1">
                                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={!!field.required}
                                      onChange={(e) => {
                                        const updated = (selectedElementAny.formFields || []).map((f) =>
                                          f.id === field.id ? { ...f, required: e.target.checked } : f
                                        );
                                        updateSelectedProp("formFields", updated);
                                      }}
                                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span>Required Field</span>
                                  </label>

                                  <div className="flex items-center gap-1 text-xs">
                                    <span className="text-[10px] text-slate-500">Span:</span>
                                    <select
                                      value={field.width || "half"}
                                      onChange={(e) => {
                                        const w = e.target.value as "full" | "half";
                                        const updated = (selectedElementAny.formFields || []).map((f) =>
                                          f.id === field.id ? { ...f, width: w } : f
                                        );
                                        updateSelectedProp("formFields", updated);
                                      }}
                                      className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-[11px] font-medium text-slate-700 outline-none"
                                    >
                                      <option value="half">50% (Half Width)</option>
                                      <option value="full">100% (Full Width)</option>
                                    </select>
                                  </div>
                                </div>

                                {/* Conditional Logic (X-788) */}
                                <div className="pt-2 border-t border-slate-100">
                                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={!!field.conditionalLogic}
                                      onChange={(e) => {
                                        const otherFields = (selectedElementAny.formFields || []).filter((f) => f.id !== field.id);
                                        const updated = (selectedElementAny.formFields || []).map((f) =>
                                          f.id === field.id
                                            ? {
                                                ...f,
                                                conditionalLogic: e.target.checked
                                                  ? {
                                                      action: "show" as const,
                                                      targetFieldId: otherFields[0]?.id || "",
                                                      operator: "equals" as const,
                                                      value: "",
                                                    }
                                                  : undefined,
                                              }
                                            : f
                                        );
                                        updateSelectedProp("formFields", updated);
                                      }}
                                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span>Conditional Visibility</span>
                                  </label>
                                  {field.conditionalLogic && (
                                    <div className="mt-1.5 space-y-1.5 rounded-lg bg-slate-50 p-2 border border-slate-200 text-xs">
                                      <div className="grid grid-cols-2 gap-1.5">
                                        <div>
                                          <label className="block text-[9px] text-slate-500">Action</label>
                                          <select
                                            value={field.conditionalLogic.action}
                                            onChange={(e) => {
                                              const updated = (selectedElementAny.formFields || []).map((f) =>
                                                f.id === field.id
                                                  ? { ...f, conditionalLogic: { ...f.conditionalLogic!, action: e.target.value as "show" | "hide" } }
                                                  : f
                                              );
                                              updateSelectedProp("formFields", updated);
                                            }}
                                            className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px]"
                                          >
                                            <option value="show">Show when</option>
                                            <option value="hide">Hide when</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label className="block text-[9px] text-slate-500">Target Field</label>
                                          <select
                                            value={field.conditionalLogic.targetFieldId}
                                            onChange={(e) => {
                                              const updated = (selectedElementAny.formFields || []).map((f) =>
                                                f.id === field.id
                                                  ? { ...f, conditionalLogic: { ...f.conditionalLogic!, targetFieldId: e.target.value } }
                                                  : f
                                              );
                                              updateSelectedProp("formFields", updated);
                                            }}
                                            className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px]"
                                          >
                                            {(selectedElementAny.formFields || [])
                                              .filter((f) => f.id !== field.id)
                                              .map((of) => (
                                                <option key={of.id} value={of.id}>
                                                  {of.label}
                                                </option>
                                              ))}
                                          </select>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-1.5">
                                        <div>
                                          <label className="block text-[9px] text-slate-500">Operator</label>
                                          <select
                                            value={field.conditionalLogic.operator}
                                            onChange={(e) => {
                                              const updated = (selectedElementAny.formFields || []).map((f) =>
                                                f.id === field.id
                                                  ? { ...f, conditionalLogic: { ...f.conditionalLogic!, operator: e.target.value as any } }
                                                  : f
                                              );
                                              updateSelectedProp("formFields", updated);
                                            }}
                                            className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px]"
                                          >
                                            <option value="equals">Equals</option>
                                            <option value="not_equals">Does Not Equal</option>
                                            <option value="contains">Contains</option>
                                            <option value="not_empty">Is Not Empty</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label className="block text-[9px] text-slate-500">Match Value</label>
                                          <input
                                            type="text"
                                            value={field.conditionalLogic.value}
                                            onChange={(e) => {
                                              const updated = (selectedElementAny.formFields || []).map((f) =>
                                                f.id === field.id
                                                  ? { ...f, conditionalLogic: { ...f.conditionalLogic!, value: e.target.value } }
                                                  : f
                                              );
                                              updateSelectedProp("formFields", updated);
                                            }}
                                            placeholder="Value to match..."
                                            className="w-full rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px]"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Login Specific Properties (F-179) */}
                    {selectedElementAny.type === "login" && (
                      <div className="space-y-4">
                        {/* Header */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Login Header
                          </span>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Title
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.loginTitle !== undefined ? selectedElementAny.loginTitle : "Welcome Back"}
                              onChange={(e) => updateSelectedProp("loginTitle", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Subtitle
                            </label>
                            <textarea
                              rows={2}
                              value={selectedElementAny.loginSubtitle !== undefined ? selectedElementAny.loginSubtitle : "Sign in to your account to access your workspace."}
                              onChange={(e) => updateSelectedProp("loginSubtitle", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>

                        {/* Field Labels */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Field Labels & Placeholders
                          </span>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Email Label
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.loginEmailLabel || "Email Address"}
                                onChange={(e) => updateSelectedProp("loginEmailLabel", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Email Placeholder
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.loginEmailPlaceholder || "name@example.com"}
                                onChange={(e) => updateSelectedProp("loginEmailPlaceholder", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Password Label
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.loginPasswordLabel || "Password"}
                                onChange={(e) => updateSelectedProp("loginPasswordLabel", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Password Placeholder
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.loginPasswordPlaceholder || "••••••••"}
                                onChange={(e) => updateSelectedProp("loginPasswordPlaceholder", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Features & Options */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Options & Links
                          </span>
                          <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                            <span className="font-bold">Remember Me Option</span>
                            <input
                              type="checkbox"
                              checked={selectedElementAny.loginShowRememberMe !== false}
                              onChange={(e) => updateSelectedProp("loginShowRememberMe", e.target.checked)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                          </label>

                          <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                            <span className="font-bold">Forgot Password Link</span>
                            <input
                              type="checkbox"
                              checked={selectedElementAny.loginShowForgotPassword !== false}
                              onChange={(e) => updateSelectedProp("loginShowForgotPassword", e.target.checked)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                          </label>

                          {selectedElementAny.loginShowForgotPassword !== false && (
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                  Link Text
                                </label>
                                <input
                                  type="text"
                                  value={selectedElementAny.loginForgotPasswordText || "Forgot password?"}
                                  onChange={(e) => updateSelectedProp("loginForgotPasswordText", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                  Target URL
                                </label>
                                <input
                                  type="text"
                                  value={selectedElementAny.loginForgotPasswordUrl || "#"}
                                  onChange={(e) => updateSelectedProp("loginForgotPasswordUrl", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                                />
                              </div>
                            </div>
                          )}

                          <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer pt-1">
                            <span className="font-bold">Show Social Login Options</span>
                            <input
                              type="checkbox"
                              checked={selectedElementAny.loginShowSocialButtons !== false}
                              onChange={(e) => updateSelectedProp("loginShowSocialButtons", e.target.checked)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                          </label>
                        </div>

                        {/* Button Styling */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Button & Theme
                          </span>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Button Text
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.loginButtonText || "Sign In"}
                              onChange={(e) => updateSelectedProp("loginButtonText", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Button Background
                              </label>
                              <div className="flex items-center gap-1">
                                <input
                                  type="color"
                                  value={selectedElementAny.loginButtonBg || "#2563eb"}
                                  onChange={(e) => updateSelectedProp("loginButtonBg", e.target.value)}
                                  className="h-6 w-7 cursor-pointer rounded border border-slate-200 bg-transparent p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.loginButtonBg || "#2563eb"}
                                  onChange={(e) => updateSelectedProp("loginButtonBg", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Button Text Color
                              </label>
                              <div className="flex items-center gap-1">
                                <input
                                  type="color"
                                  value={selectedElementAny.loginButtonColor || "#ffffff"}
                                  onChange={(e) => updateSelectedProp("loginButtonColor", e.target.value)}
                                  className="h-6 w-7 cursor-pointer rounded border border-slate-200 bg-transparent p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.loginButtonColor || "#ffffff"}
                                  onChange={(e) => updateSelectedProp("loginButtonColor", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Nav Menu Specific Properties (F-180) */}
                    {selectedElementAny.type === "nav-menu" && (
                      <div className="space-y-4">
                        {/* Layout & Alignment */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Menu Layout & Alignment
                          </span>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Orientation
                              </label>
                              <select
                                value={selectedElementAny.navLayout || "horizontal"}
                                onChange={(e) => updateSelectedProp("navLayout", e.target.value as "horizontal" | "vertical")}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                              >
                                <option value="horizontal">Horizontal Row</option>
                                <option value="vertical">Vertical Column</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Alignment
                              </label>
                              <select
                                value={selectedElementAny.navAlignment || "left"}
                                onChange={(e) => updateSelectedProp("navAlignment", e.target.value as "left" | "center" | "right" | "between")}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                              >
                                <option value="left">Left Align</option>
                                <option value="center">Center Align</option>
                                <option value="right">Right Align</option>
                                <option value="between">Space Between</option>
                              </select>
                            </div>
                          </div>

                          {/* Gap Spacing Slider */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] font-semibold text-slate-500">
                                Item Gap Spacing
                              </label>
                              <span className="text-[10px] font-mono text-slate-500">
                                {selectedElementAny.navGap ?? 24}px
                              </span>
                            </div>
                            <input
                              type="range"
                              min={8}
                              max={64}
                              step={4}
                              value={selectedElementAny.navGap ?? 24}
                              onChange={(e) => updateSelectedProp("navGap", Number(e.target.value))}
                              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                            />
                          </div>
                        </div>

                        {/* Typography & Item Styling */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Typography & Colors
                          </span>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Font Size
                              </label>
                              <select
                                value={selectedElementAny.navFontSize || "14px"}
                                onChange={(e) => updateSelectedProp("navFontSize", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                              >
                                <option value="12px">12px (Small)</option>
                                <option value="14px">14px (Medium)</option>
                                <option value="16px">16px (Large)</option>
                                <option value="18px">18px (XL)</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Font Weight
                              </label>
                              <select
                                value={selectedElementAny.navFontWeight || "600"}
                                onChange={(e) => updateSelectedProp("navFontWeight", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                              >
                                <option value="400">Normal (400)</option>
                                <option value="500">Medium (500)</option>
                                <option value="600">SemiBold (600)</option>
                                <option value="700">Bold (700)</option>
                              </select>
                            </div>
                          </div>

                          {/* States Text Colors */}
                          <span className="block text-[10px] font-bold text-slate-600 mt-2">
                            Text Colors (Normal / Hover / Active)
                          </span>
                          <div className="grid grid-cols-3 gap-1.5">
                            <div>
                              <label className="block text-[9px] text-slate-400 mb-0.5">Normal</label>
                              <input
                                type="color"
                                value={selectedElementAny.navItemColor || "#334155"}
                                onChange={(e) => updateSelectedProp("navItemColor", e.target.value)}
                                className="h-6 w-full cursor-pointer rounded border border-slate-200 bg-transparent p-0.5"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] text-slate-400 mb-0.5">Hover</label>
                              <input
                                type="color"
                                value={selectedElementAny.navItemHoverColor || "#2563eb"}
                                onChange={(e) => updateSelectedProp("navItemHoverColor", e.target.value)}
                                className="h-6 w-full cursor-pointer rounded border border-slate-200 bg-transparent p-0.5"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] text-slate-400 mb-0.5">Active</label>
                              <input
                                type="color"
                                value={selectedElementAny.navItemActiveColor || "#2563eb"}
                                onChange={(e) => updateSelectedProp("navItemActiveColor", e.target.value)}
                                className="h-6 w-full cursor-pointer rounded border border-slate-200 bg-transparent p-0.5"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Menu Items Manager */}
                        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="block text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                              Menu Items ({selectedElementAny.navMenuItems?.length || 5})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const current = selectedElementAny.navMenuItems || [
                                  { id: "1", label: "Home", url: "/", isActive: true },
                                  { id: "2", label: "About", url: "/about" },
                                  { id: "3", label: "Services", url: "/services" },
                                  { id: "4", label: "Pricing", url: "/pricing" },
                                  { id: "5", label: "Contact", url: "/contact" },
                                ];
                                const newItem: NavMenuItem = {
                                  id: `nav_${Date.now()}`,
                                  label: `New Link ${current.length + 1}`,
                                  url: "#",
                                  linkType: "url",
                                  dropdownEnabled: true,
                                  trigger: "hover",
                                };
                                updateSelectedProp("navMenuItems", [...current, newItem]);
                              }}
                              className="rounded bg-amber-500 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-amber-600 transition cursor-pointer shadow-xs"
                            >
                              + Add Item
                            </button>
                          </div>

                          <div className="space-y-3">
                            {(selectedElementAny.navMenuItems || [
                              { id: "1", label: "Home", url: "/", isActive: true },
                              { id: "2", label: "About", url: "/about" },
                              {
                                id: "3",
                                label: "Services",
                                url: "/services",
                                dropdownEnabled: true,
                                submenu: [
                                  { id: "s1", label: "Web Design", url: "/services/web-design", description: "Responsive web design" },
                                  { id: "s2", label: "App Development", url: "/services/app-dev", description: "Native & cross-platform apps" },
                                ],
                              },
                              { id: "4", label: "Pricing", url: "/pricing" },
                              { id: "5", label: "Contact", url: "/contact" },
                            ]).map((item, index, arr) => (
                              <div
                                key={item.id}
                                className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs space-y-2.5"
                              >
                                <div className="flex items-center justify-between gap-1 pb-1 border-b border-slate-100">
                                  <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                                    <span className="text-amber-500">#{index + 1}</span>
                                    {item.icon && <span>{item.icon}</span>}
                                    <span>{item.label}</span>
                                  </span>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      disabled={index === 0}
                                      onClick={() => {
                                        const copy = [...arr];
                                        const temp = copy[index - 1];
                                        copy[index - 1] = copy[index];
                                        copy[index] = temp;
                                        updateSelectedProp("navMenuItems", copy);
                                      }}
                                      className="h-5 w-5 rounded border border-slate-200 text-[10px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                                      title="Move Up"
                                    >
                                      ↑
                                    </button>
                                    <button
                                      type="button"
                                      disabled={index === arr.length - 1}
                                      onClick={() => {
                                        const copy = [...arr];
                                        const temp = copy[index + 1];
                                        copy[index + 1] = copy[index];
                                        copy[index] = temp;
                                        updateSelectedProp("navMenuItems", copy);
                                      }}
                                      className="h-5 w-5 rounded border border-slate-200 text-[10px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                                      title="Move Down"
                                    >
                                      ↓
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const dupItem: NavMenuItem = {
                                          ...item,
                                          id: `nav_${Date.now()}`,
                                          label: `${item.label} (Copy)`,
                                        };
                                        const copy = [...arr];
                                        copy.splice(index + 1, 0, dupItem);
                                        updateSelectedProp("navMenuItems", copy);
                                      }}
                                      className="h-5 w-5 rounded border border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                                      title="Duplicate Item"
                                    >
                                      ⧉
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const filtered = arr.filter((i) => i.id !== item.id);
                                        updateSelectedProp("navMenuItems", filtered);
                                      }}
                                      className="h-5 w-5 rounded border border-red-200 bg-red-50 text-[10px] font-bold text-red-600 hover:bg-red-100 cursor-pointer"
                                      title="Delete Item"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>

                                {/* Label & Link Type */}
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[9px] font-semibold text-slate-500 mb-0.5">Label</label>
                                    <input
                                      type="text"
                                      value={item.label}
                                      onChange={(e) => {
                                        const updated = arr.map((i) =>
                                          i.id === item.id ? { ...i, label: e.target.value } : i
                                        );
                                        updateSelectedProp("navMenuItems", updated);
                                      }}
                                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[9px] font-semibold text-slate-500 mb-0.5">Link Type</label>
                                    <select
                                      value={item.linkType || "url"}
                                      onChange={(e) => {
                                        const updated = arr.map((i) =>
                                          i.id === item.id ? { ...i, linkType: e.target.value as any } : i
                                        );
                                        updateSelectedProp("navMenuItems", updated);
                                      }}
                                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                                    >
                                      <option value="url">External URL</option>
                                      <option value="page">Website Page</option>
                                      <option value="anchor">Anchor (#id)</option>
                                    </select>
                                  </div>
                                </div>

                                {/* URL Target / Page Picker */}
                                <div>
                                  <label className="block text-[9px] font-semibold text-slate-500 mb-0.5">
                                    {item.linkType === "page" ? "Select Page" : "URL Destination"}
                                  </label>
                                  {item.linkType === "page" && pages.length > 0 ? (
                                    <select
                                      value={item.url}
                                      onChange={(e) => {
                                        const updated = arr.map((i) =>
                                          i.id === item.id ? { ...i, url: e.target.value } : i
                                        );
                                        updateSelectedProp("navMenuItems", updated);
                                      }}
                                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                                    >
                                      {pages.map((p) => (
                                        <option key={p.id} value={p.isHome ? "/" : `/${p.slug}`}>
                                          {p.name} ({p.isHome ? "/" : `/${p.slug}`})
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      type="text"
                                      value={item.url}
                                      onChange={(e) => {
                                        const updated = arr.map((i) =>
                                          i.id === item.id ? { ...i, url: e.target.value } : i
                                        );
                                        updateSelectedProp("navMenuItems", updated);
                                      }}
                                      placeholder={item.linkType === "anchor" ? "#section-id" : "https://example.com"}
                                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-mono text-slate-800 outline-none focus:border-amber-500"
                                    />
                                  )}
                                </div>

                                {/* Target & Icon */}
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <label className="block text-[9px] font-semibold text-slate-500 mb-0.5">Target</label>
                                    <select
                                      value={item.target || "_self"}
                                      onChange={(e) => {
                                        const updated = arr.map((i) =>
                                          i.id === item.id ? { ...i, target: e.target.value as any } : i
                                        );
                                        updateSelectedProp("navMenuItems", updated);
                                      }}
                                      className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs font-medium text-slate-800 outline-none"
                                    >
                                      <option value="_self">Same Tab</option>
                                      <option value="_blank">New Tab</option>
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-[9px] font-semibold text-slate-500 mb-0.5">Icon / Emoji</label>
                                    <input
                                      type="text"
                                      value={item.icon || ""}
                                      onChange={(e) => {
                                        const updated = arr.map((i) =>
                                          i.id === item.id ? { ...i, icon: e.target.value } : i
                                        );
                                        updateSelectedProp("navMenuItems", updated);
                                      }}
                                      placeholder="e.g. 🏠"
                                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[9px] font-semibold text-slate-500 mb-0.5">Icon Pos</label>
                                    <select
                                      value={item.iconPosition || "left"}
                                      onChange={(e) => {
                                        const updated = arr.map((i) =>
                                          i.id === item.id ? { ...i, iconPosition: e.target.value as any } : i
                                        );
                                        updateSelectedProp("navMenuItems", updated);
                                      }}
                                      className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs font-medium text-slate-800 outline-none"
                                    >
                                      <option value="left">Left</option>
                                      <option value="right">Right</option>
                                    </select>
                                  </div>
                                </div>

                                {/* Toggles: Active, Disabled, Dropdown Enabled */}
                                <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2 flex-wrap">
                                  <label className="flex items-center gap-1.5 text-[10px] text-slate-700 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={!!item.isActive}
                                      onChange={(e) => {
                                        const updated = arr.map((i) =>
                                          i.id === item.id ? { ...i, isActive: e.target.checked } : { ...i, isActive: false }
                                        );
                                        updateSelectedProp("navMenuItems", updated);
                                      }}
                                      className="rounded border-slate-300 text-amber-500 cursor-pointer"
                                    />
                                    <span>Active</span>
                                  </label>

                                  <label className="flex items-center gap-1.5 text-[10px] text-slate-700 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={!!item.isDisabled}
                                      onChange={(e) => {
                                        const updated = arr.map((i) =>
                                          i.id === item.id ? { ...i, isDisabled: e.target.checked } : i
                                        );
                                        updateSelectedProp("navMenuItems", updated);
                                      }}
                                      className="rounded border-slate-300 text-amber-500 cursor-pointer"
                                    />
                                    <span>Disabled</span>
                                  </label>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const sub = item.submenu || [];
                                      const newSub: NavSubmenuItem = {
                                        id: `sub_${Date.now()}`,
                                        label: `Submenu ${sub.length + 1}`,
                                        url: "#",
                                      };
                                      const updated = arr.map((i) =>
                                        i.id === item.id ? { ...i, submenu: [...sub, newSub], dropdownEnabled: true } : i
                                      );
                                      updateSelectedProp("navMenuItems", updated);
                                    }}
                                    className="text-[10px] font-bold text-amber-600 hover:underline cursor-pointer ml-auto"
                                  >
                                    + Add Submenu
                                  </button>
                                </div>

                                {/* Submenu List */}
                                {item.submenu && item.submenu.length > 0 && (
                                  <div className="mt-2 pl-3 border-l-2 border-amber-300 space-y-2 bg-amber-50/30 p-2 rounded-r-xl">
                                    <span className="block text-[9px] font-bold text-amber-900 uppercase tracking-wider">
                                      Submenu Items ({item.submenu.length})
                                    </span>
                                    {item.submenu.map((sub, sIdx) => (
                                      <div key={sub.id} className="rounded-lg border border-slate-200 bg-white p-2 space-y-1.5">
                                        <div className="flex items-center justify-between gap-1">
                                          <span className="text-[10px] font-bold text-slate-700">Sub #{sIdx + 1}</span>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const newSub = item.submenu!.filter((s) => s.id !== sub.id);
                                              const updated = arr.map((i) =>
                                                i.id === item.id ? { ...i, submenu: newSub } : i
                                              );
                                              updateSelectedProp("navMenuItems", updated);
                                            }}
                                            className="h-4 w-4 shrink-0 rounded border border-red-200 bg-red-50 text-[9px] font-bold text-red-600 hover:bg-red-100 cursor-pointer flex items-center justify-center"
                                            title="Delete Submenu Item"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-1">
                                          <input
                                            type="text"
                                            value={sub.label}
                                            onChange={(e) => {
                                              const newSub = item.submenu!.map((s) =>
                                                s.id === sub.id ? { ...s, label: e.target.value } : s
                                              );
                                              const updated = arr.map((i) =>
                                                i.id === item.id ? { ...i, submenu: newSub } : i
                                              );
                                              updateSelectedProp("navMenuItems", updated);
                                            }}
                                            placeholder="Submenu Label"
                                            className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-800 outline-none"
                                          />
                                          <input
                                            type="text"
                                            value={sub.url}
                                            onChange={(e) => {
                                              const newSub = item.submenu!.map((s) =>
                                                s.id === sub.id ? { ...s, url: e.target.value } : s
                                              );
                                              const updated = arr.map((i) =>
                                                i.id === item.id ? { ...i, submenu: newSub } : i
                                              );
                                              updateSelectedProp("navMenuItems", updated);
                                            }}
                                            placeholder="URL"
                                            className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-mono text-slate-800 outline-none"
                                          />
                                        </div>
                                        <div className="grid grid-cols-2 gap-1">
                                          <input
                                            type="text"
                                            value={sub.description || ""}
                                            onChange={(e) => {
                                              const newSub = item.submenu!.map((s) =>
                                                s.id === sub.id ? { ...s, description: e.target.value } : s
                                              );
                                              const updated = arr.map((i) =>
                                                i.id === item.id ? { ...i, submenu: newSub } : i
                                              );
                                              updateSelectedProp("navMenuItems", updated);
                                            }}
                                            placeholder="Description (optional)"
                                            className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-700 outline-none"
                                          />
                                          <input
                                            type="text"
                                            value={sub.badge || ""}
                                            onChange={(e) => {
                                              const newSub = item.submenu!.map((s) =>
                                                s.id === sub.id ? { ...s, badge: e.target.value } : s
                                              );
                                              const updated = arr.map((i) =>
                                                i.id === item.id ? { ...i, submenu: newSub } : i
                                              );
                                              updateSelectedProp("navMenuItems", updated);
                                            }}
                                            placeholder="Badge (e.g. New)"
                                            className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-700 outline-none"
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Animated Headline Specific Properties (F-181) */}
                    {selectedElementAny.type === "animated-headline" && (
                      <div className="space-y-4">
                        {/* HTML Tag & Text Parts */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Headline Text Content
                          </span>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              HTML Tag
                            </label>
                            <select
                              value={selectedElementAny.headlineTag || "h2"}
                              onChange={(e) => updateSelectedProp("headlineTag", e.target.value as any)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-violet-500"
                            >
                              <option value="h1">H1 (Main Title)</option>
                              <option value="h2">H2 (Section Header)</option>
                              <option value="h3">H3 (Sub Header)</option>
                              <option value="h4">H4 (Small Header)</option>
                              <option value="p">P (Paragraph)</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Prefix Text (Before Animation)
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.headlinePrefix ?? "Build Websites That Are"}
                              onChange={(e) => updateSelectedProp("headlinePrefix", e.target.value)}
                              placeholder="Prefix Text..."
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-violet-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Suffix Text (After Animation)
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.headlineSuffix ?? "With ForgeStudio"}
                              onChange={(e) => updateSelectedProp("headlineSuffix", e.target.value)}
                              placeholder="Suffix Text..."
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-violet-500"
                            />
                          </div>
                        </div>

                        {/* Animated Phrases List */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                              Animated Phrases ({(selectedElementAny.headlineAnimatedTexts || []).length})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const current = selectedElementAny.headlineAnimatedTexts || ["Stunning", "Blazing Fast", "Ultra Flexible", "Powerful"];
                                updateSelectedProp("headlineAnimatedTexts", [...current, `Phrase ${current.length + 1}`]);
                              }}
                              className="rounded bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-violet-700 transition cursor-pointer"
                            >
                              + Add Word
                            </button>
                          </div>

                          <div className="space-y-2">
                            {(selectedElementAny.headlineAnimatedTexts || ["Stunning", "Blazing Fast", "Ultra Flexible", "Powerful"]).map((phrase, idx) => (
                              <div key={idx} className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={phrase}
                                  onChange={(e) => {
                                    const copy = [...(selectedElementAny.headlineAnimatedTexts || ["Stunning", "Blazing Fast", "Ultra Flexible", "Powerful"])];
                                    copy[idx] = e.target.value;
                                    updateSelectedProp("headlineAnimatedTexts", copy);
                                  }}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-violet-700 outline-none focus:border-violet-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const copy = (selectedElementAny.headlineAnimatedTexts || ["Stunning", "Blazing Fast", "Ultra Flexible", "Powerful"]).filter((_, i) => i !== idx);
                                    updateSelectedProp("headlineAnimatedTexts", copy);
                                  }}
                                  className="h-7 w-7 shrink-0 rounded-lg border border-red-200 bg-red-50 text-xs font-bold text-red-600 hover:bg-red-100 cursor-pointer"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Animation Style & Speed */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Animation Settings
                          </span>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Animation Effect
                            </label>
                            <select
                              value={selectedElementAny.headlineAnimationType || "typing"}
                              onChange={(e) => updateSelectedProp("headlineAnimationType", e.target.value as AnimatedHeadlineStyle)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-violet-500"
                            >
                              <option value="typing">Typewriter Effect (| Cursor)</option>
                              <option value="fade">Smooth Fade In/Out</option>
                              <option value="slide-up">Slide Up & Fade</option>
                              <option value="zoom">Zoom Scale & Fade</option>
                              <option value="flip">3D Flip Rotation</option>
                              <option value="highlight">Brush Highlight Box</option>
                            </select>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] font-semibold text-slate-500">
                                Animation Interval Speed
                              </label>
                              <span className="text-[10px] font-mono text-slate-500">
                                {((selectedElementAny.headlineAnimationSpeed || 2500) / 1000).toFixed(1)}s
                              </span>
                            </div>
                            <input
                              type="range"
                              min={1000}
                              max={5000}
                              step={250}
                              value={selectedElementAny.headlineAnimationSpeed || 2500}
                              onChange={(e) => updateSelectedProp("headlineAnimationSpeed", Number(e.target.value))}
                              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
                            />
                          </div>
                        </div>

                        {/* Highlighted Phrase Colors */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Animated Text Styling
                          </span>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                                Text Color
                              </label>
                              <input
                                type="color"
                                value={selectedElementAny.headlineHighlightColor || "#2563eb"}
                                onChange={(e) => updateSelectedProp("headlineHighlightColor", e.target.value)}
                                className="h-7 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-0.5"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                                Background / Highlight
                              </label>
                              <input
                                type="color"
                                value={selectedElementAny.headlineHighlightBg || "#eff6ff"}
                                onChange={(e) => updateSelectedProp("headlineHighlightBg", e.target.value)}
                                className="h-7 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-0.5"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Price Table Specific Properties (F-182) */}
                    {selectedElementAny.type === "price-table" && (
                      <PriceTableWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Price List Specific Properties (F-183) */}
                    {selectedElementAny.type === "price-list" && (
                      <div className="space-y-4">
                        {/* List Styling & Layout */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            List & Separator Layout
                          </span>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Item Spacing
                              </label>
                              <input
                                type="number"
                                min={8}
                                max={60}
                                value={selectedElementAny.priceListGap ?? 20}
                                onChange={(e) => updateSelectedProp("priceListGap", Number(e.target.value))}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-teal-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Leader Line Style
                              </label>
                              <select
                                value={selectedElementAny.priceListSeparatorStyle || "dotted"}
                                onChange={(e) => updateSelectedProp("priceListSeparatorStyle", e.target.value as any)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-teal-500"
                              >
                                <option value="dotted">Dotted Leader (...) </option>
                                <option value="dashed">Dashed Line (---)</option>
                                <option value="solid">Solid Line (___)</option>
                                <option value="none">None</option>
                              </select>
                            </div>
                          </div>

                          {/* Image settings */}
                          <div className="pt-2 border-t border-slate-200/60 space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-semibold text-slate-700 cursor-pointer">
                                Show Thumbnail Images
                              </label>
                              <input
                                type="checkbox"
                                checked={selectedElementAny.priceListShowImages !== false}
                                onChange={(e) => updateSelectedProp("priceListShowImages", e.target.checked)}
                                className="accent-teal-600 rounded cursor-pointer"
                              />
                            </div>

                            {selectedElementAny.priceListShowImages !== false && (
                              <div>
                                <div className="flex justify-between text-[10px] font-semibold text-slate-500 mb-0.5">
                                  <span>Image Size</span>
                                  <span>{selectedElementAny.priceListImageSize || 48}px</span>
                                </div>
                                <input
                                  type="range"
                                  min={32}
                                  max={96}
                                  value={selectedElementAny.priceListImageSize || 48}
                                  onChange={(e) => updateSelectedProp("priceListImageSize", Number(e.target.value))}
                                  className="w-full accent-teal-600 cursor-pointer"
                                />
                              </div>
                            )}
                          </div>

                          {/* Color settings */}
                          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                                Title Color
                              </label>
                              <input
                                type="color"
                                value={selectedElementAny.priceListTitleColor || "#0f172a"}
                                onChange={(e) => updateSelectedProp("priceListTitleColor", e.target.value)}
                                className="h-7 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-0.5"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                                Price Color
                              </label>
                              <input
                                type="color"
                                value={selectedElementAny.priceListPriceColor || "#2563eb"}
                                onChange={(e) => updateSelectedProp("priceListPriceColor", e.target.value)}
                                className="h-7 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-0.5"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                                Price Pill Bg
                              </label>
                              <input
                                type="color"
                                value={selectedElementAny.priceListPriceBg || "#eff6ff"}
                                onChange={(e) => updateSelectedProp("priceListPriceBg", e.target.value)}
                                className="h-7 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-0.5"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Price List Items Manager */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                              Services / Products ({(selectedElementAny.priceListItems || []).length})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const arr = selectedElementAny.priceListItems || [];
                                const newItem: PriceListItem = {
                                  id: String(Date.now()),
                                  name: `Service Item ${arr.length + 1}`,
                                  price: "$25.00",
                                  description: "Item description goes here.",
                                  imageUrl: "",
                                };
                                updateSelectedProp("priceListItems", [...arr, newItem]);
                              }}
                              className="rounded bg-teal-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-teal-700 transition cursor-pointer"
                            >
                              + Add Item
                            </button>
                          </div>

                          <div className="space-y-3">
                            {(selectedElementAny.priceListItems || []).map((item, itemIdx) => (
                              <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-2">
                                <div className="flex items-center justify-between gap-1 border-b border-slate-100 pb-1.5">
                                  <input
                                    type="text"
                                    value={item.name}
                                    onChange={(e) => {
                                      const copy = [...(selectedElementAny.priceListItems || [])];
                                      copy[itemIdx] = { ...copy[itemIdx], name: e.target.value };
                                      updateSelectedProp("priceListItems", copy);
                                    }}
                                    placeholder="Item Name..."
                                    className="w-full font-bold text-xs text-slate-900 outline-none border-b border-transparent focus:border-teal-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const filtered = (selectedElementAny.priceListItems || []).filter((i) => i.id !== item.id);
                                      updateSelectedProp("priceListItems", filtered);
                                    }}
                                    className="h-5 w-5 shrink-0 rounded border border-red-200 bg-red-50 text-[10px] font-bold text-red-600 hover:bg-red-100 cursor-pointer"
                                  >
                                    ✕
                                  </button>
                                </div>

                                {/* Price */}
                                <div>
                                  <label className="block text-[9px] font-semibold text-slate-400">Price Display</label>
                                  <input
                                    type="text"
                                    value={item.price}
                                    onChange={(e) => {
                                      const copy = [...(selectedElementAny.priceListItems || [])];
                                      copy[itemIdx] = { ...copy[itemIdx], price: e.target.value };
                                      updateSelectedProp("priceListItems", copy);
                                    }}
                                    placeholder="Price e.g. $49.00 or From $30"
                                    className="w-full rounded border border-slate-200 px-2 py-0.5 text-xs font-semibold outline-none"
                                  />
                                </div>

                                {/* Description */}
                                <div>
                                  <label className="block text-[9px] font-semibold text-slate-400">Description</label>
                                  <textarea
                                    rows={2}
                                    value={item.description || ""}
                                    onChange={(e) => {
                                      const copy = [...(selectedElementAny.priceListItems || [])];
                                      copy[itemIdx] = { ...copy[itemIdx], description: e.target.value };
                                      updateSelectedProp("priceListItems", copy);
                                    }}
                                    placeholder="Short item description..."
                                    className="w-full rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 outline-none"
                                  />
                                </div>

                                {/* Thumbnail URL */}
                                {selectedElementAny.priceListShowImages !== false && (
                                  <div>
                                    <label className="block text-[9px] font-semibold text-slate-400">Image URL</label>
                                    <input
                                      type="text"
                                      value={item.imageUrl || ""}
                                      onChange={(e) => {
                                        const copy = [...(selectedElementAny.priceListItems || [])];
                                        copy[itemIdx] = { ...copy[itemIdx], imageUrl: e.target.value };
                                        updateSelectedProp("priceListItems", copy);
                                      }}
                                      placeholder="https://images.unsplash.com/..."
                                      className="w-full rounded border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500 font-mono outline-none"
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Gallery Specific Properties (F-184) */}
                    {selectedElementAny.type === "gallery" && (
                      <div className="space-y-4">
                        {/* Grid Layout & Aspect Ratio */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Grid & Image Layout
                          </span>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Columns
                              </label>
                              <select
                                value={selectedElementAny.galleryColumns || 3}
                                onChange={(e) => updateSelectedProp("galleryColumns", Number(e.target.value))}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-pink-500"
                              >
                                <option value={1}>1 Column</option>
                                <option value={2}>2 Columns</option>
                                <option value={3}>3 Columns</option>
                                <option value={4}>4 Columns</option>
                                <option value={5}>5 Columns</option>
                                <option value={6}>6 Columns</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Image Gap
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={60}
                                value={selectedElementAny.galleryGap ?? 16}
                                onChange={(e) => updateSelectedProp("galleryGap", Number(e.target.value))}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-pink-500"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Aspect Ratio
                              </label>
                              <select
                                value={selectedElementAny.galleryAspectRatio || "square"}
                                onChange={(e) => updateSelectedProp("galleryAspectRatio", e.target.value as any)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-pink-500"
                              >
                                <option value="square">Square (1:1)</option>
                                <option value="landscape">Landscape (16:9)</option>
                                <option value="portrait">Portrait (3:4)</option>
                                <option value="auto">Original / Auto</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Hover Effect
                              </label>
                              <select
                                value={selectedElementAny.galleryHoverEffect || "zoom"}
                                onChange={(e) => updateSelectedProp("galleryHoverEffect", e.target.value as any)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-pink-500"
                              >
                                <option value="zoom">Zoom Scale</option>
                                <option value="lift">Lift & Elevation</option>
                                <option value="fade">Subtle Fade</option>
                                <option value="none">None</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Border Radius
                              </label>
                              <select
                                value={selectedElementAny.galleryBorderRadius || "16px"}
                                onChange={(e) => updateSelectedProp("galleryBorderRadius", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-pink-500"
                              >
                                <option value="0px">Square (0px)</option>
                                <option value="8px">Rounded Small (8px)</option>
                                <option value="16px">Rounded Large (16px)</option>
                                <option value="24px">Extra Rounded (24px)</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Caption Style
                              </label>
                              <select
                                value={selectedElementAny.galleryCaptionPosition || "overlay"}
                                onChange={(e) => updateSelectedProp("galleryCaptionPosition", e.target.value as any)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-pink-500"
                              >
                                <option value="overlay">Overlay on Image</option>
                                <option value="below">Below Image</option>
                              </select>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                            <label className="text-[11px] font-semibold text-slate-700 cursor-pointer">
                              Show Image Captions
                            </label>
                            <input
                              type="checkbox"
                              checked={selectedElementAny.galleryShowCaptions !== false}
                              onChange={(e) => updateSelectedProp("galleryShowCaptions", e.target.checked)}
                              className="accent-pink-600 rounded cursor-pointer"
                            />
                          </div>
                        </div>

                        {/* Gallery Images Manager */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-200/80 pb-2">
                            <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                              Gallery Images ({(selectedElementAny.galleryImages || []).length})
                            </span>

                            <div className="flex items-center gap-1.5">
                              {/* Bulk Upload Button */}
                              <label className="rounded-lg bg-pink-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-pink-700 transition cursor-pointer flex items-center gap-1 shadow-xs">
                                <span>📁</span>
                                <span>Upload Photos</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  className="hidden"
                                  onChange={(e) => {
                                    const files = e.target.files;
                                    if (!files || files.length === 0) return;
                                    const currentItems = selectedElementAny.galleryImages || [];
                                    const fileArray = Array.from(files);
                                    const newItems: GalleryImageItem[] = [];
                                    let loadedCount = 0;

                                    fileArray.forEach((file, idx) => {
                                      const reader = new FileReader();
                                      reader.onload = (ev) => {
                                        if (ev.target?.result) {
                                          newItems.push({
                                            id: String(Date.now() + idx + Math.random()),
                                            url: ev.target.result as string,
                                            caption: file.name.replace(/\.[^/.]+$/, ""),
                                            altText: file.name,
                                          });
                                        }
                                        loadedCount++;
                                        if (loadedCount === fileArray.length) {
                                          updateSelectedProp("galleryImages", [...currentItems, ...newItems]);
                                        }
                                      };
                                      reader.readAsDataURL(file);
                                    });
                                    e.target.value = "";
                                  }}
                                />
                              </label>

                              {/* Add URL Item Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  const arr = selectedElementAny.galleryImages || [];
                                  const newImg: GalleryImageItem = {
                                    id: String(Date.now()),
                                    url: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&auto=format&fit=crop&q=80",
                                    caption: `Gallery Image ${arr.length + 1}`,
                                    altText: "Gallery Image",
                                  };
                                  updateSelectedProp("galleryImages", [...arr, newImg]);
                                }}
                                className="rounded-lg bg-slate-200 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-300 transition cursor-pointer"
                              >
                                + URL
                              </button>
                            </div>
                          </div>

                          <div className="space-y-3">
                            {(selectedElementAny.galleryImages || []).map((img, imgIdx) => (
                              <div key={img.id} className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-2 shadow-2xs">
                                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                                  {/* Thumbnail preview */}
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-slate-100 border border-slate-200 relative">
                                      {img.url ? (
                                        <img src={img.url} alt="Thumbnail" className="h-full w-full object-cover" />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">📷</div>
                                      )}
                                    </div>
                                    <span className="font-bold text-xs text-slate-800 truncate">Photo #{imgIdx + 1}</span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const filtered = (selectedElementAny.galleryImages || []).filter((i) => i.id !== img.id);
                                      updateSelectedProp("galleryImages", filtered);
                                    }}
                                    className="h-5 w-5 shrink-0 rounded border border-red-200 bg-red-50 text-[10px] font-bold text-red-600 hover:bg-red-100 cursor-pointer"
                                  >
                                    ✕
                                  </button>
                                </div>

                                {/* Image Upload / URL Controls */}
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <label className="block text-[9px] font-semibold text-slate-400">Photo File / Source URL</label>
                                    <label className="text-[9px] font-bold text-pink-600 hover:text-pink-700 cursor-pointer flex items-center gap-1">
                                      <span>📤 Replace Photo</span>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (!file) return;
                                          const reader = new FileReader();
                                          reader.onload = (ev) => {
                                            if (ev.target?.result) {
                                              const copy = [...(selectedElementAny.galleryImages || [])];
                                              copy[imgIdx] = {
                                                ...copy[imgIdx],
                                                url: ev.target.result as string,
                                                caption: copy[imgIdx].caption || file.name.replace(/\.[^/.]+$/, ""),
                                              };
                                              updateSelectedProp("galleryImages", copy);
                                            }
                                          };
                                          reader.readAsDataURL(file);
                                          e.target.value = "";
                                        }}
                                      />
                                    </label>
                                  </div>

                                  <input
                                    type="text"
                                    value={img.url}
                                    onChange={(e) => {
                                      const copy = [...(selectedElementAny.galleryImages || [])];
                                      copy[imgIdx] = { ...copy[imgIdx], url: e.target.value };
                                      updateSelectedProp("galleryImages", copy);
                                    }}
                                    placeholder="Paste Image URL or select local file..."
                                    className="w-full rounded border border-slate-200 px-2 py-1 text-[10px] text-slate-700 font-mono outline-none focus:border-pink-500"
                                  />
                                </div>

                                {/* Caption */}
                                <div>
                                  <label className="block text-[9px] font-semibold text-slate-400">Caption Text</label>
                                  <input
                                    type="text"
                                    value={img.caption || ""}
                                    onChange={(e) => {
                                      const copy = [...(selectedElementAny.galleryImages || [])];
                                      copy[imgIdx] = { ...copy[imgIdx], caption: e.target.value };
                                      updateSelectedProp("galleryImages", copy);
                                    }}
                                    placeholder="Image caption..."
                                    className="w-full rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-700 outline-none"
                                  />
                                </div>

                                {/* Alt Text */}
                                <div>
                                  <label className="block text-[9px] font-semibold text-slate-400">Alt Description (SEO)</label>
                                  <input
                                    type="text"
                                    value={img.altText || ""}
                                    onChange={(e) => {
                                      const copy = [...(selectedElementAny.galleryImages || [])];
                                      copy[imgIdx] = { ...copy[imgIdx], altText: e.target.value };
                                      updateSelectedProp("galleryImages", copy);
                                    }}
                                    placeholder="Alt text for accessibility..."
                                    className="w-full rounded border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500 outline-none"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Flip Box Specific Properties (F-185) */}
                    {selectedElementAny.type === "flip-box" && (
                      <div className="space-y-4">
                        {/* Card Animation & Dimensions Settings */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                            <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                              Card Settings & Effect
                            </span>
                            <button
                              type="button"
                              onClick={() => updateSelectedProp("flipIsFlippedManual", !selectedElementAny.flipIsFlippedManual)}
                              className={`rounded px-2 py-0.5 text-[10px] font-bold transition cursor-pointer ${selectedElementAny.flipIsFlippedManual
                                ? "bg-amber-600 text-white"
                                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                }`}
                            >
                              {selectedElementAny.flipIsFlippedManual ? "Viewing: BACK" : "Flip to Back"}
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Flip Direction
                              </label>
                              <select
                                value={selectedElementAny.flipDirection || "flip-right"}
                                onChange={(e) => updateSelectedProp("flipDirection", e.target.value as any)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                              >
                                <option value="flip-right">Flip Right (0° → 180°)</option>
                                <option value="flip-left">Flip Left (0° → -180°)</option>
                                <option value="flip-up">Flip Up (-180° X)</option>
                                <option value="flip-down">Flip Down (180° X)</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Animation Speed
                              </label>
                              <select
                                value={selectedElementAny.flipDuration || "0.6s"}
                                onChange={(e) => updateSelectedProp("flipDuration", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                              >
                                <option value="0.3s">Fast (0.3s)</option>
                                <option value="0.6s">Normal (0.6s)</option>
                                <option value="0.9s">Slow (0.9s)</option>
                                <option value="1.2s">Very Slow (1.2s)</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Card Height
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.flipCardHeight || "320px"}
                                onChange={(e) => updateSelectedProp("flipCardHeight", e.target.value)}
                                placeholder="320px"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-amber-500 font-mono"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Border Radius
                              </label>
                              <select
                                value={selectedElementAny.flipBorderRadius || "20px"}
                                onChange={(e) => updateSelectedProp("flipBorderRadius", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                              >
                                <option value="0px">Square (0px)</option>
                                <option value="12px">Rounded (12px)</option>
                                <option value="20px">Large Curved (20px)</option>
                                <option value="32px">Pill / Heavy (32px)</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Front Card Content */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Front Card Content
                          </span>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Icon / Emoji
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.flipFrontIcon || "🚀"}
                                onChange={(e) => updateSelectedProp("flipFrontIcon", e.target.value)}
                                placeholder="🚀, 💡, ⚡..."
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                                Image URL (Optional)
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.flipFrontImage || ""}
                                onChange={(e) => updateSelectedProp("flipFrontImage", e.target.value)}
                                placeholder="https://..."
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-mono text-slate-700 outline-none focus:border-amber-500"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Front Title
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.flipFrontTitle !== undefined ? selectedElementAny.flipFrontTitle : "Interactive Solutions"}
                              onChange={(e) => updateSelectedProp("flipFrontTitle", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Front Description
                            </label>
                            <textarea
                              rows={2}
                              value={selectedElementAny.flipFrontDescription !== undefined ? selectedElementAny.flipFrontDescription : "Hover or tap to flip card and explore custom features."}
                              onChange={(e) => updateSelectedProp("flipFrontDescription", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Background Color / Gradient
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.flipFrontBg || "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)"}
                                onChange={(e) => updateSelectedProp("flipFrontBg", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-mono text-slate-800 outline-none focus:border-amber-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Text Color
                              </label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.flipFrontTextColor || "#ffffff"}
                                  onChange={(e) => updateSelectedProp("flipFrontTextColor", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.flipFrontTextColor || "#ffffff"}
                                  onChange={(e) => updateSelectedProp("flipFrontTextColor", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Back Card Content */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Back Card Content
                          </span>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Back Title
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.flipBackTitle !== undefined ? selectedElementAny.flipBackTitle : "Ready to Start?"}
                              onChange={(e) => updateSelectedProp("flipBackTitle", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Back Description
                            </label>
                            <textarea
                              rows={2}
                              value={selectedElementAny.flipBackDescription !== undefined ? selectedElementAny.flipBackDescription : "Join thousands of creators building high-converting websites."}
                              onChange={(e) => updateSelectedProp("flipBackDescription", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Button Text
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.flipBackBtnText !== undefined ? selectedElementAny.flipBackBtnText : "Get Started Now"}
                                onChange={(e) => updateSelectedProp("flipBackBtnText", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Button Link URL
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.flipBackBtnUrl || "#"}
                                onChange={(e) => updateSelectedProp("flipBackBtnUrl", e.target.value)}
                                placeholder="#"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-mono text-slate-800 outline-none focus:border-amber-500"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Back Background
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.flipBackBg || "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)"}
                                onChange={(e) => updateSelectedProp("flipBackBg", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-mono text-slate-800 outline-none focus:border-amber-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Back Text Color
                              </label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.flipBackTextColor || "#ffffff"}
                                  onChange={(e) => updateSelectedProp("flipBackTextColor", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.flipBackTextColor || "#ffffff"}
                                  onChange={(e) => updateSelectedProp("flipBackTextColor", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Button Background
                              </label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.flipBackBtnBg || "#ffffff"}
                                  onChange={(e) => updateSelectedProp("flipBackBtnBg", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.flipBackBtnBg || "#ffffff"}
                                  onChange={(e) => updateSelectedProp("flipBackBtnBg", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none font-mono"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Button Text Color
                              </label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.flipBackBtnTextColor || "#4f46e5"}
                                  onChange={(e) => updateSelectedProp("flipBackBtnTextColor", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.flipBackBtnTextColor || "#4f46e5"}
                                  onChange={(e) => updateSelectedProp("flipBackBtnTextColor", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none font-mono"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Call to Action Specific Properties (F-186) */}
                    {selectedElementAny.type === "call-to-action" && (
                      <CTAWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Media Carousel Specific Properties (F-187) */}
                    {selectedElementAny.type === "media-carousel" && (
                      <MediaCarouselWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Testimonial Carousel Specific Properties (F-188) */}
                    {selectedElementAny.type === "testimonial-carousel" && (
                      <TestimonialCarouselWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Nested Carousel Inspector Panel (F-189) */}
                    {selectedElementAny.type === "nested-carousel" && (
                      <NestedCarouselWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                        setSelectedId={setSelectedId}
                      />
                    )}

                    {/* Loop Carousel Inspector Panel (F-190) */}
                    {selectedElementAny.type === "loop-carousel" && (
                      <LoopCarouselWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Table of Contents Inspector Panel (F-191) */}
                    {selectedElementAny.type === "table-of-contents" && (
                      <TOCWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Countdown Inspector Panel (F-192) */}
                    {selectedElementAny.type === "countdown" && (
                      <div className="space-y-4">
                        {/* Target Date & Time */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Target Date & Time
                          </span>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Target Date & Time
                            </label>
                            <input
                              type="datetime-local"
                              value={selectedElementAny.countdownTargetDate || ""}
                              onChange={(e) => updateSelectedProp("countdownTargetDate", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none cursor-pointer"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Expired Message
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.countdownExpiredMessage || "Event Has Ended!"}
                              onChange={(e) => updateSelectedProp("countdownExpiredMessage", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none"
                            />
                          </div>
                        </div>

                        {/* Display Units */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Displayed Units & Labels
                          </span>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-1">
                              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedElementAny.countdownShowDays !== false}
                                  onChange={(e) => updateSelectedProp("countdownShowDays", e.target.checked)}
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                />
                                <span>Days</span>
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.countdownDaysLabel || "Days"}
                                onChange={(e) => updateSelectedProp("countdownDaysLabel", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-800 outline-none"
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedElementAny.countdownShowHours !== false}
                                  onChange={(e) => updateSelectedProp("countdownShowHours", e.target.checked)}
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                />
                                <span>Hours</span>
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.countdownHoursLabel || "Hours"}
                                onChange={(e) => updateSelectedProp("countdownHoursLabel", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-800 outline-none"
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedElementAny.countdownShowMinutes !== false}
                                  onChange={(e) => updateSelectedProp("countdownShowMinutes", e.target.checked)}
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                />
                                <span>Minutes</span>
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.countdownMinutesLabel || "Minutes"}
                                onChange={(e) => updateSelectedProp("countdownMinutesLabel", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-800 outline-none"
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedElementAny.countdownShowSeconds !== false}
                                  onChange={(e) => updateSelectedProp("countdownShowSeconds", e.target.checked)}
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                />
                                <span>Seconds</span>
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.countdownSecondsLabel || "Seconds"}
                                onChange={(e) => updateSelectedProp("countdownSecondsLabel", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-800 outline-none"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Layout & Styling */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Layout & Box Styling
                          </span>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Alignment</label>
                              <select
                                value={selectedElementAny.countdownAlignment || "center"}
                                onChange={(e) => updateSelectedProp("countdownAlignment", e.target.value as "left" | "center" | "right")}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              >
                                <option value="left">Left</option>
                                <option value="center">Center</option>
                                <option value="right">Right</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Box Gap (px)</label>
                              <input
                                type="number"
                                value={selectedElementAny.countdownGap ?? 16}
                                onChange={(e) => updateSelectedProp("countdownGap", Number(e.target.value))}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Number Size</label>
                              <input
                                type="text"
                                value={selectedElementAny.countdownNumberSize || "32px"}
                                onChange={(e) => updateSelectedProp("countdownNumberSize", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Label Size</label>
                              <input
                                type="text"
                                value={selectedElementAny.countdownLabelSize || "11px"}
                                onChange={(e) => updateSelectedProp("countdownLabelSize", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Box Background</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.countdownBoxBg || "#ffffff"}
                                  onChange={(e) => updateSelectedProp("countdownBoxBg", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.countdownBoxBg || "#ffffff"}
                                  onChange={(e) => updateSelectedProp("countdownBoxBg", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Number Color</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.countdownNumberColor || "#0f172a"}
                                  onChange={(e) => updateSelectedProp("countdownNumberColor", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.countdownNumberColor || "#0f172a"}
                                  onChange={(e) => updateSelectedProp("countdownNumberColor", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Border Color</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.countdownBoxBorder || "#e2e8f0"}
                                  onChange={(e) => updateSelectedProp("countdownBoxBorder", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.countdownBoxBorder || "#e2e8f0"}
                                  onChange={(e) => updateSelectedProp("countdownBoxBorder", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Label Color</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.countdownLabelColor || "#64748b"}
                                  onChange={(e) => updateSelectedProp("countdownLabelColor", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.countdownLabelColor || "#64748b"}
                                  onChange={(e) => updateSelectedProp("countdownLabelColor", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Facebook Page Inspector Panel (F-193) */}
                    {selectedElementAny.type === "facebook-page" && (
                      <div className="space-y-4">
                        {/* Page URL & Tabs */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Facebook Page Configuration
                          </span>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Facebook Page URL
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.facebookPageUrl || ""}
                              onChange={(e) => updateSelectedProp("facebookPageUrl", e.target.value)}
                              placeholder="https://www.facebook.com/facebook"
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Displayed Tabs
                            </label>
                            <select
                              value={selectedElementAny.facebookTabs || "timeline"}
                              onChange={(e) => updateSelectedProp("facebookTabs", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                            >
                              <option value="timeline">Timeline</option>
                              <option value="events">Events</option>
                              <option value="messages">Messages</option>
                              <option value="timeline,events">Timeline & Events</option>
                              <option value="timeline,messages">Timeline & Messages</option>
                              <option value="events,messages">Events & Messages</option>
                              <option value="timeline,events,messages">Timeline, Events & Messages</option>
                            </select>
                          </div>
                        </div>

                        {/* Dimensions & Alignment */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Dimensions & Alignment
                          </span>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Width (px)
                              </label>
                              <input
                                type="number"
                                min={180}
                                max={500}
                                value={selectedElementAny.facebookWidth ?? 340}
                                onChange={(e) => updateSelectedProp("facebookWidth", Number(e.target.value))}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Height (px)
                              </label>
                              <input
                                type="number"
                                min={130}
                                max={1000}
                                value={selectedElementAny.facebookHeight ?? 500}
                                onChange={(e) => updateSelectedProp("facebookHeight", Number(e.target.value))}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Alignment
                            </label>
                            <select
                              value={selectedElementAny.facebookAlignment || "center"}
                              onChange={(e) => updateSelectedProp("facebookAlignment", e.target.value as "left" | "center" | "right")}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                            >
                              <option value="left">Left</option>
                              <option value="center">Center</option>
                              <option value="right">Right</option>
                            </select>
                          </div>
                        </div>

                        {/* Display Options Toggles */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Display Controls
                          </span>

                          <label className="flex items-center justify-between text-xs font-semibold text-slate-700 cursor-pointer py-1">
                            <span>Adapt Container Width</span>
                            <input
                              type="checkbox"
                              checked={selectedElementAny.facebookAdaptContainerWidth !== false}
                              onChange={(e) => updateSelectedProp("facebookAdaptContainerWidth", e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </label>

                          <label className="flex items-center justify-between text-xs font-semibold text-slate-700 cursor-pointer py-1 border-t border-slate-200/60">
                            <span>Use Small Header</span>
                            <input
                              type="checkbox"
                              checked={selectedElementAny.facebookSmallHeader === true}
                              onChange={(e) => updateSelectedProp("facebookSmallHeader", e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </label>

                          <label className="flex items-center justify-between text-xs font-semibold text-slate-700 cursor-pointer py-1 border-t border-slate-200/60">
                            <span>Hide Cover Photo</span>
                            <input
                              type="checkbox"
                              checked={selectedElementAny.facebookHideCover === true}
                              onChange={(e) => updateSelectedProp("facebookHideCover", e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </label>

                          <label className="flex items-center justify-between text-xs font-semibold text-slate-700 cursor-pointer py-1 border-t border-slate-200/60">
                            <span>Show Friend Faces</span>
                            <input
                              type="checkbox"
                              checked={selectedElementAny.facebookShowFacepile !== false}
                              onChange={(e) => updateSelectedProp("facebookShowFacepile", e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Blockquote Inspector Panel (F-194) */}
                    {selectedElementAny.type === "blockquote" && (
                      <div className="space-y-4">
                        {/* Content & Citation */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Quote Content & Citation
                          </span>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Quotation Text
                            </label>
                            <textarea
                              rows={3}
                              value={selectedElementAny.content || selectedElementAny.quoteContent || ""}
                              onChange={(e) => {
                                updateSelectedProp("content", e.target.value);
                                updateSelectedProp("quoteContent", e.target.value);
                              }}
                              placeholder="The only way to do great work is to love what you do."
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-indigo-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Author Name
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.quoteAuthor || ""}
                                onChange={(e) => updateSelectedProp("quoteAuthor", e.target.value)}
                                placeholder="Steve Jobs"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Citation / Title
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.quoteCitation || ""}
                                onChange={(e) => updateSelectedProp("quoteCitation", e.target.value)}
                                placeholder="Co-founder, Apple Inc."
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Style Variant & Alignment */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Style Variant & Layout
                          </span>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Style Variant
                              </label>
                              <select
                                value={selectedElementAny.quoteStyle || "accent-left"}
                                onChange={(e) => updateSelectedProp("quoteStyle", e.target.value as "accent-left" | "boxed" | "centered-clean" | "top-border")}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              >
                                <option value="accent-left">Left Accent Line</option>
                                <option value="boxed">Boxed Card</option>
                                <option value="top-border">Top Accent Line</option>
                                <option value="centered-clean">Centered Clean</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Text Alignment
                              </label>
                              <select
                                value={selectedElementAny.quoteAlignment || "left"}
                                onChange={(e) => updateSelectedProp("quoteAlignment", e.target.value as "left" | "center" | "right")}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              >
                                <option value="left">Left</option>
                                <option value="center">Center</option>
                                <option value="right">Right</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Icon & Colors */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Appearance & Colors
                          </span>

                          <label className="flex items-center justify-between text-xs font-semibold text-slate-700 cursor-pointer py-0.5">
                            <span>Show Decorative Quote Icon</span>
                            <input
                              type="checkbox"
                              checked={selectedElementAny.quoteShowIcon !== false}
                              onChange={(e) => updateSelectedProp("quoteShowIcon", e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </label>

                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Icon Color</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.quoteIconColor || "#6366f1"}
                                  onChange={(e) => updateSelectedProp("quoteIconColor", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.quoteIconColor || "#6366f1"}
                                  onChange={(e) => updateSelectedProp("quoteIconColor", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Border/Accent</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.quoteBorderColor || "#6366f1"}
                                  onChange={(e) => updateSelectedProp("quoteBorderColor", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.quoteBorderColor || "#6366f1"}
                                  onChange={(e) => updateSelectedProp("quoteBorderColor", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Quote Text Color</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.quoteTextColor || "#1e293b"}
                                  onChange={(e) => updateSelectedProp("quoteTextColor", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.quoteTextColor || "#1e293b"}
                                  onChange={(e) => updateSelectedProp("quoteTextColor", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Author Color</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.quoteAuthorColor || "#475569"}
                                  onChange={(e) => updateSelectedProp("quoteAuthorColor", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.quoteAuthorColor || "#475569"}
                                  onChange={(e) => updateSelectedProp("quoteAuthorColor", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Template Inspector Panel (F-195) */}
                    {selectedElementAny.type === "template" && (
                      <div className="space-y-4">
                        {/* Source Selection & Picker */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Template Source & Selection
                          </span>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                              Template Source Type
                            </label>
                            <div className="grid grid-cols-2 gap-1 bg-slate-200/60 p-1 rounded-lg">
                              <button
                                type="button"
                                onClick={() => {
                                  updateSelectedProp("templateSource", "preset");
                                  updateSelectedProp("templateId", undefined);
                                  if (!selectedElementAny.templatePresetName) {
                                    updateSelectedProp("templatePresetName", "hero");
                                  }
                                }}
                                className={`py-1 text-xs font-bold rounded-md transition ${selectedElementAny.templateSource !== "custom"
                                  ? "bg-white text-purple-700 shadow-2xs"
                                  : "text-slate-600 hover:text-slate-900"
                                  }`}
                              >
                                Presets
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  updateSelectedProp("templateSource", "custom");
                                  updateSelectedProp("templatePresetName", undefined);
                                  const firstCompKey = Object.keys(components)[0];
                                  if (firstCompKey) {
                                    updateSelectedProp("templateId", firstCompKey);
                                  }
                                }}
                                className={`py-1 text-xs font-bold rounded-md transition ${selectedElementAny.templateSource === "custom"
                                  ? "bg-white text-purple-700 shadow-2xs"
                                  : "text-slate-600 hover:text-slate-900"
                                  }`}
                              >
                                Saved Components
                              </button>
                            </div>
                          </div>

                          {selectedElementAny.templateSource === "custom" ? (
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Select Saved Reusable Component
                              </label>
                              {Object.keys(components).length === 0 ? (
                                <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-2.5 text-center text-[10px] font-medium text-purple-700">
                                  No components saved yet. Select any element & click "Save as Comp".
                                </div>
                              ) : (
                                <select
                                  value={selectedElementAny.templateId || ""}
                                  onChange={(e) => updateSelectedProp("templateId", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-purple-500"
                                >
                                  <option value="">-- Choose Component --</option>
                                  {Object.entries(components).map(([compId, comp]) => (
                                    <option key={compId} value={compId}>
                                      {comp.name} ({comp.element.type})
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          ) : (
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Select Section Template Preset
                              </label>
                              <select
                                value={selectedElementAny.templatePresetName || "hero"}
                                onChange={(e) => updateSelectedProp("templatePresetName", e.target.value as any)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-purple-500"
                              >
                                {Object.entries(PRESET_SECTION_TEMPLATES).map(([key, tpl]) => (
                                  <option key={key} value={key}>
                                    {tpl.icon} {tpl.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => handleUnpackTemplate(selectedElementAny.id)}
                            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-purple-700 active:scale-98 mt-2"
                          >
                            <span>⚡</span>
                            <span>Unpack / Insert into Canvas</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Reviews Inspector Panel (F-196) */}
                    {selectedElementAny.type === "reviews" && (
                      <div className="space-y-4">
                        {/* Layout & Columns */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Layout & Alignment
                          </span>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Layout Mode</label>
                              <select
                                value={selectedElementAny.reviewLayout || "grid"}
                                onChange={(e) => updateSelectedProp("reviewLayout", e.target.value as "grid" | "list")}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              >
                                <option value="grid">Grid Layout</option>
                                <option value="list">List Layout</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Grid Columns</label>
                              <select
                                value={selectedElementAny.reviewColumns || 3}
                                onChange={(e) => updateSelectedProp("reviewColumns", parseInt(e.target.value))}
                                disabled={selectedElementAny.reviewLayout === "list"}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none disabled:opacity-50"
                              >
                                <option value={1}>1 Column</option>
                                <option value={2}>2 Columns</option>
                                <option value={3}>3 Columns</option>
                                <option value={4}>4 Columns</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Text Alignment</label>
                            <div className="grid grid-cols-3 gap-1 bg-slate-200/60 p-1 rounded-lg">
                              {(["left", "center", "right"] as const).map((align) => (
                                <button
                                  key={align}
                                  type="button"
                                  onClick={() => updateSelectedProp("reviewAlignment", align)}
                                  className={`py-1 text-xs font-bold capitalize rounded-md transition ${(selectedElementAny.reviewAlignment || "left") === align
                                    ? "bg-white text-amber-700 shadow-2xs"
                                    : "text-slate-600 hover:text-slate-900"
                                    }`}
                                >
                                  {align}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Colors & Visual Features */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Color & Badges
                          </span>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Star Rating Color</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.reviewStarColor || "#f59e0b"}
                                  onChange={(e) => updateSelectedProp("reviewStarColor", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.reviewStarColor || "#f59e0b"}
                                  onChange={(e) => updateSelectedProp("reviewStarColor", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Card Background</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.reviewCardBg || "#ffffff"}
                                  onChange={(e) => updateSelectedProp("reviewCardBg", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.reviewCardBg || "#ffffff"}
                                  onChange={(e) => updateSelectedProp("reviewCardBg", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedElementAny.reviewShowAvatar !== false}
                                onChange={(e) => updateSelectedProp("reviewShowAvatar", e.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                              />
                              <span>Show Avatars</span>
                            </label>

                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedElementAny.reviewShowVerified !== false}
                                onChange={(e) => updateSelectedProp("reviewShowVerified", e.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />
                              <span>Show Verified Badge</span>
                            </label>
                          </div>
                        </div>

                        {/* Visitor Manual Submission Options */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Manual Review Submissions
                          </span>

                          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedElementAny.reviewAllowSubmission !== false}
                              onChange={(e) => updateSelectedProp("reviewAllowSubmission", e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                            />
                            <span>Enable "Write a Review" Button</span>
                          </label>

                          {selectedElementAny.reviewAllowSubmission !== false && (
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Submit Button Text
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.reviewSubmissionButtonText || "+ Write a Review"}
                                onChange={(e) => updateSelectedProp("reviewSubmissionButtonText", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              />
                            </div>
                          )}
                        </div>

                        {/* Customer Review Items Manager */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                              Customer Reviews ({selectedElementAny.reviewItems?.length || 0})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const current = selectedElementAny.reviewItems || [];
                                const newItem: ReviewItem = {
                                  id: "rev-" + Date.now(),
                                  reviewerName: "Alex Rivera",
                                  reviewerTitle: "Verified Customer",
                                  reviewText: "Fantastic experience! Highly recommended product.",
                                  rating: 5,
                                  avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80",
                                  verified: true,
                                };
                                updateSelectedProp("reviewItems", [...current, newItem]);
                              }}
                              className="flex items-center gap-1 rounded bg-amber-600 px-2 py-1 text-[10px] font-bold text-white shadow-2xs hover:bg-amber-700 transition"
                            >
                              <span>+</span> Add Review
                            </button>
                          </div>

                          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                            {(selectedElementAny.reviewItems || []).map((rev, idx) => (
                              <div key={rev.id} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2.5 shadow-2xs">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                                  <span className="text-xs font-bold text-amber-800">
                                    Review #{idx + 1}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    {idx > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const items = [...(selectedElementAny.reviewItems || [])];
                                          const temp = items[idx];
                                          items[idx] = items[idx - 1];
                                          items[idx - 1] = temp;
                                          updateSelectedProp("reviewItems", items);
                                        }}
                                        className="px-1 text-[10px] text-slate-500 hover:text-slate-900"
                                        title="Move Up"
                                      >
                                        ▲
                                      </button>
                                    )}
                                    {idx < (selectedElementAny.reviewItems?.length || 0) - 1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const items = [...(selectedElementAny.reviewItems || [])];
                                          const temp = items[idx];
                                          items[idx] = items[idx + 1];
                                          items[idx + 1] = temp;
                                          updateSelectedProp("reviewItems", items);
                                        }}
                                        className="px-1 text-[10px] text-slate-500 hover:text-slate-900"
                                        title="Move Down"
                                      >
                                        ▼
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const items = (selectedElementAny.reviewItems || []).filter((i) => i.id !== rev.id);
                                        updateSelectedProp("reviewItems", items);
                                      }}
                                      className="ml-1 text-[10px] font-bold text-red-500 hover:text-red-700"
                                      title="Remove Review"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Name</label>
                                    <input
                                      type="text"
                                      value={rev.reviewerName}
                                      onChange={(e) => {
                                        const items = [...(selectedElementAny.reviewItems || [])];
                                        items[idx] = { ...items[idx], reviewerName: e.target.value };
                                        updateSelectedProp("reviewItems", items);
                                      }}
                                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Rating</label>
                                    <select
                                      value={rev.rating || 5}
                                      onChange={(e) => {
                                        const items = [...(selectedElementAny.reviewItems || [])];
                                        items[idx] = { ...items[idx], rating: parseInt(e.target.value) };
                                        updateSelectedProp("reviewItems", items);
                                      }}
                                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                                    >
                                      <option value={5}>5 Stars (★★★★★)</option>
                                      <option value={4}>4 Stars (★★★★☆)</option>
                                      <option value={3}>3 Stars (★★★☆☆)</option>
                                      <option value={2}>2 Stars (★★☆☆☆)</option>
                                      <option value={1}>1 Star (★☆☆☆☆)</option>
                                    </select>
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Title / Role</label>
                                  <input
                                    type="text"
                                    value={rev.reviewerTitle || ""}
                                    onChange={(e) => {
                                      const items = [...(selectedElementAny.reviewItems || [])];
                                      items[idx] = { ...items[idx], reviewerTitle: e.target.value };
                                      updateSelectedProp("reviewItems", items);
                                    }}
                                    placeholder="Verified Buyer"
                                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-800 outline-none"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Review Text</label>
                                  <textarea
                                    rows={2}
                                    value={rev.reviewText}
                                    onChange={(e) => {
                                      const items = [...(selectedElementAny.reviewItems || [])];
                                      items[idx] = { ...items[idx], reviewText: e.target.value };
                                      updateSelectedProp("reviewItems", items);
                                    }}
                                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-normal text-slate-800 outline-none"
                                  />
                                </div>

                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <label className="block text-[10px] font-semibold text-slate-500">Avatar Image</label>
                                    <label className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 hover:text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded cursor-pointer border border-amber-200">
                                      <span>📁 Upload File</span>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            const reader = new FileReader();
                                            reader.onloadend = () => {
                                              if (typeof reader.result === "string") {
                                                const items = [...(selectedElementAny.reviewItems || [])];
                                                items[idx] = { ...items[idx], avatarUrl: reader.result };
                                                updateSelectedProp("reviewItems", items);
                                              }
                                            };
                                            reader.readAsDataURL(file);
                                          }
                                        }}
                                      />
                                    </label>
                                  </div>
                                  <input
                                    type="text"
                                    value={rev.avatarUrl || ""}
                                    onChange={(e) => {
                                      const items = [...(selectedElementAny.reviewItems || [])];
                                      items[idx] = { ...items[idx], avatarUrl: e.target.value };
                                      updateSelectedProp("reviewItems", items);
                                    }}
                                    placeholder="https://..."
                                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                  />
                                </div>

                                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer pt-0.5">
                                  <input
                                    type="checkbox"
                                    checked={rev.verified ?? true}
                                    onChange={(e) => {
                                      const items = [...(selectedElementAny.reviewItems || [])];
                                      items[idx] = { ...items[idx], verified: e.target.checked };
                                      updateSelectedProp("reviewItems", items);
                                    }}
                                    className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                  />
                                  <span>Verified Customer Badge</span>
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Facebook Button Inspector Panel (F-197) */}
                    {selectedElementAny.type === "facebook-button" && (
                      <div className="space-y-4">
                        {/* Facebook Button Configuration */}
                        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                            <FacebookButtonBoxIcon />
                            <span>Facebook Button Settings</span>
                          </span>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                              Target Facebook URL *
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.fbButtonUrl || "https://facebook.com"}
                              onChange={(e) => updateSelectedProp("fbButtonUrl", e.target.value)}
                              placeholder="https://facebook.com/yourpage"
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-800 outline-none focus:border-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                              Button Label *
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.fbButtonLabel || "Like Us on Facebook"}
                              onChange={(e) => updateSelectedProp("fbButtonLabel", e.target.value)}
                              placeholder="e.g. Like Us on Facebook, Share Page, Follow Us"
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Button Action
                              </label>
                              <select
                                value={selectedElementAny.fbButtonAction || "like"}
                                onChange={(e) => updateSelectedProp("fbButtonAction", e.target.value as any)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              >
                                <option value="like">Like</option>
                                <option value="share">Share</option>
                                <option value="follow">Follow</option>
                                <option value="custom">Custom</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Button Size
                              </label>
                              <select
                                value={selectedElementAny.fbButtonSize || "md"}
                                onChange={(e) => updateSelectedProp("fbButtonSize", e.target.value as any)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              >
                                <option value="sm">Small</option>
                                <option value="md">Medium</option>
                                <option value="lg">Large</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Alignment
                            </label>
                            <div className="grid grid-cols-3 gap-1 bg-slate-200/60 p-1 rounded-lg">
                              {(["left", "center", "right"] as const).map((align) => (
                                <button
                                  key={align}
                                  type="button"
                                  onClick={() => updateSelectedProp("fbButtonAlignment", align)}
                                  className={`py-1 text-xs font-bold capitalize rounded-md transition ${(selectedElementAny.fbButtonAlignment || "left") === align
                                    ? "bg-white text-blue-700 shadow-2xs"
                                    : "text-slate-600 hover:text-slate-900"
                                    }`}
                                >
                                  {align}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Color Customization */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Button Colors & Styling
                          </span>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Background</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.fbButtonBgColor || "#1877F2"}
                                  onChange={(e) => updateSelectedProp("fbButtonBgColor", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.fbButtonBgColor || "#1877F2"}
                                  onChange={(e) => updateSelectedProp("fbButtonBgColor", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Hover Background</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.fbButtonHoverBgColor || "#0d65d9"}
                                  onChange={(e) => updateSelectedProp("fbButtonHoverBgColor", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.fbButtonHoverBgColor || "#0d65d9"}
                                  onChange={(e) => updateSelectedProp("fbButtonHoverBgColor", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Text & Icon Color</label>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="color"
                                value={selectedElementAny.fbButtonTextColor || "#ffffff"}
                                onChange={(e) => updateSelectedProp("fbButtonTextColor", e.target.value)}
                                className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                              />
                              <input
                                type="text"
                                value={selectedElementAny.fbButtonTextColor || "#ffffff"}
                                onChange={(e) => updateSelectedProp("fbButtonTextColor", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Facebook Embed Inspector Panel (F-198) */}
                    {selectedElementAny.type === "facebook-embed" && (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                            <FacebookEmbedBoxIcon />
                            <span>Facebook Embed Settings</span>
                          </span>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                              Post or Video URL *
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.fbEmbedUrl || "https://www.facebook.com/facebook"}
                              onChange={(e) => updateSelectedProp("fbEmbedUrl", e.target.value)}
                              placeholder="https://www.facebook.com/username/posts/123"
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-800 outline-none focus:border-blue-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Width</label>
                              <input
                                type="text"
                                value={selectedElementAny.fbEmbedWidth || "100%"}
                                onChange={(e) => updateSelectedProp("fbEmbedWidth", e.target.value)}
                                placeholder="e.g. 100% or 500px"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Height</label>
                              <input
                                type="text"
                                value={selectedElementAny.fbEmbedHeight || "450px"}
                                onChange={(e) => updateSelectedProp("fbEmbedHeight", e.target.value)}
                                placeholder="e.g. 450px"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Alignment</label>
                            <div className="grid grid-cols-3 gap-1 bg-slate-200/60 p-1 rounded-lg">
                              {(["left", "center", "right"] as const).map((align) => (
                                <button
                                  key={align}
                                  type="button"
                                  onClick={() => updateSelectedProp("fbEmbedAlignment", align)}
                                  className={`py-1 text-xs font-bold capitalize rounded-md transition ${(selectedElementAny.fbEmbedAlignment || "center") === align
                                    ? "bg-white text-blue-700 shadow-2xs"
                                    : "text-slate-600 hover:text-slate-900"
                                    }`}
                                >
                                  {align}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Facebook Comments Inspector Panel (F-199) */}
                    {selectedElementAny.type === "facebook-comments" && (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                            <FacebookCommentsBoxIcon />
                            <span>Facebook Comments Settings</span>
                          </span>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                              Target Discussion URL *
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.fbCommentsUrl || "https://facebook.com"}
                              onChange={(e) => updateSelectedProp("fbCommentsUrl", e.target.value)}
                              placeholder="https://yourwebsite.com/blog/article-1"
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-800 outline-none focus:border-blue-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Number of Posts</label>
                              <input
                                type="number"
                                min={1}
                                max={50}
                                value={selectedElementAny.fbCommentsNumPosts || 5}
                                onChange={(e) => updateSelectedProp("fbCommentsNumPosts", parseInt(e.target.value) || 5)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Container Width</label>
                              <input
                                type="text"
                                value={selectedElementAny.fbCommentsWidth || "100%"}
                                onChange={(e) => updateSelectedProp("fbCommentsWidth", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Alignment</label>
                            <div className="grid grid-cols-3 gap-1 bg-slate-200/60 p-1 rounded-lg">
                              {(["left", "center", "right"] as const).map((align) => (
                                <button
                                  key={align}
                                  type="button"
                                  onClick={() => updateSelectedProp("fbCommentsAlignment", align)}
                                  className={`py-1 text-xs font-bold capitalize rounded-md transition ${(selectedElementAny.fbCommentsAlignment || "center") === align
                                    ? "bg-white text-blue-700 shadow-2xs"
                                    : "text-slate-600 hover:text-slate-900"
                                    }`}
                                >
                                  {align}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PayPal Button Inspector Panel (F-200 / F-217) */}
                    {selectedElementAny.type === "paypal-button" && (
                      <PayPalWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Stripe Button Inspector Panel (F-201) */}
                    {selectedElementAny.type === "stripe-button" && (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                            <StripeButtonBoxIcon />
                            <span>Stripe Checkout Settings</span>
                          </span>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                              Button Text
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.stripeText || "Checkout with Stripe"}
                              onChange={(e) => updateSelectedProp("stripeText", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                              Stripe Payment Link URL *
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.stripeCheckoutUrl || "https://buy.stripe.com"}
                              onChange={(e) => updateSelectedProp("stripeCheckoutUrl", e.target.value)}
                              placeholder="https://buy.stripe.com/..."
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-800 outline-none focus:border-indigo-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Display Amount</label>
                              <input
                                type="text"
                                value={selectedElementAny.stripeAmount || "$49.00"}
                                onChange={(e) => updateSelectedProp("stripeAmount", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Size</label>
                              <select
                                value={selectedElementAny.stripeButtonSize || "md"}
                                onChange={(e) => updateSelectedProp("stripeButtonSize", e.target.value as any)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              >
                                <option value="sm">Small</option>
                                <option value="md">Medium</option>
                                <option value="lg">Large</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">Colors</span>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Background</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.stripeBgColor || "#635BFF"}
                                  onChange={(e) => updateSelectedProp("stripeBgColor", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.stripeBgColor || "#635BFF"}
                                  onChange={(e) => updateSelectedProp("stripeBgColor", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Text Color</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.stripeTextColor || "#ffffff"}
                                  onChange={(e) => updateSelectedProp("stripeTextColor", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.stripeTextColor || "#ffffff"}
                                  onChange={(e) => updateSelectedProp("stripeTextColor", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Lottie Inspector Panel (F-202) */}
                    {selectedElementAny.type === "lottie" && (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-teal-900 uppercase tracking-wider flex items-center gap-1.5">
                            <LottieBoxIcon />
                            <span>Lottie Animation Settings</span>
                          </span>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                              Lottie JSON Animation URL *
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.lottieUrl || ""}
                              onChange={(e) => updateSelectedProp("lottieUrl", e.target.value)}
                              placeholder="https://assets9.lottiefiles.com/..."
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-800 outline-none focus:border-teal-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Width</label>
                              <input
                                type="text"
                                value={selectedElementAny.lottieWidth || "280px"}
                                onChange={(e) => updateSelectedProp("lottieWidth", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Height</label>
                              <input
                                type="text"
                                value={selectedElementAny.lottieHeight || "280px"}
                                onChange={(e) => updateSelectedProp("lottieHeight", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedElementAny.lottieAutoplay ?? true}
                                onChange={(e) => updateSelectedProp("lottieAutoplay", e.target.checked)}
                                className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                              />
                              <span>Autoplay</span>
                            </label>

                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedElementAny.lottieLoop ?? true}
                                onChange={(e) => updateSelectedProp("lottieLoop", e.target.checked)}
                                className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                              />
                              <span>Loop</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Code Highlight Inspector Panel (F-203) */}
                    {selectedElementAny.type === "code-highlight" && (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                            <CodeHighlightBoxIcon />
                            <span>Code Highlight Settings</span>
                          </span>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                              Language
                            </label>
                            <select
                              value={selectedElementAny.codeLanguage || "typescript"}
                              onChange={(e) => updateSelectedProp("codeLanguage", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none"
                            >
                              <option value="typescript">TypeScript</option>
                              <option value="javascript">JavaScript</option>
                              <option value="python">Python</option>
                              <option value="html">HTML</option>
                              <option value="css">CSS</option>
                              <option value="json">JSON</option>
                              <option value="bash">Bash / Shell</option>
                              <option value="sql">SQL</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                              Code Snippet Content
                            </label>
                            <textarea
                              rows={6}
                              value={selectedElementAny.codeSnippet || ""}
                              onChange={(e) => updateSelectedProp("codeSnippet", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-800 outline-none leading-relaxed"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Theme Mode</label>
                              <select
                                value={selectedElementAny.codeTheme || "dark"}
                                onChange={(e) => updateSelectedProp("codeTheme", e.target.value as any)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              >
                                <option value="dark">Dark (Vs Code Dark)</option>
                                <option value="light">Light (Vs Code Light)</option>
                              </select>
                            </div>

                            <div className="flex items-center pt-4">
                              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedElementAny.codeShowLineNumbers ?? true}
                                  onChange={(e) => updateSelectedProp("codeShowLineNumbers", e.target.checked)}
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                                />
                                <span>Line Numbers</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Video Playlist Inspector Panel (F-204) */}
                    {selectedElementAny.type === "video-playlist" && (() => {
                      const items: PlaylistItem[] = selectedElementAny.playlistItems?.length
                        ? selectedElementAny.playlistItems
                        : [
                          {
                            id: "1",
                            title: "ForgeStudio Platform Overview & Quick Start Guide",
                            url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                            videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                            duration: "3:45",
                            thumbnail: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80",
                            thumbnailUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80",
                          },
                          {
                            id: "2",
                            title: "Designing Responsive SaaS Layouts in Record Time",
                            url: "https://vimeo.com/76979871",
                            videoUrl: "https://vimeo.com/76979871",
                            duration: "5:12",
                            thumbnail: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=400&q=80",
                            thumbnailUrl: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=400&q=80",
                          },
                        ];

                      return (
                        <div className="space-y-4">
                          <div className="rounded-xl border border-red-200 bg-red-50/50 p-3 space-y-3">
                            <span className="block text-[11px] font-bold text-red-900 uppercase tracking-wider flex items-center gap-1.5">
                              <VideoPlaylistBoxIcon />
                              <span>Video Playlist Settings</span>
                            </span>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                                Playlist Layout Position
                              </label>
                              <div className="grid grid-cols-2 gap-1 bg-slate-200/60 p-1 rounded-lg">
                                {(["right", "bottom"] as const).map((pos) => (
                                  <button
                                    key={pos}
                                    type="button"
                                    onClick={() => updateSelectedProp("playlistPosition", pos)}
                                    className={`py-1 text-xs font-bold capitalize rounded-md transition ${(selectedElementAny.playlistPosition || "right") === pos
                                      ? "bg-white text-red-700 shadow-2xs"
                                      : "text-slate-600 hover:text-slate-900"
                                      }`}
                                  >
                                    {pos}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Dynamic Video Playlist Editor */}
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                Playlist Videos ({items.length})
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const newItem: PlaylistItem = {
                                    id: `v_${Date.now()}`,
                                    title: `New Video ${items.length + 1}`,
                                    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                                    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                                    duration: "2:30",
                                    thumbnail: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80",
                                    thumbnailUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80",
                                  };
                                  updateSelectedProp("playlistItems", [...items, newItem]);
                                }}
                                className="rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs hover:bg-red-700 transition cursor-pointer"
                              >
                                + Add Video
                              </button>
                            </div>

                            <div className="space-y-3">
                              {items.map((item, idx) => (
                                <div
                                  key={item.id || idx}
                                  className="rounded-xl border border-slate-200 bg-white p-3 space-y-2 shadow-2xs"
                                >
                                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                                    <span className="text-xs font-bold text-red-700">Video #{idx + 1}</span>
                                    {items.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = items.filter((_, i) => i !== idx);
                                          updateSelectedProp("playlistItems", updated);
                                        }}
                                        className="text-[10px] font-bold text-red-500 hover:text-red-700 hover:underline"
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Title</label>
                                    <input
                                      type="text"
                                      value={item.title || ""}
                                      onChange={(e) => {
                                        const updated = [...items];
                                        updated[idx] = { ...updated[idx], title: e.target.value };
                                        updateSelectedProp("playlistItems", updated);
                                      }}
                                      placeholder="Video Title"
                                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-red-500"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                      Video URL (YouTube, Vimeo, MP4 link) *
                                    </label>
                                    <input
                                      type="text"
                                      value={item.videoUrl || ""}
                                      onChange={(e) => {
                                        const updated = [...items];
                                        updated[idx] = { ...updated[idx], videoUrl: e.target.value };
                                        updateSelectedProp("playlistItems", updated);
                                      }}
                                      placeholder="https://www.youtube.com/watch?v=..."
                                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-mono text-slate-800 outline-none focus:border-red-500"
                                    />
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Duration</label>
                                      <input
                                        type="text"
                                        value={item.duration || ""}
                                        onChange={(e) => {
                                          const updated = [...items];
                                          updated[idx] = { ...updated[idx], duration: e.target.value };
                                          updateSelectedProp("playlistItems", updated);
                                        }}
                                        placeholder="e.g. 4:15"
                                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                      />
                                    </div>

                                    <div>
                                      <div className="flex items-center justify-between mb-0.5">
                                        <label className="block text-[10px] font-semibold text-slate-500">Thumbnail</label>
                                        <label className="text-[9px] font-bold text-red-600 hover:text-red-800 cursor-pointer">
                                          📁 Upload
                                          <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                              const file = e.target.files?.[0];
                                              if (file) {
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                  if (typeof reader.result === "string") {
                                                    const updated = [...items];
                                                    updated[idx] = { ...updated[idx], thumbnail: reader.result };
                                                    updateSelectedProp("playlistItems", updated);
                                                  }
                                                };
                                                reader.readAsDataURL(file);
                                              }
                                            }}
                                          />
                                        </label>
                                      </div>
                                      <input
                                        type="text"
                                        value={item.thumbnail || ""}
                                        onChange={(e) => {
                                          const updated = [...items];
                                          updated[idx] = { ...updated[idx], thumbnail: e.target.value };
                                          updateSelectedProp("playlistItems", updated);
                                        }}
                                        placeholder="https://..."
                                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Mega Menu Inspector Panel (F-205) */}
                    {selectedElementAny.type === "mega-menu" && (
                      <div className="space-y-4">
                        {/* General Settings */}
                        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                            <MegaMenuBoxIcon />
                            <span>Mega Menu Navigation Settings</span>
                          </span>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Background</label>
                              <input
                                type="color"
                                value={selectedElementAny.megaMenuBgColor || "#ffffff"}
                                onChange={(e) => updateSelectedProp("megaMenuBgColor", e.target.value)}
                                className="h-8 w-full cursor-pointer rounded border border-slate-200 p-0.5 bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Text Color</label>
                              <input
                                type="color"
                                value={selectedElementAny.megaMenuTextColor || "#0f172a"}
                                onChange={(e) => updateSelectedProp("megaMenuTextColor", e.target.value)}
                                className="h-8 w-full cursor-pointer rounded border border-slate-200 p-0.5 bg-white"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Alignment</label>
                              <select
                                value={selectedElementAny.megaMenuAlignment || "center"}
                                onChange={(e) => updateSelectedProp("megaMenuAlignment", e.target.value as any)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none"
                              >
                                <option value="left">Left Align</option>
                                <option value="center">Center Align</option>
                                <option value="right">Right Align</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Menu Trigger</label>
                              <select
                                value={selectedElementAny.megaMenuTrigger || "hover"}
                                onChange={(e) => updateSelectedProp("megaMenuTrigger", e.target.value as any)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none"
                              >
                                <option value="hover">On Hover</option>
                                <option value="click">On Click</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Mega Menu Items Manager */}
                        <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="block text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                              Categories ({selectedElementAny.megaMenuItems?.length || 3})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const defaultItems: MegaMenuItem[] = [
                                  { id: "1", title: "Products" },
                                  { id: "2", title: "Resources" },
                                  { id: "3", title: "Pricing", href: "#pricing" },
                                ];
                                const current = selectedElementAny.megaMenuItems?.length ? selectedElementAny.megaMenuItems : defaultItems;
                                const newItem: MegaMenuItem = {
                                  id: `mega_${Date.now()}`,
                                  title: `New Category ${current.length + 1}`,
                                  trigger: "hover",
                                  columns: [
                                    {
                                      id: `col_${Date.now()}`,
                                      title: "Category Section",
                                      links: [
                                        { label: "New Link 1", href: "#" },
                                        { label: "New Link 2", href: "#" },
                                      ],
                                    },
                                  ],
                                };
                                updateSelectedProp("megaMenuItems", [...current, newItem]);
                              }}
                              className="rounded bg-blue-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-blue-700 transition cursor-pointer shadow-xs"
                            >
                              + Add Category
                            </button>
                          </div>

                          <div className="space-y-3">
                            {(selectedElementAny.megaMenuItems || [
                              {
                                id: "1",
                                title: "Products",
                                columns: [
                                  {
                                    id: "col_1",
                                    title: "Core Platform",
                                    links: [
                                      { label: "Visual Builder", href: "#", badge: "New", description: "Drag & drop visual builder" },
                                      { label: "Design System", href: "#", description: "Design tokens & components" },
                                    ],
                                  },
                                  {
                                    id: "col_2",
                                    title: "Solutions",
                                    links: [
                                      { label: "SaaS Agencies", href: "#", description: "White-label builder" },
                                      { label: "E-Commerce Stores", href: "#", badge: "Pro", description: "Product & Woo integration" },
                                    ],
                                  },
                                ],
                              },
                              {
                                id: "2",
                                title: "Resources",
                                columns: [
                                  {
                                    id: "col_3",
                                    title: "Documentation",
                                    links: [
                                      { label: "Getting Started Guide", href: "#" },
                                      { label: "API Reference", href: "#" },
                                    ],
                                  },
                                ],
                              },
                              { id: "3", title: "Pricing", href: "#pricing" },
                            ]).map((catItem, cIdx, catArr) => (
                              <div
                                key={catItem.id}
                                className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs space-y-2.5"
                              >
                                <div className="flex items-center justify-between gap-1 pb-1 border-b border-slate-100">
                                  <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                                    <span className="text-blue-600">#{cIdx + 1}</span>
                                    {catItem.icon && <span>{catItem.icon}</span>}
                                    <span>{catItem.title}</span>
                                  </span>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      disabled={cIdx === 0}
                                      onClick={() => {
                                        const copy = [...catArr];
                                        const temp = copy[cIdx - 1];
                                        copy[cIdx - 1] = copy[cIdx];
                                        copy[cIdx] = temp;
                                        updateSelectedProp("megaMenuItems", copy);
                                      }}
                                      className="h-5 w-5 rounded border border-slate-200 text-[10px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                                      title="Move Up"
                                    >
                                      ↑
                                    </button>
                                    <button
                                      type="button"
                                      disabled={cIdx === catArr.length - 1}
                                      onClick={() => {
                                        const copy = [...catArr];
                                        const temp = copy[cIdx + 1];
                                        copy[cIdx + 1] = copy[cIdx];
                                        copy[cIdx] = temp;
                                        updateSelectedProp("megaMenuItems", copy);
                                      }}
                                      className="h-5 w-5 rounded border border-slate-200 text-[10px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                                      title="Move Down"
                                    >
                                      ↓
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const dup: MegaMenuItem = {
                                          ...catItem,
                                          id: `mega_${Date.now()}`,
                                          title: `${catItem.title} (Copy)`,
                                        };
                                        const copy = [...catArr];
                                        copy.splice(cIdx + 1, 0, dup);
                                        updateSelectedProp("megaMenuItems", copy);
                                      }}
                                      className="h-5 w-5 rounded border border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                                      title="Duplicate Category"
                                    >
                                      ⧉
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const filtered = catArr.filter((i) => i.id !== catItem.id);
                                        updateSelectedProp("megaMenuItems", filtered);
                                      }}
                                      className="h-5 w-5 rounded border border-red-200 bg-red-50 text-[10px] font-bold text-red-600 hover:bg-red-100 cursor-pointer"
                                      title="Delete Category"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>

                                {/* Category Details */}
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[9px] font-semibold text-slate-500 mb-0.5">Category Title</label>
                                    <input
                                      type="text"
                                      value={catItem.title}
                                      onChange={(e) => {
                                        const updated = catArr.map((i) =>
                                          i.id === catItem.id ? { ...i, title: e.target.value } : i
                                        );
                                        updateSelectedProp("megaMenuItems", updated);
                                      }}
                                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[9px] font-semibold text-slate-500 mb-0.5">Destination Type</label>
                                    <select
                                      value={catItem.destinationType || (catItem.pageId ? "page" : catItem.productId ? "product" : "url")}
                                      onChange={(e) => {
                                        const val = e.target.value as "url" | "page" | "product";
                                        const updated = catArr.map((i) =>
                                          i.id === catItem.id ? { ...i, destinationType: val, linkType: val } : i
                                        );
                                        updateSelectedProp("megaMenuItems", updated);
                                      }}
                                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                                    >
                                      <option value="url">URL / Anchor</option>
                                      <option value="page">📄 Site Page</option>
                                      <option value="product">🛍️ Product</option>
                                    </select>
                                  </div>
                                </div>

                                {/* Category Dynamic Destination Target */}
                                {(catItem.destinationType === "page" || (!catItem.destinationType && catItem.pageId)) && (
                                  <div className="space-y-1 rounded-lg border border-blue-100 bg-blue-50/40 p-2">
                                    <div className="flex items-center justify-between">
                                      <label className="block text-[9px] font-bold text-blue-900 uppercase">Target Page</label>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const created = handleCreatePageQuick();
                                          const updated = catArr.map((i) =>
                                            i.id === catItem.id ? { ...i, pageId: created.id, href: created.slug, destinationType: "page" } : i
                                          );
                                          updateSelectedProp("megaMenuItems", updated);
                                        }}
                                        className="text-[9px] font-bold text-blue-600 hover:underline cursor-pointer"
                                      >
                                        + Create Page
                                      </button>
                                    </div>
                                    <select
                                      value={catItem.pageId || ""}
                                      onChange={(e) => {
                                        const pId = e.target.value;
                                        const pObj = pages.find(p => p.id === pId);
                                        const updated = catArr.map((i) =>
                                          i.id === catItem.id ? { ...i, pageId: pId, href: pObj?.slug || i.href, destinationType: "page" } : i
                                        );
                                        updateSelectedProp("megaMenuItems", updated);
                                      }}
                                      className="w-full rounded border border-blue-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none"
                                    >
                                      <option value="">-- Select Page --</option>
                                      {pages.map((p) => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.slug})</option>
                                      ))}
                                    </select>
                                  </div>
                                )}

                                {(catItem.destinationType === "product" || (!catItem.destinationType && catItem.productId)) && (
                                  <div className="space-y-1 rounded-lg border border-purple-100 bg-purple-50/40 p-2">
                                    <label className="block text-[9px] font-bold text-purple-900 uppercase">Target Product</label>
                                    <select
                                      value={catItem.productId || ""}
                                      onChange={(e) => {
                                        const prId = e.target.value;
                                        const prObj = siteProducts.find(p => p.id === prId);
                                        const updated = catArr.map((i) =>
                                          i.id === catItem.id ? { ...i, productId: prId, href: prObj?.url || i.href, destinationType: "product" } : i
                                        );
                                        updateSelectedProp("megaMenuItems", updated);
                                      }}
                                      className="w-full rounded border border-purple-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none"
                                    >
                                      <option value="">-- Select Product --</option>
                                      {siteProducts.map((prod) => (
                                        <option key={prod.id} value={prod.id}>{prod.name} ({prod.price})</option>
                                      ))}
                                    </select>
                                  </div>
                                )}

                                {(!catItem.destinationType || catItem.destinationType === "url") && (
                                  <div>
                                    <label className="block text-[9px] font-semibold text-slate-500 mb-0.5">Link Href / URL</label>
                                    <input
                                      type="text"
                                      value={catItem.href || ""}
                                      onChange={(e) => {
                                        const updated = catArr.map((i) =>
                                          i.id === catItem.id ? { ...i, href: e.target.value } : i
                                        );
                                        updateSelectedProp("megaMenuItems", updated);
                                      }}
                                      placeholder="# (optional direct link)"
                                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-mono text-slate-800 outline-none focus:border-blue-500"
                                    />
                                  </div>
                                )}

                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[9px] font-semibold text-slate-500 mb-0.5">Badge (e.g. New)</label>
                                    <input
                                      type="text"
                                      value={catItem.badge || ""}
                                      onChange={(e) => {
                                        const updated = catArr.map((i) =>
                                          i.id === catItem.id ? { ...i, badge: e.target.value } : i
                                        );
                                        updateSelectedProp("megaMenuItems", updated);
                                      }}
                                      placeholder="New / Pro"
                                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[9px] font-semibold text-slate-500 mb-0.5">Icon / Emoji</label>
                                    <input
                                      type="text"
                                      value={catItem.icon || ""}
                                      onChange={(e) => {
                                        const updated = catArr.map((i) =>
                                          i.id === catItem.id ? { ...i, icon: e.target.value } : i
                                        );
                                        updateSelectedProp("megaMenuItems", updated);
                                      }}
                                      placeholder="e.g. 📦"
                                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none"
                                    />
                                  </div>
                                </div>

                                {/* Columns Manager */}
                                <div className="mt-3 pl-3 border-l-2 border-blue-400 space-y-2 bg-blue-50/20 p-2.5 rounded-r-xl">
                                  <div className="flex items-center justify-between">
                                    <span className="block text-[10px] font-bold text-blue-900 uppercase tracking-wider">
                                      Mega Columns ({catItem.columns?.length || 0})
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const cols = catItem.columns || [];
                                        const newCol: MegaMenuColumn = {
                                          id: `col_${Date.now()}`,
                                          title: `Column ${cols.length + 1}`,
                                          links: [
                                            { label: "New Column Link", href: "#" },
                                          ],
                                        };
                                        const updated = catArr.map((i) =>
                                          i.id === catItem.id ? { ...i, columns: [...cols, newCol] } : i
                                        );
                                        updateSelectedProp("megaMenuItems", updated);
                                      }}
                                      className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                                    >
                                      + Add Column
                                    </button>
                                  </div>

                                  {catItem.columns?.map((col, colIdx) => (
                                    <div key={col.id || `col_${colIdx}`} className="rounded-xl border border-slate-200 bg-white p-2.5 space-y-2">
                                      <div className="flex items-center justify-between gap-1 pb-1 border-b border-slate-100">
                                        <span className="text-[10px] font-bold text-slate-700">Column #{colIdx + 1}</span>
                                        <div className="flex items-center gap-1">
                                          <button
                                            type="button"
                                            disabled={colIdx === 0}
                                            onClick={() => {
                                              const cols = [...catItem.columns!];
                                              const temp = cols[colIdx - 1];
                                              cols[colIdx - 1] = cols[colIdx];
                                              cols[colIdx] = temp;
                                              const updated = catArr.map((i) =>
                                                i.id === catItem.id ? { ...i, columns: cols } : i
                                              );
                                              updateSelectedProp("megaMenuItems", updated);
                                            }}
                                            className="h-4 w-4 rounded border border-slate-200 text-[9px] text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                                          >
                                            ↑
                                          </button>
                                          <button
                                            type="button"
                                            disabled={colIdx === catItem.columns!.length - 1}
                                            onClick={() => {
                                              const cols = [...catItem.columns!];
                                              const temp = cols[colIdx + 1];
                                              cols[colIdx + 1] = cols[colIdx];
                                              cols[colIdx] = temp;
                                              const updated = catArr.map((i) =>
                                                i.id === catItem.id ? { ...i, columns: cols } : i
                                              );
                                              updateSelectedProp("megaMenuItems", updated);
                                            }}
                                            className="h-4 w-4 rounded border border-slate-200 text-[9px] text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                                          >
                                            ↓
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const cols = catItem.columns!.filter((_, idx) => idx !== colIdx);
                                              const updated = catArr.map((i) =>
                                                i.id === catItem.id ? { ...i, columns: cols } : i
                                              );
                                              updateSelectedProp("megaMenuItems", updated);
                                            }}
                                            className="h-4 w-4 shrink-0 rounded border border-red-200 bg-red-50 text-[9px] font-bold text-red-600 hover:bg-red-100 cursor-pointer flex items-center justify-center"
                                            title="Delete Column"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      </div>

                                      <div>
                                        <label className="block text-[9px] font-semibold text-slate-400 mb-0.5">Column Header Title</label>
                                        <input
                                          type="text"
                                          value={col.title}
                                          onChange={(e) => {
                                            const cols = catItem.columns!.map((c, idx) =>
                                              idx === colIdx ? { ...c, title: e.target.value } : c
                                            );
                                            const updated = catArr.map((i) =>
                                              i.id === catItem.id ? { ...i, columns: cols } : i
                                            );
                                            updateSelectedProp("megaMenuItems", updated);
                                          }}
                                          className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-800 outline-none"
                                        />
                                      </div>

                                      {/* Column Links */}
                                      <div className="space-y-1.5 pt-1">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[9px] font-bold text-slate-500 uppercase">
                                            Links ({col.links.length})
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const newLink: MegaMenuColumnLink = {
                                                id: `link_${Date.now()}`,
                                                label: `New Link ${col.links.length + 1}`,
                                                href: "#",
                                              };
                                              const cols = catItem.columns!.map((c, idx) =>
                                                idx === colIdx ? { ...c, links: [...c.links, newLink] } : c
                                              );
                                              const updated = catArr.map((i) =>
                                                i.id === catItem.id ? { ...i, columns: cols } : i
                                              );
                                              updateSelectedProp("megaMenuItems", updated);
                                            }}
                                            className="text-[9px] font-bold text-blue-600 hover:underline cursor-pointer"
                                          >
                                            + Add Link
                                          </button>
                                        </div>

                                        {col.links.map((link, lIdx) => (
                                          <div key={link.id || `l_${lIdx}`} className="rounded border border-slate-100 bg-slate-50 p-2 space-y-1">
                                            <div className="flex items-center justify-between gap-1">
                                              <span className="text-[9px] font-bold text-slate-600">Link #{lIdx + 1}</span>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const newLinks = col.links.filter((_, idx) => idx !== lIdx);
                                                  const cols = catItem.columns!.map((c, idx) =>
                                                    idx === colIdx ? { ...c, links: newLinks } : c
                                                  );
                                                  const updated = catArr.map((i) =>
                                                    i.id === catItem.id ? { ...i, columns: cols } : i
                                                  );
                                                  updateSelectedProp("megaMenuItems", updated);
                                                }}
                                                className="h-3.5 w-3.5 rounded border border-red-200 bg-red-50 text-[8px] text-red-600 hover:bg-red-100 cursor-pointer flex items-center justify-center"
                                                title="Delete Link"
                                              >
                                                ✕
                                              </button>
                                            </div>

                                            <div className="grid grid-cols-2 gap-1">
                                              <input
                                                type="text"
                                                value={link.label}
                                                onChange={(e) => {
                                                  const newLinks = col.links.map((l, idx) =>
                                                    idx === lIdx ? { ...l, label: e.target.value } : l
                                                  );
                                                  const cols = catItem.columns!.map((c, idx) =>
                                                    idx === colIdx ? { ...c, links: newLinks } : c
                                                  );
                                                  const updated = catArr.map((i) =>
                                                    i.id === catItem.id ? { ...i, columns: cols } : i
                                                  );
                                                  updateSelectedProp("megaMenuItems", updated);
                                                }}
                                                placeholder="Link Label"
                                                className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-800 outline-none"
                                              />
                                              <select
                                                value={link.destinationType || (link.pageId ? "page" : link.productId ? "product" : "url")}
                                                onChange={(e) => {
                                                  const val = e.target.value as "url" | "page" | "product";
                                                  const newLinks = col.links.map((l, idx) =>
                                                    idx === lIdx ? { ...l, destinationType: val, linkType: val } : l
                                                  );
                                                  const cols = catItem.columns!.map((c, idx) =>
                                                    idx === colIdx ? { ...c, links: newLinks } : c
                                                  );
                                                  const updated = catArr.map((i) =>
                                                    i.id === catItem.id ? { ...i, columns: cols } : i
                                                  );
                                                  updateSelectedProp("megaMenuItems", updated);
                                                }}
                                                className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px] font-semibold text-slate-800 outline-none"
                                              >
                                                <option value="url">URL</option>
                                                <option value="page">Page</option>
                                                <option value="product">Product</option>
                                              </select>
                                            </div>

                                            {link.destinationType === "page" ? (
                                              <select
                                                value={link.pageId || ""}
                                                onChange={(e) => {
                                                  const pId = e.target.value;
                                                  const pObj = pages.find(p => p.id === pId);
                                                  const newLinks = col.links.map((l, idx) =>
                                                    idx === lIdx ? { ...l, pageId: pId, href: pObj?.slug || l.href } : l
                                                  );
                                                  const cols = catItem.columns!.map((c, idx) =>
                                                    idx === colIdx ? { ...c, links: newLinks } : c
                                                  );
                                                  const updated = catArr.map((i) =>
                                                    i.id === catItem.id ? { ...i, columns: cols } : i
                                                  );
                                                  updateSelectedProp("megaMenuItems", updated);
                                                }}
                                                className="w-full rounded border border-blue-200 bg-blue-50/50 px-1.5 py-0.5 text-[10px] font-medium text-slate-800 outline-none"
                                              >
                                                <option value="">-- Select Page --</option>
                                                {pages.map((p) => (
                                                  <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                              </select>
                                            ) : link.destinationType === "product" ? (
                                              <select
                                                value={link.productId || ""}
                                                onChange={(e) => {
                                                  const prId = e.target.value;
                                                  const prObj = siteProducts.find(p => p.id === prId);
                                                  const newLinks = col.links.map((l, idx) =>
                                                    idx === lIdx ? { ...l, productId: prId, href: prObj?.url || l.href } : l
                                                  );
                                                  const cols = catItem.columns!.map((c, idx) =>
                                                    idx === colIdx ? { ...c, links: newLinks } : c
                                                  );
                                                  const updated = catArr.map((i) =>
                                                    i.id === catItem.id ? { ...i, columns: cols } : i
                                                  );
                                                  updateSelectedProp("megaMenuItems", updated);
                                                }}
                                                className="w-full rounded border border-purple-200 bg-purple-50/50 px-1.5 py-0.5 text-[10px] font-medium text-slate-800 outline-none"
                                              >
                                                <option value="">-- Select Product --</option>
                                                {siteProducts.map((p) => (
                                                  <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                              </select>
                                            ) : (
                                              <input
                                                type="text"
                                                value={link.href}
                                                onChange={(e) => {
                                                  const newLinks = col.links.map((l, idx) =>
                                                    idx === lIdx ? { ...l, href: e.target.value } : l
                                                  );
                                                  const cols = catItem.columns!.map((c, idx) =>
                                                    idx === colIdx ? { ...c, links: newLinks } : c
                                                  );
                                                  const updated = catArr.map((i) =>
                                                    i.id === catItem.id ? { ...i, columns: cols } : i
                                                  );
                                                  updateSelectedProp("megaMenuItems", updated);
                                                }}
                                                placeholder="Href / URL"
                                                className="w-full rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-mono text-slate-800 outline-none"
                                              />
                                            )}

                                            <div className="grid grid-cols-2 gap-1">
                                              <input
                                                type="text"
                                                value={link.description || ""}
                                                onChange={(e) => {
                                                  const newLinks = col.links.map((l, idx) =>
                                                    idx === lIdx ? { ...l, description: e.target.value } : l
                                                  );
                                                  const cols = catItem.columns!.map((c, idx) =>
                                                    idx === colIdx ? { ...c, links: newLinks } : c
                                                  );
                                                  const updated = catArr.map((i) =>
                                                    i.id === catItem.id ? { ...i, columns: cols } : i
                                                  );
                                                  updateSelectedProp("megaMenuItems", updated);
                                                }}
                                                placeholder="Description (optional)"
                                                className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-700 outline-none"
                                              />
                                              <input
                                                type="text"
                                                value={link.badge || ""}
                                                onChange={(e) => {
                                                  const newLinks = col.links.map((l, idx) =>
                                                    idx === lIdx ? { ...l, badge: e.target.value } : l
                                                  );
                                                  const cols = catItem.columns!.map((c, idx) =>
                                                    idx === colIdx ? { ...c, links: newLinks } : c
                                                  );
                                                  const updated = catArr.map((i) =>
                                                    i.id === catItem.id ? { ...i, columns: cols } : i
                                                  );
                                                  updateSelectedProp("megaMenuItems", updated);
                                                }}
                                                placeholder="Badge (e.g. New)"
                                                className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-700 outline-none"
                                              />
                                            </div>

                                            <input
                                              type="text"
                                              value={link.image || ""}
                                              onChange={(e) => {
                                                const newLinks = col.links.map((l, idx) =>
                                                  idx === lIdx ? { ...l, image: e.target.value } : l
                                                );
                                                const cols = catItem.columns!.map((c, idx) =>
                                                  idx === colIdx ? { ...c, links: newLinks } : c
                                                );
                                                const updated = catArr.map((i) =>
                                                  i.id === catItem.id ? { ...i, columns: cols } : i
                                                );
                                                updateSelectedProp("megaMenuItems", updated);
                                              }}
                                              placeholder="Image URL (optional)"
                                              className="w-full rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-mono text-slate-700 outline-none"
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Off Canvas Inspector Panel (F-206) */}
                    {selectedElementAny.type === "off-canvas" && (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                            <OffCanvasBoxIcon />
                            <span>Off Canvas Panel Settings</span>
                          </span>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">Trigger Button Text</label>
                            <input
                              type="text"
                              value={selectedElementAny.offCanvasButtonText || "Open Panel"}
                              onChange={(e) => updateSelectedProp("offCanvasButtonText", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">Panel Title</label>
                            <input
                              type="text"
                              value={selectedElementAny.offCanvasTitle || "Navigation & Tools"}
                              onChange={(e) => updateSelectedProp("offCanvasTitle", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Position</label>
                              <select
                                value={selectedElementAny.offCanvasPosition || "right"}
                                onChange={(e) => updateSelectedProp("offCanvasPosition", e.target.value as any)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              >
                                <option value="right">Slide Right</option>
                                <option value="left">Slide Left</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Panel Width</label>
                              <input
                                type="text"
                                value={selectedElementAny.offCanvasWidth || "340px"}
                                onChange={(e) => updateSelectedProp("offCanvasWidth", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Image Carousel Inspector Panel (F-210) */}
                    {selectedElementAny.type === "image-carousel" && (() => {
                      const items: ImageCarouselItem[] = selectedElementAny.imageCarouselItems || [];
                      return (
                        <div className="space-y-4">
                          {/* CONTENT SECTION */}
                          <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 space-y-3">
                            <div className="flex items-center justify-between border-b border-blue-200/60 pb-2">
                              <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                                <span>🖼️</span>
                                <span>CONTENT — Images ({items.length})</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const newItem: ImageCarouselItem = {
                                    id: "img_" + Math.random().toString(36).substring(2, 9),
                                    url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
                                    title: `Image Slide ${items.length + 1}`,
                                    caption: "New Carousel Image",
                                    alt: "Carousel Image",
                                  };
                                  updateSelectedProp("imageCarouselItems", [...items, newItem]);
                                }}
                                className="rounded bg-blue-600 px-2 py-1 text-[10px] font-bold text-white shadow-2xs hover:bg-blue-700 transition cursor-pointer"
                              >
                                + Add Image
                              </button>
                            </div>

                            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                              {items.map((item, idx) => (
                                <div key={item.id || idx} className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-2xs space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="flex h-5 w-5 items-center justify-center rounded bg-blue-100 text-[10px] font-bold text-blue-700">
                                        {idx + 1}
                                      </span>
                                      {item.url && (
                                        <img src={item.url} alt={item.title || "thumbnail"} className="h-6 w-8 object-cover rounded border border-slate-200" />
                                      )}
                                      <span className="text-xs font-bold text-slate-800 truncate max-w-[120px]">
                                        {item.title || `Image ${idx + 1}`}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        disabled={idx === 0}
                                        onClick={() => {
                                          const updated = [...items];
                                          const temp = updated[idx];
                                          updated[idx] = updated[idx - 1];
                                          updated[idx - 1] = temp;
                                          updateSelectedProp("imageCarouselItems", updated);
                                        }}
                                        className="px-1 py-0.5 text-[10px] font-bold text-slate-500 hover:text-blue-600 disabled:opacity-30 cursor-pointer"
                                        title="Move Up"
                                      >
                                        ▲
                                      </button>
                                      <button
                                        type="button"
                                        disabled={idx === items.length - 1}
                                        onClick={() => {
                                          const updated = [...items];
                                          const temp = updated[idx];
                                          updated[idx] = updated[idx + 1];
                                          updated[idx + 1] = temp;
                                          updateSelectedProp("imageCarouselItems", updated);
                                        }}
                                        className="px-1 py-0.5 text-[10px] font-bold text-slate-500 hover:text-blue-600 disabled:opacity-30 cursor-pointer"
                                        title="Move Down"
                                      >
                                        ▼
                                      </button>
                                      {items.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updated = items.filter((_, i) => i !== idx);
                                            updateSelectedProp("imageCarouselItems", updated);
                                          }}
                                          className="text-[10px] font-bold text-red-500 hover:text-red-700 hover:underline ml-1 cursor-pointer"
                                        >
                                          Remove
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="flex items-center justify-between mb-0.5">
                                      <label className="block text-[10px] font-semibold text-slate-500">Image Source URL *</label>
                                      <label className="text-[9px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer">
                                        📁 Upload File
                                        <input
                                          type="file"
                                          accept="image/*"
                                          className="hidden"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              const reader = new FileReader();
                                              reader.onloadend = () => {
                                                if (typeof reader.result === "string") {
                                                  const updated = [...items];
                                                  updated[idx] = { ...updated[idx], url: reader.result };
                                                  updateSelectedProp("imageCarouselItems", updated);
                                                }
                                              };
                                              reader.readAsDataURL(file);
                                            }
                                          }}
                                        />
                                      </label>
                                    </div>
                                    <input
                                      type="text"
                                      value={item.url || ""}
                                      onChange={(e) => {
                                        const updated = [...items];
                                        updated[idx] = { ...updated[idx], url: e.target.value };
                                        updateSelectedProp("imageCarouselItems", updated);
                                      }}
                                      placeholder="https://images.unsplash.com/..."
                                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-mono text-slate-800 outline-none focus:border-blue-500"
                                    />
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Title</label>
                                      <input
                                        type="text"
                                        value={item.title || ""}
                                        onChange={(e) => {
                                          const updated = [...items];
                                          updated[idx] = { ...updated[idx], title: e.target.value };
                                          updateSelectedProp("imageCarouselItems", updated);
                                        }}
                                        placeholder="Slide Title"
                                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Alt Text</label>
                                      <input
                                        type="text"
                                        value={item.alt || ""}
                                        onChange={(e) => {
                                          const updated = [...items];
                                          updated[idx] = { ...updated[idx], alt: e.target.value };
                                          updateSelectedProp("imageCarouselItems", updated);
                                        }}
                                        placeholder="Image Alt Text"
                                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                                      />
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Caption Overlay</label>
                                      <input
                                        type="text"
                                        value={item.caption || ""}
                                        onChange={(e) => {
                                          const updated = [...items];
                                          updated[idx] = { ...updated[idx], caption: e.target.value };
                                          updateSelectedProp("imageCarouselItems", updated);
                                        }}
                                        placeholder="Short Caption"
                                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Click Link URL</label>
                                      <input
                                        type="text"
                                        value={item.linkUrl || ""}
                                        onChange={(e) => {
                                          const updated = [...items];
                                          updated[idx] = { ...updated[idx], linkUrl: e.target.value };
                                          updateSelectedProp("imageCarouselItems", updated);
                                        }}
                                        placeholder="https://..."
                                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* SLIDES SECTION */}
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                            <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">SLIDES — Sizing & Ratio</span>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Image Sizing</label>
                                <select
                                  value={selectedElementAny.imageCarouselImageSizing || "cover"}
                                  onChange={(e) => updateSelectedProp("imageCarouselImageSizing", e.target.value as any)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                                >
                                  <option value="cover">Cover (Fill & Crop)</option>
                                  <option value="contain">Contain (Fit inside)</option>
                                  <option value="fill">Fill (Stretch)</option>
                                  <option value="auto">Auto Original</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Aspect Ratio</label>
                                <select
                                  value={selectedElementAny.imageCarouselAspectRatio || "landscape"}
                                  onChange={(e) => updateSelectedProp("imageCarouselAspectRatio", e.target.value as any)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                                >
                                  <option value="landscape">Landscape (16:10)</option>
                                  <option value="video">Video (16:9)</option>
                                  <option value="square">Square (1:1)</option>
                                  <option value="portrait">Portrait (3:4)</option>
                                  <option value="auto">Custom Height</option>
                                </select>
                              </div>
                            </div>

                            {selectedElementAny.imageCarouselAspectRatio === "auto" && (
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Slide Fixed Height</label>
                                <input
                                  type="text"
                                  value={selectedElementAny.imageCarouselHeight || "320px"}
                                  onChange={(e) => updateSelectedProp("imageCarouselHeight", e.target.value)}
                                  placeholder="e.g. 320px or 40vh"
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            )}

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Slide Corner Radius</label>
                              <input
                                type="text"
                                value={selectedElementAny.imageCarouselBorderRadius || "16px"}
                                onChange={(e) => updateSelectedProp("imageCarouselBorderRadius", e.target.value)}
                                placeholder="e.g. 16px"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                              />
                            </div>
                          </div>

                          {/* NAVIGATION SECTION */}
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                            <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">NAVIGATION</span>
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedElementAny.imageCarouselShowNav !== false}
                                  onChange={(e) => updateSelectedProp("imageCarouselShowNav", e.target.checked)}
                                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <span>Show Previous / Next Arrows</span>
                              </label>
                            </div>

                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedElementAny.imageCarouselShowDots !== false}
                                  onChange={(e) => updateSelectedProp("imageCarouselShowDots", e.target.checked)}
                                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <span>Show Pagination Dots</span>
                              </label>
                            </div>
                          </div>

                          {/* AUTOPLAY SECTION */}
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                            <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">AUTOPLAY & LOOP</span>
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedElementAny.imageCarouselAutoplay !== false}
                                  onChange={(e) => updateSelectedProp("imageCarouselAutoplay", e.target.checked)}
                                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <span>Enable Autoplay</span>
                              </label>
                            </div>

                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedElementAny.imageCarouselLoop !== false}
                                  onChange={(e) => updateSelectedProp("imageCarouselLoop", e.target.checked)}
                                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <span>Infinite Loop Rotation</span>
                              </label>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Autoplay Speed ({selectedElementAny.imageCarouselAutoplaySpeed ?? 3000} ms)
                              </label>
                              <input
                                type="range"
                                min={1000}
                                max={8000}
                                step={500}
                                value={selectedElementAny.imageCarouselAutoplaySpeed ?? 3000}
                                onChange={(e) => updateSelectedProp("imageCarouselAutoplaySpeed", parseInt(e.target.value))}
                                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Transition Type</label>
                              <select
                                value={selectedElementAny.imageCarouselTransition || "slide"}
                                onChange={(e) => updateSelectedProp("imageCarouselTransition", e.target.value as any)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              >
                                <option value="slide">Slide Track</option>
                                <option value="fade">Fade In/Out</option>
                              </select>
                            </div>
                          </div>

                          {/* LAYOUT SECTION */}
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                            <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">LAYOUT & RESPONSIVE</span>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Slides Per View (Desktop)</label>
                                <select
                                  value={selectedElementAny.imageCarouselSlidesPerView ?? 3}
                                  onChange={(e) => updateSelectedProp("imageCarouselSlidesPerView", parseInt(e.target.value))}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                                >
                                  <option value={1}>1 Slide</option>
                                  <option value={2}>2 Slides</option>
                                  <option value={3}>3 Slides</option>
                                  <option value={4}>4 Slides</option>
                                  <option value={5}>5 Slides</option>
                                  <option value={6}>6 Slides</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Gap Between Slides (px)</label>
                                <input
                                  type="number"
                                  min={0}
                                  max={40}
                                  value={selectedElementAny.imageCarouselGap ?? 16}
                                  onChange={(e) => updateSelectedProp("imageCarouselGap", parseInt(e.target.value) || 0)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Widget Alignment</label>
                              <div className="grid grid-cols-3 gap-1 bg-slate-200/60 p-1 rounded-lg">
                                {(["left", "center", "right"] as const).map((align) => (
                                  <button
                                    key={align}
                                    type="button"
                                    onClick={() => updateSelectedProp("imageCarouselAlignment", align)}
                                    className={`py-1 text-xs font-bold capitalize rounded-md transition cursor-pointer ${(selectedElementAny.imageCarouselAlignment || "center") === align
                                      ? "bg-white text-blue-700 shadow-2xs"
                                      : "text-slate-600 hover:text-slate-900"
                                      }`}
                                  >
                                    {align}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Heading Level Selector (F-191) */}
                    {selectedElementAny.type === "heading" && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Heading Level Tag
                        </label>
                        <select
                          value={selectedElementAny.headingLevel || "h2"}
                          onChange={(e) => updateSelectedProp("headingLevel", e.target.value as "h1" | "h2" | "h3" | "h4" | "h5" | "h6")}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="h1">H1 - Main Page Heading</option>
                          <option value="h2">H2 - Section Heading</option>
                          <option value="h3">H3 - Sub-section Heading</option>
                          <option value="h4">H4 - Minor Heading</option>
                          <option value="h5">H5 - Small Heading</option>
                          <option value="h6">H6 - Tiny Heading</option>
                        </select>
                      </div>
                    )}

                    {/* Content Input */}
                    {selectedElementAny.type !== "image" && selectedElementAny.type !== "video" && selectedElementAny.type !== "container" && selectedElementAny.type !== "posts" && selectedElementAny.type !== "share-buttons" && selectedElementAny.type !== "portfolio" && selectedElementAny.type !== "slides" && selectedElementAny.type !== "form" && selectedElementAny.type !== "login" && selectedElementAny.type !== "nav-menu" && selectedElementAny.type !== "animated-headline" && selectedElementAny.type !== "price-table" && selectedElementAny.type !== "price-list" && selectedElementAny.type !== "gallery" && selectedElementAny.type !== "flip-box" && selectedElementAny.type !== "call-to-action" && selectedElementAny.type !== "media-carousel" && selectedElementAny.type !== "testimonial-carousel" && selectedElementAny.type !== "nested-carousel" && selectedElementAny.type !== "loop-carousel" && selectedElementAny.type !== "table-of-contents" && selectedElementAny.type !== "countdown" && selectedElementAny.type !== "facebook-page" && selectedElementAny.type !== "blockquote" && selectedElementAny.type !== "template" && selectedElementAny.type !== "reviews" && selectedElementAny.type !== "facebook-button" && selectedElementAny.type !== "facebook-embed" && selectedElementAny.type !== "facebook-comments" && selectedElementAny.type !== "paypal-button" && selectedElementAny.type !== "stripe-button" && selectedElementAny.type !== "lottie" && selectedElementAny.type !== "code-highlight" && selectedElementAny.type !== "video-playlist" && selectedElementAny.type !== "mega-menu" && selectedElementAny.type !== "off-canvas" && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Text
                        </label>
                        <textarea
                          rows={selectedElementAny.type === "text" ? 3 : 2}
                          value={selectedElementAny.content}
                          onChange={(e) => updateSelectedProp("content", e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    )}

                    {/* Advanced Typography Section */}
                    {renderTypographySection()}

                    {/* Text Color Input */}
                    {selectedElementAny.type !== "image" && selectedElementAny.type !== "video" && selectedElementAny.type !== "video-playlist" && selectedElementAny.type !== "posts" && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-slate-700">
                            Text Color
                          </label>
                          {isControlStyleConfigured(selectedElementAny, activeDevice, activeElementState, "color") && (
                            <button
                              type="button"
                              onClick={() => resetSelectedStyle("color")}
                              title="Reset Text Color to Default"
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
                          <button
                            type="button"
                            onClick={() => handleSampleColor((hex) => updateSelectedStyle("color", hex))}
                            title="Sample Color from Screen / Image"
                            className="h-8 px-2 rounded border border-slate-300 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-xs font-bold text-slate-700 hover:text-blue-600 transition flex items-center gap-1 shrink-0"
                          >
                            <span>🧪</span>
                            <span className="text-[10px]">Sample</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Alignment */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Alignment
                      </label>
                      <select
                        value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "textAlign") || "left"}
                        onChange={(e) => updateSelectedStyle("textAlign", e.target.value as any)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                        <option value="justify">Justify</option>
                      </select>
                    </div>

                    {/* Button Href Link */}
                    {selectedElementAny.type === "button" && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Button Link (URL)
                        </label>
                        <input
                          type="text"
                          value={selectedElementAny.href || "#"}
                          onChange={(e) => updateSelectedProp("href", e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-medium text-slate-800 outline-none focus:border-blue-500"
                        />
                      </div>
                    )}

                    {/* Button Background Color */}
                    {selectedElementAny.type === "button" && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-slate-700">
                            Button Color
                          </label>
                          {isControlStyleConfigured(selectedElementAny, activeDevice, activeElementState, "backgroundColor") && (
                            <button
                              type="button"
                              onClick={() => resetSelectedStyle("backgroundColor")}
                              title="Reset Button Color to Default"
                              className="text-[10px] font-semibold text-slate-500 hover:text-blue-600 hover:underline"
                            >
                              ↺ Reset
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "backgroundColor") || "#2563eb"}
                            onChange={(e) => updateSelectedStyle("backgroundColor", e.target.value)}
                            className="h-8 w-10 cursor-pointer rounded border border-slate-300 bg-transparent p-0.5"
                          />
                          <input
                            type="text"
                            value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "backgroundColor") || "#2563eb"}
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
                    )}

                    {/* Video Widget Inspector Panel (F-208) */}
                    {selectedElementAny.type === "video" && (
                      <div className="space-y-6 pt-2 border-t border-slate-100">
                        {/* Hidden file input for video file */}
                        <input
                          id="video-file-input"
                          type="file"
                          accept="video/mp4,video/webm,video/ogg,video/quicktime"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleVideoFileSelect(e.target.files[0]);
                            }
                          }}
                        />

                        {/* Hidden file input for video poster image */}
                        <input
                          id="video-poster-input"
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleVideoPosterSelect(e.target.files[0]);
                            }
                          }}
                        />

                        {/* CONTENT SECTION */}
                        <div className="space-y-3">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1 flex items-center justify-between">
                            <span>Content</span>
                            <span className="text-[10px] text-blue-600 font-normal">Source & Poster</span>
                          </h3>

                          {/* Video Source Input & Upload Trigger */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-xs font-semibold text-slate-700">
                                Video Source URL
                              </label>
                              <button
                                type="button"
                                disabled={isUploading}
                                onClick={() => document.getElementById("video-file-input")?.click()}
                                className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1 disabled:opacity-50"
                              >
                                <span>📁</span>
                                <span>{isUploading ? "Uploading..." : "Browse Video File"}</span>
                              </button>
                            </div>
                            <input
                              type="text"
                              value={selectedElementAny.src || ""}
                              onChange={(e) => updateSelectedProp("src", e.target.value)}
                              placeholder="YouTube, Vimeo, or MP4 URL..."
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-medium text-slate-800 outline-none focus:border-blue-500"
                            />
                            <p className="mt-1 text-[10px] text-slate-400">
                              Supports YouTube (`youtu.be`), Vimeo (`vimeo.com`), and direct `.mp4` video files
                            </p>
                          </div>

                          {/* Video Poster Image Input */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-xs font-semibold text-slate-700">
                                Poster Image URL (HTML5)
                              </label>
                              <button
                                type="button"
                                disabled={isUploading}
                                onClick={() => document.getElementById("video-poster-input")?.click()}
                                className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1 disabled:opacity-50"
                              >
                                <span>🖼️</span>
                                <span>{isUploading ? "Uploading..." : "Browse Image"}</span>
                              </button>
                            </div>
                            <input
                              type="text"
                              value={selectedElementAny.videoPoster || ""}
                              onChange={(e) => updateSelectedProp("videoPoster", e.target.value)}
                              placeholder="https://.../poster.jpg"
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-medium text-slate-800 outline-none focus:border-blue-500"
                            />
                            {selectedElementAny.videoPoster && (
                              <div className="mt-2 flex items-center gap-2">
                                <img
                                  src={resolveImageUrl(selectedElementAny.videoPoster, apiUrl)}
                                  alt="Poster preview"
                                  className="h-10 w-16 object-cover rounded border border-slate-200 bg-slate-100"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateSelectedProp("videoPoster", "")}
                                  className="text-[10px] font-bold text-red-500 hover:underline"
                                >
                                  Remove Poster
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* PLAYBACK SECTION */}
                        <div className="space-y-3 pt-3 border-t border-slate-200">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1">
                            Playback Controls
                          </h3>

                          <div className="grid grid-cols-2 gap-3">
                            {/* Show Controls */}
                            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 cursor-pointer hover:bg-slate-100 transition">
                              <input
                                type="checkbox"
                                checked={selectedElementAny.videoControls !== false}
                                onChange={(e) => updateSelectedProp("videoControls", e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-xs font-medium text-slate-700">Show Controls</span>
                            </label>

                            {/* Autoplay */}
                            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 cursor-pointer hover:bg-slate-100 transition">
                              <input
                                type="checkbox"
                                checked={Boolean(selectedElementAny.videoAutoplay)}
                                onChange={(e) => updateSelectedProp("videoAutoplay", e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-xs font-medium text-slate-700">Autoplay</span>
                            </label>

                            {/* Loop */}
                            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 cursor-pointer hover:bg-slate-100 transition">
                              <input
                                type="checkbox"
                                checked={Boolean(selectedElementAny.videoLoop)}
                                onChange={(e) => updateSelectedProp("videoLoop", e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-xs font-medium text-slate-700">Loop</span>
                            </label>

                            {/* Muted */}
                            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 cursor-pointer hover:bg-slate-100 transition">
                              <input
                                type="checkbox"
                                checked={Boolean(selectedElementAny.videoMuted)}
                                onChange={(e) => updateSelectedProp("videoMuted", e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-xs font-medium text-slate-700">Muted</span>
                            </label>
                          </div>
                        </div>

                        {/* LAYOUT SECTION */}
                        <div className="space-y-3 pt-3 border-t border-slate-200">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1">
                            Layout & Alignment
                          </h3>

                          {/* Width & Height */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Width
                              </label>
                              <select
                                value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "width") || "100%"}
                                onChange={(e) => updateSelectedStyle("width", e.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                              >
                                <option value="100%">100% (Full Width)</option>
                                <option value="80%">80%</option>
                                <option value="60%">60%</option>
                                <option value="50%">50%</option>
                                <option value="auto">Auto</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Height
                              </label>
                              <select
                                value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "height") || "auto"}
                                onChange={(e) => updateSelectedStyle("height", e.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                              >
                                <option value="auto">Auto (16:9 Aspect)</option>
                                <option value="250px">250px</option>
                                <option value="350px">350px</option>
                                <option value="450px">450px</option>
                                <option value="550px">550px</option>
                              </select>
                            </div>
                          </div>

                          {/* Alignment */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Alignment
                            </label>
                            <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
                              {(["left", "center", "right"] as const).map((align) => {
                                const currentAlign = getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "textAlign") || "left";
                                const isActive = currentAlign === align;
                                return (
                                  <button
                                    key={align}
                                    type="button"
                                    onClick={() => updateSelectedStyle("textAlign", align)}
                                    className={`rounded-md py-1 text-xs font-semibold capitalize transition ${isActive
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
                        </div>

                        {/* STYLE SECTION */}
                        <div className="space-y-3 pt-3 border-t border-slate-200">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1">
                            Style & Border
                          </h3>

                          {/* Border Radius */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Border Radius
                            </label>
                            <select
                              value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "borderRadius") || "8px"}
                              onChange={(e) => updateSelectedStyle("borderRadius", e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                            >
                              <option value="0px">0px (Square Sharp)</option>
                              <option value="4px">4px (Small)</option>
                              <option value="8px">8px (Medium Rounded)</option>
                              <option value="16px">16px (Large Rounded)</option>
                              <option value="24px">24px (Extra Rounded)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Video Playlist Inspector Panel (F-209) */}
                    {selectedElementAny.type === "video-playlist" && (
                      <div className="space-y-6 pt-2 border-t border-slate-100">
                        {/* PLAYLIST ITEMS MANAGEMENT */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                              <span>📺</span>
                              <span>Playlist Videos</span>
                            </h3>
                            <span className="text-[10px] font-semibold text-slate-400">
                              {(selectedElementAny.playlistItems || []).length} items
                            </span>
                          </div>

                          {/* Add Video Button */}
                          <button
                            type="button"
                            onClick={() => {
                              const items = selectedElementAny.playlistItems || [];
                              const newItemId = `vp_${Date.now()}`;
                              const newItem: PlaylistItem = {
                                id: newItemId,
                                title: `New Video ${items.length + 1}`,
                                url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                                videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                                duration: "03:00",
                              };
                              const updated = [...items, newItem];
                              updateSelectedProp("playlistItems", updated);
                              if (!selectedElementAny.playlistActiveId) {
                                updateSelectedProp("playlistActiveId", newItemId);
                              }
                            }}
                            className="w-full rounded-lg border border-dashed border-blue-400 bg-blue-50/50 py-2 text-xs font-bold text-blue-600 hover:bg-blue-100/60 transition flex items-center justify-center gap-1.5 shadow-2xs"
                          >
                            <span>➕</span>
                            <span>Add Video to Playlist</span>
                          </button>

                          {/* Playlist Item Cards */}
                          <div className="space-y-3 pt-1">
                            {(selectedElementAny.playlistItems || []).map((item: any, index: number) => {
                              const isActive = item.id === (selectedElementAny.playlistActiveId || selectedElementAny.playlistItems?.[0]?.id);
                              return (
                                <div
                                  key={item.id || index}
                                  className={`rounded-xl border p-3 transition space-y-2.5 ${isActive
                                    ? "border-blue-400 bg-blue-50/40 ring-1 ring-blue-400/50 shadow-xs"
                                    : "border-slate-200 bg-white hover:border-slate-300"
                                    }`}
                                >
                                  {/* Header & Item Actions */}
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => updateSelectedProp("playlistActiveId", item.id)}
                                        title={isActive ? "Currently Active Video" : "Set as Active Video"}
                                        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition ${isActive
                                          ? "bg-blue-600 text-white"
                                          : "bg-slate-200 text-slate-600 hover:bg-blue-500 hover:text-white"
                                          }`}
                                      >
                                        {isActive ? "▶" : index + 1}
                                      </button>
                                      <span className="text-xs font-bold text-slate-800">
                                        Video #{index + 1}
                                      </span>
                                      {isActive && (
                                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">
                                          Active
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1">
                                      {/* Move Up */}
                                      <button
                                        type="button"
                                        disabled={index === 0}
                                        onClick={() => {
                                          const items = [...(selectedElementAny.playlistItems || [])];
                                          if (index > 0) {
                                            const temp = items[index];
                                            items[index] = items[index - 1];
                                            items[index - 1] = temp;
                                            updateSelectedProp("playlistItems", items);
                                          }
                                        }}
                                        title="Move Up"
                                        className="h-6 w-6 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-white flex items-center justify-center text-xs"
                                      >
                                        ↑
                                      </button>

                                      {/* Move Down */}
                                      <button
                                        type="button"
                                        disabled={index === (selectedElementAny.playlistItems || []).length - 1}
                                        onClick={() => {
                                          const items = [...(selectedElementAny.playlistItems || [])];
                                          if (index < items.length - 1) {
                                            const temp = items[index];
                                            items[index] = items[index + 1];
                                            items[index + 1] = temp;
                                            updateSelectedProp("playlistItems", items);
                                          }
                                        }}
                                        title="Move Down"
                                        className="h-6 w-6 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-white flex items-center justify-center text-xs"
                                      >
                                        ↓
                                      </button>

                                      {/* Delete */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const items = (selectedElementAny.playlistItems || []).filter(
                                            (_: any, i: number) => i !== index
                                          );
                                          updateSelectedProp("playlistItems", items);
                                          if (selectedElementAny.playlistActiveId === item.id && items.length > 0) {
                                            updateSelectedProp("playlistActiveId", items[0].id);
                                          }
                                        }}
                                        title="Delete Video Item"
                                        className="h-6 w-6 rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center text-xs ml-1"
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  </div>

                                  {/* Title Input */}
                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                      Video Title
                                    </label>
                                    <input
                                      type="text"
                                      value={item.title || ""}
                                      onChange={(e) => {
                                        const items = [...(selectedElementAny.playlistItems || [])];
                                        items[index] = { ...items[index], title: e.target.value };
                                        updateSelectedProp("playlistItems", items);
                                      }}
                                      placeholder="e.g. 01. Introduction Overview"
                                      className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                                    />
                                  </div>

                                  {/* URL Input */}
                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                      Video URL (YouTube, Vimeo, MP4)
                                    </label>
                                    <input
                                      type="text"
                                      value={item.url || ""}
                                      onChange={(e) => {
                                        const items = [...(selectedElementAny.playlistItems || [])];
                                        items[index] = { ...items[index], url: e.target.value };
                                        updateSelectedProp("playlistItems", items);
                                      }}
                                      placeholder="https://www.youtube.com/watch?v=..."
                                      className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono font-medium text-slate-800 outline-none focus:border-blue-500"
                                    />
                                  </div>

                                  {/* Duration & Thumbnail URL Row */}
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                        Duration
                                      </label>
                                      <input
                                        type="text"
                                        value={item.duration || ""}
                                        onChange={(e) => {
                                          const items = [...(selectedElementAny.playlistItems || [])];
                                          items[index] = { ...items[index], duration: e.target.value };
                                          updateSelectedProp("playlistItems", items);
                                        }}
                                        placeholder="e.g. 04:30"
                                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none focus:border-blue-500"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                        Thumbnail URL
                                      </label>
                                      <input
                                        type="text"
                                        value={item.thumbnailUrl || ""}
                                        onChange={(e) => {
                                          const items = [...(selectedElementAny.playlistItems || [])];
                                          items[index] = { ...items[index], thumbnailUrl: e.target.value };
                                          updateSelectedProp("playlistItems", items);
                                        }}
                                        placeholder="https://.../thumb.jpg"
                                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none focus:border-blue-500"
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* LAYOUT SECTION */}
                        <div className="space-y-3 pt-3 border-t border-slate-200">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1">
                            Layout & Position
                          </h3>

                          {/* Playlist Position Selector */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Playlist Position
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => updateSelectedProp("playlistPosition", "right")}
                                className={`rounded-lg border p-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${(selectedElementAny.playlistPosition || "right") === "right"
                                  ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                                  }`}
                              >
                                <span>▶️</span>
                                <span>Right Sidebar</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => updateSelectedProp("playlistPosition", "bottom")}
                                className={`rounded-lg border p-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${selectedElementAny.playlistPosition === "bottom"
                                  ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                                  }`}
                              >
                                <span>🔽</span>
                                <span>Bottom List</span>
                              </button>
                            </div>
                          </div>

                          {/* Player Width Selector (Right Sidebar mode) */}
                          {(selectedElementAny.playlistPosition || "right") === "right" && (
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Player Portion Width
                              </label>
                              <select
                                value={selectedElementAny.playlistPlayerWidth || "65%"}
                                onChange={(e) => updateSelectedProp("playlistPlayerWidth", e.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                              >
                                <option value="60%">60% Player / 40% Playlist</option>
                                <option value="65%">65% Player / 35% Playlist (Standard)</option>
                                <option value="70%">70% Player / 30% Playlist</option>
                                <option value="75%">75% Player / 25% Playlist</option>
                              </select>
                            </div>
                          )}

                          {/* Alignment */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Alignment
                            </label>
                            <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
                              {(["left", "center", "right"] as const).map((align) => {
                                const currentAlign = getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "textAlign") || "left";
                                const isActive = currentAlign === align;
                                return (
                                  <button
                                    key={align}
                                    type="button"
                                    onClick={() => updateSelectedStyle("textAlign", align)}
                                    className={`rounded-md py-1 text-xs font-semibold capitalize transition ${isActive
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
                        </div>

                        {/* STYLE SECTION */}
                        <div className="space-y-3 pt-3 border-t border-slate-200">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1">
                            Style & Border
                          </h3>

                          {/* Border Radius */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Border Radius
                            </label>
                            <select
                              value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "borderRadius") || "12px"}
                              onChange={(e) => updateSelectedStyle("borderRadius", e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                            >
                              <option value="0px">0px (Square Sharp)</option>
                              <option value="8px">8px (Small Rounded)</option>
                              <option value="12px">12px (Medium Rounded)</option>
                              <option value="16px">16px (Large Rounded)</option>
                              <option value="24px">24px (Extra Rounded)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Image Widget Inspector Panel (F-207) */}
                    {selectedElementAny.type === "image" && (
                      <div className="space-y-6 pt-2 border-t border-slate-100">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleImageFileSelect(e.target.files[0]);
                            }
                          }}
                        />

                        {/* CONTENT SECTION */}
                        <div className="space-y-3">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1 flex items-center justify-between">
                            <span>Content</span>
                            <span className="text-[10px] text-blue-600 font-normal">Source & Alt Text</span>
                          </h3>

                          {/* Image Source Selection / Active Thumbnail */}
                          <div className="space-y-2">
                            <label className="block text-xs font-semibold text-slate-700">
                              Image Source
                            </label>

                            {selectedElementAny.src ? (
                              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-slate-600">Preview</span>
                                  <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                    Active Image
                                  </span>
                                </div>
                                <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                                  <img
                                    src={resolveImageUrl(selectedElementAny.src, apiUrl)}
                                    alt="Thumbnail preview"
                                    className="h-28 w-full object-cover"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    disabled={isUploading}
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex-1 rounded-lg border border-slate-300 bg-white py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition flex items-center justify-center gap-1 shadow-2xs disabled:opacity-50"
                                  >
                                    <span>🔄</span>
                                    <span>{isUploading ? "Uploading..." : "Replace Image"}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateSelectedProp("src", "")}
                                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
                                  >
                                    Remove
                                  </button>
                                </div>

                                {/* Extracted Image Color Palette (F-034) */}
                                {extractedColors.length > 0 && (
                                  <div className="pt-2 border-t border-slate-200">
                                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                      Extracted Palette
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                      {extractedColors.map((hex, idx) => (
                                        <button
                                          key={idx}
                                          type="button"
                                          onClick={() => updateSelectedStyle("backgroundColor", hex)}
                                          title={`Apply extracted color ${hex}`}
                                          className="h-6 w-6 rounded-full border border-slate-300 shadow-xs hover:scale-110 transition shrink-0"
                                          style={{ backgroundColor: hex }}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  setDragOver(true);
                                }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={handleDrop}
                                className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition ${dragOver
                                  ? "border-blue-500 bg-blue-50"
                                  : "border-slate-300 bg-slate-50/50 hover:border-slate-400"
                                  }`}
                              >
                                <UploadCloudIcon />
                                <p className="mt-2 text-xs font-bold text-slate-700">
                                  No image selected
                                </p>
                                <p className="mt-0.5 text-[10px] text-slate-400">
                                  Choose local file or drop image here
                                </p>

                                <button
                                  type="button"
                                  disabled={isUploading}
                                  onClick={() => fileInputRef.current?.click()}
                                  className="mt-3 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition disabled:opacity-50"
                                >
                                  {isUploading ? "Uploading..." : "Select Image"}
                                </button>
                              </div>
                            )}

                            {uploadError && (
                              <p className="text-xs font-semibold text-red-500">{uploadError}</p>
                            )}
                          </div>

                          {/* Direct Image URL input */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Image Web URL / Source
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.src || ""}
                              onChange={(e) => updateSelectedProp("src", e.target.value)}
                              placeholder="https://images.unsplash.com/..."
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-medium text-slate-800 outline-none focus:border-blue-500"
                            />
                          </div>

                          {/* Alt Text */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Alt Text (SEO & Accessibility)
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.alt || ""}
                              onChange={(e) => updateSelectedProp("alt", e.target.value)}
                              placeholder="Describe the image content..."
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>

                        {/* LAYOUT SECTION */}
                        <div className="space-y-3 pt-3 border-t border-slate-200">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1">
                            Layout & Alignment
                          </h3>

                          {/* Width & Height */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Width
                              </label>
                              <select
                                value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "width") || "100%"}
                                onChange={(e) => updateSelectedStyle("width", e.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                              >
                                <option value="100%">100% (Full Width)</option>
                                <option value="75%">75%</option>
                                <option value="50%">50% (Half Width)</option>
                                <option value="33%">33%</option>
                                <option value="25%">25%</option>
                                <option value="auto">Auto</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Height
                              </label>
                              <select
                                value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "height") || "auto"}
                                onChange={(e) => updateSelectedStyle("height", e.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                              >
                                <option value="auto">Auto</option>
                                <option value="150px">150px</option>
                                <option value="200px">200px</option>
                                <option value="300px">300px</option>
                                <option value="400px">400px</option>
                                <option value="500px">500px</option>
                              </select>
                            </div>
                          </div>

                          {/* Object Fit & Object Position */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Object Fit
                              </label>
                              <select
                                value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "objectFit") || "cover"}
                                onChange={(e) => updateSelectedStyle("objectFit", e.target.value as any)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                              >
                                <option value="cover">Cover (Fill Container)</option>
                                <option value="contain">Contain (Fit Whole Image)</option>
                                <option value="fill">Fill (Stretch)</option>
                                <option value="none">None (Original Size)</option>
                                <option value="scale-down">Scale Down</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Object Position
                              </label>
                              <select
                                value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "objectPosition") || "center"}
                                onChange={(e) => updateSelectedStyle("objectPosition", e.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                              >
                                <option value="center">Center</option>
                                <option value="top">Top</option>
                                <option value="bottom">Bottom</option>
                                <option value="left">Left</option>
                                <option value="right">Right</option>
                                <option value="top left">Top Left</option>
                                <option value="top right">Top Right</option>
                                <option value="bottom left">Bottom Left</option>
                                <option value="bottom right">Bottom Right</option>
                              </select>
                            </div>
                          </div>

                          {/* Alignment */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Alignment
                            </label>
                            <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
                              {(["left", "center", "right"] as const).map((align) => {
                                const currentAlign = getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "textAlign") || "left";
                                const isActive = currentAlign === align;
                                return (
                                  <button
                                    key={align}
                                    type="button"
                                    onClick={() => updateSelectedStyle("textAlign", align)}
                                    className={`rounded-md py-1 text-xs font-semibold capitalize transition ${isActive
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
                        </div>

                        {/* STYLE SECTION */}
                        <div className="space-y-3 pt-3 border-t border-slate-200">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1">
                            Style & Effects
                          </h3>

                          {/* Border Radius */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Border Radius
                            </label>
                            <select
                              value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "borderRadius") || "8px"}
                              onChange={(e) => updateSelectedStyle("borderRadius", e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                            >
                              <option value="0px">0px (Square Sharp)</option>
                              <option value="4px">4px (Small)</option>
                              <option value="8px">8px (Medium Rounded)</option>
                              <option value="16px">16px (Large Rounded)</option>
                              <option value="24px">24px (Extra Rounded)</option>
                              <option value="9999px">9999px (Pill / Circle)</option>
                            </select>
                          </div>

                          {/* Opacity */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-xs font-semibold text-slate-700">
                                Opacity
                              </label>
                              <span className="text-xs font-mono font-bold text-slate-600">
                                {Math.round(Number(getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "opacity") ?? 1) * 100)}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "opacity") ?? 1}
                              onChange={(e) => updateSelectedStyle("opacity", parseFloat(e.target.value))}
                              className="w-full accent-blue-600 cursor-pointer"
                            />
                          </div>
                          {/* F-220: Image Mask Shape */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Image Mask Shape (F-220)
                            </label>
                            <select
                              value={selectedElementAny.imageMaskShape || "none"}
                              onChange={(e) => updateSelectedProp("imageMaskShape", e.target.value as any)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                            >
                              <option value="none">None (Rectangular)</option>
                              <option value="circle">⚪ Circle</option>
                              <option value="rounded">▢ Smooth Rounded</option>
                              <option value="blob">🫧 Organic Blob</option>
                              <option value="hexagon">⬡ Hexagon</option>
                              <option value="star">⭐ Star</option>
                              <option value="diamond">◆ Diamond</option>
                              <option value="squircle">⭕ Squircle</option>
                              <option value="heart">💖 Heart</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* F-212: Basic Media Carousel Inspector */}
                    {selectedElementAny.type === "basic-media-carousel" && (
                      <div className="space-y-4 pt-2 border-t border-slate-100">
                        <span className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                          🎠 Media Carousel Settings
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Slides Per View</label>
                            <input
                              type="number"
                              min={1}
                              max={6}
                              value={selectedElementAny.mediaCarouselSlidesPerView || 2}
                              onChange={(e) => updateSelectedProp("mediaCarouselSlidesPerView", Number(e.target.value))}
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Gap (px)</label>
                            <input
                              type="number"
                              min={0}
                              max={40}
                              value={selectedElementAny.mediaCarouselGap ?? 12}
                              onChange={(e) => updateSelectedProp("mediaCarouselGap", Number(e.target.value))}
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs outline-none"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedElementAny.mediaCarouselShowNav !== false}
                              onChange={(e) => updateSelectedProp("mediaCarouselShowNav", e.target.checked)}
                            />
                            Nav Arrows
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedElementAny.mediaCarouselShowDots !== false}
                              onChange={(e) => updateSelectedProp("mediaCarouselShowDots", e.target.checked)}
                            />
                            Pagination Dots
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedElementAny.mediaCarouselAutoplay ?? true}
                              onChange={(e) => updateSelectedProp("mediaCarouselAutoplay", e.target.checked)}
                            />
                            Autoplay
                          </label>
                        </div>
                      </div>
                    )}

                    {/* F-214: Basic Gallery Inspector */}
                    {selectedElementAny.type === "basic-gallery" && (
                      <div className="space-y-4 pt-2 border-t border-slate-100">
                        <span className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                          🖼️ Basic Gallery Settings
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Columns</label>
                            <select
                              value={selectedElementAny.basicGalleryColumns || 3}
                              onChange={(e) => updateSelectedProp("basicGalleryColumns", Number(e.target.value))}
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold outline-none"
                            >
                              <option value={1}>1 Column</option>
                              <option value={2}>2 Columns</option>
                              <option value={3}>3 Columns</option>
                              <option value={4}>4 Columns</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Gap (px)</label>
                            <input
                              type="number"
                              min={0}
                              max={40}
                              value={selectedElementAny.basicGalleryGap ?? 12}
                              onChange={(e) => updateSelectedProp("basicGalleryGap", Number(e.target.value))}
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* F-215: Audio Playlist Inspector */}
                    {selectedElementAny.type === "audio-playlist" && (
                      <div className="space-y-4 pt-2 border-t border-slate-100">
                        <span className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                          🎵 Audio Playlist Colors & Tracks
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Card Background</label>
                            <input
                              type="color"
                              value={selectedElementAny.audioPlaylistCardBg || "#0f172a"}
                              onChange={(e) => updateSelectedProp("audioPlaylistCardBg", e.target.value)}
                              className="h-8 w-full cursor-pointer rounded border border-slate-300 p-0.5"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Accent Color</label>
                            <input
                              type="color"
                              value={selectedElementAny.audioPlaylistAccentColor || "#38bdf8"}
                              onChange={(e) => updateSelectedProp("audioPlaylistAccentColor", e.target.value)}
                              className="h-8 w-full cursor-pointer rounded border border-slate-300 p-0.5"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* F-219: Dynamic Lightbox Inspector */}
                    {selectedElementAny.type === "dynamic-lightbox" && (
                      <div className="space-y-4 pt-2 border-t border-slate-100">
                        <span className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                          🔍 Dynamic Lightbox Settings
                        </span>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600 mb-1">Trigger Button Label</label>
                          <input
                            type="text"
                            value={selectedElementAny.lightboxTriggerText || "🔍 Open Dynamic Lightbox"}
                            onChange={(e) => updateSelectedProp("lightboxTriggerText", e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* F-221: Custom SVG Inspector */}
                    {selectedElementAny.type === "custom-svg" && (
                      <div className="space-y-4 pt-2 border-t border-slate-100">
                        <span className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                          ⚡ Custom SVG Markup & Styling
                        </span>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600 mb-1">Raw SVG Markup Code</label>
                          <textarea
                            rows={4}
                            value={selectedElementAny.svgRawContent || ""}
                            onChange={(e) => updateSelectedProp("svgRawContent", e.target.value)}
                            placeholder="<svg viewBox='0 0 24 24'>...</svg>"
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">SVG Fill / Stroke Color</label>
                            <input
                              type="color"
                              value={selectedElementAny.svgColor || "#0284c7"}
                              onChange={(e) => updateSelectedProp("svgColor", e.target.value)}
                              className="h-8 w-full cursor-pointer rounded border border-slate-300 p-0.5"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Alignment</label>
                            <select
                              value={selectedElementAny.svgAlignment || "center"}
                              onChange={(e) => updateSelectedProp("svgAlignment", e.target.value as any)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold outline-none"
                            >
                              <option value="left">Left</option>
                              <option value="center">Center</option>
                              <option value="right">Right</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* F-222: Icon Library Inspector */}
                    {selectedElementAny.type === "icon-library" && (
                      <div className="space-y-4 pt-2 border-t border-slate-100">
                        <span className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                          ✨ Icon Library Styling
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Icon Size (px)</label>
                            <input
                              type="number"
                              value={selectedElementAny.iconSize || 48}
                              onChange={(e) => updateSelectedProp("iconSize", Number(e.target.value))}
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Icon Color</label>
                            <input
                              type="color"
                              value={selectedElementAny.iconColor || "#e11d48"}
                              onChange={(e) => updateSelectedProp("iconColor", e.target.value)}
                              className="h-8 w-full cursor-pointer rounded border border-slate-300 p-0.5"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Advanced Spacing Controls for non-container elements */}
                    {selectedElementAny.type !== "container" && (
                      <div className="space-y-4 pt-4 border-t border-slate-200">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Advanced Spacing
                        </h3>
                        {render4SideSpacingControl("Margin", "margin", isMarginLinked, setIsMarginLinked)}
                        {render4SideSpacingControl("Padding", "padding", isPaddingLinked, setIsPaddingLinked)}
                      </div>
                    )}

                    {/* Background & Border Controls */}
                    {renderBackgroundAndBorderControls()}

                    {/* Positioning & Layering Controls */}
                    {renderPositioningControls()}
                  </div>
  );
}
