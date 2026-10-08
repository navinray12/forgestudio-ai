import React, { useState, useEffect, useRef, useCallback } from "react";
import MonacoEditor, { DiffEditor } from "@monaco-editor/react";
import {
  X,
  Pin,
  Save,
  SplitSquareVertical,
  Columns,
  Sparkles,
  AlertCircle,
  Check,
  FileCode,
  FileText,
  FileJson,
  File,
  RotateCcw,
  Eye,
  Shield,
  History,
} from "lucide-react";
import type { ProjectFile } from "../services/forgeProjectService";

export interface OpenTab {
  path: string;
  name: string;
  file: ProjectFile;
  content: string;
  savedContent: string;
  isDirty: boolean;
  isPinned: boolean;
  language: string;
}

interface MultiFileEditorProps {
  tabs: OpenTab[];
  activePath: string | null;
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string) => void;
  onCloseOtherTabs: (path: string) => void;
  onCloseAllTabs: () => void;
  onTogglePinTab: (path: string) => void;
  onContentChange: (path: string, newContent: string) => void;
  onSaveFile: (path: string) => Promise<void>;
  onTriggerAiEdit?: (path: string, selectedCode: string, instruction: string) => Promise<string>;
  diagnostics?: Array<{
    file: string;
    line?: number;
    message: string;
    severity: "error" | "warning" | "info";
  }>;
  readOnly?: boolean;
}

function detectLanguage(filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  switch (ext) {
    case ".ts":
      return "typescript";
    case ".tsx":
      return "typescript";
    case ".js":
      return "javascript";
    case ".jsx":
      return "javascript";
    case ".json":
    case ".manifest":
      return "json";
    case ".css":
      return "css";
    case ".scss":
      return "scss";
    case ".html":
      return "html";
    case ".md":
      return "markdown";
    case ".yaml":
    case ".yml":
      return "yaml";
    default:
      return "plaintext";
  }
}

export const MultiFileEditor: React.FC<MultiFileEditorProps> = ({
  tabs,
  activePath,
  onSelectTab,
  onCloseTab,
  onCloseOtherTabs,
  onCloseAllTabs,
  onTogglePinTab,
  onContentChange,
  onSaveFile,
  onTriggerAiEdit,
  diagnostics = [],
  readOnly = false,
}) => {
  const [diffMode, setDiffMode] = useState(false);
  const [minimap, setMinimap] = useState(false);
  const [wordWrap, setWordWrap] = useState<"on" | "off">("on");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const editorRef = useRef<any>(null);

  const activeTab = tabs.find((t) => t.path === activePath);

  // Keyboard shortcut Ctrl/Cmd + S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (activeTab && activeTab.isDirty) {
          handleSave();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab]);

  const handleSave = async () => {
    if (!activeTab || saving) return;
    try {
      setSaving(true);
      await onSaveFile(activeTab.path);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err: any) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleEditorMount = (editor: any) => {
    editorRef.current = editor;
  };

  const handleAiEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim() || !activeTab || !onTriggerAiEdit) return;

    try {
      setAiGenerating(true);
      setAiError(null);
      const selection = editorRef.current?.getModel()?.getValueInRange(editorRef.current.getSelection()) || "";
      const transformed = await onTriggerAiEdit(activeTab.path, selection || activeTab.content, aiPrompt);
      if (transformed) {
        onContentChange(activeTab.path, transformed);
        setAiModalOpen(false);
        setAiPrompt("");
      }
    } catch (err: any) {
      setAiError(err.message || "Failed to generate AI code edits");
    } finally {
      setAiGenerating(false);
    }
  };

  const activeFileDiagnostics = diagnostics.filter((d) => d.file === activeTab?.path);

  const getTabIcon = (tab: OpenTab) => {
    const ext = tab.path.slice(tab.path.lastIndexOf(".")).toLowerCase();
    if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
      return <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    }
    if ([".json", ".manifest"].includes(ext)) {
      return <FileJson className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    }
    if ([".css", ".scss", ".html", ".md"].includes(ext)) {
      return <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
    }
    return <File className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
  };

  if (tabs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-slate-400 p-8 select-none">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 text-slate-500 shadow-inner">
          <FileCode className="w-8 h-8 opacity-40 text-blue-400" />
        </div>
        <h3 className="text-sm font-semibold text-slate-300 mb-1">No file open</h3>
        <p className="text-xs text-slate-500 max-w-sm text-center mb-6">
          Select a file from the Project Explorer or press{" "}
          <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[10px]">
            Ctrl/Cmd + P
          </kbd>{" "}
          to search files.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden select-none">
      {/* Top Tab Bar */}
      <div className="flex items-center justify-between bg-slate-900/90 border-b border-slate-800/80 px-2 py-0 overflow-x-auto scrollbar-thin">
        <div className="flex items-center space-x-1 overflow-x-auto py-1">
          {tabs.map((tab) => {
            const isActive = tab.path === activePath;
            return (
              <div
                key={tab.path}
                onClick={() => onSelectTab(tab.path)}
                className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-t-md text-xs font-mono border-t-2 transition-all cursor-pointer ${
                  isActive
                    ? "bg-slate-950 text-slate-100 border-blue-500 shadow-sm"
                    : "bg-slate-900/60 text-slate-400 border-transparent hover:bg-slate-800/60 hover:text-slate-200"
                }`}
              >
                {getTabIcon(tab)}
                <span className="truncate max-w-[140px]">{tab.name}</span>

                {/* Protected indicator */}
                {tab.file.isProtected && (
                  <span title="Protected manual source file" className="shrink-0 flex items-center">
                    <Shield className="w-3 h-3 text-amber-400" />
                  </span>
                )}

                {/* Dirty indicator */}
                {tab.isDirty && (
                  <span
                    className="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-pulse"
                    title="Unsaved changes"
                  />
                )}

                {/* Pin toggle */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePinTab(tab.path);
                  }}
                  className={`opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 ${
                    tab.isPinned ? "!opacity-100 text-blue-400" : ""
                  }`}
                  title={tab.isPinned ? "Unpin tab" : "Pin tab"}
                >
                  <Pin className="w-3 h-3" />
                </button>

                {/* Close Tab */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.path);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-rose-900/40 text-slate-400 hover:text-rose-300"
                  title="Close (Ctrl+W)"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Tab Actions Toolbar */}
        <div className="flex items-center gap-1 pl-2">
          {activeTab && (
            <>
              {/* Diff View Toggle */}
              <button
                type="button"
                onClick={() => setDiffMode(!diffMode)}
                className={`p-1.5 rounded text-xs flex items-center gap-1 transition ${
                  diffMode
                    ? "bg-blue-600/30 text-blue-300 border border-blue-500/50"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
                title={diffMode ? "Exit Diff View" : "Diff against saved revision"}
              >
                <SplitSquareVertical className="w-3.5 h-3.5" />
              </button>

              {/* AI Inline Assistant */}
              {onTriggerAiEdit && (
                <button
                  type="button"
                  onClick={() => setAiModalOpen(true)}
                  className="p-1.5 rounded text-xs flex items-center gap-1 text-purple-400 hover:bg-purple-950/40 hover:text-purple-300 transition"
                  title="AI Code Assistant"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Save Button */}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !activeTab.isDirty}
                className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                  saveSuccess
                    ? "bg-emerald-600 text-white"
                    : activeTab.isDirty
                    ? "bg-blue-600 hover:bg-blue-500 text-white shadow-sm cursor-pointer"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed"
                }`}
                title="Save File (Ctrl+S)"
              >
                {saveSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Saved</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>{saving ? "Saving..." : "Save"}</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Breadcrumb & Diagnostics Bar */}
      {activeTab && (
        <div className="flex items-center justify-between px-3 py-1 bg-slate-950 border-b border-slate-800/60 text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-slate-500">forge://</span>
            <span className="text-slate-300">{activeTab.path}</span>
            {activeTab.file.isProtected && (
              <span className="ml-2 px-1.5 py-0.2 rounded bg-amber-950/60 border border-amber-800/60 text-amber-300 text-[10px]">
                PROTECTED
              </span>
            )}
            {activeTab.file.isGenerated && (
              <span className="px-1.5 py-0.2 rounded bg-blue-950/60 border border-blue-800/60 text-blue-300 text-[10px]">
                GENERATED
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {activeFileDiagnostics.length > 0 && (
              <div className="flex items-center gap-1 text-rose-400 font-sans">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{activeFileDiagnostics.length} issue(s)</span>
              </div>
            )}
            <span className="text-slate-500 uppercase">{activeTab.language}</span>
            <span className="text-slate-500">v{activeTab.file.version || 1}</span>
          </div>
        </div>
      )}

      {/* Editor Main Canvas */}
      <div className="flex-1 relative overflow-hidden">
        {activeTab ? (
          diffMode ? (
            <DiffEditor
              height="100%"
              theme="vs-dark"
              language={activeTab.language}
              original={activeTab.savedContent}
              modified={activeTab.content}
              options={{
                readOnly,
                minimap: { enabled: minimap },
                fontSize: 13,
                wordWrap,
                automaticLayout: true,
                renderSideBySide: true,
              }}
            />
          ) : (
            <MonacoEditor
              height="100%"
              theme="vs-dark"
              language={activeTab.language}
              value={activeTab.content}
              onMount={handleEditorMount}
              onChange={(value) => {
                onContentChange(activeTab.path, value || "");
              }}
              options={{
                readOnly,
                minimap: { enabled: minimap },
                fontSize: 13,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                wordWrap,
                tabSize: 2,
                automaticLayout: true,
                cursorBlinking: "smooth",
                smoothScrolling: true,
                bracketPairColorization: { enabled: true },
              }}
            />
          )
        ) : null}
      </div>

      {/* AI Inline Edit Modal */}
      {aiModalOpen && activeTab && (
        <div className="absolute inset-x-4 top-14 z-30 max-w-xl mx-auto bg-slate-900 border border-purple-500/50 rounded-xl shadow-2xl p-4 backdrop-blur-md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-purple-300 font-semibold text-xs">
              <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
              <span>AI Code Transformation for {activeTab.name}</span>
            </div>
            <button
              onClick={() => setAiModalOpen(false)}
              className="text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleAiEditSubmit}>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g. Add responsive layout with flexbox and a gradient card background, or refactor props..."
              rows={3}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-500 resize-none font-mono"
              autoFocus
            />

            {aiError && (
              <p className="mt-2 text-xs text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {aiError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={() => setAiModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={aiGenerating || !aiPrompt.trim()}
                className="px-4 py-1.5 text-xs font-semibold rounded bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1.5 transition disabled:opacity-50"
              >
                {aiGenerating ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Apply Code Edit
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
