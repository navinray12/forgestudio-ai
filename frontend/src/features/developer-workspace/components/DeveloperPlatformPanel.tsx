import React, { useState, useEffect } from "react";
import {
  Users,
  Puzzle,
  Download,
  FolderGit2,
  Box,
  Play,
  Square,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  GitPullRequest,
  MessageSquare,
  FileCode,
  Shield,
  Layers,
  Terminal,
  Activity,
  ArrowRight,
  Plus,
  GitBranch,
  FileCheck,
} from "lucide-react";
import { developerPlatformService } from "../services/developerPlatformService";

interface Props {
  projectId: string;
  onLog?: (msg: string, type?: "info" | "success" | "warn" | "error") => void;
}

type TabKey = "collaboration" | "extensions" | "import" | "monorepo" | "containers";

export const DeveloperPlatformPanel: React.FC<Props> = ({ projectId, onLog }) => {
  const [activeTab, setActiveTab] = useState<TabKey>("collaboration");
  const [loading, setLoading] = useState(false);

  // Module 57: Collaboration state
  const [sessions, setSessions] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [newCommentText, setNewCommentText] = useState("");
  const [newCommentFile, setNewCommentFile] = useState("src/App.tsx");
  const [conflictDiff, setConflictDiff] = useState<any | null>(null);

  // Module 58: Extensions state
  const [plugins, setPlugins] = useState<any[]>([]);

  // Module 59: Import state
  const [importRepoUrl, setImportRepoUrl] = useState("https://github.com/example/react-app");
  const [importJob, setImportJob] = useState<any | null>(null);

  // Module 60: Monorepo state
  const [monorepoGraph, setMonorepoGraph] = useState<any | null>(null);
  const [affectedPackages, setAffectedPackages] = useState<any[]>([]);
  const [deployPlan, setDeployPlan] = useState<any | null>(null);

  // Module 61: Container & Infra state
  const [dockerfileContent, setDockerfileContent] = useState<string>("");
  const [composeContent, setComposeContent] = useState<any | null>(null);
  const [containers, setContainers] = useState<any[]>([]);
  const [infraValidation, setInfraValidation] = useState<any | null>(null);

  // Fetch initial data based on active tab
  useEffect(() => {
    loadTabData(activeTab);
  }, [projectId, activeTab]);

  const loadTabData = async (tab: TabKey) => {
    setLoading(true);
    try {
      if (tab === "collaboration") {
        const [sessRes, commRes, revRes, timeRes] = await Promise.allSettled([
          developerPlatformService.getActiveSessions(projectId),
          developerPlatformService.listComments(projectId),
          developerPlatformService.listReviews(projectId),
          developerPlatformService.getCollaborationTimeline(projectId, 15),
        ]);
        if (sessRes.status === "fulfilled") setSessions(sessRes.value.sessions || []);
        if (commRes.status === "fulfilled") setComments(commRes.value.comments || []);
        if (revRes.status === "fulfilled") setReviews(revRes.value.reviews || []);
        if (timeRes.status === "fulfilled") setTimeline(timeRes.value.activities || []);
      } else if (tab === "extensions") {
        const res = await developerPlatformService.listPlugins(projectId);
        setPlugins(res.plugins || []);
      } else if (tab === "monorepo") {
        const res = await developerPlatformService.getMonorepoGraph(projectId);
        setMonorepoGraph(res.graph || null);
      } else if (tab === "containers") {
        const [dfRes, runsRes, validRes] = await Promise.allSettled([
          developerPlatformService.getDockerfile(projectId),
          developerPlatformService.listContainers(projectId),
          developerPlatformService.validateInfrastructure(projectId),
        ]);
        if (dfRes.status === "fulfilled") setDockerfileContent(dfRes.value.definition?.rawContent || "");
        if (runsRes.status === "fulfilled") setContainers(runsRes.value.runs || []);
        if (validRes.status === "fulfilled") setInfraValidation(validRes.value.result || null);
      }
    } catch (err: any) {
      onLog?.(`Failed to load ${tab} data: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // Module 57 Actions
  // =========================================================================
  const handleCreateComment = async () => {
    if (!newCommentText.trim()) return;
    try {
      const res = await developerPlatformService.createComment(projectId, {
        filePath: newCommentFile,
        lineNumber: 1,
        content: newCommentText,
      });
      setComments((prev) => [res.comment, ...prev]);
      setNewCommentText("");
      onLog?.(`Comment posted on ${newCommentFile}`, "success");
    } catch (err: any) {
      onLog?.(`Comment error: ${err.message}`, "error");
    }
  };

  const handleTestConflictDetection = async () => {
    try {
      const res = await developerPlatformService.detectFileConflict(projectId, {
        filePath: "src/App.tsx",
        incomingContent: "export default function App() {\n  return <div>Collaborative Edit</div>;\n}",
      });
      setConflictDiff(res.result);
      onLog?.(`Conflict status: ${res.result.status}`, res.result.conflictDetected ? "warn" : "success");
    } catch (err: any) {
      onLog?.(`Conflict detection failed: ${err.message}`, "error");
    }
  };

  // =========================================================================
  // Module 58 Actions
  // =========================================================================
  const handleTogglePlugin = async (plugin: any) => {
    try {
      if (plugin.lifecycleState === "ENABLED") {
        await developerPlatformService.disablePlugin(projectId, plugin.id);
        onLog?.(`Disabled plugin ${plugin.name}`, "info");
      } else {
        await developerPlatformService.enablePlugin(projectId, plugin.id);
        onLog?.(`Enabled plugin ${plugin.name}`, "success");
      }
      loadTabData("extensions");
    } catch (err: any) {
      onLog?.(`Plugin action failed: ${err.message}`, "error");
    }
  };

  const handleInstallSamplePlugin = async () => {
    try {
      const sampleManifest = {
        manifestVersion: "1.0.0",
        id: `plugin-${Date.now().toString(36)}`,
        name: "Linter & Formatter Extension",
        version: "1.0.0",
        description: "Zero-dependency static analyzer and code style verification hook.",
        author: { name: "Forge Platform", verified: true },
        compatibility: { minForgeVersion: "2.0.0" },
        permissions: ["filesystem.read" as const],
        lifecycle: { canDisable: true, canUninstall: true },
      };
      await developerPlatformService.installPlugin(projectId, sampleManifest);
      onLog?.(`Installed plugin: ${sampleManifest.name}`, "success");
      loadTabData("extensions");
    } catch (err: any) {
      onLog?.(`Installation failed: ${err.message}`, "error");
    }
  };

  // =========================================================================
  // Module 59 Actions
  // =========================================================================
  const handleStartImport = async () => {
    if (!importRepoUrl.trim()) return;
    try {
      setLoading(true);
      const res = await developerPlatformService.startProjectImport(projectId, {
        sourceType: "GIT",
        repoUrl: importRepoUrl,
      });
      setImportJob(res.job);
      onLog?.(`Import job started: ${res.job.id} [status: ${res.job.status}]`, "info");
    } catch (err: any) {
      onLog?.(`Import failed: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // Module 60 Actions
  // =========================================================================
  const handleFindAffected = async () => {
    try {
      const res = await developerPlatformService.getAffectedPackages(projectId, ["packages/ui/src/Button.tsx"]);
      setAffectedPackages(res.affected || []);
      onLog?.(`Found ${res.affected.length} affected packages`, "info");
    } catch (err: any) {
      onLog?.(`Affected analysis failed: ${err.message}`, "error");
    }
  };

  const handleGenerateDeployPlan = async () => {
    try {
      const res = await developerPlatformService.getMonorepoDeployPlan(projectId);
      setDeployPlan(res.plan);
      onLog?.(`Generated deploy plan with ${res.plan.stages.length} stages`, "success");
    } catch (err: any) {
      onLog?.(`Deploy plan failed: ${err.message}`, "error");
    }
  };

  // =========================================================================
  // Module 61 Actions
  // =========================================================================
  const handleGenerateDockerfile = async () => {
    try {
      const res = await developerPlatformService.generateDockerfile(projectId, {
        framework: "react",
        port: 3000,
        nodeVersion: "20-alpine",
      });
      setDockerfileContent(res.dockerfile);
      onLog?.("Generated multi-stage Dockerfile", "success");
    } catch (err: any) {
      onLog?.(`Dockerfile generation failed: ${err.message}`, "error");
    }
  };

  const handleRunContainer = async () => {
    try {
      const res = await developerPlatformService.startContainer(projectId, {
        imageTag: "latest",
        containerPort: 3000,
        hostPort: 3000,
      });
      setContainers((prev) => [res.run, ...prev]);
      onLog?.(`Container started on port ${res.run.hostPort}`, "success");
    } catch (err: any) {
      onLog?.(`Container start failed: ${err.message}`, "error");
    }
  };

  const handleValidateInfra = async () => {
    try {
      const res = await developerPlatformService.validateInfrastructure(projectId);
      setInfraValidation(res.result);
      onLog?.(
        `Infra validation: ${res.result.valid ? "PASSED" : "FAILED"} (${res.result.errors.length} errors, ${res.result.warnings.length} warnings)`,
        res.result.valid ? "success" : "warn"
      );
    } catch (err: any) {
      onLog?.(`Validation failed: ${err.message}`, "error");
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 overflow-hidden font-sans">
      {/* Top Header & Navigation */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800/80 border-b border-slate-700/60 backdrop-blur-md">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setActiveTab("collaboration")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "collaboration"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/40"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Collaboration</span>
          </button>

          <button
            onClick={() => setActiveTab("extensions")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "extensions"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/40"
            }`}
          >
            <Puzzle className="w-3.5 h-3.5" />
            <span>Plugin SDK</span>
          </button>

          <button
            onClick={() => setActiveTab("import")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "import"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/40"
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Import & Migration</span>
          </button>

          <button
            onClick={() => setActiveTab("monorepo")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "monorepo"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/40"
            }`}
          >
            <FolderGit2 className="w-3.5 h-3.5" />
            <span>Monorepo & Services</span>
          </button>

          <button
            onClick={() => setActiveTab("containers")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "containers"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/40"
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>Containers & Infra</span>
          </button>
        </div>

        <button
          onClick={() => loadTabData(activeTab)}
          disabled={loading}
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 rounded transition"
          title="Refresh view"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-400" : ""}`} />
        </button>
      </div>

      {/* Main Panel Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ========================================================================= */}
        {/* TAB 1: COLLABORATION */}
        {/* ========================================================================= */}
        {activeTab === "collaboration" && (
          <div className="space-y-6">
            {/* Top row: Active Sessions & Conflict Resolver */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Presence / Active Sessions Card */}
              <div className="bg-slate-800/60 border border-slate-700/70 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-400" />
                    Active Collaborators ({sessions.length})
                  </h3>
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/80 px-2 py-0.5 rounded-full font-mono">
                    Live Presence
                  </span>
                </div>

                {sessions.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No other active collaborators currently connected.</p>
                ) : (
                  <div className="space-y-2">
                    {sessions.map((s, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-slate-900/60 p-2.5 rounded border border-slate-800 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="font-medium text-slate-200">{s.userId || "Collaborator"}</span>
                          {s.activeFile && (
                            <span className="text-[11px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                              {s.activeFile}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          Cursor: {s.cursorLine || 1}:{s.cursorColumn || 1}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3-Way Conflict Detector */}
              <div className="bg-slate-800/60 border border-slate-700/70 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <GitPullRequest className="w-4 h-4 text-amber-400" />
                    3-Way Conflict Resolution
                  </h3>
                  <button
                    onClick={handleTestConflictDetection}
                    className="text-xs bg-slate-700 hover:bg-slate-600 px-2.5 py-1 rounded transition text-slate-200"
                  >
                    Check Workspace Diff
                  </button>
                </div>

                {conflictDiff ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between bg-slate-900/70 p-2 rounded border border-slate-800">
                      <span>Status:</span>
                      <span
                        className={`font-semibold ${
                          conflictDiff.conflictDetected ? "text-amber-400" : "text-emerald-400"
                        }`}
                      >
                        {conflictDiff.status}
                      </span>
                    </div>
                    {conflictDiff.conflictDetected && (
                      <div className="bg-amber-950/40 border border-amber-800/60 p-2.5 rounded text-amber-200 text-xs">
                        Concurrent write detected on {conflictDiff.filePath}. Resolution strategy available: 3-way
                        merge, incoming overwrite, or keep current.
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    Workspace revisions are synchronized deterministically with the persistent filesystem.
                  </p>
                )}
              </div>
            </div>

            {/* Middle row: File Comments & Discussions */}
            <div className="bg-slate-800/60 border border-slate-700/70 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                Code Comments & Review Threads ({comments.length})
              </h3>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Target file (e.g. src/App.tsx)"
                  value={newCommentFile}
                  onChange={(e) => setNewCommentFile(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 w-44"
                />
                <input
                  type="text"
                  placeholder="Leave comment or @mention a collaborator..."
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateComment()}
                  className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 flex-1"
                />
                <button
                  onClick={handleCreateComment}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded text-xs font-medium transition"
                >
                  Post
                </button>
              </div>

              <div className="space-y-2 mt-3 max-h-48 overflow-y-auto">
                {comments.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No comments yet on this project.</p>
                ) : (
                  comments.map((c, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-900/60 p-2.5 rounded border border-slate-800 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-semibold text-indigo-300">{c.authorId || "User"}</span>
                        <span>
                          {c.filePath}:{c.lineNumber || 1}
                        </span>
                      </div>
                      <p className="text-slate-200">{c.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Bottom row: Activity Timeline */}
            <div className="bg-slate-800/60 border border-slate-700/70 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Activity className="w-4 h-4 text-sky-400" />
                Collaborative Activity Timeline
              </h3>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {timeline.map((act, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-slate-800/80"
                  >
                    <span className="text-slate-300 font-mono">
                      <span className="text-sky-400 font-semibold">{act.action}</span> on {act.entityType}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(act.createdAt).toLocaleTimeString()} by {act.actorId}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: EXTENSIONS & PLUGIN SDK */}
        {/* ========================================================================= */}
        {activeTab === "extensions" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Installed Extensions & Plugins</h3>
                <p className="text-xs text-slate-400">
                  Manage sandbox lifecycle, capability permissions, and verified extension hooks.
                </p>
              </div>
              <button
                onClick={handleInstallSamplePlugin}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded font-medium transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Install Plugin
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plugins.length === 0 ? (
                <div className="col-span-2 text-center py-8 text-xs text-slate-400 italic">
                  No extensions installed in this workspace. Click 'Install Plugin' to register one.
                </div>
              ) : (
                plugins.map((plugin) => (
                  <div
                    key={plugin.id}
                    className="bg-slate-800/60 border border-slate-700/70 rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                          {plugin.name}
                          <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                            v{plugin.version}
                          </span>
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">{plugin.description}</p>
                      </div>

                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                          plugin.lifecycleState === "ENABLED"
                            ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                            : "bg-slate-800 text-slate-400 border-slate-700"
                        }`}
                      >
                        {plugin.lifecycleState}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <Shield className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Permissions:</span>
                      <div className="flex gap-1 flex-wrap">
                        {(plugin.manifest?.permissions || ["filesystem.read"]).map((perm: string) => (
                          <span key={perm} className="bg-slate-900 px-1.5 py-0.5 rounded text-[10px] text-slate-300">
                            {perm}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-700/50">
                      <button
                        onClick={() => handleTogglePlugin(plugin)}
                        className={`text-xs px-2.5 py-1 rounded transition ${
                          plugin.lifecycleState === "ENABLED"
                            ? "bg-amber-900/60 hover:bg-amber-900 text-amber-200"
                            : "bg-emerald-900/60 hover:bg-emerald-900 text-emerald-200"
                        }`}
                      >
                        {plugin.lifecycleState === "ENABLED" ? "Disable" : "Enable"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: PROJECT IMPORT & MIGRATION */}
        {/* ========================================================================= */}
        {activeTab === "import" && (
          <div className="space-y-4">
            <div className="bg-slate-800/60 border border-slate-700/70 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Download className="w-4 h-4 text-indigo-400" />
                Ingest External Project (Git / GitHub / ZIP)
              </h3>
              <p className="text-xs text-slate-400">
                Detects framework, runtime, lockfiles, and environment references non-destructively in an isolated
                staging workspace before committing.
              </p>

              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  placeholder="https://github.com/org/repo.git or git URL"
                  value={importRepoUrl}
                  onChange={(e) => setImportRepoUrl(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-200 flex-1 font-mono"
                />
                <button
                  onClick={handleStartImport}
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded text-xs font-medium transition"
                >
                  Analyze & Import
                </button>
              </div>
            </div>

            {importJob && (
              <div className="bg-slate-800/60 border border-slate-700/70 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-slate-200 font-mono">Job ID: {importJob.id}</h4>
                  <span className="text-[10px] bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded font-mono">
                    {importJob.status}
                  </span>
                </div>

                {importJob.analysis && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                      <span className="text-slate-400 text-[10px] block">Framework</span>
                      <span className="font-semibold text-slate-200">{importJob.analysis.framework?.name || "React"}</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                      <span className="text-slate-400 text-[10px] block">Runtime</span>
                      <span className="font-semibold text-slate-200">
                        Node {importJob.analysis.runtime?.nodeVersion || ">=18"}
                      </span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                      <span className="text-slate-400 text-[10px] block">Package Manager</span>
                      <span className="font-semibold text-slate-200">{importJob.analysis.runtime?.packageManager || "npm"}</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                      <span className="text-slate-400 text-[10px] block">Safe Staging</span>
                      <span className="font-semibold text-emerald-400">Verified</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: MONOREPO & MULTI-SERVICE */}
        {/* ========================================================================= */}
        {activeTab === "monorepo" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <FolderGit2 className="w-4 h-4 text-indigo-400" />
                  Monorepo Workspace Graph & Services
                </h3>
                <p className="text-xs text-slate-400">
                  Manager: <span className="font-semibold text-indigo-300">{monorepoGraph?.manager || "npm"}</span> |{" "}
                  Packages: {monorepoGraph?.packages?.length || 0}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleFindAffected}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded transition border border-slate-700"
                >
                  Analyze Affected
                </button>
                <button
                  onClick={handleGenerateDeployPlan}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded transition font-medium"
                >
                  Deploy Plan
                </button>
              </div>
            </div>

            {/* Packages list */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(monorepoGraph?.packages || []).map((pkg: any) => (
                <div
                  key={pkg.id}
                  className="bg-slate-800/60 border border-slate-700/70 rounded-lg p-3 space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">{pkg.name}</span>
                    <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                      {pkg.type}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono truncate">{pkg.path}</p>
                </div>
              ))}
            </div>

            {/* Deploy plan preview */}
            {deployPlan && (
              <div className="bg-slate-800/60 border border-slate-700/70 rounded-lg p-4 space-y-2">
                <h4 className="text-xs font-semibold text-slate-200">Coordinated Deployment Stages</h4>
                <div className="space-y-1">
                  {deployPlan.stages.map((stage: string[], idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 bg-slate-900 p-2 rounded border border-slate-800 text-xs"
                    >
                      <span className="text-indigo-400 font-mono font-semibold">Stage {idx + 1}:</span>
                      <span className="text-slate-200">{stage.join(", ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: CONTAINERS & INFRASTRUCTURE */}
        {/* ========================================================================= */}
        {activeTab === "containers" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Box className="w-4 h-4 text-indigo-400" />
                  Containerization & IaC Engine
                </h3>
                <p className="text-xs text-slate-400">
                  Production multi-stage Dockerfiles, Compose services, Kubernetes manifests, and Terraform IaC.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleGenerateDockerfile}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded transition border border-slate-700"
                >
                  Generate Dockerfile
                </button>
                <button
                  onClick={handleRunContainer}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded transition font-medium flex items-center gap-1"
                >
                  <Play className="w-3 h-3" />
                  Run Container
                </button>
                <button
                  onClick={handleValidateInfra}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded transition font-medium"
                >
                  Validate Policy
                </button>
              </div>
            </div>

            {/* Validation Banner */}
            {infraValidation && (
              <div
                className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                  infraValidation.valid
                    ? "bg-emerald-950/40 border-emerald-800 text-emerald-200"
                    : "bg-amber-950/40 border-amber-800 text-amber-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  {infraValidation.valid ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  )}
                  <span>
                    Zero-Trust Policy: {infraValidation.valid ? "Clean (No exposed secrets)" : "Warnings Detected"}
                  </span>
                </div>
                <span className="font-mono text-[11px]">
                  Errors: {infraValidation.errors.length} | Warnings: {infraValidation.warnings.length}
                </span>
              </div>
            )}

            {/* Active Containers list */}
            <div className="bg-slate-800/60 border border-slate-700/70 rounded-lg p-4 space-y-3">
              <h4 className="text-xs font-semibold text-slate-200">Active Sandbox Containers ({containers.length})</h4>
              {containers.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No containers currently running.</p>
              ) : (
                <div className="space-y-2">
                  {containers.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between bg-slate-900 p-2.5 rounded border border-slate-800 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="font-semibold text-slate-200">{c.containerName}</span>
                        <span className="text-slate-400 font-mono text-[11px]">
                          Port: {c.hostPort} -&gt; {c.containerPort}
                        </span>
                      </div>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                        {c.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Dockerfile Editor Preview */}
            <div className="bg-slate-800/60 border border-slate-700/70 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                  Dockerfile (Production Multi-Stage)
                </h4>
                <span className="text-[10px] text-slate-400 font-mono">workspace/Dockerfile</span>
              </div>
              <pre className="bg-slate-950 p-3 rounded font-mono text-xs text-slate-300 max-h-56 overflow-y-auto leading-relaxed border border-slate-800">
                {dockerfileContent || "# No Dockerfile configured. Click 'Generate Dockerfile' above."}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
