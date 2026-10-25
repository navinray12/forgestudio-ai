import React from "react";
import { DefaultWebsiteNavbar } from "../components/DefaultWebsiteNavbar";
import { matchesThemeCondition } from "../types";
import type { DeviceMode, EditorElement, PageConfig, SitePartsConfig, ThemeBuilderScope, WebsiteData } from "../types";

/** What renderPreviewPageBody reads: the editor values and callbacks the inline JSX used. */
export interface PreviewPageBodyDeps {
  activeDevice: DeviceMode;
  activePageId: string;
  activePreviewPageId: string;
  elements: EditorElement[];
  globalSettings: any;
  handlePreviewPageNavigate: (targetPage: PageConfig) => void;
  handleSwitchCanvasMode: (mode: ThemeBuilderScope) => void;
  pageSettings: { [key: string]: any; title?: string | undefined; description?: string | undefined; path?: string | undefined; backgroundColor?: string | undefined; customHead?: string | undefined; isMaintenanceMode?: boolean | undefined; siteLanguage?: string | undefined; ogTitle?: string | undefined; ogDescription?: string | undefined; ogImage?: string | undefined; canonicalUrl?: string | undefined; noindex?: boolean | undefined; nofollow?: boolean | undefined; };
  pages: PageConfig[];
  renderElementTree: (el: EditorElement) => React.ReactNode;
  setIsPreview: React.Dispatch<React.SetStateAction<boolean>>;
  siteParts: SitePartsConfig;
  website: WebsiteData;
}

/**
 * Preview mode: the current preview page's body (header, page elements, footer) resolved from activePreviewPageId.
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 3717-3815 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderPreviewPageBody({
  activeDevice,
  activePageId,
  activePreviewPageId,
  elements,
  globalSettings,
  handlePreviewPageNavigate,
  handleSwitchCanvasMode,
  pageSettings,
  pages,
  renderElementTree,
  setIsPreview,
  siteParts,
  website,
}: PreviewPageBodyDeps): React.ReactNode {
  return (
                (() => {
                  const currentPreviewPage = pages.find((p) => p.id === activePreviewPageId) || pages[0];
                  const activeElements = currentPreviewPage?.id === activePageId ? elements : (currentPreviewPage?.elements || []);

                  if (pageSettings.isMaintenanceMode) {
                    return (
                      <div className="flex min-h-[450px] flex-col items-center justify-center rounded-2xl bg-amber-50/60 border border-amber-200/80 p-8 text-center shadow-inner my-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 shadow-md mb-4 animate-pulse">
                          <span className="text-3xl">🛠️</span>
                        </div>
                        <span className="inline-block rounded-full bg-amber-200/80 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800 mb-2">
                          Temporary Maintenance State
                        </span>
                        <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">
                          Website Under Maintenance
                        </h2>
                        <p className="mt-2 max-w-md text-xs leading-relaxed text-slate-600">
                          This website is currently undergoing scheduled maintenance and upgrades. Please check back shortly!
                        </p>
                        <div className="mt-6 flex items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => setIsPreview(false)}
                            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-black transition"
                          >
                            Return to Editor
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-6 py-2">
                      {/* Global Header in Preview (Comment 5, 21) */}
                      {(siteParts.header?.enabled ?? siteParts.header?.isEnabled ?? true) &&
                        matchesThemeCondition(siteParts.header?.conditions, {
                          pageId: currentPreviewPage?.id,
                          isHome: currentPreviewPage?.isHome,
                          slug: currentPreviewPage?.slug,
                        }) && (
                          <div className="site-global-header border-b border-slate-100 pb-4 mb-4">
                            {siteParts.header?.elements && siteParts.header.elements.length > 0 ? (
                              siteParts.header.elements.map((el) => renderElementTree(el))
                            ) : (
                              <DefaultWebsiteNavbar
                                websiteName={website?.name || globalSettings?.siteIdentity?.name || "ForgeStudio"}
                                pages={pages}
                                activePageId={currentPreviewPage?.id || activePageId}
                                isPreview={true}
                                activeDevice={activeDevice}
                                onNavigatePage={(targetPage) => handlePreviewPageNavigate(targetPage)}
                                onEditHeader={() => {
                                  setIsPreview(false);
                                  handleSwitchCanvasMode("header");
                                }}
                              />
                            )}
                          </div>
                        )}

                      {/* Active Page Elements */}
                      <div className="site-page-content">
                        {(!activeElements || activeElements.length === 0) ? (
                          <div className="flex h-72 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 text-center p-8 bg-slate-50/50">
                            <p className="text-sm font-bold text-slate-700">
                              Page "{currentPreviewPage?.name || "Untitled"}" is Empty
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              Switch back to the editor to add elements to this page.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {activeElements.map((el) => renderElementTree(el))}
                          </div>
                        )}
                      </div>

                      {/* Global Footer in Preview (Comment 5, 21) */}
                      {(siteParts.footer?.enabled ?? siteParts.footer?.isEnabled ?? true) &&
                        matchesThemeCondition(siteParts.footer?.conditions, {
                          pageId: currentPreviewPage?.id,
                          isHome: currentPreviewPage?.isHome,
                          slug: currentPreviewPage?.slug,
                        }) && (
                          <div className="site-global-footer border-t border-slate-100 pt-6 mt-10">
                            {siteParts.footer?.elements && siteParts.footer.elements.length > 0 ? (
                              siteParts.footer.elements.map((el) => renderElementTree(el))
                            ) : (
                              <div className="py-6 text-center text-xs text-slate-500">
                                © {new Date().getFullYear()} {website?.name || globalSettings?.siteIdentity?.name || "ForgeStudio"}. All rights reserved.
                              </div>
                            )}
                          </div>
                        )}
                    </div>
                  );
                })()
  );
}
