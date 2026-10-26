import React from "react";
import type { DocumentAcknowledgement } from "../../../../features/editor-access/save-authorized-website";
import type { ElementType } from "../../types";

/** What renderFinderOverlay reads: the editor values and callbacks the inline JSX used. */
export interface FinderOverlayDeps {
  finderQuery: string;
  handleAddElement: (type: ElementType, targetId?: string | null) => void;
  handleGenerateSupportToken: () => Promise<void>;
  handleQuitEditor: () => void;
  handleRedo: () => void;
  handleReorderElement: (id: string, direction: "up" | "down") => void;
  handleSave: () => Promise<DocumentAcknowledgement | undefined>;
  handleUndo: () => void;
  isFinderOpen: boolean;
  isPreview: boolean;
  isShortcutsHelpOpen: boolean;
  selectedId: string | null;
  setFinderQuery: React.Dispatch<React.SetStateAction<string>>;
  setIsFinderOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsPreview: React.Dispatch<React.SetStateAction<boolean>>;
  setIsShortcutsHelpOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setLeftSidebarTab: React.Dispatch<React.SetStateAction<"elements" | "navigator" | "templates">>;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  updatePreference: <K extends keyof FinderOverlayDeps["userPreferences"]>(key: K, value: { autoSaveEnabled: boolean; gridOverlay: boolean; themeMode: "dark" | "light"; }[K]) => void;
  userPreferences: { autoSaveEnabled: boolean; gridOverlay: boolean; themeMode: "dark" | "light"; };
}

/**
 * Finder command palette (Ctrl+K): search input, filtered pages / templates / settings / features, keyboard handling inside the palette.
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 14273-14606 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderFinderOverlay({
  finderQuery,
  handleAddElement,
  handleGenerateSupportToken,
  handleQuitEditor,
  handleRedo,
  handleReorderElement,
  handleSave,
  handleUndo,
  isFinderOpen,
  isPreview,
  isShortcutsHelpOpen,
  selectedId,
  setFinderQuery,
  setIsFinderOpen,
  setIsPreview,
  setIsShortcutsHelpOpen,
  setLeftSidebarTab,
  setSelectedId,
  updatePreference,
  userPreferences,
}: FinderOverlayDeps): React.ReactNode {
  return (
      isFinderOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-20 px-4 backdrop-blur-sm" onClick={() => setIsFinderOpen(false)}>
          <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200" onClick={(e) => e.stopPropagation()}>
            {/* Search Header Input */}
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 bg-slate-50/50">
              <span className="text-slate-400 text-lg">🔍</span>
              <input
                type="text"
                autoFocus
                value={finderQuery}
                onChange={(e) => setFinderQuery(e.target.value)}
                onKeyDown={(e) => {
                  // Handle Escape once here; stop it before the window handler can close a second overlay.
                  if (e.key !== "Escape") return;
                  e.preventDefault();
                  e.stopPropagation();
                  if (isShortcutsHelpOpen) setIsShortcutsHelpOpen(false);
                  else setIsFinderOpen(false);
                }}
                placeholder="Search pages, templates, settings and features... (Esc to close)"
                className="w-full bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => setIsFinderOpen(false)}
                className="rounded-lg px-2 py-1 text-xs font-bold text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
              >
                ✕
              </button>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 px-4 py-2 border-b border-slate-100 bg-white text-[11px] overflow-x-auto">
              <span className="text-slate-400 font-semibold mr-1">Filter:</span>
              <span className="rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 font-medium">Pages</span>
              <span className="rounded-full bg-purple-50 text-purple-600 px-2 py-0.5 font-medium">Templates</span>
              <span className="rounded-full bg-blue-50 text-blue-600 px-2 py-0.5 font-medium">Settings</span>
              <span className="rounded-full bg-emerald-50 text-emerald-600 px-2 py-0.5 font-medium">Features</span>
            </div>

            {/* Search Results List */}
            <div className="max-h-[380px] overflow-y-auto p-2 divide-y divide-slate-50">
              {[
                {
                  id: "page-home",
                  title: "Home Page",
                  category: "page",
                  icon: "📄",
                  description: "Current main landing page route (/)",
                  keywords: "home page index main route",
                  action: () => {
                    setIsPreview(false);
                    setSelectedId(null);
                  },
                },
                {
                  id: "page-settings",
                  title: "Page Settings",
                  category: "page",
                  icon: "⚙️",
                  description: "Configure page title, SEO description, URL slug",
                  keywords: "page settings config seo title description slug",
                  action: () => {
                    setIsPreview(false);
                    setSelectedId(null);
                  },
                },
                {
                  id: "tpl-hero",
                  title: "Hero Section Template",
                  category: "template",
                  icon: "✨",
                  description: "Header section with title, subtitle & action button",
                  keywords: "hero header template banner section title subtitle button",
                  action: () => {
                    setIsPreview(false);
                    setLeftSidebarTab("elements");
                    handleAddElement("container");
                  },
                },
                {
                  id: "tpl-features",
                  title: "Features Grid Template",
                  category: "template",
                  icon: "📌",
                  description: "Container block layout for product feature cards",
                  keywords: "features grid template cards layout block container",
                  action: () => {
                    setIsPreview(false);
                    setLeftSidebarTab("elements");
                    handleAddElement("container");
                  },
                },
                {
                  id: "tpl-cta",
                  title: "Call to Action Template",
                  category: "template",
                  icon: "🚀",
                  description: "Conversion banner block with text and primary button",
                  keywords: "call to action cta template banner button conversion",
                  action: () => {
                    setIsPreview(false);
                    setLeftSidebarTab("elements");
                    handleAddElement("button");
                  },
                },
                {
                  id: "set-maintenance",
                  title: "Maintenance Mode",
                  category: "setting",
                  icon: "🛠️",
                  description: "Show temporary maintenance state to public visitors",
                  keywords: "maintenance mode public temporary offline state",
                  action: () => {
                    setIsPreview(false);
                    setSelectedId(null);
                  },
                },
                {
                  id: "set-sitelang",
                  title: "Site Published Language",
                  category: "setting",
                  icon: "🌐",
                  description: "Set published HTML lang attribute (en, es, fr, de...)",
                  keywords: "site language html lang published website",
                  action: () => {
                    setIsPreview(false);
                    setSelectedId(null);
                  },
                },
                {
                  id: "set-editorlang",
                  title: "Editor UI Language",
                  category: "setting",
                  icon: "🗣️",
                  description: "Switch Editor interface language (English, Spanish...)",
                  keywords: "editor language ui interface translate english spanish french german",
                  action: () => {
                    setIsPreview(false);
                    setSelectedId(null);
                  },
                },
                {
                  id: "set-grid",
                  title: "Canvas Alignment Grid",
                  category: "setting",
                  icon: "📐",
                  description: "Toggle 20px visual layout grid overlay on canvas",
                  keywords: "grid alignment layout overlay canvas guidelines",
                  action: () => {
                    updatePreference("gridOverlay", !userPreferences.gridOverlay);
                  },
                },
                {
                  id: "set-theme",
                  title: "Header Toolbar Theme",
                  category: "setting",
                  icon: "🎨",
                  description: "Switch Header theme between Dark Navy and Light Modern",
                  keywords: "theme dark light header toolbar appearance mode",
                  action: () => {
                    updatePreference("themeMode", userPreferences.themeMode === "dark" ? "light" : "dark");
                  },
                },
                {
                  id: "feat-elements",
                  title: "Elements Palette",
                  category: "feature",
                  icon: "🧱",
                  description: "Browse containers, headings, text, images & buttons",
                  keywords: "elements palette add container heading text image button widgets",
                  action: () => {
                    setIsPreview(false);
                    setLeftSidebarTab("elements");
                  },
                },
                {
                  id: "feat-navigator",
                  title: "Navigator Layers",
                  category: "feature",
                  icon: "🌳",
                  description: "Visual tree structure hierarchy navigation panel",
                  keywords: "navigator layers tree structure hierarchy elements outline",
                  action: () => {
                    setIsPreview(false);
                    setLeftSidebarTab("navigator");
                  },
                },
                {
                  id: "feat-save",
                  title: "Save Website",
                  category: "feature",
                  icon: "💾",
                  description: "Persist all editor elements & page settings (Ctrl+S)",
                  keywords: "save site website persist publish store ctrl+s",
                  action: () => {
                    handleSave();
                  },
                },
                {
                  id: "feat-preview",
                  title: "Toggle Preview Mode",
                  category: "feature",
                  icon: "👁️",
                  description: "Switch between editing canvas and published site view (Ctrl+P)",
                  keywords: "preview mode view exit preview test ctrl+p",
                  action: () => {
                    setIsPreview(!isPreview);
                  },
                },
                {
                  id: "feat-undo",
                  title: "Undo Action",
                  category: "feature",
                  icon: "↩️",
                  description: "Restore previous canvas state (Ctrl+Z)",
                  keywords: "undo revert history ctrl+z",
                  action: () => {
                    handleUndo();
                  },
                },
                {
                  id: "feat-redo",
                  title: "Redo Action",
                  category: "feature",
                  icon: "↪️",
                  description: "Reapply undone canvas change (Ctrl+Y)",
                  keywords: "redo reapply history ctrl+y",
                  action: () => {
                    handleRedo();
                  },
                },
                {
                  id: "feat-moveup",
                  title: "Move Section Up",
                  category: "feature",
                  icon: "▲",
                  description: "Move selected section upward in page hierarchy (Alt+Up)",
                  keywords: "move section up reorder upward alt+up",
                  action: () => {
                    if (selectedId) handleReorderElement(selectedId, "up");
                  },
                },
                {
                  id: "feat-movedown",
                  title: "Move Section Down",
                  category: "feature",
                  icon: "▼",
                  description: "Move selected section downward in page hierarchy (Alt+Down)",
                  keywords: "move section down reorder downward alt+down",
                  action: () => {
                    if (selectedId) handleReorderElement(selectedId, "down");
                  },
                },
                {
                  id: "feat-support",
                  title: "Temporary Support Token",
                  category: "feature",
                  icon: "🔐",
                  description: "Generate 2-hour temporary support access credential",
                  keywords: "support token access credentials temporary auth troubleshooting",
                  action: () => {
                    setIsPreview(false);
                    setSelectedId(null);
                    handleGenerateSupportToken();
                  },
                },
                {
                  id: "feat-quit",
                  title: "Quit Editor",
                  category: "feature",
                  icon: "🚪",
                  description: "Exit visual editor and return to Dashboard",
                  keywords: "quit exit return dashboard leave back",
                  action: () => {
                    handleQuitEditor();
                  },
                },
              ]
                .filter((item) => {
                  if (!finderQuery.trim()) return true;
                  const q = finderQuery.toLowerCase().trim();
                  return (
                    item.title.toLowerCase().includes(q) ||
                    item.description.toLowerCase().includes(q) ||
                    item.keywords.toLowerCase().includes(q) ||
                    item.category.toLowerCase().includes(q)
                  );
                })
                .map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setIsFinderOpen(false);
                      setFinderQuery("");
                      item.action();
                    }}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 cursor-pointer transition group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-base shadow-sm group-hover:bg-blue-600 group-hover:text-white transition">
                        {item.icon}
                      </span>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition flex items-center gap-2">
                          <span>{item.title}</span>
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${item.category === "page"
                              ? "bg-slate-100 text-slate-600"
                              : item.category === "template"
                                ? "bg-purple-100 text-purple-700"
                                : item.category === "setting"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}
                          >
                            {item.category}
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <span className="text-xs text-slate-300 group-hover:text-blue-500 transition font-bold">
                      →
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )
  );
}
