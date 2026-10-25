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
  type CodeSyncResult,
  type ProjectPage,
  type PageMutationResult,
} from "../services/forgeProjectService";
import { connectWorkspaceSync, workspaceSyncUrl } from "../services/workspaceSyncClient";
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
import { isHelperOrNonPageFile, resolveDefaultWorkspaceFile, resolveFileForRoute } from "../utils/workspaceFileResolution";

type WorkspaceMode = "code" | "split" | "preview";
type BottomTab = "ai" | "git" | "terminal" | "build" | "hosting" | "cicd" | "domains" | "dependencies" | "database" | "storage" | "runtime" | "quality" | "devops" | "intelligence" | "platform" | "debug" | "output" | "problems" | "manifest" | "snapshots";

// isHelperOrNonPageFile, resolveDefaultWorkspaceFile and resolveFileForRoute moved verbatim to
// ../utils/workspaceFileResolution; re-exported so this module's exports are unchanged.
export { isHelperOrNonPageFile, resolveDefaultWorkspaceFile, resolveFileForRoute };

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
  const [currentRoute, setCurrentRoute] = useState<string>("/");

  // Workspace layout state
  const [mode, setMode] = useState<WorkspaceMode>("code");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [bottomDrawerOpen, setBottomDrawerOpen] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState<BottomTab>("output");
  const [bottomDrawerHeight, setBottomDrawerHeight] = useState(190);

  // The current "reload what changed" routine, for the live sync connection to call.
  const workspaceRefreshRef = useRef<(() => Promise<void>) | null>(null);
  const isResizingSplit = useRef(false);
  const isResizingDrawer = useRef(false);
  const isResizingSidebar = useRef(false);

  // Resizing functions
  const startSidebarResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingSidebar.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingSidebar.current) return;
      const newWidth = Math.max(180, Math.min(500, moveEvent.clientX));
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      isResizingSidebar.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

  const startSplitResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingSplit.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingSplit.current) return;
      const container = document.getElementById("workspace-split-container");
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const offsetX = moveEvent.clientX - rect.left;
      const ratio = Math.max(0.2, Math.min(0.8, offsetX / rect.width));
      setSplitRatio(ratio);
    };

    const onMouseUp = () => {
      isResizingSplit.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

  const startDrawerResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingDrawer.current = true;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingDrawer.current) return;
      const newHeight = Math.max(100, Math.min(window.innerHeight * 0.7, window.innerHeight - moveEvent.clientY));
      setBottomDrawerHeight(newHeight);
      setBottomDrawerOpen(true);
    };

    const onMouseUp = () => {
      isResizingDrawer.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

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
  // Bumped whenever persisted source changes, so the preview rebuilds from it
  const [previewVersion, setPreviewVersion] = useState(0);
  // A page whose code and visual versions both changed; neither is overwritten until the user chooses
  const [syncConflict, setSyncConflict] = useState<{ path: string; message: string } | null>(null);
  // A file that changed on the server after it was opened here
  const [staleFilePath, setStaleFilePath] = useState<string | null>(null);

  // Pages (visual page registry)
  const [pagesModalOpen, setPagesModalOpen] = useState(false);
  const [pages, setPages] = useState<ProjectPage[]>([]);
  const [newPageName, setNewPageName] = useState("");
  const [newPageRoute, setNewPageRoute] = useState("");
  const [pageBusy, setPageBusy] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  // Generator Modal state (Modules 08 & 09)
  const [generatorModalOpen, setGeneratorModalOpen] = useState(false);
  const [selectedFramework, setSelectedFramework] = useState<"react" | "nextjs">("react");
  const [generationScopeType, setGenerationScopeType] = useState<"full" | "page">("full");
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [generationPlan, setGenerationPlan] = useState<any>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);

  const addLog = useCallback((text: string, type: "info" | "success" | "warn" | "error" = "info") => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev.slice(-150), { id: Math.random().toString(), time, text, type }]);
  }, []);

  const mapFileToRoute = useCallback((filePath: string, currentPages: ProjectPage[] = pages): string | null => {
    if (isHelperOrNonPageFile(filePath)) return null;

    const matched = currentPages.find((p) => p.filePath === filePath);
    if (matched) return matched.routePath;

    // Next.js App Router
    const nextMatch = filePath.match(/^app\/(.*?)\/?page\.(tsx|jsx)$/);
    if (nextMatch) {
      const seg = nextMatch[1];
      return !seg ? "/" : `/${seg.replace(/^[/\\]+|[/\\]+$/g, "")}`;
    }

    // React/Vite Pages: src/pages/*
    const reactMatch = filePath.match(/^src\/pages\/(.+)\.(tsx|jsx)$/);
    if (reactMatch) {
      let raw = reactMatch[1];
      if (raw.endsWith("Page") && raw.length > 4) raw = raw.slice(0, -4);
      if (raw.toLowerCase() === "home" || raw.toLowerCase() === "index") return "/";
      const slug = raw.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
      return `/${slug}`;
    }

    if (filePath === "src/App.tsx" || filePath === "src/main.tsx" || filePath === "index.html") {
      return "/";
    }

    return null;
  }, [pages]);

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
        if (currentProj.visualSync?.synced) {
          addLog("Source files regenerated from the latest saved visual design", "success");
        } else if (currentProj.visualSync?.stale) {
          addLog(
            `Source files are out of date with the visual design: ${currentProj.visualSync.error || "sync failed"}`,
            "error"
          );
        }

        // Load file tree
        const treeRes = await forgeProjectService.getFileTree(currentProj.id);
        const loadedTree = treeRes.tree || [];
        if (isMounted) setFileTree(loadedTree);

        // Load manifest
        let loadedManifest: any = null;
        try {
          const mRes = await forgeProjectService.getManifest(currentProj.id);
          loadedManifest = mRes.manifest;
          if (isMounted) setManifest(loadedManifest);
        } catch (e) {
          console.warn("Could not load manifest:", e);
        }

        // Load visual pages registry
        let loadedPages: ProjectPage[] = [];
        try {
          const pRes = await forgeProjectService.listPages(currentProj.id);
          loadedPages = pRes.pages || [];
          if (isMounted) setPages(loadedPages);
        } catch (e) {
          console.warn("Could not load pages registry:", e);
        }

        // Open default entry page file (manifest/routes derived, never EmptyState.tsx)
        const defaultPath = resolveDefaultWorkspaceFile(loadedTree, loadedManifest, loadedPages);
        if (defaultPath && isMounted) {
          openFileByPath(currentProj.id, defaultPath);
          const mapped = mapFileToRoute(defaultPath, loadedPages);
          if (mapped) setCurrentRoute(mapped);
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
    // If tab is already open, activate it and refresh content if not dirty
    const existing = openTabs.find((t) => t.path === filePath);
    if (existing) {
      setActivePath(filePath);
      if (!existing.isDirty) {
        try {
          const { file } = await forgeProjectService.readFile(pId, filePath);
          if (file && file.content !== existing.content) {
            setOpenTabs((prev) =>
              prev.map((t) =>
                t.path === filePath
                  ? { ...t, file, content: file.content || "", savedContent: file.content || "", isDirty: false }
                  : t
              )
            );
          }
        } catch {}
      }
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

  // Synchronize active code file -> preview route
  useEffect(() => {
    if (!activePath) return;
    const mapped = mapFileToRoute(activePath, pages);
    if (mapped && mapped.toLowerCase() !== currentRoute.toLowerCase()) {
      setCurrentRoute(mapped);
    }
  }, [activePath, mapFileToRoute, pages, currentRoute]);

  // Synchronize preview route -> active code file
  const handlePreviewRouteChange = useCallback((newRoute: string) => {
    setCurrentRoute(newRoute);
    if (!project) return;
    const targetFile = resolveFileForRoute(newRoute, fileTree, pages);
    if (targetFile) {
      openFileByPath(project.id, targetFile);
    }
  }, [project, pages, fileTree]);

  // Ensure Split Preview always has an active page open matching currentRoute
  useEffect(() => {
    if (mode === "split" && project) {
      if (openTabs.length === 0) {
        const targetPath =
          resolveFileForRoute(currentRoute, fileTree, pages) ||
          resolveDefaultWorkspaceFile(fileTree, manifest, pages);
        if (targetPath) {
          openFileByPath(project.id, targetPath);
        }
      } else if (!activePath && openTabs.length > 0) {
        setActivePath(openTabs[0].path);
      }
    }
  }, [mode, project, openTabs.length, activePath, currentRoute, pages, fileTree, manifest, fileTree]);

  // Cross-tab synchronization: receive changes saved in the Visual Editor
  useEffect(() => {
    if (!project) return;

    const refreshFromVisualEditor = async () => {
      try {
        await handleRefreshTree();
        await loadPages();
        await reloadChangedFiles(openTabs.map((t) => t.path));
        setPreviewVersion((v) => v + 1);
        addLog("Source files and pages refreshed from Visual Editor changes", "info");
      } catch (err: any) {
        console.warn("Could not refresh from visual editor changes:", err);
      }
    };

    workspaceRefreshRef.current = refreshFromVisualEditor;

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("forge_workspace_sync");
      channel.onmessage = (event) => {
        if (project.websiteId && event.data?.websiteId === project.websiteId && event.data?.type === "visual_saved") {
          refreshFromVisualEditor();
        }
      };
    } catch {}

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "forge_workspace_sync_event" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (project.websiteId && parsed.websiteId === project.websiteId && parsed.type === "visual_saved") {
            refreshFromVisualEditor();
          }
        } catch {}
      }
    };

    const handleFocus = () => {
      refreshFromVisualEditor();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshFromVisualEditor();
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      channel?.close();
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [project, openTabs]);

  // Live synchronization: changes committed to this project by anyone, from any browser or
  // device, arrive as checkpoints over the workspace sync gateway. After a disconnect the client
  // resumes from the last checkpoint it saw.
  const liveProjectId = project?.id;
  useEffect(() => {
    if (!liveProjectId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const connection = connectWorkspaceSync({
      url: workspaceSyncUrl(import.meta.env.VITE_API_URL || "http://localhost:5000"),
      projectId: liveProjectId,
      onCheckpoint: () => {
        // Several checkpoints usually arrive together (a save writes many files).
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => void workspaceRefreshRef.current?.(), 300);
      },
      onStatus: (status) => {
        if (status === "online") addLog("Live workspace sync connected", "info");
        else if (status === "offline") addLog("Live workspace sync disconnected; reconnecting…", "warn");
        else if (status === "denied") addLog("Live workspace sync stopped: the session or project access is no longer valid", "error");
      },
    });
    return () => {
      if (timer) clearTimeout(timer);
      connection.close();
    };
  }, [liveProjectId, addLog]);

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

  // Re-read files whose persisted content changed on the server (regenerated source)
  const reloadChangedFiles = async (paths: string[]) => {
    if (!project || paths.length === 0) return;
    const changed = new Set(paths);
    const reloaded = new Map<string, ProjectFile | null>();
    for (const tab of openTabs) {
      if (!changed.has(tab.path)) continue;
      try {
        const { file } = await forgeProjectService.readFile(project.id, tab.path);
        reloaded.set(tab.path, file);
      } catch {
        reloaded.set(tab.path, null); // the file no longer exists
      }
    }
    if (reloaded.size === 0) return;
    setOpenTabs((prev) =>
      prev
        .filter((t) => reloaded.get(t.path) !== null)
        .map((t) => {
          const file = reloaded.get(t.path);
          // Unsaved edits in another tab are never replaced
          if (!file || t.isDirty) return t;
          return { ...t, file, content: file.content || "", savedContent: file.content || "", isDirty: false };
        })
    );
  };

  // Report the outcome of reconciling a saved file with the visual document
  const applySyncResult = async (path: string, sync: CodeSyncResult | null | undefined) => {
    if (!sync || sync.status === "not-a-page") {
      setSyncStatus("synced");
      return;
    }

    const problems = (sync.diagnostics || [])
      .filter((d) => d.severity !== "info")
      .map((d) => ({ file: d.filePath || path, line: d.line, message: `[${d.code}] ${d.message}`, severity: d.severity }));
    setDiagnostics((prev) => [...prev.filter((d) => d.file !== path), ...problems]);
    for (const info of (sync.diagnostics || []).filter((d) => d.severity === "info")) addLog(info.message, "info");

    switch (sync.status) {
      case "synced":
        addLog(sync.message || `Synchronised ${path} into the Visual Editor`, "success");
        setSyncStatus("synced");
        setSyncConflict(null);
        await loadPages();
        if (project?.websiteId) {
          try {
            const channel = new BroadcastChannel("forge_workspace_sync");
            channel.postMessage({
              type: "code_synced",
              websiteId: project.websiteId,
              documentVersion: (sync as any).documentVersion,
              filePath: path,
              timestamp: Date.now(),
            });
            channel.close();
          } catch {}
          try {
            localStorage.setItem(
              "forge_workspace_sync_event",
              JSON.stringify({
                websiteId: project.websiteId,
                documentVersion: (sync as any).documentVersion,
                filePath: path,
                timestamp: Date.now(),
              })
            );
          } catch {}
        }
        break;
      case "unchanged":
        addLog(`${path} matches the visual document`, "info");
        setSyncStatus("synced");
        setSyncConflict(null);
        break;
      case "reverted":
        addLog(sync.message || `${path} was regenerated from the visual document`, "success");
        setSyncStatus("synced");
        setSyncConflict(null);
        break;
      case "conflict":
        addLog(sync.message || `${path} conflicts with a change made in the Visual Editor`, "warn");
        setSyncStatus("diverged");
        setSyncConflict({ path, message: sync.message || "This page was changed in both the Visual Editor and the code." });
        break;
      case "unsupported":
      case "invalid":
        addLog(sync.message || `${path} could not be synchronised with the Visual Editor`, "warn");
        for (const d of problems.slice(0, 5)) addLog(`${d.file}${d.line ? `:${d.line}` : ""} ${d.message}`, "warn");
        setSyncStatus("diverged");
        setActiveBottomTab("problems");
        setBottomDrawerOpen(true);
        break;
      default:
        addLog(sync.message || `Synchronisation of ${path} failed`, "error");
        setSyncStatus("diverged");
    }

    if (sync.updatedFiles && sync.updatedFiles.length > 0) {
      await reloadChangedFiles(sync.updatedFiles);
      await handleRefreshTree();
    }
    setPreviewVersion((v) => v + 1);
  };

  // File save with optimistic concurrency. The server reconciles a saved page
  // with the visual document as part of the save and reports the outcome.
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
                content: res.file.content ?? tab.content,
                savedContent: res.file.content ?? tab.content,
                isDirty: false,
              }
            : t
        )
      );
      setStaleFilePath((current) => (current === path ? null : current));

      addLog(`Saved ${path} (v${res.file.version})`, "success");
      await applySyncResult(path, res.sync);
      setPreviewVersion((v) => v + 1);
    } catch (err: any) {
      if (/concurrency conflict/i.test(err.message || "")) {
        setStaleFilePath(path);
        addLog(`${path} was changed on the server after you opened it. Your edits were not saved.`, "error");
      } else {
        addLog(`Save failed for ${path}: ${err.message}`, "error");
      }
      throw err;
    }
  };

  // Discard local edits and load the server's current version of a file
  const handleReloadStaleFile = async (path: string) => {
    if (!project) return;
    try {
      const { file } = await forgeProjectService.readFile(project.id, path);
      setOpenTabs((prev) =>
        prev.map((t) =>
          t.path === path ? { ...t, file, content: file.content || "", savedContent: file.content || "", isDirty: false } : t
        )
      );
      setStaleFilePath(null);
      addLog(`Reloaded ${path} (v${file.version})`, "info");
    } catch (err: any) {
      addLog(`Could not reload ${path}: ${err.message}`, "error");
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
      const clean = filePath.replace(/^[/\\]+/, "").replace(/\\/g, "/");
      const isPage =
        /\.(tsx|jsx)$/.test(clean) &&
        (clean.startsWith("src/pages/") || clean.startsWith("pages/") || clean.startsWith("app/") || !clean.includes("/"));
      let initialContent = `// ${filePath}\n`;
      if (isPage) {
        const baseName = clean.split("/").pop()!.replace(/\.(tsx|jsx)$/, "");
        const compName = `${baseName.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\s+/g, "")}${
          baseName.endsWith("Page") ? "" : "Page"
        }`;
        const pageTitle = baseName.replace(/Page$/, "").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        initialContent = `import React from 'react';\n\nexport default function ${compName}() {\n  return (\n    <div className="min-h-screen p-8">\n      <h1 className="text-3xl font-bold">${pageTitle}</h1>\n      <p className="mt-4 text-gray-600">Welcome to the ${pageTitle} page.</p>\n    </div>\n  );\n}\n`;
      }

      await forgeProjectService.writeFile(project.id, filePath, {
        content: initialContent,
      });
      await handleRefreshTree();
      await loadPages();
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
      // Whole-project generation never rewrites hand-written pages. Canvas edits reach those pages
      // as element-level AST edits when the canvas is saved, not through this action.
      const held: string[] = res.result?.heldBackPaths || [];
      if (held.length > 0) {
        addLog(
          `Not regenerated (hand-written code): ${held.join(", ")}. Canvas edits to these pages are applied element by element when the design is saved; resolve remaining differences with "Sync Code to Visual".`,
          "warn"
        );
      }
      setDiagnostics(res.result?.diagnostics || []);
      setSyncStatus("synced");
      await handleRefreshTree();
      await reloadChangedFiles(openTabs.map((t) => t.path));
      setPreviewVersion((v) => v + 1);
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

  const handleSyncCodeToVisual = async (resolve?: "code" | "visual", targetPath?: string) => {
    const path = targetPath || activePath;
    if (!project || !path || syncing) return;
    try {
      setSyncing(true);
      addLog(
        resolve === "visual"
          ? `Regenerating ${path} from the visual document...`
          : `Reconciling ${path} with the Visual Editor...`,
        "info"
      );
      const res = await forgeProjectService.syncCodeToVisual(project.id, path, resolve);
      if (res.status === "not-a-page") addLog(res.message || `${path} is not a visual page`, "info");
      await applySyncResult(path, res);
    } catch (err: any) {
      addLog(`Code to visual reconciliation error: ${err.message}`, "error");
    } finally {
      setSyncing(false);
    }
  };

  // Pages: the visual page registry behind routes, page files and the Visual Editor page list
  const loadPages = async () => {
    if (!project) return;
    try {
      const res = await forgeProjectService.listPages(project.id);
      setPages(res.pages || []);
    } catch (err: any) {
      setPageError(err.message || "Could not load pages");
    }
  };

  const finishPageMutation = async (res: PageMutationResult, successText: string): Promise<boolean> => {
    if (res.pages) setPages(res.pages);
    await handleRefreshTree();
    await reloadChangedFiles(openTabs.map((t) => t.path));
    setPreviewVersion((v) => v + 1);
    if (!res.success) {
      const detail = res.diagnostics?.find((d) => d.severity === "error");
      const text = `${res.message || "The page change failed"}${detail?.line ? ` (line ${detail.line})` : ""}`;
      setPageError(text);
      addLog(text, "error");
      return false;
    }
    setPageError(null);
    addLog(successText, "success");
    if (res.preservedFile) {
      addLog(`${res.preservedFile} contains hand-written code and was kept. Delete it in the explorer if it is no longer needed.`, "warn");
    }
    if (res.visualSync?.conflicts?.length) {
      addLog(`Not regenerated (hand-written code): ${res.visualSync.conflicts.join(", ")}`, "warn");
    }
    return true;
  };

  const handleCreatePage = async (sourcePath?: string) => {
    if (!project || pageBusy || !newPageName.trim()) return;
    try {
      setPageBusy(true);
      const res = await forgeProjectService.createPage(project.id, {
        name: newPageName.trim(),
        route: newPageRoute.trim() || undefined,
        sourcePath,
      });
      const ok = await finishPageMutation(
        res,
        `Created page "${res.page?.name}" at ${res.page?.routePath} (${res.page?.filePath})`
      );
      if (ok && res.page) {
        setNewPageName("");
        setNewPageRoute("");
        if (sourcePath && sourcePath !== res.page.filePath) {
          setOpenTabs((prev) => prev.filter((t) => t.path !== sourcePath));
        }
        openFileByPath(project.id, res.page.filePath);
      }
    } catch (err: any) {
      setPageError(err.message || "The page could not be created");
      addLog(`Create page failed: ${err.message}`, "error");
    } finally {
      setPageBusy(false);
    }
  };

  const handleRenamePage = async (page: ProjectPage) => {
    if (!project || pageBusy) return;
    const name = window.prompt("Page name", page.name);
    if (name === null) return;
    const route = page.isHome ? undefined : window.prompt("Route", page.routePath);
    if (route === null) return;
    try {
      setPageBusy(true);
      const res = await forgeProjectService.updatePage(project.id, page.key, { name: name.trim(), route: route?.trim() });
      const ok = await finishPageMutation(res, `Updated page "${res.page?.name}" (${res.page?.routePath})`);
      if (ok && res.page && res.page.filePath !== page.filePath) {
        setOpenTabs((prev) => prev.filter((t) => t.path !== page.filePath));
        if (activePath === page.filePath) openFileByPath(project.id, res.page.filePath);
      }
    } catch (err: any) {
      setPageError(err.message || "The page could not be updated");
    } finally {
      setPageBusy(false);
    }
  };

  const handleDeletePage = async (page: ProjectPage) => {
    if (!project || pageBusy) return;
    if (!window.confirm(`Delete page "${page.name}" (${page.routePath})? Its route and generated file are removed; a snapshot is taken first.`)) return;
    try {
      setPageBusy(true);
      const res = await forgeProjectService.deletePage(project.id, page.key);
      const ok = await finishPageMutation(res, `Deleted page "${page.name}"`);
      if (ok && !res.preservedFile) {
        setOpenTabs((prev) => prev.filter((t) => t.path !== page.filePath));
        if (activePath === page.filePath) setActivePath(null);
      }
    } catch (err: any) {
      setPageError(err.message || "The page could not be deleted");
    } finally {
      setPageBusy(false);
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

  // Export the persisted project (including manual edits) as a standalone ZIP
  const handleExportZip = async () => {
    if (!project || exporting) return;
    try {
      setExporting(true);
      addLog("Packaging project source as ZIP...", "info");
      const filename = await forgeProjectService.exportProjectZip(project.id, `${project.slug}-${project.framework}`);
      addLog(`Exported ${filename}`, "success");
    } catch (err: any) {
      addLog(`ZIP export failed: ${err.message}`, "error");
      setExportError(err.message || "ZIP export failed");
    } finally {
      setExporting(false);
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

  const secondaryTabs: Array<{ id: BottomTab; label: string }> = [
    { id: "hosting", label: "Hosting" },
    { id: "cicd", label: "CI/CD" },
    { id: "domains", label: "Domains" },
    { id: "database", label: "Database" },
    { id: "storage", label: "Storage" },
    { id: "runtime", label: "Runtime" },
    { id: "quality", label: "Quality" },
    { id: "devops", label: "DevOps & Security" },
    { id: "intelligence", label: "Intelligence" },
    { id: "platform", label: "Platform" },
    { id: "debug", label: "Debug" },
    { id: "manifest", label: "Manifest" },
    { id: "snapshots", label: `Snapshots (${snapshots.length})` },
  ];

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

          {/* Export ZIP */}
          <button
            onClick={handleExportZip}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-md text-xs font-semibold shadow-sm transition disabled:opacity-50"
            title="Download the project source as a standalone ZIP"
          >
            <FolderArchive className="w-3.5 h-3.5" />
            <span>{exporting ? "Exporting..." : "Export ZIP"}</span>
          </button>

          {/* Pages: create / rename / delete visual pages and their routes */}
          {project.websiteId && (
            <button
              onClick={() => {
                setPageError(null);
                setPagesModalOpen(true);
                loadPages();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-md text-xs font-semibold shadow-sm transition"
              title="Pages: create, rename or delete pages and their routes"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Pages</span>
            </button>
          )}

          {/* Sync Code → Visual */}
          <button
            onClick={() => handleSyncCodeToVisual()}
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

      {/* Conflict: the page changed in both the Visual Editor and the code; nothing is overwritten until chosen */}
      {syncConflict && (
        <div className="px-3 py-2 bg-amber-950/70 border-b border-amber-800/60 text-xs text-amber-100 flex items-center gap-3 shrink-0">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="flex-1">
            <span className="font-semibold">{syncConflict.path}</span>: {syncConflict.message}
          </span>
          <button
            onClick={() => handleSyncCodeToVisual("code", syncConflict.path)}
            disabled={syncing}
            className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-semibold disabled:opacity-50"
            title="Apply the saved code to the visual page, replacing the visual changes"
          >
            Keep code
          </button>
          <button
            onClick={() => handleSyncCodeToVisual("visual", syncConflict.path)}
            disabled={syncing}
            className="px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white font-semibold disabled:opacity-50"
            title="Regenerate this file from the visual page, discarding the code edit"
          >
            Keep visual version
          </button>
          <button onClick={() => setSyncConflict(null)} className="text-amber-300 hover:text-white" title="Decide later">
            Later
          </button>
        </div>
      )}

      {staleFilePath && (
        <div className="px-3 py-2 bg-rose-950/70 border-b border-rose-800/60 text-xs text-rose-100 flex items-center gap-3 shrink-0">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="flex-1">
            <span className="font-semibold">{staleFilePath}</span> was regenerated or edited elsewhere after you opened
            it. Your edits were not saved; copy anything you need before reloading.
          </span>
          <button
            onClick={() => handleReloadStaleFile(staleFilePath)}
            className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold"
          >
            Reload file
          </button>
          <button onClick={() => setStaleFilePath(null)} className="text-rose-300 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Main Workspace Body: Project Explorer + Editor + Preview */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: Project Explorer Sidebar (Hidden in Full Preview) */}
        {sidebarOpen && mode !== "preview" && (
          <div
            style={{ width: `${sidebarWidth}px` }}
            className="h-full bg-slate-900 border-r border-slate-800 shrink-0 flex flex-col relative"
          >
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
            {/* Sidebar Resize Handle */}
            <div
              onMouseDown={startSidebarResize}
              className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 transition-colors z-10"
              title="Drag to resize file explorer"
            />
          </div>
        )}

        {/* Center/Right: Code Editor & Live Preview Containers */}
        {mode === "code" && (
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

        {mode === "split" && (
          <div id="workspace-split-container" className="flex-1 flex h-full overflow-hidden">
            <div
              style={{ width: `${splitRatio * 100}%` }}
              className="h-full flex flex-col overflow-hidden bg-slate-950 min-w-[280px]"
            >
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

            {/* Splitter Resize Handle */}
            <div
              onMouseDown={startSplitResize}
              className="w-1.5 hover:w-2 bg-slate-800 hover:bg-blue-500 cursor-col-resize transition-all shrink-0 z-10 flex items-center justify-center group"
              title="Drag to resize Code Editor & Live Preview"
            >
              <div className="w-0.5 h-6 bg-slate-600 group-hover:bg-white rounded transition-colors" />
            </div>

            <div
              style={{ width: `${(1 - splitRatio) * 100}%` }}
              className="h-full flex flex-col overflow-hidden min-w-[280px]"
            >
              <LivePreviewPanel
                projectId={project.id}
                websiteId={project.websiteId}
                refreshKey={previewVersion}
                currentRoute={currentRoute}
                onRouteChange={handlePreviewRouteChange}
                pages={pages}
                onInspectElement={(filePath) => {
                  openFileByPath(project.id, filePath);
                }}
              />
            </div>
          </div>
        )}

        {mode === "preview" && (
          <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
            <LivePreviewPanel
              projectId={project.id}
              websiteId={project.websiteId}
              refreshKey={previewVersion}
              currentRoute={currentRoute}
              onRouteChange={handlePreviewRouteChange}
              pages={pages}
              onInspectElement={(filePath) => {
                openFileByPath(project.id, filePath);
              }}
            />
          </div>
        )}
      </div>

      {/* 3. Bottom Drawer: Terminal, Build, Diagnostics (Hidden in Full Preview) */}
      {mode !== "preview" && (
        <div
          className={`bg-slate-900 border-t border-slate-800 flex flex-col transition-all duration-150 shrink-0 relative ${
            bottomDrawerOpen ? "" : "h-9"
          }`}
          style={{ height: bottomDrawerOpen ? `${bottomDrawerHeight}px` : "36px" }}
        >
        {/* Top Row Resizer Handle */}
        <div
          onMouseDown={startDrawerResize}
          className="h-1 hover:h-1.5 bg-slate-800 hover:bg-blue-500 cursor-row-resize transition-all shrink-0 z-10"
          title="Drag up/down to resize bottom drawer"
        />

        {/* Drawer Header Tabs */}
        <div className="h-9 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between px-3 select-none">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1">
            <button
              onClick={() => {
                setActiveBottomTab("output");
                setBottomDrawerOpen(true);
              }}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                bottomDrawerOpen && activeBottomTab === "output"
                  ? "bg-slate-800 text-slate-100 shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-blue-400" />
              <span>Output</span>
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
              <span>Problems {diagnostics.length > 0 && `(${diagnostics.length})`}</span>
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
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
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
              <GitBranch className="w-3.5 h-3.5 text-orange-400" />
              <span>Git</span>
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

            {/* Secondary Tools Dropdown */}
            <div className="relative inline-flex items-center ml-2">
              <select
                value={secondaryTabs.some((t) => t.id === activeBottomTab) ? activeBottomTab : ""}
                onChange={(e) => {
                  if (e.target.value) {
                    setActiveBottomTab(e.target.value as BottomTab);
                    setBottomDrawerOpen(true);
                    if (e.target.value === "snapshots") {
                      loadSnapshots();
                    }
                  }
                }}
                className={`text-xs font-semibold px-2 py-1 rounded border transition focus:outline-none cursor-pointer ${
                  secondaryTabs.some((t) => t.id === activeBottomTab) && bottomDrawerOpen
                    ? "bg-slate-800 text-indigo-300 border-indigo-500/50"
                    : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
                }`}
              >
                <option value="" disabled>More Tools...</option>
                {secondaryTabs.map((t) => (
                  <option key={t.id} value={t.id} className="bg-slate-900 text-slate-200">
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
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
      )}

      {/* Command Palette Modal */}
      <CommandPaletteModal
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        files={fileTree}
        onSelectFile={handleSelectFile}
        onCompile={handleCompile}
        onSyncVisualToCode={handleSyncVisualToCode}
        onSyncCodeToVisual={() => handleSyncCodeToVisual()}
        onCreateSnapshot={() => setSnapshotModalOpen(true)}
        onOpenManifest={() => {
          setActiveBottomTab("manifest");
          setBottomDrawerOpen(true);
        }}
      />

      {/* Snapshot Modal */}
      {/* Pages: the visual page registry */}
      {pagesModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setPagesModalOpen(false)}>
          <div
            className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col max-h-[85vh] select-text"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-100">Pages</h3>
                <p className="text-[11px] text-slate-400">
                  A page has a route, a source file and an entry in the Visual Editor. Other component files are never pages.
                </p>
              </div>
              <button onClick={() => setPagesModalOpen(false)} className="text-slate-400 hover:text-white text-xs">
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {pages.length === 0 && <p className="text-xs text-slate-500">No pages loaded.</p>}
              {pages.map((page) => (
                <div key={page.key} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-100 truncate">{page.name}</span>
                      <span className="font-mono text-[11px] text-blue-300">{page.routePath}</span>
                      {page.isHome && <span className="text-[10px] px-1.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60">home</span>}
                      {page.ownership === "code" && (
                        <span
                          className="text-[10px] px-1.5 rounded bg-amber-950 text-amber-300 border border-amber-800/60"
                          title={page.sync?.message || "Hand-written code is kept; visual changes are not written into this file"}
                        >
                          code-owned{page.sync?.status ? `: ${page.sync.status}` : ""}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        openFileByPath(project.id, page.filePath);
                        setPagesModalOpen(false);
                      }}
                      className="font-mono text-[11px] text-slate-400 hover:text-white truncate"
                      title="Open the page's source file"
                    >
                      {page.filePath}
                    </button>
                  </div>
                  <button
                    onClick={() => handleRenamePage(page)}
                    disabled={pageBusy}
                    className="px-2 py-1 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-50"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => handleDeletePage(page)}
                    disabled={pageBusy || page.isHome || pages.length <= 1}
                    className="px-2 py-1 text-[11px] rounded bg-rose-900/60 hover:bg-rose-800 text-rose-100 disabled:opacity-40"
                    title={page.isHome ? "The home page cannot be deleted" : "Delete this page"}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>

            <div className="px-4 py-3 border-t border-slate-800 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  value={newPageName}
                  onChange={(e) => setNewPageName(e.target.value)}
                  placeholder="Page name, e.g. About"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
                <input
                  value={newPageRoute}
                  onChange={(e) => setNewPageRoute(e.target.value)}
                  placeholder="Route (optional), e.g. /about"
                  className="w-52 bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => handleCreatePage()}
                  disabled={pageBusy || !newPageName.trim()}
                  className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50"
                >
                  {pageBusy ? "Working..." : "Create page"}
                </button>
              </div>
              {activePath && /\.(tsx|jsx)$/.test(activePath) && !pages.some((page) => page.filePath === activePath) && (
                <button
                  onClick={() => handleCreatePage(activePath)}
                  disabled={pageBusy || !newPageName.trim()}
                  className="text-[11px] text-blue-300 hover:text-white disabled:opacity-40"
                  title="Convert the open component file into this page. It must be a single component returning static JSX."
                >
                  Register the open file ({activePath}) as this page instead of starting empty
                </button>
              )}
              {pageError && <p className="text-[11px] text-rose-400">{pageError}</p>}
            </div>
          </div>
        </div>
      )}

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
      {exportError && (
        <div
          role="alert"
          className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-red-500/50 bg-red-950 px-4 py-3 text-xs text-red-100 shadow-xl"
        >
          <div className="font-semibold">ZIP export failed</div>
          <div className="mt-1 break-words">{exportError}</div>
          <button onClick={() => setExportError(null)} className="mt-2 font-semibold underline">
            Dismiss
          </button>
        </div>
      )}

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
