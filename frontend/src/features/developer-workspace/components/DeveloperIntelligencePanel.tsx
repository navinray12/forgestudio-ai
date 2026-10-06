/**
 * ForgeStudio Modules 62–64: Intelligence, Optimization, Recovery & Architecture Panel
 * Unified developer panel for Optimization Engine (Bundle/Tree-shaking),
 * Project Checkpoints & Atomic Rollback, and Architecture Visualization Graphs.
 */

import React, { useState, useEffect } from "react";
import {
  Zap,
  History,
  GitBranch,
  Layers,
  Sparkles,
  RotateCw,
  Plus,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Database,
  ArrowRight,
  Download,
  Upload,
  Search,
  Eye,
  Sliders,
  Gauge,
  Box,
  Share2,
  FileText,
  Clock,
  Trash2,
  Cpu,
} from "lucide-react";
import { forgeProjectService } from "../services/forgeProjectService";

interface DeveloperIntelligencePanelProps {
  projectId: string;
}

type MainTab = "optimization" | "recovery" | "architecture";
type ArchLayer = "ALL" | "MODULES" | "SERVICES" | "DATABASE";

export const DeveloperIntelligencePanel: React.FC<DeveloperIntelligencePanelProps> = ({ projectId }) => {
  const [activeTab, setActiveTab] = useState<MainTab>("optimization");
  const [loading, setLoading] = useState(false);

  // ------------------------------------------------------------
  // MODULE 62: Optimization State
  // ------------------------------------------------------------
  const [latestAudit, setLatestAudit] = useState<any>(null);
  const [auditing, setAuditing] = useState(false);
  const [activePatch, setActivePatch] = useState<any>(null);

  const loadOptimizationAudit = async () => {
    try {
      setLoading(true);
      const res = await forgeProjectService.getLatestOptimizationAudit(projectId);
      setLatestAudit(res.audit);
    } catch (err) {
      console.warn("Failed to load optimization audit:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunAudit = async () => {
    try {
      setAuditing(true);
      const res = await forgeProjectService.runOptimizationAudit(projectId);
      setLatestAudit(res.audit);
    } catch (err: any) {
      alert("Optimization audit failed: " + err.message);
    } finally {
      setAuditing(false);
    }
  };

  const handleGeneratePatch = async (recId: string) => {
    try {
      const res = await forgeProjectService.generateOptimizationPatch(projectId, recId);
      setActivePatch(res.patch);
    } catch (err: any) {
      alert("Failed to generate optimization patch: " + err.message);
    }
  };

  // ------------------------------------------------------------
  // MODULE 63: Checkpoints & Recovery State
  // ------------------------------------------------------------
  const [checkpoints, setCheckpoints] = useState<any[]>([]);
  const [showCreateCheckpoint, setShowCreateCheckpoint] = useState(false);
  const [newCheckpointName, setNewCheckpointName] = useState("");
  const [newCheckpointTag, setNewCheckpointTag] = useState("MANUAL");
  const [activeDiff, setActiveDiff] = useState<any>(null);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<any>(null);
  const [rollingBack, setRollingBack] = useState(false);

  const loadCheckpoints = async () => {
    try {
      setLoading(true);
      const res = await forgeProjectService.listProjectCheckpoints(projectId);
      setCheckpoints(res.checkpoints || []);
    } catch (err) {
      console.warn("Failed to load checkpoints:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCheckpoint = async () => {
    if (!newCheckpointName.trim()) return;
    try {
      setLoading(true);
      await forgeProjectService.createProjectCheckpoint(projectId, {
        name: newCheckpointName,
        tag: newCheckpointTag,
      });
      setShowCreateCheckpoint(false);
      setNewCheckpointName("");
      await loadCheckpoints();
    } catch (err: any) {
      alert("Failed to create checkpoint: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDiff = async (checkpointId: string) => {
    try {
      const res = await forgeProjectService.diffProjectCheckpoint(projectId, checkpointId);
      setActiveDiff(res.diff);
    } catch (err: any) {
      alert("Failed to calculate diff: " + err.message);
    }
  };

  const handleRollback = async (checkpoint: any) => {
    if (!confirm(`Are you sure you want to roll back the entire project to '${checkpoint.name}'? All files will be reverted.`)) return;
    try {
      setRollingBack(true);
      const res = await forgeProjectService.rollbackProjectCheckpoint(projectId, checkpoint.id);
      alert(`Rollback successful! Restored ${res.rollback.filesRestoredCount} files in ${res.rollback.durationMs}ms.`);
      setActiveDiff(null);
      await loadCheckpoints();
    } catch (err: any) {
      alert("Rollback failed: " + err.message);
    } finally {
      setRollingBack(false);
    }
  };

  const handleExportBundle = async (checkpointId: string) => {
    try {
      const res = await forgeProjectService.exportDisasterRecoveryBundle(projectId, checkpointId);
      const blob = new Blob([JSON.stringify(res.bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `checkpoint-${checkpointId}.recovery.json`;
      a.click();
    } catch (err: any) {
      alert("Export failed: " + err.message);
    }
  };

  // ------------------------------------------------------------
  // MODULE 64: Architecture Visualization State
  // ------------------------------------------------------------
  const [archLayer, setArchLayer] = useState<ArchLayer>("ALL");
  const [archGraph, setArchGraph] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [showMermaidModal, setShowMermaidModal] = useState(false);

  const loadArchitectureGraph = async () => {
    try {
      setLoading(true);
      const res = await forgeProjectService.getArchitectureGraph(projectId, archLayer);
      setArchGraph(res.graph);
      if (res.graph?.nodes?.length > 0) {
        setSelectedNode(res.graph.nodes[0]);
      }
    } catch (err) {
      console.warn("Failed to load architecture graph:", err);
    } finally {
      setLoading(false);
    }
  };

  // Initial loader
  useEffect(() => {
    if (activeTab === "optimization") loadOptimizationAudit();
    else if (activeTab === "recovery") loadCheckpoints();
    else if (activeTab === "architecture") loadArchitectureGraph();
  }, [projectId, activeTab, archLayer]);

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 select-none">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("optimization")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "optimization"
                ? "bg-amber-600 text-white shadow-xs"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Optimization Engine</span>
            {latestAudit && (
              <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-bold ${
                latestAudit.score >= 80 ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
              }`}>
                {latestAudit.score}/100
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("recovery")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "recovery"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <History className="w-3.5 h-3.5 text-indigo-400" />
            <span>Checkpoints & Recovery</span>
            {checkpoints.length > 0 && (
              <span className="px-1.5 py-0.2 bg-indigo-500/30 text-indigo-200 text-[10px] rounded-full">
                {checkpoints.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("architecture")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "architecture"
                ? "bg-cyan-600 text-white shadow-xs"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Architecture Visualizer</span>
            {archGraph && (
              <span className="px-1.5 py-0.2 bg-cyan-500/30 text-cyan-200 text-[10px] rounded-full">
                {archGraph.summary.totalNodes} nodes
              </span>
            )}
          </button>
        </div>

        <button
          onClick={() => {
            if (activeTab === "optimization") loadOptimizationAudit();
            else if (activeTab === "recovery") loadCheckpoints();
            else if (activeTab === "architecture") loadArchitectureGraph();
          }}
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded"
          title="Refresh view"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ============================================================ */}
        {/* MODULE 62: OPTIMIZATION ENGINE                               */}
        {/* ============================================================ */}
        {activeTab === "optimization" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Production Optimization Engine</h3>
                <p className="text-xs text-slate-400">
                  Bundle weight analysis, tree shaking, dead code detection, and Core Web Vitals projections.
                </p>
              </div>

              <button
                onClick={handleRunAudit}
                disabled={auditing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{auditing ? "Auditing Bundle..." : "Run Optimization Audit"}</span>
              </button>
            </div>

            {/* Performance Metrics Cards */}
            {latestAudit && (
              <div className="grid grid-cols-5 gap-3">
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Health Score</div>
                  <div className={`text-xl font-bold mt-1 ${
                    latestAudit.score >= 80 ? "text-emerald-400" : "text-amber-400"
                  }`}>
                    {latestAudit.score} <span className="text-xs text-slate-500 font-normal">/ 100</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Total Bundle Size</div>
                  <div className="text-lg font-bold text-slate-200 mt-1">
                    {(latestAudit.totalBytes / 1024).toFixed(1)} <span className="text-xs text-slate-400 font-normal">KB</span>
                  </div>
                  <div className="text-[10px] text-emerald-400 mt-0.5">
                    ~{(latestAudit.estimatedGzipBytes / 1024).toFixed(1)} KB gzipped
                  </div>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Projected LCP</div>
                  <div className="text-lg font-bold text-cyan-400 mt-1">
                    {latestAudit.metrics.webVitalsPrediction.lcpMs} <span className="text-xs text-slate-400 font-normal">ms</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    FID: {latestAudit.metrics.webVitalsPrediction.fidMs}ms
                  </div>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="text-[10px] text-amber-400 font-semibold uppercase">Heavy Packages</div>
                  <div className="text-xl font-bold text-amber-400 mt-1">{latestAudit.heavyDepCount}</div>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Dead Code / Unused</div>
                  <div className="text-xl font-bold text-slate-300 mt-1">{latestAudit.deadCodeCount}</div>
                </div>
              </div>
            )}

            {/* AI Optimization Patch Modal */}
            {activePatch && (
              <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    {activePatch.summary}
                  </span>
                  <button
                    onClick={() => setActivePatch(null)}
                    className="text-slate-400 hover:text-slate-200 text-xs"
                  >
                    Close
                  </button>
                </div>
                <pre className="p-2.5 bg-slate-950 text-emerald-300 text-xs font-mono rounded overflow-x-auto">
                  {activePatch.patchCode}
                </pre>
              </div>
            )}

            {/* Recommendations List */}
            <div className="space-y-2">
              {!latestAudit || latestAudit.recommendations.length === 0 ? (
                <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400">
                  No optimization issues detected. Click "Run Optimization Audit" to evaluate bundle weight.
                </div>
              ) : (
                latestAudit.recommendations.map((rec: any) => (
                  <div
                    key={rec.id}
                    className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2 hover:border-slate-700 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            rec.severity === "HIGH"
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          {rec.category}
                        </span>
                        <span className="text-xs font-bold text-slate-200">{rec.title}</span>
                      </div>

                      <button
                        onClick={() => handleGeneratePatch(rec.id)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>AI Optimize</span>
                      </button>
                    </div>

                    <p className="text-xs text-slate-400">{rec.description}</p>

                    {rec.actionableDiff && (
                      <div className="p-2 bg-slate-950 rounded text-[11px] text-amber-300 font-mono">
                        Suggested Action: {rec.actionableDiff}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODULE 63: CHECKPOINTS & RECOVERY                            */}
        {/* ============================================================ */}
        {activeTab === "recovery" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Project Snapshots & Atomic Recovery</h3>
                <p className="text-xs text-slate-400">
                  Point-in-time multi-layer checkpoints (code, DB schema, manifest) with instant 1-click rollback.
                </p>
              </div>

              <button
                onClick={() => setShowCreateCheckpoint(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Checkpoint</span>
              </button>
            </div>

            {/* Create Checkpoint Modal */}
            {showCreateCheckpoint && (
              <div className="p-4 bg-slate-900 border border-indigo-500/30 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                  Create Named Project Checkpoint
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Checkpoint Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Pre-Refactor Stable Version"
                      value={newCheckpointName}
                      onChange={(e) => setNewCheckpointName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Tag</label>
                    <select
                      value={newCheckpointTag}
                      onChange={(e) => setNewCheckpointTag(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200"
                    >
                      <option value="MANUAL">Manual</option>
                      <option value="PRE_DEPLOY">Pre-Deployment</option>
                      <option value="PRE_AI_TASK">Pre-AI Task</option>
                      <option value="PRE_MIGRATION">Pre-Migration</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowCreateCheckpoint(false)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateCheckpoint}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded"
                  >
                    Save Checkpoint
                  </button>
                </div>
              </div>
            )}

            {/* Diff Modal */}
            {activeDiff && (
              <div className="p-4 bg-slate-900 border border-cyan-500/40 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                      Differential Inspection: Workspace vs Checkpoint
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      Total Changes: {activeDiff.totalChanges} (Added: {activeDiff.addedCount}, Modified: {activeDiff.modifiedCount}, Deleted: {activeDiff.deletedCount})
                    </span>
                  </div>

                  <button
                    onClick={() => setActiveDiff(null)}
                    className="text-xs text-slate-400 hover:text-slate-200"
                  >
                    Close Diff
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1 font-mono text-xs bg-slate-950 p-2 rounded">
                  {activeDiff.diffs.map((d: any) => (
                    <div
                      key={d.path}
                      className="flex items-center justify-between py-1 px-2 rounded hover:bg-slate-900"
                    >
                      <span className="text-slate-300">{d.path}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          d.status === "ADDED"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : d.status === "MODIFIED"
                            ? "bg-amber-500/20 text-amber-300"
                            : d.status === "DELETED"
                            ? "bg-rose-500/20 text-rose-300"
                            : "text-slate-500"
                        }`}
                      >
                        {d.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Checkpoints Grid */}
            {checkpoints.length === 0 ? (
              <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400">
                No checkpoints found. Create a checkpoint to protect your workspace before making major changes.
              </div>
            ) : (
              <div className="space-y-2">
                {checkpoints.map((chk) => (
                  <div
                    key={chk.id}
                    className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between hover:border-slate-700 transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-200">{chk.name}</span>
                        <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] font-semibold rounded">
                          {chk.tag}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {chk.filesCount} files ({(chk.totalBytes / 1024).toFixed(1)} KB) • Created: {new Date(chk.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewDiff(chk.id)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs"
                      >
                        Compare Diff
                      </button>

                      <button
                        onClick={() => handleExportBundle(chk.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded"
                        title="Export Recovery Bundle"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleRollback(chk)}
                        disabled={rollingBack}
                        className="flex items-center gap-1 px-3 py-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded text-xs font-semibold"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Rollback Workspace</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* MODULE 64: ARCHITECTURE VISUALIZATION                        */}
        {/* ============================================================ */}
        {activeTab === "architecture" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Interactive Architecture Topology</h3>
                <p className="text-xs text-slate-400">
                  Components, backend services, API routes, and Database ER relationships.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                  {(["ALL", "MODULES", "SERVICES", "DATABASE"] as ArchLayer[]).map((lay) => (
                    <button
                      key={lay}
                      onClick={() => setArchLayer(lay)}
                      className={`px-2.5 py-1 rounded text-xs font-semibold ${
                        archLayer === lay ? "bg-cyan-600 text-white" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {lay}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setShowMermaidModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Mermaid Code</span>
                </button>
              </div>
            </div>

            {/* Mermaid Code Modal */}
            {showMermaidModal && archGraph && (
              <div className="p-4 bg-slate-900 border border-cyan-500/40 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-300">Mermaid Diagram Code</span>
                  <button
                    onClick={() => setShowMermaidModal(false)}
                    className="text-xs text-slate-400 hover:text-slate-200"
                  >
                    Close
                  </button>
                </div>
                <pre className="p-3 bg-slate-950 text-cyan-300 font-mono text-xs rounded max-h-60 overflow-y-auto">
                  {archGraph.mermaid}
                </pre>
              </div>
            )}

            {/* Summary Telemetry */}
            {archGraph && (
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Total Nodes</div>
                  <div className="text-lg font-bold text-cyan-400 mt-1">{archGraph.summary.totalNodes}</div>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Dependencies / Edges</div>
                  <div className="text-lg font-bold text-indigo-400 mt-1">{archGraph.summary.totalEdges}</div>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Database Tables</div>
                  <div className="text-lg font-bold text-emerald-400 mt-1">{archGraph.summary.databaseTablesCount}</div>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Circular Cycles</div>
                  <div className={`text-lg font-bold mt-1 ${
                    archGraph.summary.circularCount > 0 ? "text-rose-400" : "text-emerald-400"
                  }`}>
                    {archGraph.summary.circularCount}
                  </div>
                </div>
              </div>
            )}

            {/* Topology Graph & Node Inspector */}
            {archGraph && (
              <div className="grid grid-cols-3 gap-3">
                {/* Node Grid */}
                <div className="col-span-2 p-4 bg-slate-900/60 border border-slate-800 rounded-xl max-h-96 overflow-y-auto space-y-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Discovered Architectural Entities
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {archGraph.nodes.map((node: any) => (
                      <div
                        key={node.id}
                        onClick={() => setSelectedNode(node)}
                        className={`p-2.5 rounded-lg border cursor-pointer transition ${
                          selectedNode?.id === node.id
                            ? "bg-cyan-950/40 border-cyan-500"
                            : "bg-slate-950/80 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-200 truncate">{node.label}</span>
                          <span className={`px-1 py-0.2 rounded text-[10px] font-semibold ${
                            node.layer === "frontend"
                              ? "bg-indigo-500/20 text-indigo-300"
                              : node.layer === "database"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-cyan-500/20 text-cyan-300"
                          }`}>
                            {node.type}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-1 truncate">
                          fan-in: {node.fanIn} • fan-out: {node.fanOut}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Selected Node Details */}
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Node Inspector
                  </h4>
                  {selectedNode ? (
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-slate-500 text-[11px] block">Identifier</span>
                        <span className="text-slate-200 font-bold">{selectedNode.label}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[11px] block">Path</span>
                        <span className="text-slate-400 font-mono text-[11px] break-all">{selectedNode.path || "Database"}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                        <div>
                          <span className="text-slate-500 text-[11px] block">Layer</span>
                          <span className="text-cyan-400 font-semibold">{selectedNode.layer}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[11px] block">Type</span>
                          <span className="text-slate-300">{selectedNode.type}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[11px] block">Incoming (Fan-In)</span>
                          <span className="text-indigo-400 font-bold">{selectedNode.fanIn}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[11px] block">Outgoing (Fan-Out)</span>
                          <span className="text-indigo-400 font-bold">{selectedNode.fanOut}</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-800">
                        <span className="text-slate-500 text-[11px] block">Complexity Risk</span>
                        <span className={`font-bold ${selectedNode.riskScore > 30 ? "text-amber-400" : "text-emerald-400"}`}>
                          {selectedNode.riskScore} / 100
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">Select a node from the topology map to inspect details.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
