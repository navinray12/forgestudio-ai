import React from "react";
import { Sparkles } from "lucide-react";

/** What renderSiteSettingsSecondBlock reads: the editor values and callbacks the inline JSX used. */
export interface SiteSettingsSecondBlockDeps {
  globalSettings: any;
  handleGenerateSupportToken: () => Promise<void>;
  handleRevokeSupportTokens: () => Promise<void>;
  isGeneratingToken: boolean;
  pageSettings: { [key: string]: any; title?: string | undefined; description?: string | undefined; path?: string | undefined; backgroundColor?: string | undefined; customHead?: string | undefined; isMaintenanceMode?: boolean | undefined; siteLanguage?: string | undefined; ogTitle?: string | undefined; ogDescription?: string | undefined; ogImage?: string | undefined; canonicalUrl?: string | undefined; noindex?: boolean | undefined; nofollow?: boolean | undefined; };
  setGlobalSettings: React.Dispatch<any>;
  setIsMultilingualModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSeoAnalyzerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSeoModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSupportCredentialsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setPageSettings: React.Dispatch<React.SetStateAction<{ [key: string]: any; title?: string | undefined; description?: string | undefined; path?: string | undefined; backgroundColor?: string | undefined; customHead?: string | undefined; isMaintenanceMode?: boolean | undefined; siteLanguage?: string | undefined; ogTitle?: string | undefined; ogDescription?: string | undefined; ogImage?: string | undefined; canonicalUrl?: string | undefined; noindex?: boolean | undefined; nofollow?: boolean | undefined; }>>;
  setSupportCopied: React.Dispatch<React.SetStateAction<boolean>>;
  supportCopied: boolean;
  supportExpiresAt: string | null;
  supportMessage: string;
  supportToken: string | null;
  t: (key: string, fallback: string) => string;
  updatePreference: <K extends keyof SiteSettingsSecondBlockDeps["userPreferences"]>(key: K, value: { autoSaveEnabled: boolean; gridOverlay: boolean; themeMode: "dark" | "light"; }[K]) => void;
  userPreferences: { autoSaveEnabled: boolean; gridOverlay: boolean; themeMode: "dark" | "light"; };
}

/**
 * No-selection inspector, second block: page settings header, site identity, back-to-top, floating action button, maintenance mode, support credentials, page title / meta / slug, SEO & social graph, language, RTL / LTR, accessibility audit and widget settings, canvas background, support credentials (F-020) and editor user preferences. Several sections repeat ones in the first block; both are kept exactly as they were.
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 11861-12490 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderSiteSettingsSecondBlock({
  globalSettings,
  handleGenerateSupportToken,
  handleRevokeSupportTokens,
  isGeneratingToken,
  pageSettings,
  setGlobalSettings,
  setIsMultilingualModalOpen,
  setIsSeoAnalyzerOpen,
  setIsSeoModalOpen,
  setIsSupportCredentialsOpen,
  setPageSettings,
  setSupportCopied,
  supportCopied,
  supportExpiresAt,
  supportMessage,
  supportToken,
  t,
  updatePreference,
  userPreferences,
}: SiteSettingsSecondBlockDeps): React.ReactNode {
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

                {/* Temporary Support Credentials (F-020) */}
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>🔑</span>
                      <span>Support Access Credentials</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsSupportCredentialsOpen(true)}
                      className="rounded bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white shadow hover:bg-indigo-500"
                      id="btn-support-credentials"
                    >
                      Manage Tokens
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Generate temporary scoped tokens for customer support & audit access with revocation control.
                  </p>
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
                    <option value="ar">Arabic (ar - RTL)</option>
                    <option value="he">Hebrew (he - RTL)</option>
                    <option value="ta">Tamil (ta)</option>
                  </select>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Controls published HTML website language. Completely independent from Editor UI language.
                  </p>
                </div>

                {/* F-380: Site Layout Direction (RTL / LTR) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Site Layout Direction (F-380 RTL)</span>
                    <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded">dir</span>
                  </label>
                  <select
                    value={pageSettings.siteDirection || "ltr"}
                    onChange={(e) => setPageSettings((prev) => ({ ...prev, siteDirection: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                  >
                    <option value="ltr">Left-to-Right (LTR - Standard)</option>
                    <option value="rtl">Right-to-Left (RTL - Arabic, Hebrew, Urdu)</option>
                  </select>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Mirrors published website text direction and layout alignment for RTL languages.
                  </p>
                </div>

                {/* Action Buttons for Accessibility Audit & Multilingual Export */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsSeoAnalyzerOpen(true)}
                    className="w-full py-2 px-3 rounded-lg bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                  >
                    <span>✨</span>
                    <span>Run WCAG & SEO Audit (F-363/F-371)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMultilingualModalOpen(true)}
                    className="w-full py-2 px-3 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 font-bold text-xs hover:bg-purple-100 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>🌐</span>
                    <span>Multilingual Export (F-381 WPML/Weglot)</span>
                  </button>
                </div>

                {/* Accessibility & Usability Widget Settings (F-364, F-367) */}
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3.5 space-y-3">
                  <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>♿</span>
                      <span>Accessibility Widget (F-364 / F-367)</span>
                    </label>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                      WCAG 2.1
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700">Enable Floating Toolbar Widget</span>
                      <input
                        type="checkbox"
                        checked={globalSettings?.accessibilityWidget?.enabled !== false}
                        onChange={(e) =>
                          setGlobalSettings((prev: any) => ({
                            ...prev,
                            accessibilityWidget: { ...prev?.accessibilityWidget, enabled: e.target.checked },
                          }))
                        }
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Widget Corner Position</label>
                      <select
                        value={globalSettings?.accessibilityWidget?.position || "bottom-right"}
                        onChange={(e) =>
                          setGlobalSettings((prev: any) => ({
                            ...prev,
                            accessibilityWidget: { ...prev?.accessibilityWidget, position: e.target.value },
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-indigo-500"
                      >
                        <option value="bottom-right">Bottom Right</option>
                        <option value="bottom-left">Bottom Left</option>
                        <option value="top-right">Top Right</option>
                        <option value="top-left">Top Left</option>
                      </select>
                    </div>
                  </div>
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

                {/* Temporary Support Credentials (F-020) */}
                <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4 space-y-3 pt-3">
                  <div className="flex items-center justify-between border-b border-purple-100 pb-2">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>🔐</span>
                      <span>Temporary Support Access</span>
                    </label>
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                      2-Hr Limit
                    </span>
                  </div>

                      <p className="text-[11px] text-slate-500 leading-normal">
                        Generate temporary, time-limited credentials for support troubleshooting without sharing your password.
                      </p>

                      {supportToken ? (
                        <div className="space-y-2 rounded-lg border border-purple-200 bg-white p-3">
                          <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                            <span>Support Token:</span>
                            <span className="text-purple-600 font-bold">Expires ~{supportExpiresAt}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              readOnly
                              value={supportToken}
                              className="w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] font-mono text-slate-800"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (supportToken) {
                                  navigator.clipboard.writeText(supportToken);
                                  setSupportCopied(true);
                                  setTimeout(() => setSupportCopied(false), 2000);
                                }
                              }}
                              className="rounded-md bg-purple-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm hover:bg-purple-700 transition shrink-0"
                            >
                              {supportCopied ? "Copied!" : "Copy"}
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {supportMessage && (
                        <p className="text-[11px] font-semibold text-purple-700">{supportMessage}</p>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={isGeneratingToken}
                          onClick={handleGenerateSupportToken}
                          className="flex-1 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-purple-700 disabled:opacity-50 transition"
                        >
                          {isGeneratingToken ? "Generating..." : "Generate Support Token"}
                        </button>
                        <button
                          type="button"
                          onClick={handleRevokeSupportTokens}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition"
                          title="Revoke active support credentials"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>

                    {/* Editor User Preferences (F-026) */}
                    <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <span>⚙️</span>
                          <span>Editor User Preferences</span>
                        </label>
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                          Persistent
                        </span>
                      </div>

                      <div className="space-y-2.5 pt-1">
                        {/* Auto Save Toggle */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-700">⚡ Auto-Save Drafts</span>
                          <input
                            type="checkbox"
                            checked={userPreferences.autoSaveEnabled}
                            onChange={(e) => updatePreference("autoSaveEnabled", e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </div>

                        {/* Canvas Grid Alignment Overlay Toggle */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-700">📐 Canvas Alignment Grid</span>
                          <input
                            type="checkbox"
                            checked={userPreferences.gridOverlay}
                            onChange={(e) => updatePreference("gridOverlay", e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </div>

                        {/* Header Toolbar Theme Switch */}
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs font-semibold text-slate-700">🎨 Header Toolbar Theme</span>
                          <button
                            type="button"
                            onClick={() => updatePreference("themeMode", userPreferences.themeMode === "dark" ? "light" : "dark")}
                            className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 shadow-sm transition"
                          >
                            {userPreferences.themeMode === "dark" ? "🌙 Dark Navy" : "☀️ Light Modern"}
                          </button>
                        </div>
                      </div>
                    </div>
                </>
  );
}
