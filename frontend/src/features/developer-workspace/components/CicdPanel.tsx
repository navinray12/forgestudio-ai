import React, { useState, useEffect } from "react";
import {
  Workflow,
  Play,
  RotateCw,
  CheckCircle2,
  XCircle,
  Clock,
  Check,
  AlertOctagon,
  ShieldAlert,
  GitBranch,
  GitCommit,
  UserCheck,
  Ban,
  Layers,
} from "lucide-react";
import { forgeProjectService } from "../services/forgeProjectService";

interface CicdPanelProps {
  projectId: string;
}

export const CicdPanel: React.FC<CicdPanelProps> = ({ projectId }) => {
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [activePipeline, setActivePipeline] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [selectedStage, setSelectedStage] = useState<any>(null);

  const loadPipelines = async () => {
    try {
      setLoading(true);
      const res = await forgeProjectService.listPipelines(projectId);
      setPipelines(res.pipelines || []);
      if (res.pipelines && res.pipelines.length > 0) {
        setActivePipeline(res.pipelines[0]);
        if (res.pipelines[0].stages?.length > 0) {
          setSelectedStage(res.pipelines[0].stages[0]);
        }
      }
    } catch (e) {
      console.warn("Could not load pipelines:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPipelines();
  }, [projectId]);

  const handleTriggerPipeline = async (environment: "preview" | "staging" | "production" = "preview") => {
    try {
      setTriggering(true);
      const res = await forgeProjectService.createPipelineRun(projectId, {
        trigger: "manual",
        environment,
        branch: "main",
        requireApproval: environment === "production",
      });
      setActivePipeline(res.pipeline);
      if (res.pipeline.stages?.length > 0) {
        setSelectedStage(res.pipeline.stages[0]);
      }
      await loadPipelines();
    } catch (err: any) {
      alert(`Pipeline trigger failed: ${err.message}`);
    } finally {
      setTriggering(false);
    }
  };

  const handleApprove = async () => {
    if (!activePipeline) return;
    try {
      setApproving(true);
      const notes = prompt("Enter approval justification notes (auditable):", "Release approved after staging verification");
      if (!notes) return;
      const res = await forgeProjectService.approvePipelineGate(projectId, activePipeline.id, notes);
      setActivePipeline(res.pipeline);
      await loadPipelines();
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`);
    } finally {
      setApproving(false);
    }
  };

  const handleRerun = async () => {
    if (!activePipeline) return;
    try {
      setRerunning(true);
      const res = await forgeProjectService.rerunPipeline(projectId, activePipeline.id);
      setActivePipeline(res.pipeline);
      await loadPipelines();
    } catch (err: any) {
      alert(`Rerun failed: ${err.message}`);
    } finally {
      setRerunning(false);
    }
  };

  const handleCancel = async () => {
    if (!activePipeline) return;
    try {
      setCancelling(true);
      const res = await forgeProjectService.cancelPipeline(projectId, activePipeline.id);
      setActivePipeline(res.pipeline);
      await loadPipelines();
    } catch (err: any) {
      alert(`Cancel failed: ${err.message}`);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 overflow-hidden font-sans select-none">
      {/* Top Header & Actions */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-semibold text-slate-100">
            <Workflow className="w-4 h-4 text-cyan-400" />
            <span>Automated CI/CD Pipelines</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadPipelines}
            disabled={loading}
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition"
            title="Refresh Pipelines"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={() => handleTriggerPipeline("preview")}
            disabled={triggering}
            className="flex items-center gap-1.5 px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium text-xs shadow-sm transition disabled:opacity-50"
          >
            <Play className={`w-3 h-3 ${triggering ? "animate-spin" : ""}`} />
            <span>{triggering ? "Running..." : "Trigger Preview Pipeline"}</span>
          </button>

          <button
            onClick={() => handleTriggerPipeline("production")}
            disabled={triggering}
            className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium text-xs shadow-sm transition disabled:opacity-50"
          >
            <Play className={`w-3 h-3 ${triggering ? "animate-spin" : ""}`} />
            <span>Trigger Prod Pipeline</span>
          </button>
        </div>
      </div>

      {/* Main Split: Pipelines List & Active Pipeline Graph */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Pipeline Runs History */}
        <div className="w-72 border-r border-slate-800 bg-slate-900/50 flex flex-col">
          <div className="px-3 py-2 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Pipeline Runs ({pipelines.length})
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
            {pipelines.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                No pipeline runs yet. Click "Trigger Pipeline" to execute stages.
              </div>
            ) : (
              pipelines.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    setActivePipeline(p);
                    if (p.stages?.length > 0) setSelectedStage(p.stages[0]);
                  }}
                  className={`p-2.5 cursor-pointer text-xs transition ${
                    activePipeline?.id === p.id
                      ? "bg-slate-800/80 border-l-2 border-cyan-500"
                      : "hover:bg-slate-800/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-200 truncate max-w-[120px]">
                      {p.name}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        p.status === "SUCCESS"
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800/40"
                          : p.status === "WAITING_APPROVAL"
                          ? "bg-amber-950 text-amber-400 border border-amber-800/40 animate-pulse"
                          : p.status === "FAILED"
                          ? "bg-rose-950 text-rose-400 border border-rose-800/40"
                          : "bg-blue-950 text-blue-400 border border-blue-800/40 animate-pulse"
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <GitBranch className="w-3 h-3 text-slate-500" />
                      {p.branch}
                    </span>
                    <span>{new Date(p.startedAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Active Pipeline Details & Stage Graph */}
        <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
          {activePipeline ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Pipeline Status Banner */}
              <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-100">{activePipeline.name}</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                      {activePipeline.environment.toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      trigger: {activePipeline.trigger}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {activePipeline.status === "WAITING_APPROVAL" && (
                    <button
                      onClick={handleApprove}
                      disabled={approving}
                      className="flex items-center gap-1.5 px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-medium text-xs shadow-sm transition animate-pulse"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{approving ? "Approving..." : "Approve Release Gate"}</span>
                    </button>
                  )}

                  {activePipeline.status === "RUNNING" && (
                    <button
                      onClick={handleCancel}
                      disabled={cancelling}
                      className="flex items-center gap-1 px-2.5 py-1 bg-rose-950 hover:bg-rose-900 border border-rose-800/50 text-rose-300 rounded text-xs transition"
                    >
                      <Ban className="w-3 h-3" />
                      <span>Cancel</span>
                    </button>
                  )}

                  <button
                    onClick={handleRerun}
                    disabled={rerunning}
                    className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition"
                  >
                    <RotateCw className={`w-3 h-3 ${rerunning ? "animate-spin" : ""}`} />
                    <span>Rerun</span>
                  </button>
                </div>
              </div>

              {/* Approval Gate Alert if WAITING_APPROVAL */}
              {activePipeline.status === "WAITING_APPROVAL" && (
                <div className="p-3 bg-amber-950/40 border-b border-amber-800/50 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-amber-200">
                    <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      <strong>Manual Approval Required:</strong> Production deployment is paused awaiting authorized sign-off.
                    </span>
                  </div>
                </div>
              )}

              {/* Interactive Pipeline Stages Graph */}
              <div className="p-4 border-b border-slate-800 bg-slate-900/30 overflow-x-auto">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Pipeline Execution Graph
                </div>
                <div className="flex items-center gap-2 min-w-max">
                  {(activePipeline.stages || []).map((stage: any, index: number) => (
                    <React.Fragment key={stage.id}>
                      <div
                        onClick={() => setSelectedStage(stage)}
                        className={`p-2.5 rounded-md border text-xs cursor-pointer transition flex flex-col gap-1 min-w-[150px] ${
                          selectedStage?.id === stage.id
                            ? "border-cyan-500 bg-slate-800 shadow-md"
                            : "border-slate-800 bg-slate-900 hover:bg-slate-850"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-200 truncate text-[11px]">
                            {stage.name}
                          </span>
                          {stage.status === "SUCCESS" ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : stage.status === "FAILED" ? (
                            <XCircle className="w-3.5 h-3.5 text-rose-400" />
                          ) : stage.status === "WAITING_APPROVAL" ? (
                            <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                          ) : (
                            <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                          <span>{stage.status}</span>
                          <span>{stage.durationMs ? `${stage.durationMs}ms` : "-"}</span>
                        </div>
                      </div>

                      {index < activePipeline.stages.length - 1 && (
                        <div className="w-4 h-0.5 bg-slate-700 shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Selected Stage Output / Logs */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-3 py-1.5 bg-slate-900/80 border-b border-slate-800 text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                  <span>Stage Output: {selectedStage?.name || "Select a stage"}</span>
                  <span className="font-mono text-[10px] text-slate-500">
                    {selectedStage?.status}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed space-y-1 bg-slate-950 text-slate-300">
                  {selectedStage?.logs && selectedStage.logs.length > 0 ? (
                    selectedStage.logs.map((log: string, idx: number) => (
                      <div key={idx} className="hover:bg-slate-900/50 px-1 rounded text-slate-300">
                        {log}
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-600 italic">No output recorded for this stage.</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
              Select a pipeline from the list or trigger a new pipeline run.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
