import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  FileCode,
  FileText,
  FileJson,
  File,
  Play,
  RotateCw,
  Camera,
  Layers,
  Settings,
  X,
  Code2,
  Sparkles,
} from "lucide-react";
import type { FileTreeNode } from "../services/forgeProjectService";

export interface CommandItem {
  id: string;
  title: string;
  category: "Files" | "Actions" | "Sync" | "Snapshots";
  shortcut?: string;
  icon?: React.ReactNode;
  onExecute: () => void;
}

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: FileTreeNode[];
  onSelectFile: (path: string) => void;
  onCompile: () => void;
  onSyncVisualToCode: () => void;
  onSyncCodeToVisual: () => void;
  onCreateSnapshot: () => void;
  onOpenManifest: () => void;
  initialMode?: "files" | "commands";
}

function flattenFiles(nodes: FileTreeNode[]): FileTreeNode[] {
  const result: FileTreeNode[] = [];
  for (const node of nodes) {
    if (!node.isDirectory) {
      result.push(node);
    }
    if (node.children && node.children.length > 0) {
      result.push(...flattenFiles(node.children));
    }
  }
  return result;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  files,
  onSelectFile,
  onCompile,
  onSyncVisualToCode,
  onSyncCodeToVisual,
  onCreateSnapshot,
  onOpenManifest,
  initialMode = "files",
}) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const flattenedFileList = flattenFiles(files);

  const fileCommands: CommandItem[] = flattenedFileList.map((file) => {
    const ext = file.extension.toLowerCase();
    let icon = <File className="w-4 h-4 text-slate-400" />;
    if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
      icon = <FileCode className="w-4 h-4 text-blue-400" />;
    } else if ([".json", ".manifest"].includes(ext)) {
      icon = <FileJson className="w-4 h-4 text-emerald-400" />;
    } else if ([".css", ".scss", ".html", ".md"].includes(ext)) {
      icon = <FileText className="w-4 h-4 text-cyan-400" />;
    }

    return {
      id: `file:${file.path}`,
      title: file.path,
      category: "Files",
      icon,
      onExecute: () => {
        onSelectFile(file.path);
        onClose();
      },
    };
  });

  const actionCommands: CommandItem[] = [
    {
      id: "action:compile",
      title: "Compile Project (Visual ↔ IR ↔ Source AST)",
      category: "Actions",
      shortcut: "Ctrl+Shift+B",
      icon: <Play className="w-4 h-4 text-emerald-400" />,
      onExecute: () => {
        onCompile();
        onClose();
      },
    },
    {
      id: "sync:visual-to-code",
      title: "Sync Visual Changes to Source Files",
      category: "Sync",
      shortcut: "Ctrl+Shift+V",
      icon: <RotateCw className="w-4 h-4 text-blue-400" />,
      onExecute: () => {
        onSyncVisualToCode();
        onClose();
      },
    },
    {
      id: "sync:code-to-visual",
      title: "Sync Source Code into Visual Builder (Reconcile)",
      category: "Sync",
      shortcut: "Ctrl+Shift+C",
      icon: <RotateCw className="w-4 h-4 text-purple-400" />,
      onExecute: () => {
        onSyncCodeToVisual();
        onClose();
      },
    },
    {
      id: "snapshot:create",
      title: "Create Point-in-Time Filesystem Snapshot",
      category: "Snapshots",
      icon: <Camera className="w-4 h-4 text-amber-400" />,
      onExecute: () => {
        onCreateSnapshot();
        onClose();
      },
    },
    {
      id: "action:manifest",
      title: "View / Edit Project Manifest (forge.manifest.json)",
      category: "Actions",
      icon: <Settings className="w-4 h-4 text-cyan-400" />,
      onExecute: () => {
        onOpenManifest();
        onClose();
      },
    },
  ];

  const allItems: CommandItem[] = [...actionCommands, ...fileCommands];

  const filteredItems = allItems.filter((item) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev - 1 < 0 ? Math.max(0, filteredItems.length - 1) : prev - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].onExecute();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-xs select-none">
      <div
        className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-slate-800 bg-slate-900/90 gap-2.5">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or filename to search..."
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-1.5 scrollbar-thin">
          {filteredItems.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-slate-500">
              No matching files or commands found
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => item.onExecute()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition ${
                    isSelected
                      ? "bg-blue-600 text-white"
                      : "text-slate-300 hover:bg-slate-800/80"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="shrink-0">{item.icon}</span>
                    <span className="font-mono truncate">{item.title}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold ${
                        isSelected
                          ? "bg-blue-700 text-blue-100"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {item.category}
                    </span>
                    {item.shortcut && (
                      <kbd
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                          isSelected
                            ? "bg-blue-800 text-blue-200"
                            : "bg-slate-800 text-slate-400 border border-slate-700"
                        }`}
                      >
                        {item.shortcut}
                      </kbd>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Footer Help */}
        <div className="px-3 py-2 bg-slate-950 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between font-mono">
          <div className="flex items-center gap-3">
            <span>↑↓ navigate</span>
            <span>↵ select</span>
            <span>esc close</span>
          </div>
          <span>ForgeStudio Command Engine</span>
        </div>
      </div>
    </div>
  );
};
