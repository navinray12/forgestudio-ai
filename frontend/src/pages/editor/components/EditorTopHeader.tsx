import React, { useState, useEffect } from "react";
import {
  ArrowLeft, ChevronDown, Monitor, Tablet, Smartphone, Undo, Redo,
  Eye, Rocket, Save, RefreshCw, Sparkles, Code2, FileText, Palette,
  MessageSquare, MoreHorizontal, Layers, Check, Lock, Plus, History,
  Search, Globe, Layers2, Copy, Trash2, ArrowUp, ArrowDown, Puzzle, Maximize
} from "lucide-react";
import type { DeveloperModalMode } from "./DeveloperModal";

interface EditorTopHeaderProps {
  website: any;
  activePage?: { id: string; name: string; slug?: string };
  pages: Array<{ id: string; name: string; slug?: string }>;
  homePageId?: string;
  onSwitchPage: (pageId: string) => void;
  onOpenPageManager: () => void;
  onQuit: () => void;
  publishing: { status: string };
  activeDevice: "desktop" | "tablet" | "mobile";
  onSelectDevice: (device: "desktop" | "tablet" | "mobile") => void;
  zoomLevel: number;
  onSelectZoom: (zoom: number) => void;
  canvasTheme?: "light" | "dark";
  onToggleCanvasTheme?: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isPreview: boolean;
  onTogglePreview: () => void;
  onOpenPublishModal: () => void;
  onSave: () => Promise<any> | void;
  saving: boolean;
  autosaveText?: string;
  statusContent?: React.ReactNode;
  onOpenReplaceTemplate?: () => void;
  onOpenDevModal: (mode: DeveloperModalMode | null) => void;
  devModalMode: DeveloperModalMode | null;
  onOpenAiAssistant: () => void;
  onOpenSeoModal: () => void;
  onOpenExperimentModal: () => void;
  onOpenVariablesModal: () => void;
  onOpenClassModal: () => void;
  isDesignNotesOpen: boolean;
  onToggleDesignNotes: () => void;
  isFullScreenCanvas: boolean;
  onToggleFullScreenCanvas: () => void;
  canvasPeers?: any[];
  isRestrictedMode?: boolean;
  onNavigateWorkspace: () => void;
  onOpenRevisionHistory?: () => void;
  onOpenFinder?: () => void;
  onOpenPopupManager?: () => void;
  onOpenMultilingual?: () => void;
  onOpenAddPageModal?: () => void;
  onQuickCreatePage?: (name: string, path: string) => void;
  canvasMode?: string;
  onSwitchCanvasMode?: (mode: any) => void;
  selectedElementId?: string | null;
  onReorderElement?: (id: string, dir: "up" | "down") => void;
  onCopyElement?: (id: string) => void;
  onDuplicateElement?: (id: string) => void;
  onSaveAsComponent?: (id: string) => void;
  onOpenShortcutsHelp?: () => void;
}

export const EditorTopHeader: React.FC<EditorTopHeaderProps> = ({
  website,
  activePage,
  pages,
  homePageId,
  onSwitchPage,
  onOpenPageManager,
  onQuit,
  publishing,
  activeDevice,
  onSelectDevice,
  zoomLevel,
  onSelectZoom,
  canvasTheme,
  onToggleCanvasTheme,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  isPreview,
  onTogglePreview,
  onOpenPublishModal,
  onSave,
  saving,
  autosaveText,
  statusContent,
  onOpenReplaceTemplate,
  onOpenDevModal,
  devModalMode,
  onOpenAiAssistant,
  onOpenSeoModal,
  onOpenExperimentModal,
  onOpenVariablesModal,
  onOpenClassModal,
  isDesignNotesOpen,
  onToggleDesignNotes,
  isFullScreenCanvas,
  onToggleFullScreenCanvas,
  canvasPeers = [],
  isRestrictedMode = false,
  onNavigateWorkspace,
  onOpenRevisionHistory,
  onOpenFinder,
  onOpenPopupManager,
  onOpenMultilingual,
  onOpenAddPageModal,
  onQuickCreatePage,
  canvasMode = "page",
  onSwitchCanvasMode,
  selectedElementId,
  onReorderElement,
  onCopyElement,
  onDuplicateElement,
  onSaveAsComponent,
  onOpenShortcutsHelp,
}) => {
  const [isPageSelectorOpen, setIsPageSelectorOpen] = useState(false);
  const [isScopeDropdownOpen, setIsScopeDropdownOpen] = useState(false);
  const [isZoomMenuOpen, setIsZoomMenuOpen] = useState(false);
  const [isMoreToolsOpen, setIsMoreToolsOpen] = useState(false);

  const zoomOptions = [50, 75, 100, 125, 150];

  const siteTitle = activePage?.name || website?.name || "Summer Sale Landing";
  const categoryPath = `Ecommerce / ${website?.name || "Campaigns"} / ${activePage?.name || "Summer Sale"}`;

  const scopeOptions = [
    { mode: "page", label: "Page Content", icon: "📄" },
    { mode: "header", label: "Global Header", icon: "🌐" },
    { mode: "footer", label: "Global Footer", icon: "🌐" },
    { mode: "single", label: "Single Post Template", icon: "📰" },
    { mode: "archive", label: "Archive Template", icon: "📚" },
    { mode: "404", label: "404 Not Found Page", icon: "⚠️" },
    { mode: "search-results", label: "Search Results Layout", icon: "🔍" },
  ] as const;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsPageSelectorOpen(false);
        setIsScopeDropdownOpen(false);
        setIsZoomMenuOpen(false);
        setIsMoreToolsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <header className="relative w-full h-14 shrink-0 bg-[#12131f] border-b border-[#1e2033] text-white flex items-center justify-between px-3 md:px-4 z-40 select-none">
      {/* ========================================================= */}
      {/* LEFT: Back to Dashboard & Project Title / Breadcrumbs     */}
      {/* ========================================================= */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 min-w-0">
        {/* Back Button matching "← web studio" */}
        <button
          type="button"
          onClick={onQuit}
          className="flex items-center gap-1.5 text-slate-300 hover:text-white transition group cursor-pointer focus:outline-none"
          title="Return to Dashboard"
        >
          <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-white transition group-hover:-translate-x-0.5" />
          <span className="text-xs font-bold tracking-tight text-slate-200 group-hover:text-white">
            web studio
          </span>
        </button>

        {onOpenAddPageModal && <button type="button" aria-label="Add New Page" title="Add New Page" onClick={onOpenAddPageModal} className="w-7 h-7 rounded-lg text-purple-300 hover:bg-[#24263f] flex items-center justify-center"><Plus className="w-3.5 h-3.5" /></button>}
        {/* Vertical subtle divider */}
        <div className="h-5 w-px bg-[#26283d] shrink-0 hidden sm:block" />

        {/* Website & Current Page Title with Draft Pill and Breadcrumb */}
        <div className="relative">
          <button
            type="button"
            id="header-page-selector-btn"
            data-testid="header-page-selector"
            onClick={() => setIsPageSelectorOpen(!isPageSelectorOpen)}
            className="flex flex-col text-left cursor-pointer hover:opacity-90 transition bg-transparent border-0 p-0"
            aria-label="Switch page or add page presets"
            title="Switch Active Page or Manage Site Pages"
            aria-expanded={isPageSelectorOpen}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-wide truncate max-w-[120px] sm:max-w-[180px]">
                {siteTitle}
              </span>

              {/* Draft / Live Badge */}
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold tracking-wide border uppercase ${
                  publishing.status === "PUBLISHED"
                    ? "bg-emerald-950/80 text-emerald-400 border-emerald-800/60"
                    : "bg-[#142922] text-[#34d399] border-[#1d4d3e]"
                }`}
              >
                {publishing.status === "PUBLISHED" ? "Live" : "Draft"}
              </span>

              <ChevronDown className="w-3 h-3 text-slate-400" />
            </div>

            {/* Breadcrumb Path from PDF: Ecommerce / Campaigns / Summer Sale */}
            <span className="text-[10px] text-[#717792] truncate max-w-[200px] font-normal leading-tight hidden md:block">
              {categoryPath}
            </span>
          </button>

          {/* Page Selector Popover with Quick Add Presets and Custom Page Creation */}
          {isPageSelectorOpen && (
            <div
              className="absolute top-full left-0 mt-2 w-72 rounded-xl bg-[#171828] border border-[#272942] shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-[#25273e] flex items-center justify-between mb-1">
                <span>Site Pages ({pages.length})</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsPageSelectorOpen(false);
                    onOpenPageManager();
                  }}
                  className="text-purple-400 hover:text-purple-300 font-semibold cursor-pointer text-[10px]"
                >
                  Manage ⚙
                </button>
              </div>

              <div className="max-h-44 overflow-y-auto space-y-0.5">
                {pages.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onSwitchPage(p.id);
                      setIsPageSelectorOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition cursor-pointer ${
                      p.id === activePage?.id
                        ? "bg-purple-600/30 text-purple-200 font-bold border border-purple-500/40"
                        : "text-slate-300 hover:bg-[#202237] hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-xs">{p.id === homePageId ? "🏠" : "📄"}</span>
                      <span className="truncate">{p.name}</span>
                    </div>
                    {p.id === homePageId && (
                      <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded font-bold">
                        Home
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Quick Add Presets (About, Contact, Services, Pricing) */}
              {onQuickCreatePage && (
                <div className="mt-2 pt-2 border-t border-[#25273e]">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">
                    Quick Add Page
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { name: "About Us", path: "/about", icon: "ℹ️" },
                      { name: "Contact", path: "/contact", icon: "✉️" },
                      { name: "Services", path: "/services", icon: "🛠️" },
                      { name: "Pricing", path: "/pricing", icon: "🏷️" },
                    ].map((preset) => (
                      <button
                        key={preset.path}
                        type="button"
                        title={`Create or switch to ${preset.name} page`}
                        onClick={() => {
                          setIsPageSelectorOpen(false);
                          onQuickCreatePage(preset.name, preset.path);
                        }}
                        className="px-2 py-1 text-[11px] rounded bg-[#202237] hover:bg-purple-900/40 text-slate-200 hover:text-purple-300 transition flex items-center gap-1 cursor-pointer"
                      >
                        <span>{preset.icon}</span>
                        <span>{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom Page Button */}
              {onOpenAddPageModal && (
                <div className="mt-2 pt-1.5 border-t border-[#25273e]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPageSelectorOpen(false);
                      onOpenAddPageModal();
                    }}
                    className="w-full py-1.5 text-xs text-purple-400 hover:bg-purple-950/40 rounded-lg flex items-center justify-center gap-1 transition font-semibold cursor-pointer border border-purple-500/30"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Create Custom Page...</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Theme Builder Scope Selector (Header, Footer, 404, Archive, etc.) */}
        {onSwitchCanvasMode && (
          <div className="relative hidden xl:block">
            <button
              type="button"
              onClick={() => setIsScopeDropdownOpen(!isScopeDropdownOpen)}
              className="h-7 px-2 text-[11px] font-semibold text-slate-300 bg-[#1a1b2d] hover:bg-[#24263f] rounded-lg border border-[#272942] transition flex items-center gap-1 cursor-pointer"
              title="Theme Builder Scope (Edit Header, Footer, Templates)"
              aria-label="Switch Canvas Scope"
            >
              <span>{scopeOptions.find((s) => s.mode === canvasMode)?.icon || "📄"}</span>
              <span className="capitalize">{scopeOptions.find((s) => s.mode === canvasMode)?.label || "Page"}</span>
              <ChevronDown className="w-2.5 h-2.5 text-slate-400" />
            </button>

            {isScopeDropdownOpen && (
              <div
                className="absolute top-full left-0 mt-1.5 w-52 rounded-xl bg-[#171828] border border-[#272942] shadow-2xl py-1 z-50 text-xs text-slate-200 animate-in fade-in"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-[#25273e]">
                  Theme Scope
                </div>
                {scopeOptions.map((s) => (
                  <button
                    key={s.mode}
                    type="button"
                    onClick={() => {
                      onSwitchCanvasMode(s.mode);
                      setIsScopeDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 flex items-center justify-between hover:bg-[#23253c] transition cursor-pointer ${
                      canvasMode === s.mode ? "text-purple-400 font-bold bg-[#1e2035]" : "text-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{s.icon}</span>
                      <span>{s.label}</span>
                    </div>
                    {canvasMode === s.mode && <Check className="w-3 h-3 text-purple-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* CENTER: Responsive Viewports & Zoom Controls              */}
      {/* ========================================================= */}
      <div className="flex items-center gap-2">
        {/* Viewport Toggles: Desktop | Tablet | Mobile */}
        <div className="flex items-center bg-[#1a1b2d] border border-[#272942] rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => onSelectDevice("desktop")}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition cursor-pointer ${
              activeDevice === "desktop"
                ? "bg-[#282a46] text-purple-300 shadow-xs"
                : "text-slate-400 hover:text-white"
            }`}
            title="Desktop View"
            aria-label="Desktop View"
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => onSelectDevice("tablet")}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition cursor-pointer ${
              activeDevice === "tablet"
                ? "bg-[#282a46] text-purple-300 shadow-xs"
                : "text-slate-400 hover:text-white"
            }`}
            title="Tablet View"
            aria-label="Tablet View"
          >
            <Tablet className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => onSelectDevice("mobile")}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition cursor-pointer ${
              activeDevice === "mobile"
                ? "bg-[#282a46] text-purple-300 shadow-xs"
                : "text-slate-400 hover:text-white"
            }`}
            title="Mobile View"
            aria-label="Mobile View"
          >
            <Smartphone className="w-3.5 h-3.5" />
          </button>
        </div>

        {onToggleCanvasTheme && (
          <button type="button" title="Toggle Dynamic Canvas Theme (☀️ Light / 🌙 Dark)" aria-label="Toggle canvas theme" aria-pressed={canvasTheme === "dark"} onClick={onToggleCanvasTheme} className="w-8 h-8 rounded-lg bg-[#1a1b2d] border border-[#272942] flex items-center justify-center">
            {canvasTheme === "dark" ? "🌙" : "☀️"}
          </button>
        )}
        {/* Zoom Controls Dropdown: 100% ˇ */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsZoomMenuOpen(!isZoomMenuOpen)}
            className="h-8 px-2.5 rounded-lg bg-[#1a1b2d] border border-[#272942] text-xs font-semibold text-slate-200 hover:text-white transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Canvas Zoom Level"
          >
            <span>{zoomLevel}%</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {isZoomMenuOpen && (
            <div
              className="absolute top-full left-0 mt-1.5 w-28 rounded-xl bg-[#171828] border border-[#272942] shadow-xl py-1 z-50 text-xs text-slate-200 animate-in fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              {zoomOptions.map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => {
                    onSelectZoom(z);
                    setIsZoomMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 hover:bg-[#23253c] transition flex items-center justify-between cursor-pointer ${
                    zoomLevel === z ? "text-purple-400 font-bold" : "text-slate-300"
                  }`}
                >
                  <span>{z}%</span>
                  {zoomLevel === z && <Check className="w-3 h-3" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected Element Quick Action Pill Toolbar (Move Up, Move Down, Copy, Duplicate, Save as Comp) */}
        {selectedElementId && (
          <div id="selected-element-toolbar" className="flex items-center gap-1 bg-[#1a1b2d] border border-purple-500/40 rounded-lg p-0.5">
            {onReorderElement && (
              <>
                <button
                  type="button"
                  onClick={() => onReorderElement(selectedElementId, "up")}
                  className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-white hover:bg-[#282a46] rounded transition cursor-pointer"
                  title="Move Element Up"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onReorderElement(selectedElementId, "down")}
                  className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-white hover:bg-[#282a46] rounded transition cursor-pointer"
                  title="Move Element Down"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
              </>
            )}
            {onCopyElement && (
              <button
                type="button"
                onClick={() => onCopyElement(selectedElementId)}
                className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-white hover:bg-[#282a46] rounded transition cursor-pointer"
                title="Copy Element (Ctrl+C)"
              >
                <Copy className="w-3 h-3" />
              </button>
            )}
            {onDuplicateElement && (
              <button
                type="button"
                onClick={() => onDuplicateElement(selectedElementId)}
                className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-white hover:bg-[#282a46] rounded transition cursor-pointer"
                title="Duplicate Element (Ctrl+D)"
              >
                <Layers className="w-3 h-3" />
              </button>
            )}
            {onSaveAsComponent && (
              <button
                type="button"
                onClick={() => onSaveAsComponent(selectedElementId)}
                className="w-6 h-6 flex items-center justify-center text-purple-300 hover:text-white hover:bg-purple-900/60 rounded transition cursor-pointer"
                title="Save as Reusable Component"
              >
                <Puzzle className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* RIGHT: Undo / Redo, Preview, Publish & Secondary Tools    */}
      {/* ========================================================= */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Live Canvas Peer Avatars */}
        {canvasPeers.length > 0 && (
          <div className="hidden lg:flex items-center -space-x-1.5 mr-1">
            {canvasPeers.map((peer) => (
              <div
                key={peer.socketId}
                title={`${peer.user.name} is editing`}
                className="w-6 h-6 rounded-full text-[9px] font-extrabold text-white flex items-center justify-center ring-2 ring-[#12131f] shadow-sm"
                style={{ backgroundColor: peer.user.color }}
              >
                {peer.user.name.slice(0, 2).toUpperCase()}
              </div>
            ))}
          </div>
        )}

        {/* Autosave status text */}
        {statusContent ?? (autosaveText && (
          <span className="text-[10px] text-slate-400 hidden xl:inline">
            {autosaveText}
          </span>
        ))}

        <button type="button" aria-label="Save" title="Save (Ctrl+S)" disabled={saving} onClick={() => { void onSave(); }} className="w-8 h-8 rounded-lg bg-[#1a1b2d] border border-[#272942] flex items-center justify-center disabled:opacity-40">
          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        </button>
        {/* Undo Button */}
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="w-8 h-8 rounded-lg bg-[#1a1b2d] hover:bg-[#24263f] border border-[#272942] text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <Undo className="w-3.5 h-3.5" />
        </button>

        {/* Redo Button */}
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="w-8 h-8 rounded-lg bg-[#1a1b2d] hover:bg-[#24263f] border border-[#272942] text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
          title="Redo (Ctrl+Y)"
          aria-label="Redo"
        >
          <Redo className="w-3.5 h-3.5" />
        </button>

        {/* Revision History Quick Button */}
        {onOpenRevisionHistory && (
          <button
            type="button"
            onClick={onOpenRevisionHistory}
            className="w-8 h-8 rounded-lg bg-[#1a1b2d] hover:bg-[#24263f] border border-[#272942] text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer shadow-xs"
            title="Revision History"
          >
            <History className="w-3.5 h-3.5 text-slate-400" />
          </button>
        )}

        {/* Preview Button: 👁 Preview */}
        <button
          type="button"
          onClick={onTogglePreview}
          className={`h-8 px-3 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
            isPreview
              ? "bg-purple-900/50 border-purple-500/80 text-purple-200"
              : "bg-[#1a1b2d] hover:bg-[#24263f] border-[#272942] text-slate-200 hover:text-white"
          }`}
          title="Toggle Canvas Preview (Ctrl+P)"
          aria-label={isPreview ? "Exit Preview" : "Preview"}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Preview</span>
        </button>

        <button type="button" aria-label="Developer Code Workspace" title="Open Developer Code Workspace" onClick={onNavigateWorkspace} className="w-8 h-8 rounded-lg bg-[#1a1b2d] border border-[#272942] flex items-center justify-center">
          <Code2 className="w-3.5 h-3.5 text-purple-300" />
        </button>
        <button type="button" aria-label="Toggle Full Screen Canvas" title="Toggle Full Screen Canvas" onClick={onToggleFullScreenCanvas} className="w-8 h-8 rounded-lg bg-[#1a1b2d] border border-[#272942] flex items-center justify-center">
          <Maximize className="w-3.5 h-3.5" />
        </button>
        {/* Publish Button: Publish ➔ */}
        <button
          type="button"
          onClick={onOpenPublishModal}
          className="h-8 px-3.5 rounded-lg bg-[#9333ea] hover:bg-[#8b5cf6] text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-purple-900/40 transition cursor-pointer active:scale-95"
          title="Publish Website"
        >
          <span>Publish</span>
          <Rocket className="w-3.5 h-3.5" />
          {publishing.status === "PUBLISHED" && <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" aria-label="Published" />}
        </button>

        {/* Secondary Tools Menu (Preserving 100% of Existing Tools) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsMoreToolsOpen(!isMoreToolsOpen)}
            className="w-8 h-8 rounded-lg bg-[#1a1b2d] hover:bg-[#24263f] border border-[#272942] text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer shadow-xs"
            title="More Editor Tools & Actions"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {isMoreToolsOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-60 rounded-xl bg-[#171828] border border-[#272942] shadow-2xl p-1.5 z-50 text-xs text-slate-200 animate-in fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Save Button */}
              <button
                type="button"
                onClick={async () => {
                  setIsMoreToolsOpen(false);
                  await onSave();
                }}
                disabled={saving}
                className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left hover:bg-[#23253c] text-slate-200 hover:text-white transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400" /> : <Save className="w-3.5 h-3.5 text-blue-400" />}
                  <span>Save Changes</span>
                </div>
                <span className="text-[10px] text-slate-500">Ctrl+S</span>
              </button>

              {onOpenReplaceTemplate && (
                <button type="button" className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-[#23253c]" onClick={() => { setIsMoreToolsOpen(false); onOpenReplaceTemplate(); }}>
                  Replace Template
                </button>
              )}
              {/* Quick Search / Command Finder */}
              {onOpenFinder && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreToolsOpen(false);
                    onOpenFinder();
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left hover:bg-[#23253c] text-slate-200 hover:text-white transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-slate-400" />
                    <span>Quick Finder</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Ctrl+K</span>
                </button>
              )}

              {/* Developer Code Workspace */}
              <button
                type="button"
                onClick={() => {
                  setIsMoreToolsOpen(false);
                  onNavigateWorkspace();
                }}
                className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left hover:bg-[#23253c] text-slate-200 hover:text-white transition cursor-pointer"
              >
                <Code2 className="w-3.5 h-3.5 text-purple-400" />
                <span>Developer IDE Workspace</span>
              </button>

              {/* Unified AI Copilot */}
              <button
                type="button"
                onClick={() => {
                  setIsMoreToolsOpen(false);
                  onOpenAiAssistant();
                }}
                className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left hover:bg-[#23253c] text-slate-200 hover:text-white transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Unified AI Copilot</span>
              </button>

              {/* SEO Analyzer */}
              <button
                type="button"
                onClick={() => {
                  setIsMoreToolsOpen(false);
                  onOpenSeoModal();
                }}
                className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left hover:bg-[#23253c] text-slate-200 hover:text-white transition cursor-pointer"
              >
                <span className="text-xs">📈</span>
                <span>SEO & Quality Audit</span>
              </button>

              {/* Revision History */}
              {onOpenRevisionHistory && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreToolsOpen(false);
                    onOpenRevisionHistory();
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left hover:bg-[#23253c] text-slate-200 hover:text-white transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <History className="w-3.5 h-3.5 text-purple-400" />
                    <span>Revision History</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Restore</span>
                </button>
              )}

              {/* Popups Manager */}
              {onOpenPopupManager && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreToolsOpen(false);
                    onOpenPopupManager();
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left hover:bg-[#23253c] text-slate-200 hover:text-white transition cursor-pointer"
                >
                  <Layers2 className="w-3.5 h-3.5 text-teal-400" />
                  <span>Popups & Overlay Manager</span>
                </button>
              )}

              {/* Multilingual Translation & Export */}
              {onOpenMultilingual && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreToolsOpen(false);
                    onOpenMultilingual();
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left hover:bg-[#23253c] text-slate-200 hover:text-white transition cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5 text-sky-400" />
                  <span>Multilingual Export</span>
                </button>
              )}

              {/* A/B Tests */}
              <button
                type="button"
                onClick={() => {
                  setIsMoreToolsOpen(false);
                  onOpenExperimentModal();
                }}
                className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left hover:bg-[#23253c] text-slate-200 hover:text-white transition cursor-pointer"
              >
                <span className="text-xs">🧪</span>
                <span>A/B Experiments</span>
              </button>

              {/* Design Tokens & Variables */}
              <button
                type="button"
                onClick={() => {
                  setIsMoreToolsOpen(false);
                  onOpenVariablesModal();
                }}
                className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left hover:bg-[#23253c] text-slate-200 hover:text-white transition cursor-pointer"
              >
                <Palette className="w-3.5 h-3.5 text-indigo-400" />
                <span>Design Tokens & CSS Variables</span>
              </button>

              {/* Global Utility Classes */}
              <button
                type="button"
                onClick={() => {
                  setIsMoreToolsOpen(false);
                  onOpenClassModal();
                }}
                className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left hover:bg-[#23253c] text-slate-200 hover:text-white transition cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                <span>CSS Utility Classes</span>
              </button>

              {/* Collaborative Notes */}
              <button
                type="button"
                onClick={() => {
                  setIsMoreToolsOpen(false);
                  onToggleDesignNotes();
                }}
                className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left hover:bg-[#23253c] text-slate-200 hover:text-white transition cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                <span>Collaborative Notes</span>
              </button>

              {/* Developer Mode (Code Export) */}
              <button
                type="button"
                onClick={() => {
                  setIsMoreToolsOpen(false);
                  onOpenDevModal("export-code");
                }}
                className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left hover:bg-[#23253c] text-slate-200 hover:text-white transition cursor-pointer"
              >
                <Code2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Export Code & Assets</span>
              </button>

              {/* Keyboard Shortcuts Help */}
              {onOpenShortcutsHelp && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreToolsOpen(false);
                    onOpenShortcutsHelp();
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left hover:bg-[#23253c] text-slate-200 hover:text-white transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs">⌨️</span>
                    <span>Keyboard Shortcuts</span>
                  </div>
                  <span className="text-[10px] text-slate-500">?</span>
                </button>
              )}

              {/* Fullscreen Canvas Toggle */}
              <button
                type="button"
                onClick={() => {
                  setIsMoreToolsOpen(false);
                  onToggleFullScreenCanvas();
                }}
                className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left hover:bg-[#23253c] text-slate-200 hover:text-white transition cursor-pointer"
              >
                <span className="text-xs">⛶</span>
                <span>Toggle Full Screen Canvas</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
