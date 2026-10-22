import React from "react";
import type { PageConfig, ThemeBuilderScope, WebsiteData } from "../../types";
import { ArrowLeft, ChevronDown, Plus } from "lucide-react";

/** What renderHeaderLeftRegion reads: the editor values and callbacks the inline JSX used. */
export interface HeaderLeftRegionDeps {
  activePageId: string;
  canvasMode: ThemeBuilderScope;
  handleQuickCreateOrSwitchPage: (pageName: string, preferredSlug?: string | undefined) => void;
  handleQuitEditor: () => void;
  handleSwitchCanvasMode: (mode: ThemeBuilderScope) => void;
  handleSwitchEditingPage: (targetPageId: string) => void;
  homePageId: string;
  isPageSelectorOpen: boolean;
  isScopeDropdownOpen: boolean;
  pages: PageConfig[];
  scopeDropdownRef: React.RefObject<HTMLDivElement | null>;
  setIsAddPageModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsPageManagerModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsPageSelectorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsScopeDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setNewPageName: React.Dispatch<React.SetStateAction<string>>;
  setNewPageSlug: React.Dispatch<React.SetStateAction<string>>;
  website: WebsiteData;
}

/**
 * Editor header, left region: quit / back, brand, breadcrumb, page selector (switch, quick add, page manager), canvas scope switcher.
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 3343-3573 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderHeaderLeftRegion({
  activePageId,
  canvasMode,
  handleQuickCreateOrSwitchPage,
  handleQuitEditor,
  handleSwitchCanvasMode,
  handleSwitchEditingPage,
  homePageId,
  isPageSelectorOpen,
  isScopeDropdownOpen,
  pages,
  scopeDropdownRef,
  setIsAddPageModalOpen,
  setIsPageManagerModalOpen,
  setIsPageSelectorOpen,
  setIsScopeDropdownOpen,
  setNewPageName,
  setNewPageSlug,
  website,
}: HeaderLeftRegionDeps): React.ReactNode {
  return (
          <div className="flex items-center gap-1.5 md:gap-2 shrink-0 min-w-0">
            {/* Quit Editor Button */}
            <button
              type="button"
              onClick={handleQuitEditor}
              className="w-8 h-8 rounded-lg border border-slate-700/80 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white transition flex items-center justify-center shadow-sm cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-blue-500"
              title="Back to Dashboard"
              aria-label="Back to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            {/* Project Title / Breadcrumb */}
            <span className="text-xs font-bold text-white tracking-wide border-l border-slate-700/80 pl-2.5 hidden sm:inline-block max-w-[90px] md:max-w-[130px] truncate">
              {website?.name || "ForgeStudio"}
            </span>

            {/* Page Selector Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsPageSelectorOpen(!isPageSelectorOpen)}
                className="h-8 px-2.5 text-xs font-semibold text-white bg-slate-800/90 hover:bg-slate-700/90 rounded-lg border border-slate-700/80 transition flex items-center gap-1.5 shadow-sm cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500"
                title="Switch Active Page or Manage Site Pages"
                aria-label="Switch Active Page"
                aria-expanded={isPageSelectorOpen}
                aria-haspopup="listbox"
              >
                <span className="text-amber-400 text-xs">📄</span>
                <span className="max-w-[70px] sm:max-w-[110px] truncate font-bold">
                  {pages.find((p) => p.id === activePageId)?.name || "Page"}
                </span>
                {homePageId === activePageId && (
                  <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 py-0.5 rounded font-bold hidden md:inline">Home</span>
                )}
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isPageSelectorOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-72 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl py-1 z-50 animate-fadeIn">
                  <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 flex items-center justify-between">
                    <span>Site Pages ({pages.length})</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPageSelectorOpen(false);
                        setIsPageManagerModalOpen(true);
                      }}
                      className="text-blue-400 hover:text-blue-300 font-semibold cursor-pointer text-[10px]"
                    >
                      Manage All ⚙️
                    </button>
                  </div>
                  <div className="max-h-52 overflow-y-auto py-1">
                    {pages.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          handleSwitchEditingPage(p.id);
                          setIsPageSelectorOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-800 transition cursor-pointer ${p.id === activePageId ? "bg-blue-600/20 text-blue-300 font-bold" : "text-slate-300"
                          }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span>{p.id === homePageId ? "🏠" : "📄"}</span>
                          <span className="truncate">{p.name}</span>
                          {p.id === homePageId && (
                            <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded font-bold">Home</span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">{p.slug}</span>
                      </button>
                    ))}
                  </div>

                  {/* Quick Add Presets: About, Contact, Services, Pricing */}
                  <div className="p-2 border-t border-slate-800 bg-slate-950/60">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>Quick Add Page</span>
                      <span className="text-[9px] text-slate-500 font-normal">1-click create</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleQuickCreateOrSwitchPage("About Us", "/about")}
                        className="px-2 py-1.5 text-[11px] font-semibold text-slate-200 bg-slate-800/80 hover:bg-blue-600 hover:text-white rounded-lg border border-slate-700/70 transition flex items-center gap-1.5 cursor-pointer justify-start"
                        title="Create or switch to About Us page"
                      >
                        <span className="text-blue-400">ℹ️</span>
                        <span>+ About</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickCreateOrSwitchPage("Contact", "/contact")}
                        className="px-2 py-1.5 text-[11px] font-semibold text-slate-200 bg-slate-800/80 hover:bg-blue-600 hover:text-white rounded-lg border border-slate-700/70 transition flex items-center gap-1.5 cursor-pointer justify-start"
                        title="Create or switch to Contact page"
                      >
                        <span className="text-emerald-400">✉️</span>
                        <span>+ Contact</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickCreateOrSwitchPage("Services", "/services")}
                        className="px-2 py-1.5 text-[11px] font-semibold text-slate-200 bg-slate-800/80 hover:bg-blue-600 hover:text-white rounded-lg border border-slate-700/70 transition flex items-center gap-1.5 cursor-pointer justify-start"
                        title="Create or switch to Services page"
                      >
                        <span className="text-purple-400">🛠️</span>
                        <span>+ Services</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickCreateOrSwitchPage("Pricing", "/pricing")}
                        className="px-2 py-1.5 text-[11px] font-semibold text-slate-200 bg-slate-800/80 hover:bg-blue-600 hover:text-white rounded-lg border border-slate-700/70 transition flex items-center gap-1.5 cursor-pointer justify-start"
                        title="Create or switch to Pricing page"
                      >
                        <span className="text-amber-400">🏷️</span>
                        <span>+ Pricing</span>
                      </button>
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setIsPageSelectorOpen(false);
                          setNewPageName("");
                          setNewPageSlug("");
                          setIsAddPageModalOpen(true);
                        }}
                        className="flex-1 text-center px-2 py-1 text-xs text-blue-400 hover:bg-blue-900/30 rounded-lg flex items-center justify-center gap-1 transition font-semibold cursor-pointer border border-blue-500/20"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Custom Page...</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsPageSelectorOpen(false);
                          setIsPageManagerModalOpen(true);
                        }}
                        className="px-2 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition font-medium cursor-pointer border border-slate-700/60"
                        title="Open full page manager"
                      >
                        All Pages
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Direct Quick Add Page Button beside abc Home */}
            <button
              type="button"
              onClick={() => {
                setNewPageName("");
                setNewPageSlug("");
                setIsAddPageModalOpen(true);
              }}
              className="h-8 px-2 text-xs font-semibold text-blue-400 bg-blue-950/40 hover:bg-blue-900/60 hover:text-blue-300 rounded-lg border border-blue-500/30 transition flex items-center gap-1 shadow-sm cursor-pointer"
              title="Add New Website Page (About, Contact, etc.)"
              aria-label="Add New Page"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-bold">Page</span>
            </button>

            {/* Scope Switcher Dropdown (Page / Header / Footer / Single / Archive / 404 / Search Results) */}
            <div className="relative" ref={scopeDropdownRef}>
              <button
                type="button"
                onClick={() => setIsScopeDropdownOpen((prev) => !prev)}
                className="h-8 px-2 text-xs font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 hover:text-white rounded-lg border border-slate-700/80 transition flex items-center gap-1 shadow-sm cursor-pointer"
                title="Switch Canvas Scope (Page / Header / Footer / Single / Archive / 404 / Search)"
                aria-label="Switch Canvas Scope"
              >
                <span className="text-xs">
                  {canvasMode === "page" && "📄"}
                  {canvasMode === "header" && "🌐"}
                  {canvasMode === "footer" && "🌐"}
                  {canvasMode === "single" && "📰"}
                  {canvasMode === "archive" && "📚"}
                  {canvasMode === "404" && "⚠️"}
                  {canvasMode === "search-results" && "🔍"}
                </span>
                <span className="capitalize font-semibold hidden md:inline">
                  {canvasMode === "404" ? "404 Page" : canvasMode === "search-results" ? "Search Results" : canvasMode}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isScopeDropdownOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-44 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl py-1 z-50 animate-fadeIn">
                  {(
                    [
                      { mode: "page", label: "Page Content", icon: "📄" },
                      { mode: "header", label: "Global Header", icon: "🌐" },
                      { mode: "footer", label: "Global Footer", icon: "🌐" },
                      { mode: "single", label: "Single Post Template", icon: "📰" },
                      { mode: "archive", label: "Archive Template", icon: "📚" },
                      { mode: "404", label: "404 Not Found Page", icon: "⚠️" },
                      { mode: "search-results", label: "Search Results Layout", icon: "🔍" },
                    ] as const
                  ).map(({ mode, label, icon }) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        handleSwitchCanvasMode(mode as ThemeBuilderScope);
                        setIsScopeDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition cursor-pointer hover:bg-slate-800 ${canvasMode === mode
                        ? "bg-blue-600/20 text-blue-300 font-bold"
                        : "text-slate-300 hover:text-white"
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{icon}</span>
                        <span>{label}</span>
                      </div>
                      {canvasMode === mode && (
                        <span className="text-blue-400 text-xs">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
  );
}
