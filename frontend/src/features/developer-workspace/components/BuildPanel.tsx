import React, { useState, useEffect } from "react";
import {
  Hammer,
  Play,
  CheckCircle,
  XCircle,
  RotateCw,
  Clock,
  Layers,
  FileCheck,
  AlertCircle,
  Hash,
  Download,
} from "lucide-react";
import { forgeProjectService } from "../services/forgeProjectService";

interface BuildPanelProps {
  projectId: string;
}

export const BuildPanel: React.FC<BuildPanelProps> = ({ projectId }) => {
  const [building, setBuilding] = useState(false);
  const [activeBuild, setActiveBuild] = useState<any>(null);
  const [buildsHistory, setBuildsHistory] = useState<any[]>([]);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  const loadBuilds = async () => {
    try {
      const res = await forgeProjectService.listBuilds(projectId);
      setBuildsHistory(res.builds || []);
      if (!activeBuild && res.builds?.length > 0) {
        setActiveBuild(res.builds[0]);
      }
    } catch (e) {
      console.warn("Could not load builds history:", e);
    }
  };

  useEffect(() => {
    loadBuilds();
  }, [projectId]);

  const handleStartBuild = async (buildMode: "development" | "production" = "production") => {
    try {
      setBuilding(true);
      const res = await forgeProjectService.triggerBuild(projectId, { buildMode });
      setActiveBuild(res.result);
      await loadBuilds();
    } catch (err: any) {
      alert(`Build failed: ${err.message}`);
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 overflow-hidden font-sans select-none">
      {/* Top Header & Trigger Action */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <Hammer className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-slate-100">Deterministic Build Pipeline</span>
          {activeBuild && (
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                activeBuild.status === "SUCCESS"
                  ? "bg-emerald-950 text-emerald-400 border border-emerald-900"
                  : activeBuild.status === "FAILED"
                  ? "bg-rose-950 text-rose-400 border border-rose-900"
                  : "bg-blue-950 text-blue-400 animate-pulse"
              }`}
            >
              {activeBuild.status}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleStartBuild("development")}
            disabled={building}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium transition disabled:opacity-50"
          >
            Dev Build
          </button>
          <button
            onClick={() => handleStartBuild("production")}
            disabled={building}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
          >
            {building ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span>{building ? "Building..." : "Build Production"}</span>
          </button>
        </div>
      </div>

      {/* Main Build Inspector */}
      {activeBuild ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Stages List */}
          <div className="w-64 bg-slate-900/60 border-r border-slate-800 p-3 space-y-2 overflow-y-auto">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Pipeline Stages ({activeBuild.stages?.length || 0})
            </div>
            {(activeBuild.stages || []).map((stage: any) => {
              const isSelected = selectedStage === stage.id || (!selectedStage && stage.id === "stage_prepare");
              return (
                <div
                  key={stage.id}
                  onClick={() => setSelectedStage(stage.id)}
                  className={`p-2 rounded-lg border text-xs cursor-pointer transition flex items-center justify-between ${
                    isSelected
                      ? "bg-slate-800 border-blue-500 text-slate-100"
                      : "bg-slate-950/60 border-slate-800/80 text-slate-400 hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {stage.status === "SUCCESS" && <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    {stage.status === "FAILED" && <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                    {stage.status === "RUNNING" && <RotateCw className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />}
                    {stage.status === "PENDING" && <Clock className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
                    <span className="truncate">{stage.name}</span>
                  </div>
                  {stage.durationMs && (
                    <span className="text-[10px] font-mono text-slate-500">{stage.durationMs}ms</span>
                  )}
                </div>
              );
            })}

            {/* Artifact summary card */}
            {activeBuild.artifact && (
              <div className="mt-4 p-2.5 bg-emerald-950/30 border border-emerald-900/60 rounded-lg text-xs space-y-1">
                <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>Artifact Verified</span>
                </div>
                <div className="text-[11px] text-slate-300 truncate">{activeBuild.artifact.name}</div>
                <div className="text-[10px] font-mono text-slate-500">
                  {(activeBuild.artifact.sizeBytes / 1024).toFixed(1)} KB • SHA-256:{" "}
                  {activeBuild.artifact.contentHash.substring(0, 10)}...
                </div>
              </div>
            )}
          </div>

          {/* Right: Stage Logs & Diagnostics */}
          <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
            <div className="p-3 border-b border-slate-800 text-xs font-semibold text-slate-400 flex items-center justify-between">
              <span>Stage Output Logs</span>
              <span className="font-mono text-[11px] text-slate-500">
                Duration: {activeBuild.durationMs || 0} ms
              </span>
            </div>

            <div className="flex-1 p-3 overflow-y-auto font-mono text-xs text-slate-300 space-y-1 scrollbar-thin">
              {(() => {
                const curStage =
                  (activeBuild.stages || []).find((s: any) => s.id === selectedStage) || activeBuild.stages?.[0];
                if (!curStage || !curStage.logs || curStage.logs.length === 0) {
                  return <div className="text-slate-600">No output logs recorded for this stage.</div>;
                }
                return curStage.logs.map((log: string, idx: number) => (
                  <div key={idx} className="leading-relaxed whitespace-pre-wrap">
                    {log}
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs">
          <Hammer className="w-8 h-8 opacity-40 mb-2 text-emerald-400" />
          <p>No build executed yet. Click &quot;Build Production&quot; to test your project bundle.</p>
        </div>
      )}
    </div>
  );
};
