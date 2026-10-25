import React from "react";
import type { PageConfig, WebsiteData } from "../types";

/** What renderPreviewHeader reads: the editor values and callbacks the inline JSX used. */
export interface PreviewHeaderDeps {
  activePreviewPageId: string;
  globalSettings: any;
  handlePreviewPageNavigate: (targetPage: PageConfig) => void;
  homePageId: string;
  mobileMenuOpen: boolean;
  pageSettings: { [key: string]: any; title?: string | undefined; description?: string | undefined; path?: string | undefined; backgroundColor?: string | undefined; customHead?: string | undefined; isMaintenanceMode?: boolean | undefined; siteLanguage?: string | undefined; ogTitle?: string | undefined; ogDescription?: string | undefined; ogImage?: string | undefined; canonicalUrl?: string | undefined; noindex?: boolean | undefined; nofollow?: boolean | undefined; };
  pages: PageConfig[];
  setMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  website: WebsiteData;
}

/**
 * Preview mode: the sticky preview site header (brand and page navigation).
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 3632-3715 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderPreviewHeader({
  activePreviewPageId,
  globalSettings,
  handlePreviewPageNavigate,
  homePageId,
  mobileMenuOpen,
  pageSettings,
  pages,
  setMobileMenuOpen,
  website,
}: PreviewHeaderDeps): React.ReactNode {
  return (
                <header className="sticky top-0 z-30 w-full rounded-xl border border-slate-200/80 bg-white/95 backdrop-blur-md shadow-sm transition-all overflow-hidden">
                  <div className="flex items-center justify-between px-4 sm:px-6 py-3">
                    {/* Website Brand / Logo */}
                    <div
                      className="flex items-center gap-2.5 cursor-pointer"
                      onClick={() => {
                        const homePage = pages.find((p) => p.isHome || p.id === homePageId || p.slug === "/") || pages[0];
                        if (homePage) handlePreviewPageNavigate(homePage);
                      }}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-xs shadow-md">
                        {(website?.name || pageSettings?.title || "W").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="text-sm font-extrabold tracking-tight text-slate-900 block leading-tight">
                          {globalSettings?.siteIdentity?.name || website?.name || "My Website"}
                        </span>
                        <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Website Preview
                        </span>
                      </div>
                    </div>

                    {/* Desktop Navigation Links */}
                    {pages.length > 0 && (
                      <nav className="hidden sm:flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/70">
                        {pages.map((p) => {
                          const isCurrent = (activePreviewPageId || pages[0]?.id) === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => handlePreviewPageNavigate(p)}
                              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${isCurrent
                                ? "bg-white text-blue-600 shadow-sm border border-slate-200/60 font-extrabold"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                                }`}
                            >
                              {p.name || p.pageSettings?.title || "Untitled"}
                            </button>
                          );
                        })}
                      </nav>
                    )}

                    {/* Mobile Hamburger Toggle Button */}
                    {pages.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="sm:hidden flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                        aria-label="Toggle Navigation Menu"
                      >
                        <span className="text-sm">{mobileMenuOpen ? "✕" : "☰"}</span>
                      </button>
                    )}
                  </div>

                  {/* Mobile Dropdown Menu Drawer */}
                  {mobileMenuOpen && pages.length > 0 && (
                    <div className="sm:hidden border-t border-slate-200 bg-slate-50 p-2.5 space-y-1 animate-fadeIn">
                      {pages.map((p) => {
                        const isCurrent = (activePreviewPageId || pages[0]?.id) === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              handlePreviewPageNavigate(p);
                              setMobileMenuOpen(false);
                            }}
                            className={`w-full text-left px-3.5 py-2 text-xs font-bold rounded-lg transition flex items-center justify-between ${isCurrent
                              ? "bg-blue-600 text-white font-extrabold shadow-sm"
                              : "text-slate-700 hover:bg-slate-200/70"
                              }`}
                          >
                            <span>{p.name || p.pageSettings?.title || "Untitled"}</span>
                            <span className="text-[10px] opacity-70 font-mono">{p.slug}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </header>
  );
}
