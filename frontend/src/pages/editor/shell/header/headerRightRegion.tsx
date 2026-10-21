import React from "react";
import { AutosaveStatusIndicator } from "../../../../features/autosave";
import type { AutosaveStatus } from "../../../../features/autosave/types/autosave.types";
import type { PeerItem } from "../../../../features/collaboration/hooks/useCanvasPresence";
import type { DocumentAcknowledgement } from "../../../../features/editor-access/save-authorized-website";
import type { UserAccessContext } from "../../../../features/permissions/hooks/useComponentAccess";
import type { DeveloperModalMode } from "../../components/DeveloperModal";
import type { EditorElement, PublishingState } from "../../types";
import { Code2, Copy, Eye, FileText, HistoryIcon, Layers, Lock, MessageSquare, Palette, Redo, RefreshCw, Rocket, Save, Search, Sparkles, Undo } from "lucide-react";
import type { NavigateFunction } from "react-router-dom";

/** What renderHeaderRightRegion reads: the editor values and callbacks the inline JSX used. */
export interface HeaderRightRegionDeps {
  autosaveError: string | null;
  autosaveLastSavedAt: number | null;
  autosaveStatus: AutosaveStatus;
  canvasPeers: PeerItem[];
  canvasTheme: "light" | "dark";
  devModalMode: DeveloperModalMode | null;
  errorMessage: string;
  handleCopyElement: (idToCopy?: string | null | undefined, e?: React.MouseEvent<Element, MouseEvent> | undefined) => void;
  handleDuplicateElement: (idToDuplicate?: string | null | undefined, e?: React.MouseEvent<Element, MouseEvent> | undefined) => void;
  handleOpenReplaceTemplate: () => void;
  handleRedo: () => void;
  handleReorderElement: (id: string, direction: "up" | "down") => void;
  handleSave: () => Promise<DocumentAcknowledgement | undefined>;
  handleSaveAsComponent: (elementId: string) => void;
  handleUndo: () => void;
  history: EditorElement[][];
  historyIndex: number;
  isDesignNotesOpen: boolean;
  isFullScreenCanvas: boolean;
  isPreview: boolean;
  isRestrictedMode: boolean;
  navigate: NavigateFunction;
  publishing: PublishingState;
  saveMessage: string;
  saving: boolean;
  selectedId: string | null;
  setCanvasTheme: React.Dispatch<React.SetStateAction<"light" | "dark">>;
  setDevModalMode: React.Dispatch<React.SetStateAction<DeveloperModalMode | null>>;
  setIsClassModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsDesignNotesOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsExperimentModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsFinderOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsFullScreenCanvas: React.Dispatch<React.SetStateAction<boolean>>;
  setIsPreview: React.Dispatch<React.SetStateAction<boolean>>;
  setIsPublishModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsRevisionHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSeoModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsVariablesModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  userAccess: UserAccessContext;
  websiteId: string | undefined;
}

/**
 * Editor header, right region: compact tools, history (undo / redo), save status, Save, Code Workspace, Publish and the other primary actions.
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 3616-3925 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderHeaderRightRegion({
  autosaveError,
  autosaveLastSavedAt,
  autosaveStatus,
  canvasPeers,
  canvasTheme,
  devModalMode,
  errorMessage,
  handleCopyElement,
  handleDuplicateElement,
  handleOpenReplaceTemplate,
  handleRedo,
  handleReorderElement,
  handleSave,
  handleSaveAsComponent,
  handleUndo,
  history,
  historyIndex,
  isDesignNotesOpen,
  isFullScreenCanvas,
  isPreview,
  isRestrictedMode,
  navigate,
  publishing,
  saveMessage,
  saving,
  selectedId,
  setCanvasTheme,
  setDevModalMode,
  setIsClassModalOpen,
  setIsDesignNotesOpen,
  setIsExperimentModalOpen,
  setIsFinderOpen,
  setIsFullScreenCanvas,
  setIsPreview,
  setIsPublishModalOpen,
  setIsRevisionHistoryOpen,
  setIsSeoModalOpen,
  setIsVariablesModalOpen,
  userAccess,
  websiteId,
}: HeaderRightRegionDeps): React.ReactNode {
  return (
          <div className="flex items-center justify-end gap-1.5 md:gap-2 shrink-0">
            {/* Status Messages */}
            {saveMessage && <span role="status" aria-live="polite" className={`text-xs font-medium shrink-0 ${saveMessage.startsWith("Save failed") ? "text-red-400" : "text-emerald-400"}`}>{saveMessage}</span>}
            {errorMessage && <span role="alert" className="text-xs font-medium text-red-400 shrink-0 max-w-sm">{errorMessage}</span>}
            {/* Autosave status (F-321): shows failures instead of only logging them; hidden for read-only access */}
            {userAccess.canEditContent && (
              <AutosaveStatusIndicator status={autosaveStatus} lastSavedAt={autosaveLastSavedAt} errorMessage={autosaveError} />
            )}

            {/* History Controls Group (Undo / Redo / History) */}
            <div className="flex items-center gap-0.5 bg-[#16203a] p-0.5 rounded-lg border border-slate-700/80 shrink-0">
              <button
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="w-7 h-7 flex items-center justify-center rounded text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                title="Undo (Ctrl+Z)"
                aria-label="Undo"
              >
                <Undo className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className="w-7 h-7 flex items-center justify-center rounded text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                title="Redo (Ctrl+Y)"
                aria-label="Redo"
              >
                <Redo className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsRevisionHistoryOpen(true)}
                className="w-7 h-7 flex items-center justify-center rounded text-slate-300 hover:text-white hover:bg-slate-800 transition border-l border-slate-700/80 cursor-pointer"
                title="Revision History"
                aria-label="Revision History"
              >
                <HistoryIcon className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Selected Element Quick Actions (Only active when element selected) */}
            {selectedId && (
              <div className="hidden xl:flex items-center gap-0.5 bg-[#16203a] p-0.5 rounded-lg border border-blue-500/40 shrink-0">
                <button
                  onClick={() => handleReorderElement(selectedId, "up")}
                  className="w-6 h-6 flex items-center justify-center text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded cursor-pointer"
                  title="Move Up"
                  aria-label="Move Up"
                >
                  ▲
                </button>
                <button
                  onClick={() => handleReorderElement(selectedId, "down")}
                  className="w-6 h-6 flex items-center justify-center text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded cursor-pointer"
                  title="Move Down"
                  aria-label="Move Down"
                >
                  ▼
                </button>
                <button
                  onClick={(e) => handleCopyElement(selectedId, e)}
                  className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 rounded cursor-pointer"
                  title="Copy (Ctrl+C)"
                  aria-label="Copy Element"
                >
                  <Copy className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => handleDuplicateElement(selectedId, e)}
                  className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 rounded cursor-pointer"
                  title="Duplicate (Ctrl+D)"
                  aria-label="Duplicate Element"
                >
                  <Layers className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleSaveAsComponent(selectedId)}
                  className="w-6 h-6 flex items-center justify-center text-purple-300 bg-purple-900/40 hover:bg-purple-800 rounded cursor-pointer"
                  title="Save as Reusable Component"
                  aria-label="Save Component"
                >
                  🧩
                </button>
                <button
                  onClick={handleOpenReplaceTemplate}
                  className="w-6 h-6 flex items-center justify-center text-amber-300 bg-amber-900/40 hover:bg-amber-800 rounded cursor-pointer"
                  title="Replace with Template"
                  aria-label="Replace with Template"
                >
                  🔄
                </button>
              </div>
            )}

            {/* Icon-Based Utility Tools Group */}
            <div className="flex items-center gap-1 border-l border-slate-700/80 pl-1.5 shrink-0">
              {/* Search */}
              <button
                type="button"
                onClick={() => setIsFinderOpen(true)}
                className="w-7 h-7 rounded-lg border border-slate-700/80 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white transition flex items-center justify-center shadow-xs cursor-pointer"
                title="Search (Ctrl+K)"
                aria-label="Search"
              >
                <Search className="w-3.5 h-3.5" />
              </button>

              {/* SEO & Quality Audit */}
              <button
                type="button"
                onClick={() => setIsSeoModalOpen(true)}
                className="w-7 h-7 rounded-lg border border-indigo-500/40 bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-300 hover:text-white transition flex items-center justify-center shadow-xs cursor-pointer"
                title="SEO & Quality Audit"
                aria-label="SEO & Quality Audit"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              </button>

              {/* Tokens */}
              <button
                type="button"
                onClick={() => setIsVariablesModalOpen(true)}
                className="w-7 h-7 rounded-lg border border-indigo-500/40 bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-300 hover:text-white transition flex items-center justify-center shadow-xs cursor-pointer"
                title="Design Variables & CSS Tokens"
                aria-label="Tokens"
              >
                <Palette className="w-3.5 h-3.5 text-indigo-400" />
              </button>

              {/* F-339: Dynamic Multi-Mode Theme Toggle */}
              <button
                type="button"
                onClick={() => setCanvasTheme((t) => (t === "light" ? "dark" : "light"))}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition flex items-center gap-1.5 cursor-pointer ${canvasTheme === "dark"
                  ? "bg-indigo-950/60 text-indigo-300 border-indigo-700/80 shadow-sm"
                  : "bg-amber-950/30 text-amber-300 border-amber-700/60"
                  }`}
                title="Toggle Dynamic Canvas Theme (☀️ Light / 🌙 Dark)"
              >
                <span>{canvasTheme === "dark" ? "🌙 Dark" : "☀️ Light"}</span>
              </button>

              {/* Live Real-time Collaborators Avatar Stack */}
              {canvasPeers.length > 0 && (
                <div className="flex items-center -space-x-1.5 overflow-hidden pl-1 pr-1" title={`${canvasPeers.length} other collaborator(s) online`}>
                  {canvasPeers.map((peer) => (
                    <div
                      key={peer.socketId}
                      title={`${peer.user.name} is currently editing`}
                      className="relative flex items-center justify-center w-6 h-6 rounded-full text-[9px] font-extrabold text-white ring-2 ring-slate-900 shadow-sm transition hover:z-20 hover:scale-110"
                      style={{ backgroundColor: peer.user.color }}
                    >
                      {peer.user.name.slice(0, 2).toUpperCase()}
                    </div>
                  ))}
                </div>
              )}

              {/* Client Restricted Mode Badge */}
              {isRestrictedMode && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold shadow-xs">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Client Editor Mode (Content Only)</span>
                </div>
              )}

              {/* F-339: Variables Manager (Tokens) */}
              <button
                type="button"
                onClick={() => setIsVariablesModalOpen(true)}
                className="px-3 py-1 text-xs font-semibold rounded-lg border text-indigo-300 bg-indigo-950/40 hover:bg-indigo-900/60 border-indigo-800/60 transition flex items-center gap-1.5 cursor-pointer"
                title="Design Variables & CSS Tokens (F-339)"
              >
                <span>🎨</span>
                <span>Tokens</span>
              </button>


              {/* Classes */}
              <button
                type="button"
                onClick={() => setIsClassModalOpen(true)}
                className="w-7 h-7 rounded-lg border border-emerald-500/40 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 hover:text-white transition flex items-center justify-center shadow-xs cursor-pointer"
                title="Global Utility Classes"
                aria-label="Classes"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
              </button>

              {/* Notes */}
              <button
                type="button"
                onClick={() => setIsDesignNotesOpen(!isDesignNotesOpen)}
                className={`w-7 h-7 rounded-lg border transition flex items-center justify-center shadow-xs cursor-pointer ${isDesignNotesOpen
                  ? "bg-purple-600/30 text-purple-200 border-purple-500/60"
                  : "text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border-slate-700/80"
                  }`}
                title="Collaborative Design Notes"
                aria-label="Notes"
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </button>

              {/* Dev Mode */}
              <button
                type="button"
                onClick={() => setDevModalMode((prev) => (prev === "export-code" ? null : "export-code"))}
                className={`w-7 h-7 rounded-lg border transition flex items-center justify-center shadow-xs cursor-pointer ${devModalMode === "export-code"
                  ? "bg-blue-600 text-white border-blue-500"
                  : "text-blue-300 bg-blue-900/40 hover:bg-blue-800/60 border-blue-700/60"
                  }`}
                title="Developer Mode"
                aria-label="Developer Mode"
              >
                <Code2 className="w-3.5 h-3.5" />
              </button>

              {/* Phase 3: A/B Split Testing */}
              <button
                type="button"
                onClick={() => setIsExperimentModalOpen(true)}
                className="px-3 py-1 text-xs font-semibold rounded-lg border text-purple-300 bg-purple-950/40 hover:bg-purple-900/60 border-purple-800/60 transition flex items-center gap-1.5 cursor-pointer"
                title="A/B Split Testing & Conversion Experiments"
              >
                <span>🧪</span>
                <span>A/B Tests</span>
              </button>


              {/* Fullscreen Canvas */}
              <button
                type="button"
                onClick={() => setIsFullScreenCanvas(!isFullScreenCanvas)}
                className="w-7 h-7 rounded-lg border border-slate-700/80 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white transition flex items-center justify-center shadow-xs cursor-pointer"
                title="Toggle Full Screen Canvas"
                aria-label="Toggle Full Screen Canvas"
              >
                <span className="text-xs leading-none">⛶</span>
              </button>
            </div>

            {/* Divider */}
            <div className="h-4 w-px bg-slate-700/80 mx-0.5 shrink-0" />

            {/* Primary Actions: Preview, Save, Publish */}
            {/* Preview Button */}
            <button
              type="button"
              onClick={() => setIsPreview(!isPreview)}
              className={`w-8 h-8 rounded-lg border transition flex items-center justify-center shadow-sm cursor-pointer shrink-0 ${isPreview
                ? "bg-amber-500/20 text-amber-300 border-amber-500/60 hover:bg-amber-500/30"
                : "bg-slate-800/80 text-slate-300 border-slate-700/80 hover:bg-slate-700/80 hover:text-white"
                }`}
              title={isPreview ? "Exit Preview (Ctrl+P)" : "Preview"}
              aria-label={isPreview ? "Exit Preview" : "Preview"}
            >
              <Eye className="w-4 h-4" />
            </button>

            {/* Save Button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="h-8 px-3 rounded-lg border border-blue-500 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Save (Ctrl+S)"
              aria-label="Save"
            >
              {saving ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Save</span>
            </button>

            {/* Code Workspace Button */}
            <button
              type="button"
              onClick={async () => {
                // The workspace generates code from the saved document, so an unconfirmed
                // save must not navigate: handleSave reports the failure in the editor.
                if (userAccess.canEditContent) {
                  const saved = await handleSave();
                  if (!saved) return;
                }
                navigate(`/workspace/website/${websiteId}`);
              }}
              className="h-8 px-3 rounded-lg border border-purple-500/60 bg-gradient-to-r from-purple-900/60 to-indigo-900/60 hover:from-purple-800/80 hover:to-indigo-800/80 text-purple-200 hover:text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0"
              title="Open Developer Code Workspace (Full Project IDE, React & Next.js Generation)"
              aria-label="Developer Code Workspace"
            >
              <Code2 className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Code Workspace</span>
            </button>

            {/* Publish Button */}
            <button
              type="button"
              onClick={() => setIsPublishModalOpen(true)}
              className="h-8 px-3.5 relative rounded-lg border border-emerald-500/50 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs transition flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0"
              title="Publish Website"
              aria-label="Publish"
            >
              <Rocket className="w-3.5 h-3.5" />
              <span>Publish</span>
              {publishing.status === "PUBLISHED" && (
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse ring-1 ring-emerald-950"></span>
              )}
            </button>
          </div>
  );
}
