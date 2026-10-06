import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Bot,
  Terminal,
  ShieldAlert,
  Globe,
  Network,
  Cpu,
  Play,
  RotateCw,
  CheckCircle,
  AlertTriangle,
  FileCode,
  Layers,
  Wrench,
  Search,
  Check,
  X,
  ExternalLink,
  BookOpen,
  Compass,
  FileText,
  Activity,
  Pause,
  RefreshCw,
  GitCommit,
  ShieldCheck,
  Zap,
  Filter,
} from "lucide-react";
import { forgeProjectService } from "../services/forgeProjectService";

interface AiAgentPanelProps {
  projectId: string;
  onOpenFile?: (filePath: string) => void;
}

export const AiAgentPanel: React.FC<AiAgentPanelProps> = ({ projectId, onOpenFile }) => {
  const [activeTab, setActiveTab] = useState<
    "tasks" | "planning" | "architecture" | "memory" | "context" | "coding" | "tools" | "mcp" | "gateway"
  >("tasks");

  // ==========================================
  // Module 42: Task & Run Manager State
  // ==========================================
  const [tasks, setTasks] = useState<any[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskObjective, setNewTaskObjective] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [activeRun, setActiveRun] = useState<any>(null);
  const [runEvents, setRunEvents] = useState<any[]>([]);
  const [runArtifacts, setRunArtifacts] = useState<any[]>([]);
  const [startingRun, setStartingRun] = useState(false);

  // ==========================================
  // Module 39: Planning Agent State
  // ==========================================
  const [planObjective, setPlanObjective] = useState("");
  const [activePlan, setActivePlan] = useState<any>(null);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  // ==========================================
  // Module 40: Architecture Agent State
  // ==========================================
  const [archSnapshot, setArchSnapshot] = useState<any>(null);
  const [archFindings, setArchFindings] = useState<any[]>([]);
  const [analyzingArch, setAnalyzingArch] = useState(false);

  // ==========================================
  // Module 38: Project Memory State
  // ==========================================
  const [memories, setMemories] = useState<any[]>([]);
  const [newMemoryType, setNewMemoryType] = useState<string>("ARCHITECTURE_DECISION");
  const [newMemoryTitle, setNewMemoryTitle] = useState("");
  const [newMemoryContent, setNewMemoryContent] = useState("");
  const [newMemorySeverity, setNewMemorySeverity] = useState<string>("WARNING");
  const [memoryFilter, setMemoryFilter] = useState("");

  // ==========================================
  // Module 37: Context Engine State
  // ==========================================
  const [contextObjective, setContextObjective] = useState("");
  const [contextProfile, setContextProfile] = useState("CodingAgentContext");
  const [contextSnapshot, setContextSnapshot] = useState<any>(null);
  const [assemblingContext, setAssemblingContext] = useState(false);

  // ==========================================
  // Legacy & Tools State
  // ==========================================
  const [tools, setTools] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [mcpServers, setMcpServers] = useState<any[]>([]);
  const [newServerName, setNewServerName] = useState("");
  const [newServerEndpoint, setNewServerEndpoint] = useState("");
  const [aiHealth, setAiHealth] = useState<any[]>([]);
  const [aiUsage, setAiUsage] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTabData();
  }, [projectId, activeTab]);

  // Live SSE listener for active run
  useEffect(() => {
    if (!activeRun?.id) return;
    const es = new EventSource(`/api/v1/projects/${projectId}/ai/runs/${activeRun.id}/events/stream`);

    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        if (parsed.eventType) {
          setRunEvents((prev) => [...prev, parsed]);
          if (parsed.eventType === "RUN_COMPLETED" || parsed.eventType === "RUN_FAILED") {
            loadRunDetails(activeRun.id);
          }
        }
      } catch {}
    };

    return () => {
      es.close();
    };
  }, [projectId, activeRun?.id]);

  const loadTabData = async () => {
    try {
      setLoading(true);
      if (activeTab === "tasks") {
        const res = await forgeProjectService.listAiTasks(projectId);
        setTasks(res.tasks || []);
        if (res.tasks?.length > 0 && !selectedTask) {
          setSelectedTask(res.tasks[0]);
          if (res.tasks[0].activeRunId) {
            loadRunDetails(res.tasks[0].activeRunId);
          }
        }
      } else if (activeTab === "memory") {
        const res = await forgeProjectService.listMemories(projectId);
        setMemories(res.memories || []);
      } else if (activeTab === "architecture") {
        const res = await forgeProjectService.getArchitectureSnapshot(projectId);
        if (res.snapshot) {
          setArchSnapshot(res.snapshot);
          setArchFindings(res.snapshot.findings || []);
        }
      } else if (activeTab === "tools") {
        const res = await forgeProjectService.listAiTools(projectId);
        setTools(res.tools || []);
      } else if (activeTab === "mcp") {
        const res = await forgeProjectService.listMcpServers(projectId);
        setMcpServers(res.servers || []);
      } else if (activeTab === "gateway") {
        const healthRes = await forgeProjectService.getAiHealth();
        setAiHealth(healthRes.health || []);
        const usageRes = await forgeProjectService.getAiUsage(projectId);
        setAiUsage(usageRes.stats);
      }
    } catch (err) {
      console.error("Failed to load tab data:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadRunDetails = async (runId: string) => {
    try {
      const runRes = await forgeProjectService.getAiRun(projectId, runId);
      setActiveRun(runRes.run);
      const eventsRes = await forgeProjectService.getRunEvents(projectId, runId);
      setRunEvents(eventsRes.events || []);
      const artRes = await forgeProjectService.listRunArtifacts(projectId, runId);
      setRunArtifacts(artRes.artifacts || []);
    } catch (err) {
      console.error("Error loading run details:", err);
    }
  };

  // Handlers for Module 42
  const handleCreateTask = async () => {
    if (!newTaskTitle.trim() || !newTaskObjective.trim()) return;
    try {
      setLoading(true);
      const res = await forgeProjectService.createAiTask(projectId, {
        title: newTaskTitle,
        objective: newTaskObjective,
        priority: newTaskPriority,
      });
      setNewTaskTitle("");
      setNewTaskObjective("");
      setTasks((prev) => [res.task, ...prev]);
      setSelectedTask(res.task);
    } catch (err: any) {
      alert(`Failed to create task: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStartRun = async (taskId: string) => {
    try {
      setStartingRun(true);
      const res = await forgeProjectService.startAiRun(projectId, taskId);
      setActiveRun(res.run);
      loadRunDetails(res.run.id);
      loadTabData();
    } catch (err: any) {
      alert(`Failed to start run: ${err.message}`);
    } finally {
      setStartingRun(false);
    }
  };

  const handlePauseRun = async () => {
    if (!activeRun?.id) return;
    try {
      await forgeProjectService.pauseAiRun(projectId, activeRun.id);
      loadRunDetails(activeRun.id);
    } catch (err: any) {
      alert(`Pause failed: ${err.message}`);
    }
  };

  const handleResumeRun = async () => {
    if (!activeRun?.id) return;
    try {
      await forgeProjectService.resumeAiRun(projectId, activeRun.id);
      loadRunDetails(activeRun.id);
    } catch (err: any) {
      alert(`Resume failed: ${err.message}`);
    }
  };

  const handleCancelRun = async () => {
    if (!activeRun?.id) return;
    try {
      await forgeProjectService.cancelAiRun(projectId, activeRun.id);
      loadRunDetails(activeRun.id);
    } catch (err: any) {
      alert(`Cancel failed: ${err.message}`);
    }
  };

  const handleRetryRun = async () => {
    if (!activeRun?.id) return;
    try {
      const res = await forgeProjectService.retryAiRun(projectId, activeRun.id);
      setActiveRun(res.run);
      loadRunDetails(res.run.id);
    } catch (err: any) {
      alert(`Retry failed: ${err.message}`);
    }
  };

  // Handlers for Module 39 (Planning)
  const handleGeneratePlan = async () => {
    if (!planObjective.trim()) return;
    try {
      setGeneratingPlan(true);
      const res = await forgeProjectService.generateAiPlan(projectId, {
        objective: planObjective,
      });
      setActivePlan(res.plan);
    } catch (err: any) {
      alert(`Plan generation failed: ${err.message}`);
    } finally {
      setGeneratingPlan(false);
    }
  };

  const handleApprovePlan = async (planId: string) => {
    try {
      const res = await forgeProjectService.approveAiPlan(projectId, planId);
      setActivePlan(res.plan);
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`);
    }
  };

  // Handlers for Module 40 (Architecture)
  const handleAnalyzeArchitecture = async () => {
    try {
      setAnalyzingArch(true);
      const res = await forgeProjectService.analyzeArchitecture(projectId);
      setArchSnapshot(res.snapshot);
      setArchFindings(res.snapshot.findings || []);
    } catch (err: any) {
      alert(`Architecture analysis failed: ${err.message}`);
    } finally {
      setAnalyzingArch(false);
    }
  };

  // Handlers for Module 38 (Memory)
  const handleCreateMemory = async () => {
    if (!newMemoryTitle.trim() || !newMemoryContent.trim()) return;
    try {
      const res = await forgeProjectService.createMemory(projectId, {
        type: newMemoryType,
        title: newMemoryTitle,
        content: newMemoryContent,
        severity: newMemorySeverity,
      });
      setMemories((prev) => [res.memory, ...prev]);
      setNewMemoryTitle("");
      setNewMemoryContent("");
    } catch (err: any) {
      alert(`Failed to save memory: ${err.message}`);
    }
  };

  const handleRevokeMemory = async (id: string) => {
    try {
      const res = await forgeProjectService.revokeMemory(projectId, id, "Revoked by user in workspace");
      setMemories((prev) => prev.map((m) => (m.id === id ? res.memory : m)));
    } catch (err: any) {
      alert(`Failed to revoke memory: ${err.message}`);
    }
  };

  // Handlers for Module 37 (Context Engine)
  const handleAssembleContext = async () => {
    if (!contextObjective.trim()) return;
    try {
      setAssemblingContext(true);
      const res = await forgeProjectService.assembleContext(projectId, {
        objective: contextObjective,
        contextProfile,
        tokenBudget: 32000,
      });
      setContextSnapshot(res.snapshot);
    } catch (err: any) {
      alert(`Context assembly failed: ${err.message}`);
    } finally {
      setAssemblingContext(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 font-sans select-none">
      {/* Platform Navigation Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900/60">
        <div className="flex items-center gap-1.5 text-xs overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("tasks")}
            className={`px-2.5 py-1 rounded font-medium flex items-center gap-1.5 transition ${
              activeTab === "tasks" ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Tasks & Runs</span>
          </button>

          <button
            onClick={() => setActiveTab("planning")}
            className={`px-2.5 py-1 rounded font-medium flex items-center gap-1.5 transition ${
              activeTab === "planning" ? "bg-blue-600/30 text-blue-300 border border-blue-500/40" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Plan & DAG</span>
          </button>

          <button
            onClick={() => setActiveTab("architecture")}
            className={`px-2.5 py-1 rounded font-medium flex items-center gap-1.5 transition ${
              activeTab === "architecture" ? "bg-amber-600/30 text-amber-300 border border-amber-500/40" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Architecture</span>
          </button>

          <button
            onClick={() => setActiveTab("memory")}
            className={`px-2.5 py-1 rounded font-medium flex items-center gap-1.5 transition ${
              activeTab === "memory" ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/40" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Project Memory</span>
          </button>

          <button
            onClick={() => setActiveTab("context")}
            className={`px-2.5 py-1 rounded font-medium flex items-center gap-1.5 transition ${
              activeTab === "context" ? "bg-purple-600/30 text-purple-300 border border-purple-500/40" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Context Engine</span>
          </button>

          <button
            onClick={() => setActiveTab("tools")}
            className={`px-2.5 py-1 rounded font-medium flex items-center gap-1.5 transition ${
              activeTab === "tools" ? "bg-slate-800 text-slate-300 border border-slate-700" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Tools</span>
          </button>

          <button
            onClick={() => setActiveTab("gateway")}
            className={`px-2.5 py-1 rounded font-medium flex items-center gap-1.5 transition ${
              activeTab === "gateway" ? "bg-slate-800 text-slate-300 border border-slate-700" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Gateway</span>
          </button>
        </div>

        <button
          onClick={loadTabData}
          className="p-1 text-slate-400 hover:text-slate-200 rounded"
          title="Refresh"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 text-xs">
        {/* ========================================================= */}
        {/* TAB 1: MODULE 42 - TASKS & RUNS MANAGER                  */}
        {/* ========================================================= */}
        {activeTab === "tasks" && (
          <div className="grid grid-cols-12 gap-4 h-full">
            {/* Left: Task List & Creator */}
            <div className="col-span-4 space-y-4 border-r border-slate-800/80 pr-4">
              <div className="p-3 border border-slate-800 rounded-lg bg-slate-900/40 space-y-2">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Create Engineering Task</span>
                </div>
                <input
                  type="text"
                  placeholder="Task Title (e.g. Add OAuth & DB Indexes)"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 px-2.5 py-1.5 rounded text-slate-200 outline-none"
                />
                <textarea
                  placeholder="Objective description & requirements..."
                  value={newTaskObjective}
                  onChange={(e) => setNewTaskObjective(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 px-2.5 py-1.5 rounded text-slate-200 outline-none resize-none"
                />
                <div className="flex items-center justify-between pt-1">
                  <select
                    value={newTaskPriority}
                    onChange={(e: any) => setNewTaskPriority(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-300"
                  >
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                  <button
                    onClick={handleCreateTask}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium flex items-center gap-1"
                  >
                    <Play className="w-3 h-3" />
                    <span>Create Task</span>
                  </button>
                </div>
              </div>

              {/* Task List */}
              <div className="space-y-1.5 overflow-y-auto max-h-[500px]">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1">
                  Active Tasks ({tasks.length})
                </div>
                {tasks.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 border border-dashed border-slate-800 rounded">
                    No engineering tasks yet. Create one above to begin autonomous execution.
                  </div>
                ) : (
                  tasks.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => {
                        setSelectedTask(t);
                        if (t.activeRunId) loadRunDetails(t.activeRunId);
                      }}
                      className={`p-2.5 border rounded-lg cursor-pointer transition ${
                        selectedTask?.id === t.id
                          ? "bg-indigo-950/40 border-indigo-500/50"
                          : "bg-slate-900/30 border-slate-800 hover:bg-slate-900/60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200 truncate">{t.title}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            t.status === "COMPLETED"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : t.status === "RUNNING"
                              ? "bg-indigo-500/20 text-indigo-400 animate-pulse"
                              : t.status === "FAILED"
                              ? "bg-rose-500/20 text-rose-400"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-1">{t.objective}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right: Selected Task & Active Run Plane */}
            <div className="col-span-8 space-y-4">
              {selectedTask ? (
                <>
                  <div className="p-3 border border-slate-800 rounded-lg bg-slate-900/40 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-200">{selectedTask.title}</div>
                      <div className="text-slate-400 text-[11px]">{selectedTask.objective}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeRun?.status === "RUNNING" ? (
                        <>
                          <button
                            onClick={handlePauseRun}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-medium flex items-center gap-1"
                          >
                            <Pause className="w-3 h-3" />
                            <span>Pause</span>
                          </button>
                          <button
                            onClick={handleCancelRun}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded font-medium flex items-center gap-1"
                          >
                            <X className="w-3 h-3" />
                            <span>Cancel</span>
                          </button>
                        </>
                      ) : activeRun?.status === "PAUSED" ? (
                        <button
                          onClick={handleResumeRun}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium flex items-center gap-1"
                        >
                          <Play className="w-3 h-3" />
                          <span>Resume</span>
                        </button>
                      ) : activeRun?.status === "FAILED" ? (
                        <button
                          onClick={handleRetryRun}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium flex items-center gap-1"
                        >
                          <RotateCw className="w-3 h-3" />
                          <span>Retry Run</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStartRun(selectedTask.id)}
                          disabled={startingRun}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium flex items-center gap-1.5"
                        >
                          <Play className="w-3 h-3" />
                          <span>Start Run</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Active Run Steps Timeline */}
                  {activeRun && (
                    <div className="p-3 border border-slate-800 rounded-lg bg-slate-900/40 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                          <span>Execution Run #{activeRun.attemptNumber}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 font-mono">
                            {activeRun.id.slice(0, 8)}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          Status: <strong className="text-slate-200">{activeRun.status}</strong>
                        </span>
                      </div>

                      {/* DAG Steps */}
                      {activeRun.steps && activeRun.steps.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-semibold text-slate-400">DAG Step Progress:</div>
                          <div className="grid grid-cols-2 gap-2">
                            {activeRun.steps.map((st: any) => (
                              <div
                                key={st.id}
                                className="p-2 border border-slate-800/80 rounded bg-slate-950/60 flex items-center justify-between"
                              >
                                <div>
                                  <div className="font-medium text-slate-200">{st.title}</div>
                                  <div className="text-[10px] text-slate-500 font-mono">Agent: {st.agentId}</div>
                                </div>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] ${
                                    st.status === "COMPLETED"
                                      ? "bg-emerald-500/20 text-emerald-400"
                                      : st.status === "RUNNING"
                                      ? "bg-indigo-500/20 text-indigo-400 animate-pulse"
                                      : st.status === "FAILED"
                                      ? "bg-rose-500/20 text-rose-400"
                                      : "bg-slate-800 text-slate-500"
                                  }`}
                                >
                                  {st.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Activity Timeline Events */}
                  <div className="p-3 border border-slate-800 rounded-lg bg-slate-900/40 space-y-2">
                    <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-slate-400" />
                      <span>Live Activity Timeline</span>
                    </div>
                    <div className="bg-slate-950 rounded border border-slate-800/80 p-2 font-mono text-[11px] h-48 overflow-y-auto space-y-1">
                      {runEvents.length === 0 ? (
                        <div className="text-slate-600 italic">Waiting for events from agent orchestrator...</div>
                      ) : (
                        runEvents.map((evt: any, i) => (
                          <div key={i} className="flex gap-2">
                            <span className="text-slate-500">
                              {evt.createdAt ? new Date(evt.createdAt).toLocaleTimeString() : "--"}
                            </span>
                            <span className="text-indigo-400">[{evt.eventType}]</span>
                            <span className="text-slate-300">{JSON.stringify(evt.payload || {})}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Artifacts Viewer */}
                  {runArtifacts.length > 0 && (
                    <div className="p-3 border border-slate-800 rounded-lg bg-slate-900/40 space-y-2">
                      <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                        <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Generated Artifacts & Diffs ({runArtifacts.length})</span>
                      </div>
                      <div className="space-y-1.5">
                        {runArtifacts.map((art: any) => (
                          <div
                            key={art.id}
                            className="p-2 border border-slate-800 rounded bg-slate-950/80 flex items-center justify-between"
                          >
                            <span className="font-medium text-slate-200">{art.name}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-950 text-cyan-400">
                              {art.type}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg">
                  Select or create a task on the left to inspect DAG execution, runs, and artifacts.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: MODULE 39 - PLANNING AGENT                        */}
        {/* ========================================================= */}
        {activeTab === "planning" && (
          <div className="max-w-4xl space-y-4">
            <div className="p-4 border border-slate-800 rounded-lg bg-slate-900/40 space-y-3">
              <div className="font-semibold text-sm text-slate-200 flex items-center gap-2">
                <Compass className="w-4 h-4 text-blue-400" />
                <span>AI Planning Agent & DAG Constructor</span>
              </div>
              <p className="text-slate-400">
                Decomposes complex requirements into dependency-ordered DAG tasks with risk scoring, rollback plans, and human approval gates.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Implement full authentication with rate-limiting and audit logging"
                  value={planObjective}
                  onChange={(e) => setPlanObjective(e.target.value)}
                  className="bg-slate-950 border border-slate-700 px-3 py-1.5 rounded text-slate-200 flex-1 outline-none"
                />
                <button
                  onClick={handleGeneratePlan}
                  disabled={generatingPlan}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{generatingPlan ? "Generating..." : "Generate Plan"}</span>
                </button>
              </div>
            </div>

            {activePlan && (
              <div className="p-4 border border-slate-800 rounded-lg bg-slate-900/40 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-200">{activePlan.title}</div>
                    <div className="text-slate-400 text-[11px]">{activePlan.objective}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        activePlan.riskLevel === "CRITICAL"
                          ? "bg-rose-500/20 text-rose-400"
                          : activePlan.riskLevel === "HIGH"
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-emerald-500/20 text-emerald-400"
                      }`}
                    >
                      Risk: {activePlan.riskLevel}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300">
                      Status: {activePlan.status}
                    </span>
                  </div>
                </div>

                {/* Steps */}
                <div className="space-y-2">
                  <div className="font-semibold text-slate-300">Implementation DAG Steps:</div>
                  <div className="space-y-1.5">
                    {activePlan.steps?.map((s: any, idx: number) => (
                      <div key={idx} className="p-2.5 border border-slate-800 rounded bg-slate-950/60 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="font-medium text-slate-200 flex items-center gap-2">
                            <span>#{s.order} {s.title}</span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-indigo-950 text-indigo-400 font-mono">
                              {s.agentRole}
                            </span>
                          </div>
                          <div className="text-slate-400 text-[11px]">{s.description}</div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500">Action: {s.action}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Approval Control */}
                {activePlan.status === "DRAFT" && (
                  <div className="p-3 bg-amber-950/30 border border-amber-800/60 rounded flex items-center justify-between">
                    <div className="text-amber-300">Plan is in review. High-risk execution requires explicit human authorization.</div>
                    <button
                      onClick={() => handleApprovePlan(activePlan.id)}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve Plan</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: MODULE 40 - ARCHITECTURE AGENT                    */}
        {/* ========================================================= */}
        {activeTab === "architecture" && (
          <div className="max-w-4xl space-y-4">
            <div className="p-4 border border-slate-800 rounded-lg bg-slate-900/40 flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm text-slate-200 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <span>AI Architecture Agent & Boundary Validator</span>
                </div>
                <p className="text-slate-400 mt-1">
                  Detects circular dependencies, layer violations, duplicate services, and architecture drift.
                </p>
              </div>
              <button
                onClick={handleAnalyzeArchitecture}
                disabled={analyzingArch}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded font-medium flex items-center gap-1.5"
              >
                <RotateCw className={`w-3.5 h-3.5 ${analyzingArch ? "animate-spin" : ""}`} />
                <span>{analyzingArch ? "Analyzing..." : "Run Audit"}</span>
              </button>
            </div>

            {archSnapshot && (
              <div className="space-y-4">
                {/* Score Summary */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-3 border border-slate-800 rounded bg-slate-900/40 text-center">
                    <div className="text-2xl font-bold text-amber-400">{archSnapshot.score}/100</div>
                    <div className="text-slate-400 text-[11px] mt-1">Health Score</div>
                  </div>
                  <div className="p-3 border border-slate-800 rounded bg-slate-900/40 text-center">
                    <div className="text-2xl font-bold text-slate-200">{archSnapshot.moduleCount}</div>
                    <div className="text-slate-400 text-[11px] mt-1">Modules Scanned</div>
                  </div>
                  <div className="p-3 border border-slate-800 rounded bg-slate-900/40 text-center">
                    <div className="text-2xl font-bold text-slate-200">
                      {archSnapshot.circularDependencies?.length || 0}
                    </div>
                    <div className="text-slate-400 text-[11px] mt-1">Circular Cycles</div>
                  </div>
                  <div className="p-3 border border-slate-800 rounded bg-slate-900/40 text-center">
                    <div className="text-2xl font-bold text-slate-200">
                      {archSnapshot.layerViolations?.length || 0}
                    </div>
                    <div className="text-slate-400 text-[11px] mt-1">Layer Violations</div>
                  </div>
                </div>

                {/* Findings */}
                <div className="p-3 border border-slate-800 rounded bg-slate-900/40 space-y-2">
                  <div className="font-semibold text-slate-300">Architecture Findings ({archFindings.length}):</div>
                  {archFindings.length === 0 ? (
                    <div className="text-emerald-400 font-medium py-2">✓ Zero architecture defects found. Cohesive boundaries verified.</div>
                  ) : (
                    archFindings.map((f: any) => (
                      <div key={f.id} className="p-2.5 border border-slate-800 rounded bg-slate-950/80 flex items-start justify-between">
                        <div>
                          <div className="font-medium text-slate-200">{f.title}</div>
                          <div className="text-slate-400 text-[11px] mt-0.5">{f.description}</div>
                          {f.remediation && (
                            <div className="text-cyan-400 text-[10px] mt-1">Recommendation: {f.remediation}</div>
                          )}
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-400">
                          {f.severity}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: MODULE 38 - PROJECT MEMORY                         */}
        {/* ========================================================= */}
        {activeTab === "memory" && (
          <div className="max-w-4xl space-y-4">
            <div className="p-4 border border-slate-800 rounded-lg bg-slate-900/40 space-y-3">
              <div className="font-semibold text-sm text-slate-200 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                <span>AI Project Memory (Durable Engineering Knowledge)</span>
              </div>
              <p className="text-slate-400">
                Stores durable architecture decisions, conventions, and protected behaviors. Enforces the Read-Before-Edit contract.
              </p>
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={newMemoryType}
                  onChange={(e) => setNewMemoryType(e.target.value)}
                  className="bg-slate-950 border border-slate-700 px-2.5 py-1.5 rounded text-slate-200"
                >
                  <option value="ARCHITECTURE_DECISION">Architecture Decision</option>
                  <option value="CODING_CONVENTION">Coding Convention</option>
                  <option value="DO_NOT_BREAK_RULE">Do-Not-Break Rule</option>
                  <option value="PROTECTED_BEHAVIOR">Protected Behavior</option>
                  <option value="SECURITY_RULE">Security Rule</option>
                  <option value="DATABASE_CONSTRAINT">Database Constraint</option>
                </select>
                <select
                  value={newMemorySeverity}
                  onChange={(e) => setNewMemorySeverity(e.target.value)}
                  className="bg-slate-950 border border-slate-700 px-2.5 py-1.5 rounded text-slate-200"
                >
                  <option value="WARNING">Warning</option>
                  <option value="APPROVAL_REQUIRED">Approval Required</option>
                  <option value="BLOCKING">Blocking</option>
                </select>
                <input
                  type="text"
                  placeholder="Rule Title"
                  value={newMemoryTitle}
                  onChange={(e) => setNewMemoryTitle(e.target.value)}
                  className="bg-slate-950 border border-slate-700 px-2.5 py-1.5 rounded text-slate-200 outline-none"
                />
              </div>
              <textarea
                placeholder="Rule content, invariants, and implementation constraints..."
                value={newMemoryContent}
                onChange={(e) => setNewMemoryContent(e.target.value)}
                rows={2}
                className="w-full bg-slate-950 border border-slate-700 px-2.5 py-1.5 rounded text-slate-200 outline-none resize-none"
              />
              <button
                onClick={handleCreateMemory}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Add Project Memory</span>
              </button>
            </div>

            {/* Memory List */}
            <div className="space-y-2">
              <div className="font-semibold text-slate-300">Active Memories ({memories.length}):</div>
              {memories.map((m) => (
                <div key={m.id} className="p-3 border border-slate-800 rounded bg-slate-900/40 flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200">{m.title}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 font-mono">
                        {m.type}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] ${
                          m.severity === "BLOCKING"
                            ? "bg-rose-500/20 text-rose-400"
                            : m.severity === "APPROVAL_REQUIRED"
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {m.severity}
                      </span>
                    </div>
                    <p className="text-slate-400 text-[11px]">{m.content}</p>
                  </div>
                  {m.status === "ACTIVE" && (
                    <button
                      onClick={() => handleRevokeMemory(m.id)}
                      className="text-rose-400 hover:text-rose-300 text-[11px]"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 5: MODULE 37 - CONTEXT ENGINE                        */}
        {/* ========================================================= */}
        {activeTab === "context" && (
          <div className="max-w-4xl space-y-4">
            <div className="p-4 border border-slate-800 rounded-lg bg-slate-900/40 space-y-3">
              <div className="font-semibold text-sm text-slate-200 flex items-center gap-2">
                <Zap className="w-4 h-4 text-purple-400" />
                <span>AI Context Engine (Token-Budgeted & Secret-Redacted)</span>
              </div>
              <p className="text-slate-400">
                Compiles multi-source repository context, applies relevance ranking, enforces token limits, and redacts sensitive credentials.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Task objective for context assembly (e.g. Optimize React rendering)"
                  value={contextObjective}
                  onChange={(e) => setContextObjective(e.target.value)}
                  className="bg-slate-950 border border-slate-700 px-3 py-1.5 rounded text-slate-200 flex-1 outline-none"
                />
                <select
                  value={contextProfile}
                  onChange={(e) => setContextProfile(e.target.value)}
                  className="bg-slate-950 border border-slate-700 px-2.5 py-1.5 rounded text-slate-200"
                >
                  <option value="CodingAgentContext">Coding Profile</option>
                  <option value="PlanningAgentContext">Planning Profile</option>
                  <option value="ArchitectureAgentContext">Architecture Profile</option>
                  <option value="TestingAgentContext">Testing Profile</option>
                </select>
                <button
                  onClick={handleAssembleContext}
                  disabled={assemblingContext}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded font-medium flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{assemblingContext ? "Packing..." : "Assemble"}</span>
                </button>
              </div>
            </div>

            {contextSnapshot && (
              <div className="p-4 border border-slate-800 rounded-lg bg-slate-900/40 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="font-semibold text-slate-200">Context Snapshot #{contextSnapshot.id.slice(0, 8)}</div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] bg-purple-950 text-purple-300">
                      Tokens: {contextSnapshot.tokensUsed} / {contextSnapshot.tokenBudget}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-400">
                      Redacted: {contextSnapshot.redactedCount}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-400">Rationale & Explainability:</div>
                  <ul className="list-disc list-inside text-slate-400 text-[11px] space-y-0.5">
                    {contextSnapshot.explainability?.rationale?.map((r: string, idx: number) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-1.5 pt-2">
                  <div className="text-[11px] font-semibold text-slate-400">Packed Items ({contextSnapshot.items?.length}):</div>
                  <div className="space-y-1">
                    {contextSnapshot.items?.map((it: any) => (
                      <div key={it.id} className="p-2 border border-slate-800 rounded bg-slate-950/70 flex items-center justify-between">
                        <div>
                          <div className="font-medium text-slate-300">{it.title}</div>
                          <div className="text-[10px] text-slate-500 font-mono">Source: {it.source} ({it.estimatedTokens} tokens)</div>
                        </div>
                        <span className="text-[11px] text-cyan-400">Score: {it.relevanceScore}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 6: TOOLS & APPROVALS                                  */}
        {/* ========================================================= */}
        {activeTab === "tools" && (
          <div className="max-w-3xl space-y-4">
            <div className="p-3 border border-slate-800 rounded bg-slate-900/40 flex items-center justify-between">
              <span className="font-semibold text-slate-300">Registered Execution Tools ({tools.length})</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {tools.map((t) => (
                <div key={t.name} className="p-2.5 border border-slate-800 rounded bg-slate-950/60">
                  <div className="font-semibold text-slate-200">{t.name}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{t.description}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">{t.category}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-950 text-indigo-400">{t.riskLevel}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 7: GATEWAY & USAGE                                    */}
        {/* ========================================================= */}
        {activeTab === "gateway" && (
          <div className="max-w-3xl space-y-4">
            <div className="border border-slate-800 rounded-lg overflow-hidden divide-y divide-slate-800">
              <div className="p-2.5 bg-slate-900 font-semibold text-slate-300">AI Provider Gateway Health</div>
              {aiHealth.map((h: any) => (
                <div key={h.provider} className="p-3 flex items-center justify-between">
                  <div className="capitalize font-semibold text-slate-200">{h.provider}</div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">{h.averageLatencyMs}ms</span>
                    <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-500/20 text-emerald-400">
                      Circuit: {h.circuitStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {aiUsage && (
              <div className="p-4 border border-slate-800 rounded-lg bg-slate-900/40 space-y-2">
                <div className="font-semibold text-slate-200">Telemetry & Token Metering</div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 bg-slate-950 rounded">Total Requests: {aiUsage.totalRequests}</div>
                  <div className="p-2 bg-slate-950 rounded">Tokens: {aiUsage.totalTokens?.toLocaleString()}</div>
                  <div className="p-2 bg-slate-950 rounded">Estimated Cost: ${aiUsage.totalCostUsd?.toFixed(4)}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
