import React, { useState } from "react";
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileJson,
  File,
  Plus,
  FolderPlus,
  Trash2,
  Edit2,
  RefreshCw,
  Search,
  ChevronRight,
  ChevronDown,
  Shield,
  FileCheck,
} from "lucide-react";
import type { FileTreeNode } from "../services/forgeProjectService";

interface ProjectExplorerProps {
  tree: FileTreeNode[];
  activeFilePath?: string;
  onSelectFile: (path: string) => void;
  onCreateFile: (path: string) => void;
  onCreateFolder: (path: string) => void;
  onDeleteFile: (path: string) => void;
  onRenameFile: (oldPath: string, newPath: string) => void;
  onRefresh: () => void;
  loading?: boolean;
}

export const ProjectExplorer: React.FC<ProjectExplorerProps> = ({
  tree,
  activeFilePath,
  onSelectFile,
  onCreateFile,
  onCreateFolder,
  onDeleteFile,
  onRenameFile,
  onRefresh,
  loading = false,
}) => {
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState<"file" | "folder" | null>(null);
  const [newPathInput, setNewPathInput] = useState("");
  const [selectedFolderForCreate, setSelectedFolderForCreate] = useState("");
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");

  const toggleCollapse = (dirPath: string) => {
    setCollapsedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) {
        next.delete(dirPath);
      } else {
        next.add(dirPath);
      }
      return next;
    });
  };

  const getFileIcon = (node: FileTreeNode) => {
    if (node.isDirectory) {
      const isCollapsed = collapsedPaths.has(node.path);
      return isCollapsed ? (
        <Folder className="w-4 h-4 text-amber-400 shrink-0" />
      ) : (
        <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
      );
    }
    const ext = node.extension.toLowerCase();
    if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
      return <FileCode className="w-4 h-4 text-blue-400 shrink-0" />;
    }
    if ([".json", ".manifest"].includes(ext) || node.name.includes("manifest")) {
      return <FileJson className="w-4 h-4 text-emerald-400 shrink-0" />;
    }
    if ([".css", ".scss", ".html", ".md"].includes(ext)) {
      return <FileText className="w-4 h-4 text-cyan-400 shrink-0" />;
    }
    return <File className="w-4 h-4 text-slate-400 shrink-0" />;
  };

  const handleStartCreate = (type: "file" | "folder", basePath = "") => {
    setShowCreateModal(type);
    setSelectedFolderForCreate(basePath);
    setNewPathInput("");
  };

  const handleConfirmCreate = () => {
    if (!newPathInput.trim()) return;
    const finalPath = selectedFolderForCreate
      ? `${selectedFolderForCreate}/${newPathInput.trim()}`
      : newPathInput.trim();

    if (showCreateModal === "file") {
      onCreateFile(finalPath);
    } else {
      onCreateFolder(finalPath);
    }
    setShowCreateModal(null);
    setNewPathInput("");
  };

  const handleStartRename = (node: FileTreeNode) => {
    setRenamingPath(node.path);
    setRenameInput(node.name);
  };

  const handleConfirmRename = (oldPath: string) => {
    if (!renameInput.trim()) {
      setRenamingPath(null);
      return;
    }
    const dir = oldPath.includes("/") ? oldPath.substring(0, oldPath.lastIndexOf("/")) : "";
    const newPath = dir ? `${dir}/${renameInput.trim()}` : renameInput.trim();
    onRenameFile(oldPath, newPath);
    setRenamingPath(null);
  };

  const filterTree = (nodes: FileTreeNode[]): FileTreeNode[] => {
    if (!searchQuery.trim()) return nodes;
    const q = searchQuery.toLowerCase();

    return nodes
      .map((node) => {
        if (node.isDirectory) {
          const matchingChildren = filterTree(node.children || []);
          if (matchingChildren.length > 0 || node.name.toLowerCase().includes(q)) {
            return { ...node, children: matchingChildren };
          }
          return null;
        }
        return node.name.toLowerCase().includes(q) || node.path.toLowerCase().includes(q) ? node : null;
      })
      .filter(Boolean) as FileTreeNode[];
  };

  const renderNode = (node: FileTreeNode, level = 0) => {
    const isSelected = activeFilePath === node.path;
    const isCollapsed = collapsedPaths.has(node.path);

    return (
      <div key={node.id} className="select-none">
        <div
          className={`group flex items-center justify-between px-2 py-1 text-xs cursor-pointer rounded transition-colors ${
            isSelected
              ? "bg-blue-600/20 text-blue-400 font-medium"
              : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
          }`}
          style={{ paddingLeft: `${level * 14 + 8}px` }}
          onClick={() => {
            if (node.isDirectory) {
              toggleCollapse(node.path);
            } else {
              onSelectFile(node.path);
            }
          }}
        >
          <div className="flex items-center gap-1.5 min-w-0 truncate">
            {node.isDirectory && (
              <span className="text-slate-400">
                {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </span>
            )}
            {getFileIcon(node)}

            {renamingPath === node.path ? (
              <input
                type="text"
                autoFocus
                className="bg-slate-900 border border-blue-500 rounded px-1 py-0.5 text-xs text-white focus:outline-none"
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                onBlur={() => handleConfirmRename(node.path)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirmRename(node.path);
                  if (e.key === "Escape") setRenamingPath(null);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="truncate">{node.name}</span>
            )}

            {node.isProtected && (
              <span title="Protected manual code" className="shrink-0 flex items-center">
                <Shield className="w-3 h-3 text-amber-400" />
              </span>
            )}
            {node.isGenerated && (
              <span title="Generated file" className="shrink-0 flex items-center">
                <FileCheck className="w-3 h-3 text-blue-400/60" />
              </span>
            )}
          </div>

          <div className="hidden group-hover:flex items-center gap-1 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
            {node.isDirectory && (
              <button
                type="button"
                onClick={() => handleStartCreate("file", node.path)}
                className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white rounded"
                title="New file in this folder"
              >
                <Plus className="w-3 h-3" />
              </button>
            )}
            <button
              type="button"
              onClick={() => handleStartRename(node)}
              className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white rounded"
              title="Rename"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => onDeleteFile(node.path)}
              className="p-1 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded"
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {node.isDirectory && !isCollapsed && node.children && (
          <div>
            {node.children.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const filtered = filterTree(tree);

  return (
    <div className="flex flex-col h-full bg-slate-950 border-r border-slate-800/80 w-64 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800/80 bg-slate-900/40">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Explorer</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleStartCreate("file")}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition"
            title="New File"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleStartCreate("folder")}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition"
            title="New Folder"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className={`p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition ${
              loading ? "animate-spin text-blue-400" : ""
            }`}
            title="Refresh Filesystem"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-2 border-b border-slate-800/80">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search files..."
            className="w-full bg-slate-900 border border-slate-800 rounded-md pl-8 pr-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* File Tree List */}
      <div className="flex-1 overflow-y-auto p-1 py-2 space-y-0.5 custom-scrollbar">
        {filtered.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500">
            {searchQuery ? "No matching files" : "No files in project"}
          </div>
        ) : (
          filtered.map((node) => renderNode(node))
        )}
      </div>

      {/* Create Modal Dialog */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 w-full max-w-sm shadow-2xl space-y-3">
            <h3 className="text-sm font-semibold text-slate-100">
              Create New {showCreateModal === "file" ? "File" : "Folder"}
            </h3>
            {selectedFolderForCreate && (
              <p className="text-xs text-slate-400">
                Inside: <code className="text-blue-400">{selectedFolderForCreate}/</code>
              </p>
            )}
            <input
              type="text"
              autoFocus
              placeholder={showCreateModal === "file" ? "src/components/Card.tsx" : "components"}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              value={newPathInput}
              onChange={(e) => setNewPathInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirmCreate();
                if (e.key === "Escape") setShowCreateModal(null);
              }}
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCreate}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
