import React from "react";
import { Sparkles } from "lucide-react";

/** What renderSiteSettingsFirstBlock reads: the editor values and callbacks the inline JSX used. */
export interface SiteSettingsFirstBlockDeps {
  globalSettings: any;
  isMarginLinked: boolean;
  isPaddingLinked: boolean;
  pageSettings: { [key: string]: any; title?: string | undefined; description?: string | undefined; path?: string | undefined; backgroundColor?: string | undefined; customHead?: string | undefined; isMaintenanceMode?: boolean | undefined; siteLanguage?: string | undefined; ogTitle?: string | undefined; ogDescription?: string | undefined; ogImage?: string | undefined; canonicalUrl?: string | undefined; noindex?: boolean | undefined; nofollow?: boolean | undefined; };
  render4SideSpacingControl: (title: string, type: "margin" | "padding", isLinked: boolean, setIsLinked: (val: boolean) => void) => React.JSX.Element;
  renderBackgroundAndBorderControls: () => React.JSX.Element | null;
  selectedElementAny: any;
  setGlobalSettings: React.Dispatch<any>;
  setIsMarginLinked: React.Dispatch<React.SetStateAction<boolean>>;
  setIsPaddingLinked: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSeoModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setPageSettings: React.Dispatch<React.SetStateAction<{ [key: string]: any; title?: string | undefined; description?: string | undefined; path?: string | undefined; backgroundColor?: string | undefined; customHead?: string | undefined; isMaintenanceMode?: boolean | undefined; siteLanguage?: string | undefined; ogTitle?: string | undefined; ogDescription?: string | undefined; ogImage?: string | undefined; canonicalUrl?: string | undefined; noindex?: boolean | undefined; nofollow?: boolean | undefined; }>>;
  t: (key: string, fallback: string) => string;
  updateSelectedProp: (key: string, value: any) => void;
}

/**
 * No-selection inspector, first block: page settings header, site identity, back-to-top, floating action button, maintenance mode, page title / meta / slug, SEO & social graph, language, canvas background, custom head tags, icon library (selection-dependent), advanced spacing and the background & border controls call.
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 11402-11858 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderSiteSettingsFirstBlock({
  globalSettings,
  isMarginLinked,
  isPaddingLinked,
  pageSettings,
  render4SideSpacingControl,
  renderBackgroundAndBorderControls,
  selectedElementAny,
  setGlobalSettings,
  setIsMarginLinked,
  setIsPaddingLinked,
  setIsSeoModalOpen,
  setPageSettings,
  t,
  updateSelectedProp,
}: SiteSettingsFirstBlockDeps): React.ReactNode {
  return (
                    <>
                    <div className="border-b border-slate-100 pb-3">
                      <h3 className="text-xs font-bold uppercase tracking-wide text-blue-600 flex items-center gap-1.5">
                        <span>📄</span>
                        <span>PAGE SETTINGS</span>
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Configure page-level properties & SEO settings.
                      </p>
                    </div>
                    {/* Site Identity */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <h3 className="text-xs font-bold text-slate-700 mb-2">Site Identity</h3>
                      <input
                        type="text"
                        value={globalSettings.siteIdentity?.name || ""}
                        onChange={(e) =>
                          setGlobalSettings((prev: any) => ({
                            ...prev,
                            siteIdentity: { ...prev.siteIdentity, name: e.target.value },
                          }))
                        }
                        placeholder="Site Name"
                        className="w-full rounded border px-2 py-1 text-xs"
                      />
                    </div>

                    {/* Back To Top Button Settings */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-slate-700">Back To Top Button</h3>
                        <input
                          type="checkbox"
                          checked={globalSettings.backToTop?.enabled !== false}
                          onChange={(e) =>
                            setGlobalSettings((prev: any) => ({
                              ...prev,
                              backToTop: { ...prev.backToTop, enabled: e.target.checked },
                            }))
                          }
                          className="h-4 w-4 rounded text-blue-600"
                        />
                      </div>
                      {globalSettings.backToTop?.enabled !== false && (
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center justify-between gap-2">
                            <label className="text-[11px] font-semibold text-slate-600">Position:</label>
                            <select
                              value={globalSettings.backToTop?.position || "bottom-right"}
                              onChange={(e) =>
                                setGlobalSettings((prev: any) => ({
                                  ...prev,
                                  backToTop: { ...prev.backToTop, position: e.target.value },
                                }))
                              }
                              className="rounded border px-2 py-1 text-[11px]"
                            >
                              <option value="bottom-right">Bottom Right</option>
                              <option value="bottom-left">Bottom Left</option>
                            </select>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <label className="text-[11px] font-semibold text-slate-600">Scroll Offset (px):</label>
                            <input
                              type="number"
                              value={globalSettings.backToTop?.offset ?? 300}
                              onChange={(e) =>
                                setGlobalSettings((prev: any) => ({
                                  ...prev,
                                  backToTop: { ...prev.backToTop, offset: Number(e.target.value) },
                                }))
                              }
                              className="w-20 rounded border px-2 py-1 text-[11px]"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Floating Action Button Settings */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-slate-700">Floating Action Button (FAB)</h3>
                        <input
                          type="checkbox"
                          checked={globalSettings.floatingActionButton?.enabled === true}
                          onChange={(e) =>
                            setGlobalSettings((prev: any) => ({
                              ...prev,
                              floatingActionButton: {
                                ...prev.floatingActionButton,
                                enabled: e.target.checked,
                              },
                            }))
                          }
                          className="h-4 w-4 rounded text-blue-600"
                        />
                      </div>

                      {globalSettings.floatingActionButton?.enabled && (
                        <div className="space-y-2 pt-1">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                              Icon & Type
                            </label>
                            <select
                              value={globalSettings.floatingActionButton?.icon || "whatsapp"}
                              onChange={(e) =>
                                setGlobalSettings((prev: any) => ({
                                  ...prev,
                                  floatingActionButton: {
                                    ...prev.floatingActionButton,
                                    icon: e.target.value,
                                    backgroundColor:
                                      e.target.value === "whatsapp" ? "#25D366" : prev.floatingActionButton?.backgroundColor || "#2563eb",
                                  },
                                }))
                              }
                              className="w-full rounded border px-2 py-1 text-[11px]"
                            >
                              <option value="whatsapp">WhatsApp Button</option>
                              <option value="chat">Live Chat / Message</option>
                              <option value="phone">Call Now (Phone)</option>
                              <option value="email">Email Us</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                              Label
                            </label>
                            <input
                              type="text"
                              value={globalSettings.floatingActionButton?.label || ""}
                              onChange={(e) =>
                                setGlobalSettings((prev: any) => ({
                                  ...prev,
                                  floatingActionButton: {
                                    ...prev.floatingActionButton,
                                    label: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Chat with us"
                              className="w-full rounded border px-2 py-1 text-[11px]"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                              Link or Smart Action
                            </label>
                            <input
                              type="text"
                              value={globalSettings.floatingActionButton?.link || ""}
                              onChange={(e) =>
                                setGlobalSettings((prev: any) => ({
                                  ...prev,
                                  floatingActionButton: {
                                    ...prev.floatingActionButton,
                                    link: e.target.value,
                                  },
                                }))
                              }
                              placeholder="https://wa.me/... or popup:open(id)"
                              className="w-full rounded border px-2 py-1 text-[11px] font-mono"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <label className="text-[11px] font-semibold text-slate-600">Position:</label>
                            <select
                              value={globalSettings.floatingActionButton?.position || "bottom-left"}
                              onChange={(e) =>
                                setGlobalSettings((prev: any) => ({
                                  ...prev,
                                  floatingActionButton: {
                                    ...prev.floatingActionButton,
                                    position: e.target.value,
                                  },
                                }))
                              }
                              className="rounded border px-2 py-1 text-[11px]"
                            >
                              <option value="bottom-left">Bottom Left</option>
                              <option value="bottom-right">Bottom Right</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Maintenance Mode Toggle (F-019) */}
                    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer">
                          <span>🛠️</span>
                          <span>Maintenance Mode</span>
                        </label>
                        <input
                          type="checkbox"
                          checked={!!pageSettings.isMaintenanceMode}
                          onChange={(e) => setPageSettings((prev) => ({ ...prev, isMaintenanceMode: e.target.checked }))}
                          className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 leading-normal">
                        Show temporary maintenance state to public visitors & preview while editing.
                      </p>
                      {pageSettings.isMaintenanceMode && (
                        <span className="inline-block rounded bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          Active — Site displays Maintenance Notice
                        </span>
                      )}

                    </div>

                    {/* Page Title */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Page Title
                      </label>
                      <input
                        type="text"
                        value={pageSettings.title || ""}
                        onChange={(e) => setPageSettings((prev) => ({ ...prev, title: e.target.value }))}
                        placeholder="Home"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                      />
                    </div>

                    {/* Meta Description */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Meta Description (SEO)
                      </label>
                      <textarea
                        rows={3}
                        value={pageSettings.description || ""}
                        onChange={(e) => setPageSettings((prev) => ({ ...prev, description: e.target.value }))}
                        placeholder="Page SEO description..."
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                      />
                    </div>

                    {/* Page Path / URL Slug */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        URL Path Slug
                      </label>
                      <input
                        type="text"
                        value={pageSettings.path || "/"}
                        onChange={(e) => setPageSettings((prev) => ({ ...prev, path: e.target.value }))}
                        placeholder="/"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-medium text-slate-800 outline-none focus:border-blue-500"
                      />
                    </div>

                    {/* Page SEO & Social Graph (Phase 4) */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <span>🌐</span>
                          <span>SEO & Social Graph</span>
                        </label>
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded">
                          Metadata
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsSeoModalOpen(true)}
                        className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Open Full SEO & Quality Audit</span>
                      </button>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Canonical URL
                        </label>
                        <input
                          type="url"
                          value={pageSettings.canonicalUrl || ""}
                          onChange={(e) => setPageSettings((prev) => ({ ...prev, canonicalUrl: e.target.value }))}
                          placeholder="https://example.com/canonical-page"
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          OpenGraph Title
                        </label>
                        <input
                          type="text"
                          value={pageSettings.ogTitle || ""}
                          onChange={(e) => setPageSettings((prev) => ({ ...prev, ogTitle: e.target.value }))}
                          placeholder={pageSettings.title || "Social title..."}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          OpenGraph Description
                        </label>
                        <textarea
                          rows={2}
                          value={pageSettings.ogDescription || ""}
                          onChange={(e) => setPageSettings((prev) => ({ ...prev, ogDescription: e.target.value }))}
                          placeholder={pageSettings.description || "Social share description..."}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Social Share Image URL (og:image)
                        </label>
                        <input
                          type="url"
                          value={pageSettings.ogImage || ""}
                          onChange={(e) => setPageSettings((prev) => ({ ...prev, ogImage: e.target.value }))}
                          placeholder="https://example.com/share-card.jpg"
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono outline-none focus:border-blue-500"
                        />
                      </div>

                      {/* Search Engine Robots Indexing */}
                      <div className="pt-2 border-t border-slate-200/80 space-y-2">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Robots Directives
                        </span>
                        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!pageSettings.noindex}
                            onChange={(e) => setPageSettings((prev) => ({ ...prev, noindex: e.target.checked }))}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                          />
                          <span>Prevent search engine indexing (<code className="text-[10px] bg-slate-200 px-1 py-0.5 rounded">noindex</code>)</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!pageSettings.nofollow}
                            onChange={(e) => setPageSettings((prev) => ({ ...prev, nofollow: e.target.checked }))}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                          />
                          <span>Do not follow links on this page (<code className="text-[10px] bg-slate-200 px-1 py-0.5 rounded">nofollow</code>)</span>
                        </label>
                      </div>
                    </div>

                    {/* Site / Website Published Language (F-022) */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                        <span>{t("siteLang", "Site Language (Published)")}</span>
                        <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded">HTML lang</span>
                      </label>
                      <select
                        value={pageSettings.siteLanguage || "en"}
                        onChange={(e) => setPageSettings((prev) => ({ ...prev, siteLanguage: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                      >
                        <option value="en">English (en)</option>
                        <option value="es">Spanish (es)</option>
                        <option value="fr">French (fr)</option>
                        <option value="de">German (de)</option>
                        <option value="it">Italian (it)</option>
                        <option value="ja">Japanese (ja)</option>
                      </select>
                      <p className="mt-1 text-[10px] text-slate-400">
                        Controls published HTML website language. Completely independent from Editor UI language.
                      </p>
                    </div>

                    {/* Page Canvas Background Color */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Page Canvas Background Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={pageSettings.backgroundColor || "#ffffff"}
                          onChange={(e) => setPageSettings((prev) => ({ ...prev, backgroundColor: e.target.value }))}
                          className="h-8 w-10 cursor-pointer rounded border border-slate-300 bg-transparent p-0.5"
                        />
                        <input
                          type="text"
                          value={pageSettings.backgroundColor || "#ffffff"}
                          onChange={(e) => setPageSettings((prev) => ({ ...prev, backgroundColor: e.target.value }))}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-medium text-slate-800 outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {/* Custom Head Script/Tags */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Custom Head Tags / Scripts
                      </label>
                      <textarea
                        rows={3}
                        value={pageSettings.customHead || ""}
                        onChange={(e) => setPageSettings((prev) => ({ ...prev, customHead: e.target.value }))}
                        placeholder="<meta name='keywords' content='builder' />"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-medium text-slate-800 outline-none focus:border-blue-500"
                      />
                    </div>

                {/* F-222: Icon Library Inspector */}
                {selectedElementAny?.type === "icon-library" && (
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
                {selectedElementAny?.type !== "container" && (
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
                    </>
  );
}
