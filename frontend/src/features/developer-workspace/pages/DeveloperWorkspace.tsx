import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Code2,
  Columns,
  Play,
  RotateCw,
  Camera,
  Layers,
  Terminal,
  AlertCircle,
  FileCode,
  FileJson,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  FileText,
  Search,
  Maximize2,
  Minimize2,
  Hammer,
  Package,
  Bug,
  Globe,
  Workflow,
  Link2,
  GitBranch,
  Bot,
  Database,
  FolderArchive,
  Zap,
  Users,
} from "lucide-react";
import {
  forgeProjectService,
  type ForgeProject,
  type FileTreeNode,
  type ProjectFile,
} from "../services/forgeProjectService";
import { ProjectExplorer } from "../components/ProjectExplorer";
import { MultiFileEditor, type OpenTab } from "../components/MultiFileEditor";
import { CommandPaletteModal } from "../components/CommandPaletteModal";
import { TerminalPanel } from "../components/TerminalPanel";
import { DependencyPanel } from "../components/DependencyPanel";
import { BuildPanel } from "../components/BuildPanel";
import { DebugPanel } from "../components/DebugPanel";
import { LivePreviewPanel } from "../components/LivePreviewPanel";
import { HostingPanel } from "../components/HostingPanel";
import { CicdPanel } from "../components/CicdPanel";
import { DomainPanel } from "../components/DomainPanel";
import { GitPanel } from "../components/GitPanel";
import { AiAgentPanel } from "../components/AiAgentPanel";
import { DatabaseStudioPanel } from "../components/DatabaseStudioPanel";
import { ObjectStoragePanel } from "../components/ObjectStoragePanel";
import { AppRuntimePanel } from "../components/AppRuntimePanel";
import { DeveloperQualityPanel } from "../components/DeveloperQualityPanel";
import { DeveloperOpsSecurityPanel } from "../components/DeveloperOpsSecurityPanel";
import { DeveloperIntelligencePanel } from "../components/DeveloperIntelligencePanel";
import { DeveloperPlatformPanel } from "../components/DeveloperPlatformPanel";

type WorkspaceMode = "code" | "split" | "preview";
type BottomTab = "ai" | "git" | "terminal" | "build" | "hosting" | "cicd" | "domains" | "dependencies" | "database" | "storage" | "runtime" | "quality" | "devops" | "intelligence" | "platform" | "debug" | "output" | "problems" | "manifest" | "snapshots";



export const DeveloperWorkspace: React.FC = () => {
  const { projectId, websiteId } = useParams<{ projectId?: string; websiteId?: string }>();
  const navigate = useNavigate();

  // Project state
  const [project, setProject] = useState<ForgeProject | null>(null);
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editor tabs state
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);

  // Workspace layout state
  const [mode, setMode] = useState<WorkspaceMode>("code");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [bottomDrawerOpen, setBottomDrawerOpen] = useState(true);
  const [activeBottomTab, setActiveBottomTab] = useState<BottomTab>("output");
  const [bottomDrawerHeight, setBottomDrawerHeight] = useState(200);

  // Modals & Popups
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);
  const [snapshotName, setSnapshotName] = useState("");
  const [snapshotDesc, setSnapshotDesc] = useState("");

  // System output logs & diagnostics
  const [logs, setLogs] = useState<Array<{ id: string; time: string; text: string; type: "info" | "success" | "warn" | "error" }>>([]);
  const [diagnostics, setDiagnostics] = useState<Array<{ file: string; line?: number; message: string; severity: "error" | "warning" | "info" }>>([]);
  const [manifest, setManifest] = useState<any>(null);
  const [snapshots, setSnapshots] = useState<any[]>([]);

  // Operation statuses
  const [compiling, setCompiling] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "diverged">("synced");

  // Generator Modal state (Modules 08 & 09)
  const [generatorModalOpen, setGeneratorModalOpen] = useState(false);
  const [selectedFramework, setSelectedFramework] = useState<"react" | "nextjs">("react");
  const [generationScopeType, setGenerationScopeType] = useState<"full" | "page">("full");
  const [generating, setGenerating] = useState(false);
  const [generationPlan, setGenerationPlan] = useState<any>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);

  const addLog = useCallback((text: string, type: "info" | "success" | "warn" | "error" = "info") => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev.slice(-150), { id: Math.random().toString(), time, text, type }]);
  }, []);

  // 1. Initial Load: Fetch or bridge project
  useEffect(() => {
    let isMounted = true;
    async function initProject() {
      try {
        setLoading(true);
        setError(null);
        let currentProj: ForgeProject;

        if (projectId) {
          const res = await forgeProjectService.getProject(projectId);
          currentProj = res.project;
        } else if (websiteId) {
          const res = await forgeProjectService.getProjectByWebsite(websiteId);
          currentProj = res.project;
        } else {
          throw new Error("No project ID or website ID specified");
        }

        if (!isMounted) return;
        setProject(currentProj);
        addLog(`Loaded project: ${currentProj.name} (${currentProj.framework})`, "info");

        // Load file tree
        const treeRes = await forgeProjectService.getFileTree(currentProj.id);
        if (isMounted) setFileTree(treeRes.tree || []);

        // Load manifest
        try {
          const mRes = await forgeProjectService.getManifest(currentProj.id);
          if (isMounted) setManifest(mRes.manifest);
        } catch (e) {
          console.warn("Could not load manifest:", e);
        }

        // Open default file (e.g. src/App.tsx or index.html)
        const findDefaultFile = (nodes: FileTreeNode[]): string | null => {
          for (const node of nodes) {
            if (!node.isDirectory && (node.path.includes("App.tsx") || node.path.includes("main.tsx") || node.path.includes("index.html"))) {
              return node.path;
            }
            if (node.children) {
              const found = findDefaultFile(node.children);
              if (found) return found;
            }
          }
          return nodes.find((n) => !n.isDirectory)?.path || null;
        };

        const defaultPath = findDefaultFile(treeRes.tree || []);
        if (defaultPath && isMounted) {
          openFileByPath(currentProj.id, defaultPath);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Failed to initialize developer workspace");
          addLog(`Initialization error: ${err.message}`, "error");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initProject();
    return () => {
      isMounted = false;
    };
  }, [projectId, websiteId]);

  // Open file helper
  const openFileByPath = async (pId: string, filePath: string) => {
    // If tab is already open, simply activate it
    const existing = openTabs.find((t) => t.path === filePath);
    if (existing) {
      setActivePath(filePath);
      return;
    }

    try {
      const { file } = await forgeProjectService.readFile(pId, filePath);
      const newTab: OpenTab = {
        path: file.path,
        name: file.name,
        file,
        content: file.content || "",
        savedContent: file.content || "",
        isDirty: false,
        isPinned: false,
        language: file.extension === ".ts" || file.extension === ".tsx" ? "typescript" : file.extension === ".json" ? "json" : file.extension === ".css" ? "css" : file.extension === ".html" ? "html" : "javascript",
      };

      setOpenTabs((prev) => [...prev, newTab]);
      setActivePath(filePath);
      addLog(`Opened: ${filePath}`, "info");
    } catch (err: any) {
      addLog(`Failed to open ${filePath}: ${err.message}`, "error");
    }
  };

  const handleSelectFile = (filePath: string) => {
    if (!project) return;
    openFileByPath(project.id, filePath);
  };

  // Tab management
  const handleSelectTab = (path: string) => {
    setActivePath(path);
  };

  const handleCloseTab = (path: string) => {
    const tabToClose = openTabs.find((t) => t.path === path);
    if (tabToClose?.isDirty) {
      if (!window.confirm(`${tabToClose.name} has unsaved changes. Discard?`)) {
        return;
      }
    }
    const nextTabs = openTabs.filter((t) => t.path !== path);
    setOpenTabs(nextTabs);
    if (activePath === path) {
      setActivePath(nextTabs.length > 0 ? nextTabs[nextTabs.length - 1].path : null);
    }
  };

  const handleCloseOtherTabs = (keepPath: string) => {
    const nextTabs = openTabs.filter((t) => t.path === keepPath || t.isPinned);
    setOpenTabs(nextTabs);
    setActivePath(keepPath);
  };

  const handleCloseAllTabs = () => {
    const pinned = openTabs.filter((t) => t.isPinned);
    setOpenTabs(pinned);
    setActivePath(pinned.length > 0 ? pinned[0].path : null);
  };

  const handleTogglePinTab = (path: string) => {
    setOpenTabs((prev) =>
      prev.map((t) => (t.path === path ? { ...t, isPinned: !t.isPinned } : t))
    );
  };

  const handleContentChange = (path: string, newContent: string) => {
    setOpenTabs((prev) =>
      prev.map((t) =>
        t.path === path
          ? {
              ...t,
              content: newContent,
              isDirty: newContent !== t.savedContent,
            }
          : t
      )
    );
    setSyncStatus("diverged");
  };

  // File save with optimistic concurrency
  const handleSaveFile = async (path: string) => {
    if (!project) return;
    const tab = openTabs.find((t) => t.path === path);
    if (!tab) return;

    try {
      const res = await forgeProjectService.writeFile(project.id, path, {
        content: tab.content,
        expectedVersion: tab.file.version,
      });

      setOpenTabs((prev) =>
        prev.map((t) =>
          t.path === path
            ? {
                ...t,
                file: res.file,
                savedContent: tab.content,
                isDirty: false,
              }
            : t
        )
      );

      addLog(`Saved ${path} (v${res.file.version})`, "success");
    } catch (err: any) {
      addLog(`Save failed for ${path}: ${err.message}`, "error");
      throw err;
    }
  };

  // Filesystem CRUD triggers
  const handleRefreshTree = async () => {
    if (!project) return;
    try {
      const res = await forgeProjectService.getFileTree(project.id);
      setFileTree(res.tree || []);
      addLog("Filesystem refreshed", "info");
    } catch (err: any) {
      addLog(`Refresh error: ${err.message}`, "error");
    }
  };

  const handleCreateFile = async (filePath: string) => {
    if (!project) return;
    try {
      await forgeProjectService.writeFile(project.id, filePath, {
        content: `// ${filePath}\n`,
      });
      await handleRefreshTree();
      openFileByPath(project.id, filePath);
      addLog(`Created file: ${filePath}`, "success");
    } catch (err: any) {
      addLog(`Failed to create ${filePath}: ${err.message}`, "error");
    }
  };

  const handleCreateFolder = async (folderPath: string) => {
    if (!project) return;
    try {
      const placeholder = `${folderPath}/.keep`;
      await forgeProjectService.writeFile(project.id, placeholder, {
        content: "",
      });
      await handleRefreshTree();
      addLog(`Created folder: ${folderPath}`, "success");
    } catch (err: any) {
      addLog(`Failed to create folder ${folderPath}: ${err.message}`, "error");
    }
  };

  const handleDeleteFile = async (filePath: string) => {
    if (!project) return;
    try {
      await forgeProjectService.deleteFile(project.id, filePath);
      setOpenTabs((prev) => prev.filter((t) => t.path !== filePath));
      if (activePath === filePath) {
        setActivePath(null);
      }
      await handleRefreshTree();
      addLog(`Deleted: ${filePath}`, "info");
    } catch (err: any) {
      addLog(`Delete error: ${err.message}`, "error");
    }
  };

  const handleRenameFile = async (oldPath: string, newPath: string) => {
    if (!project) return;
    try {
      await forgeProjectService.moveFile(project.id, oldPath, newPath);
      setOpenTabs((prev) =>
        prev.map((t) => (t.path === oldPath ? { ...t, path: newPath, name: newPath.split("/").pop() || "" } : t))
      );
      if (activePath === oldPath) setActivePath(newPath);
      await handleRefreshTree();
      addLog(`Renamed ${oldPath} to ${newPath}`, "success");
    } catch (err: any) {
      addLog(`Rename error: ${err.message}`, "error");
    }
  };

  // Compile Project (Visual ↔ IR ↔ AST ↔ Source)
  const handleCompile = async () => {
    if (!project || compiling) return;
    try {
      setCompiling(true);
      addLog("Starting compilation (Unified IR & Source AST)...", "info");
      const res = await forgeProjectService.compileProject(project.id);
      addLog(`Compilation succeeded: ${res.result?.filesCount || 0} source files generated`, "success");
      setDiagnostics(res.result?.diagnostics || []);
      setSyncStatus("synced");
      await handleRefreshTree();
    } catch (err: any) {
      addLog(`Compilation failed: ${err.message}`, "error");
    } finally {
      setCompiling(false);
    }
  };

  // Visual ↔ Code Sync
  const handleSyncVisualToCode = async () => {
    if (!project || syncing) return;
    try {
      setSyncing(true);
      addLog("Synchronizing visual canvas into source files...", "info");
      await handleCompile();
      addLog("Visual to code synchronization complete", "success");
    } catch (err: any) {
      addLog(`Visual sync failed: ${err.message}`, "error");
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncCodeToVisual = async () => {
    if (!project || !activePath || syncing) return;
    try {
      setSyncing(true);
      addLog(`Reconciling code changes in ${activePath} into Visual Builder...`, "info");
      const res = await forgeProjectService.syncCodeToVisual(project.id, activePath);
      if (res.success) {
        addLog(`Reconciled ${res.appliedChangesCount} visual elements without regressions`, "success");
        setSyncStatus("synced");
      }
      if (res.conflicts && res.conflicts.length > 0) {
        addLog(`Notice: ${res.conflicts.length} manual code conflicts preserved`, "warn");
      }
    } catch (err: any) {
      addLog(`Code to visual reconciliation error: ${err.message}`, "error");
    } finally {
      setSyncing(false);
    }
  };

  // Snapshot creation
  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !snapshotName.trim()) return;
    try {
      const res = await forgeProjectService.createSnapshot(project.id, {
        name: snapshotName.trim(),
        description: snapshotDesc.trim(),
      });
      addLog(`Created snapshot: ${res.snapshot?.name} (${res.snapshot?.fileCount} files)`, "success");
      setSnapshotModalOpen(false);
      setSnapshotName("");
      setSnapshotDesc("");
      loadSnapshots();
    } catch (err: any) {
      addLog(`Snapshot failed: ${err.message}`, "error");
    }
  };

  const loadSnapshots = async () => {
    if (!project) return;
    try {
      const res = await forgeProjectService.listSnapshots(project.id);
      setSnapshots(res.snapshots || []);
    } catch (e) {
      console.warn("Could not load snapshots:", e);
    }
  };

  const handleLoadPlan = async (framework: "react" | "nextjs") => {
    if (!project) return;
    try {
      setLoadingPlan(true);
      const res = await forgeProjectService.getGenerationPlan(project.id, framework);
      setGenerationPlan(res.plan);
    } catch (err: any) {
      addLog(`Failed to load plan: ${err.message}`, "error");
    } finally {
      setLoadingPlan(false);
    }
  };

  const handleRunGeneration = async () => {
    if (!project || generating) return;
    try {
      setGenerating(true);
      addLog(`Starting transactional ${selectedFramework.toUpperCase()} project generation...`, "info");

      let res;
      if (generationScopeType === "page" && activePath) {
        res = await forgeProjectService.regenerateScope(project.id, selectedFramework, {
          type: "page",
          targetPath: activePath,
        });
      } else if (selectedFramework === "react") {
        res = await forgeProjectService.generateReactProject(project.id);
      } else {
        res = await forgeProjectService.generateNextJsProject(project.id);
      }

      if (res.success) {
        addLog(
          `Successfully generated ${selectedFramework.toUpperCase()} project: ${res.result?.filesWritten || 0} written, ${res.result?.filesPreserved || 0} preserved, ${res.result?.filesMerged || 0} merged`,
          "success"
        );
        await handleRefreshTree();
        setGeneratorModalOpen(false);
      } else {
        addLog(`Generation failed: ${res.result?.diagnostics?.[0]?.message || "Check error log"}`, "error");
      }
    } catch (err: any) {
      addLog(`Generation error: ${err.message}`, "error");
    } finally {
      setGenerating(false);
    }
  };

  // Keyboard shortcut listener for Command Palette (Ctrl+P / Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "k")) {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-slate-300">
        <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center animate-spin mb-4">
          <Code2 className="w-6 h-6 text-blue-400" />
        </div>
        <h2 className="text-base font-semibold text-slate-100 mb-1">Booting Forge Developer Workspace...</h2>
        <p className="text-xs text-slate-500">Initializing persistent filesystem & compiler pipelines</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-slate-300 p-6">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
        <h2 className="text-lg font-bold text-slate-100 mb-2">Workspace Initialization Failed</h2>
        <p className="text-xs text-rose-400 font-mono mb-6 max-w-md text-center">{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
        >
          Return to Previous Page
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-200 overflow-hidden font-sans select-none">
      {/* 1. Header / Workspace Toolbar */}
      <header className="h-12 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-3 shrink-0 z-20">
        {/* Left: Project identity & Back button */}
        <div className="flex items-center gap-3">
          {project.websiteId && (
            <button
              onClick={() => navigate(`/editor/${project.websiteId}`)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-100 px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-800 transition"
              title="Return to Visual Builder"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Visual Editor</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-slate-100 tracking-tight">{project.name}</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-950/80 border border-blue-800/60 text-blue-300 uppercase">
              {project.framework}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/80 border border-emerald-800/60 text-emerald-400">
              {project.lifecycleStatus}
            </span>
          </div>
        </div>

        {/* Center: Workspace Mode Switcher */}
        <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
          <button
            onClick={() => setMode("code")}
            className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
              mode === "code"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Code Only</span>
          </button>

          <button
            onClick={() => setMode("split")}
            className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
              mode === "split"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Split Preview</span>
          </button>

          <button
            onClick={() => setMode("preview")}
            className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
              mode === "preview"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Full Preview</span>
          </button>
        </div>

        {/* Right: Actions (Compile, Sync, Snapshots, Palette) */}
        <div className="flex items-center gap-2">
          {/* Live Sync Status indicator */}
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-semibold ${
              syncStatus === "synced"
                ? "text-emerald-400 bg-emerald-950/50 border border-emerald-800/40"
                : syncStatus === "syncing"
                ? "text-blue-400 bg-blue-950/50 border border-blue-800/40 animate-pulse"
                : "text-amber-400 bg-amber-950/50 border border-amber-800/40"
            }`}
            title="Visual ↔ Source Synchronizer status"
          >
            {syncStatus === "synced" && <CheckCircle className="w-3 h-3 text-emerald-400" />}
            {syncStatus === "syncing" && <RotateCw className="w-3 h-3 text-blue-400 animate-spin" />}
            {syncStatus === "diverged" && <AlertTriangle className="w-3 h-3 text-amber-400" />}
            <span className="capitalize">{syncStatus}</span>
          </div>

          {/* Compile Button */}
          <button
            onClick={handleCompile}
            disabled={compiling}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-semibold shadow-sm transition disabled:opacity-50"
            title="Compile Project (IR & Source AST)"
          >
            <Play className={`w-3.5 h-3.5 ${compiling ? "animate-spin" : ""}`} />
            <span>{compiling ? "Compiling..." : "Compile"}</span>
          </button>

          {/* Project Generator Button (Modules 08 & 09) */}
          <button
            onClick={() => {
              setGeneratorModalOpen(true);
              handleLoadPlan(selectedFramework);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-semibold shadow-sm transition"
            title="Generate React or Next.js Production Project"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Project</span>
          </button>

          {/* Sync Code → Visual */}
          <button
            onClick={handleSyncCodeToVisual}
            disabled={syncing || !activePath}
            className="flex items-center gap-1 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 px-2.5 py-1.5 rounded-md text-xs font-medium transition disabled:opacity-40"
            title="Reconcile active source code back into Visual Builder"
          >
            <RotateCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            <span>Reconcile Visual</span>
          </button>

          {/* Snapshot Button */}
          <button
            onClick={() => {
              setSnapshotModalOpen(true);
              loadSnapshots();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition"
            title="Snapshots"
          >
            <Camera className="w-4 h-4" />
          </button>

          {/* Command Palette Trigger */}
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-md text-xs border border-slate-700 font-mono transition"
            title="Quick Open (Ctrl+P)"
          >
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span>Ctrl+P</span>
          </button>
        </div>
      </header>

      {/* 2. Main Workspace Body: Project Explorer + Editor + Preview */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: Project Explorer Sidebar */}
        {sidebarOpen && (
          <div className="w-64 h-full bg-slate-900 border-r border-slate-800 shrink-0 flex flex-col">
            <ProjectExplorer
              tree={fileTree}
              activeFilePath={activePath || undefined}
              onSelectFile={handleSelectFile}
              onCreateFile={handleCreateFile}
              onCreateFolder={handleCreateFolder}
              onDeleteFile={handleDeleteFile}
              onRenameFile={handleRenameFile}
              onRefresh={handleRefreshTree}
              loading={loading}
            />
          </div>
        )}

        {/* Center: Multi-File Code Editor */}
        {mode !== "preview" && (
          <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
            <MultiFileEditor
              tabs={openTabs}
              activePath={activePath}
              onSelectTab={handleSelectTab}
              onCloseTab={handleCloseTab}
              onCloseOtherTabs={handleCloseOtherTabs}
              onCloseAllTabs={handleCloseAllTabs}
              onTogglePinTab={handleTogglePinTab}
              onContentChange={handleContentChange}
              onSaveFile={handleSaveFile}
              diagnostics={diagnostics}
            />
          </div>
        )}

        {/* Right: Live Preview Panel */}
        {(mode === "split" || mode === "preview") && (
          <div className={`${mode === "preview" ? "flex-1" : "w-1/2"} h-full`}>
            <LivePreviewPanel
              projectId={project.id}
              websiteId={project.websiteId}
              onInspectElement={(filePath) => {
                openFileByPath(project.id, filePath);
              }}
            />
          </div>
        )}
      </div>

      {/* 3. Bottom Drawer: Terminal, Build, Dependencies, Debug, Problems, Manifest, Snapshots */}
      <div
        className={`bg-slate-900 border-t border-slate-800 flex flex-col transition-all duration-150 shrink-0 ${
          bottomDrawerOpen ? "" : "h-9"
        }`}
        style={{ height: bottomDrawerOpen ? `${bottomDrawerHeight}px` : "36px" }}
      >
        {/* Drawer Header Tabs */}
        <div className="h-9 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between px-3">
          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => {
                setActiveBottomTab("ai");
                setBottomDrawerOpen(true);
              }}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                bottomDrawerOpen && activeBottomTab === "ai"
                  ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Bot className="w-3.5 h-3.5 text-indigo-400" />
              <span>AI Agents</span>
            </button>

            <button
              onClick={() => {
                setActiveBottomTab("git");
                setBottomDrawerOpen(true);
              }}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                bottomDrawerOpen && activeBottomTab === "git"
                  ? "bg-slate-800 text-slate-100 shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
              <span>Git & GitHub</span>
            </button>

            <button
              onClick={() => {
                setActiveBottomTab("terminal");
                setBottomDrawerOpen(true);
              }}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                bottomDrawerOpen && activeBottomTab === "terminal"
                  ? "bg-slate-800 text-slate-100 shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-blue-400" />
              <span>Terminal</span>
            </button>

            <button
              onClick={() => {
                setActiveBottomTab("build");
                setBottomDrawerOpen(true);
              }}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                bottomDrawerOpen && activeBottomTab === "build"
                  ? "bg-slate-800 text-slate-100 shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Hammer className="w-3.5 h-3.5 text-emerald-400" />
              <span>Build</span>
            </button>

            <button
              onClick={() => {
                setActiveBottomTab("hosting");
                setBottomDrawerOpen(true);
              }}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                bottomDrawerOpen && activeBottomTab === "hosting"
                  ? "bg-slate-800 text-slate-100 shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>Hosting</span>
            </button>

            <button
              onClick={() => {
                setActiveBottomTab("cicd");
                setBottomDrawerOpen(true);
              }}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                bottomDrawerOpen && activeBottomTab === "cicd"
                  ? "bg-slate-800 text-slate-100 shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Workflow className="w-3.5 h-3.5 text-cyan-400" />
              <span>CI/CD</span>
            </button>

            <button
              onClick={() => {
                setActiveBottomTab("domains");
                setBottomDrawerOpen(true);
              }}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                bottomDrawerOpen && activeBottomTab === "domains"
                  ? "bg-slate-800 text-slate-100 shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Link2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Domains</span>
            </button>

            <button
              onClick={() => {
                setActiveBottomTab("dependencies");
                setBottomDrawerOpen(true);
              }}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                bottomDrawerOpen && activeBottomTab === "dependencies"
                  ? "bg-slate-800 text-slate-100 shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Package className="w-3.5 h-3.5 text-cyan-400" />
              <span>Dependencies</span>
            </button>

            <button
              onClick={() => {
                setActiveBottomTab("database");
                setBottomDrawerOpen(true);
              }}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                bottomDrawerOpen && activeBottomTab === "database"
                  ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>Database</span>
            </button>

            <button
              onClick={() => {
                setActiveBottomTab("storage");
                setBottomDrawerOpen(true);
              }}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                bottomDrawerOpen && activeBottomTab === "storage"
                  ? "bg-amber-600/30 text-amber-300 border border-amber-500/40 shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <FolderArchive className="w-3.5 h-3.5 text-amber-400" />
              <span>Storage</span>
            </button>

            <button
              onClick={() => {
                setActiveBottomTab("runtime");
                setBottomDrawerOpen(true);
              }}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                bottomDrawerOpen && activeBottomTab === "runtime"
                  ? "bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span>Runtime</span>
            </button>

            <button
              onClick={() => {
                setActiveBottomTab("quality");
                setBottomDrawerOpen(true);
              }}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                bottomDrawerOpen && activeBottomTab === "quality"
                  ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Quality & Testing</span>
            </button>

            <button
              onClick={() => {
                setActiveBottomTab("devops");
                setBottomDrawerOpen(true);
              }}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                bottomDrawerOpen && activeBottomTab === "devops"
                  ? "bg-rose-600/30 text-rose-300 border border-rose-500/40 shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>DevOps & Security</span>
            </button>

            <button
              onClick={() => {
                setActiveBottomTab("intelligence");
                setBottomDrawerOpen(true);
              }}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                bottomDrawerOpen && activeBottomTab === "intelligence"
                  ? "bg-violet-600/30 text-violet-300 border border-violet-500/40 shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span>Intelligence & Arch</span>
            </button>

            <button
              onClick={() => {
                setActiveBottomTab("platform");
                setBottomDrawerOpen(true);
              }}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                bottomDrawerOpen && activeBottomTab === "platform"
                  ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span>Platform & Collab</span>
            </button>

            <button
              onClick={() => {
                setActiveBottomTab("debug");
                setBottomDrawerOpen(true);
              }}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                bottomDrawerOpen && activeBottomTab === "debug"
                  ? "bg-slate-800 text-slate-100 shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Bug className="w-3.5 h-3.5 text-purple-400" />
              <span>Debug</span>
            </button>

            <button
              onClick={() => {
                setActiveBottomTab("problems");
                setBottomDrawerOpen(true);
              }}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                bottomDrawerOpen && activeBottomTab === "problems"
                  ? "bg-slate-800 text-slate-100 shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Problems ({diagnostics.length})</span>
            </button>

            <button
              onClick={() => {
                setActiveBottomTab("manifest");
                setBottomDrawerOpen(true);
              }}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                bottomDrawerOpen && activeBottomTab === "manifest"
                  ? "bg-slate-800 text-slate-100 shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileJson className="w-3.5 h-3.5 text-teal-400" />
              <span>Manifest</span>
            </button>

            <button
              onClick={() => {
                setActiveBottomTab("snapshots");
                setBottomDrawerOpen(true);
                loadSnapshots();
              }}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                bottomDrawerOpen && activeBottomTab === "snapshots"
                  ? "bg-slate-800 text-slate-100 shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Camera className="w-3.5 h-3.5 text-rose-400" />
              <span>Snapshots ({snapshots.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setBottomDrawerOpen(!bottomDrawerOpen)}
              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded"
              title={bottomDrawerOpen ? "Collapse Drawer" : "Expand Drawer"}
            >
              {bottomDrawerOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Drawer Tab Content */}
        {bottomDrawerOpen && (
          <div className="flex-1 overflow-hidden bg-slate-950">
            {activeBottomTab === "ai" && (
              <AiAgentPanel
                projectId={project.id}
                onOpenFile={(file) => openFileByPath(project.id, file)}
              />
            )}

            {activeBottomTab === "git" && (
              <GitPanel
                projectId={project.id}
                onOpenFile={(file) => openFileByPath(project.id, file)}
              />
            )}

            {activeBottomTab === "terminal" && <TerminalPanel projectId={project.id} />}

            {activeBottomTab === "build" && <BuildPanel projectId={project.id} />}

            {activeBottomTab === "hosting" && <HostingPanel projectId={project.id} />}

            {activeBottomTab === "cicd" && <CicdPanel projectId={project.id} />}

            {activeBottomTab === "domains" && <DomainPanel projectId={project.id} />}

            {activeBottomTab === "dependencies" && <DependencyPanel projectId={project.id} />}

            {activeBottomTab === "database" && <DatabaseStudioPanel projectId={project.id} />}

            {activeBottomTab === "storage" && <ObjectStoragePanel projectId={project.id} />}

            {activeBottomTab === "runtime" && <AppRuntimePanel projectId={project.id} />}

            {activeBottomTab === "quality" && <DeveloperQualityPanel projectId={project.id} />}

            {activeBottomTab === "devops" && <DeveloperOpsSecurityPanel projectId={project.id} />}

            {activeBottomTab === "intelligence" && <DeveloperIntelligencePanel projectId={project.id} />}
            {activeBottomTab === "platform" && <DeveloperPlatformPanel projectId={project.id} onLog={addLog} />}

            {activeBottomTab === "debug" && (
              <DebugPanel
                projectId={project.id}
                onJumpToSource={(file) => openFileByPath(project.id, file)}
              />
            )}

            {activeBottomTab === "output" && (
              <div className="p-3 font-mono text-xs overflow-y-auto h-full space-y-1">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-slate-600 select-none">{log.time}</span>
                    <span
                      className={
                        log.type === "error"
                          ? "text-rose-400 font-semibold"
                          : log.type === "warn"
                          ? "text-amber-400"
                          : log.type === "success"
                          ? "text-emerald-400"
                          : "text-slate-300"
                      }
                    >
                      {log.text}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {activeBottomTab === "problems" && (
              <div className="p-3 font-mono text-xs overflow-y-auto h-full space-y-1">
                {diagnostics.length === 0 ? (
                  <div className="text-slate-500 py-4 text-center">No problems or compiler diagnostics detected.</div>
                ) : (
                  diagnostics.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 py-1 text-rose-400 border-b border-slate-900">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span className="text-slate-400">{d.file}:{d.line || 1}</span>
                      <span>{d.message}</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeBottomTab === "manifest" && (
              <div className="p-3 overflow-y-auto h-full">
                <pre className="text-cyan-300 font-mono text-[11px] leading-relaxed">
                  {JSON.stringify(manifest, null, 2)}
                </pre>
              </div>
            )}

            {activeBottomTab === "snapshots" && (
              <div className="p-3 space-y-2 overflow-y-auto h-full">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400 text-xs font-sans">Point-in-time filesystem snapshots</span>
                  <button
                    onClick={() => setSnapshotModalOpen(true)}
                    className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-semibold font-sans"
                  >
                    + New Snapshot
                  </button>
                </div>
                {snapshots.map((s) => (
                  <div key={s.id} className="flex items-center justify-between bg-slate-900 p-2 rounded border border-slate-800 text-xs">
                    <div>
                      <div className="font-semibold text-slate-200">{s.name}</div>
                      <div className="text-[10px] text-slate-500">{new Date(s.createdAt).toLocaleString()} • {s.fileCount} files</div>
                    </div>
                    <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono">
                      {s.manifestSnapshot?.schemaVersion || "v1.0.0"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Command Palette Modal */}
      <CommandPaletteModal
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        files={fileTree}
        onSelectFile={handleSelectFile}
        onCompile={handleCompile}
        onSyncVisualToCode={handleSyncVisualToCode}
        onSyncCodeToVisual={handleSyncCodeToVisual}
        onCreateSnapshot={() => setSnapshotModalOpen(true)}
        onOpenManifest={() => {
          setActiveBottomTab("manifest");
          setBottomDrawerOpen(true);
        }}
      />

      {/* Snapshot Modal */}
      {snapshotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-100 mb-1">Create Filesystem Snapshot</h3>
            <p className="text-xs text-slate-400 mb-4">
              Capture the entire source tree and manifest state for instant rollback.
            </p>
            <form onSubmit={handleCreateSnapshot} className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">Snapshot Name</label>
                <input
                  type="text"
                  value={snapshotName}
                  onChange={(e) => setSnapshotName(e.target.value)}
                  placeholder="e.g. pre-refactor-hero-section"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={snapshotDesc}
                  onChange={(e) => setSnapshotDesc(e.target.value)}
                  placeholder="e.g. Before changing layout grid props"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSnapshotModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-semibold"
                >
                  Create Snapshot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project Generator Modal (Modules 08 & 09) */}
      {generatorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-slate-100">Project Code Generator</h3>
              </div>
              <button
                onClick={() => setGeneratorModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Generate production-grade React 19 (Vite) or Next.js 15 (App Router) projects with strict source preservation, typed components, API wiring, and zero overwrites of manual custom code.
            </p>

            {/* Framework Selector */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                type="button"
                onClick={() => {
                  setSelectedFramework("react");
                  handleLoadPlan("react");
                }}
                className={`p-3 rounded-lg border text-left transition ${
                  selectedFramework === "react"
                    ? "border-blue-500 bg-blue-950/40 text-blue-200"
                    : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="font-semibold text-sm">React 19 + Vite</div>
                <div className="text-xs text-slate-500 mt-1">SPA router, typed hooks, services, testing harness</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedFramework("nextjs");
                  handleLoadPlan("nextjs");
                }}
                className={`p-3 rounded-lg border text-left transition ${
                  selectedFramework === "nextjs"
                    ? "border-blue-500 bg-blue-950/40 text-blue-200"
                    : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="font-semibold text-sm">Next.js 15 (App Router)</div>
                <div className="text-xs text-slate-500 mt-1">Server/Client components, SSR/ISR, Server Actions, edge middleware</div>
              </button>
            </div>

            {/* Scope Selector */}
            <div className="mb-4">
              <label className="text-xs text-slate-300 font-semibold block mb-1.5">Regeneration Scope</label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    checked={generationScopeType === "full"}
                    onChange={() => setGenerationScopeType("full")}
                    className="accent-indigo-600"
                  />
                  <span>Full Project Generation (Preserves user files & protected regions)</span>
                </label>
                {activePath && (
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="scope"
                      checked={generationScopeType === "page"}
                      onChange={() => setGenerationScopeType("page")}
                      className="accent-indigo-600"
                    />
                    <span>Scoped to Active File ({activePath})</span>
                  </label>
                )}
              </div>
            </div>

            {/* Plan Preview */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 max-h-48 overflow-y-auto mb-4 font-mono text-xs">
              <div className="text-slate-400 font-sans font-semibold mb-1 text-[11px] uppercase tracking-wider">
                Generation Plan Preview
              </div>
              {loadingPlan ? (
                <div className="text-slate-500 py-2">Analyzing project IR and calculating hashes...</div>
              ) : generationPlan ? (
                <div>
                  <div className="text-emerald-400 mb-1">
                    ✓ Framework: {generationPlan.framework} v{generationPlan.frameworkVersion}
                  </div>
                  <div className="text-slate-300 mb-1">
                    Files to process: {generationPlan.files?.length || 0} (
                    {generationPlan.files?.filter((f: any) => f.action === "CREATE").length || 0} to create,{" "}
                    {generationPlan.files?.filter((f: any) => f.action === "UPDATE").length || 0} to update,{" "}
                    {generationPlan.files?.filter((f: any) => f.action === "PRESERVE").length || 0} preserved,{" "}
                    {generationPlan.files?.filter((f: any) => f.action === "MERGE").length || 0} to merge)
                  </div>
                  <div className="space-y-0.5 mt-2">
                    {generationPlan.files?.slice(0, 10).map((f: any) => (
                      <div key={f.path} className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-300">{f.path}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded font-semibold ${
                            f.action === "CREATE"
                              ? "text-emerald-400 bg-emerald-950/60"
                              : f.action === "UPDATE"
                              ? "text-blue-400 bg-blue-950/60"
                              : f.action === "MERGE"
                              ? "text-amber-400 bg-amber-950/60"
                              : "text-slate-400 bg-slate-800"
                          }`}
                        >
                          {f.action}
                        </span>
                      </div>
                    ))}
                    {(generationPlan.files?.length || 0) > 10 && (
                      <div className="text-slate-500 text-[10px]">
                        + {generationPlan.files.length - 10} more files
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-slate-500 py-2">No plan loaded yet.</div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setGeneratorModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRunGeneration}
                disabled={generating}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
              >
                <Sparkles className={`w-3.5 h-3.5 ${generating ? "animate-spin" : ""}`} />
                <span>{generating ? "Generating & Validating..." : `Generate ${selectedFramework.toUpperCase()} Project`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeveloperWorkspace;
