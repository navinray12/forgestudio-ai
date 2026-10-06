import React, { useState, useEffect } from "react";
import {
  Globe,
  Rocket,
  CheckCircle,
  XCircle,
  RotateCw,
  Clock,
  Layers,
  ArrowRight,
  ShieldCheck,
  History,
  Activity,
  ExternalLink,
  ChevronRight,
  Lock,
} from "lucide-react";
import { forgeProjectService } from "../services/forgeProjectService";

interface HostingPanelProps {
  projectId: string;
}

export const HostingPanel: React.FC<HostingPanelProps> = ({ projectId }) => {
  const [environment, setEnvironment] = useState<"preview" | "staging" | "production">("preview");
  const [deployments, setDeployments] = useState<any[]>([]);
  const [activeDeployment, setActiveDeployment] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [runtimeInfo, setRuntimeInfo] = useState<any>(null);

  const loadDeployments = async () => {
    try {
      setLoading(true);
      const res = await forgeProjectService.listDeployments(projectId, environment);
      setDeployments(res.deployments || []);
      if (res.deployments && res.deployments.length > 0) {
        setActiveDeployment(res.deployments[0]);
      } else {
        setActiveDeployment(null);
      }
    } catch (e) {
      console.warn("Could not load deployments:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadRuntime = async () => {
    try {
      const res = await forgeProjectService.detectRuntime(projectId);
      setRuntimeInfo(res.runtime);
    } catch (e) {
      console.warn("Could not detect runtime:", e);
    }
  };

  useEffect(() => {
    loadDeployments();
    loadRuntime();
  }, [projectId, environment]);

  const handleDeployFromSource = async () => {
    try {
      setDeploying(true);
      const res = await forgeProjectService.createDeployment(projectId, {
        environment,
        branch: "main",
      });
      setActiveDeployment(res.deployment);
      await loadDeployments();
    } catch (err: any) {
      alert(`Deployment failed: ${err.message}`);
    } finally {
      setDeploying(false);
    }
  };

  const handlePromote = async (targetEnv: "staging" | "production") => {
    if (!activeDeployment) return;
    try {
      setPromoting(true);
      const res = await forgeProjectService.promoteDeployment(projectId, {
        sourceDeploymentId: activeDeployment.id,
        targetEnvironment: targetEnv,
      });
      alert(`Successfully promoted artifact to ${targetEnv.toUpperCase()}!`);
      setEnvironment(targetEnv);
      setActiveDeployment(res.deployment);
    } catch (err: any) {
      alert(`Promotion failed: ${err.message}`);
    } finally {
      setPromoting(false);
    }
  };

  const handleRollback = async (targetDeploymentId: string) => {
    if (!confirm("Are you sure you want to roll back to this previous deployment?")) return;
    try {
      setRollingBack(true);
      const res = await forgeProjectService.rollbackDeployment(projectId, {
        targetDeploymentId,
        targetEnvironment: environment,
      });
      alert(`Successfully rolled back to deployment ${targetDeploymentId}!`);
      setActiveDeployment(res.deployment);
      await loadDeployments();
    } catch (err: any) {
      alert(`Rollback failed: ${err.message}`);
    } finally {
      setRollingBack(false);
    }
  };

  const handleHealthCheck = async () => {
    if (!activeDeployment) return;
    try {
      setCheckingHealth(true);
      const res = await forgeProjectService.executeDeploymentHealthCheck(projectId, activeDeployment.id);
      setActiveDeployment((prev: any) => ({
        ...prev,
        healthCheck: res.healthCheck,
      }));
    } catch (err: any) {
      alert(`Health check failed: ${err.message}`);
    } finally {
      setCheckingHealth(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 overflow-hidden font-sans select-none">
      {/* Top Header & Environment Switcher */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-semibold text-slate-100">
            <Globe className="w-4 h-4 text-emerald-400" />
            <span>Source-Based Hosting</span>
          </div>

          <div className="flex bg-slate-950 p-0.5 rounded border border-slate-800">
            {(["preview", "staging", "production"] as const).map((env) => (
              <button
                key={env}
                onClick={() => setEnvironment(env)}
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition ${
                  environment === env
                    ? "bg-slate-800 text-slate-100 shadow-xs"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {env.toUpperCase()}
              </button>
            ))}
          </div>

          {runtimeInfo && (
            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300">
                {runtimeInfo.framework} ({runtimeInfo.mode})
              </span>
              <span>Node {runtimeInfo.runtimeVersion}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadDeployments}
            disabled={loading}
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition"
            title="Refresh Deployments"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleDeployFromSource}
            disabled={deploying}
            className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium text-xs shadow-sm transition disabled:opacity-50"
          >
            <Rocket className={`w-3.5 h-3.5 ${deploying ? "animate-spin" : ""}`} />
            <span>{deploying ? "Building & Deploying..." : `Deploy to ${environment.toUpperCase()}`}</span>
          </button>
        </div>
      </div>

      {/* Main Split Body: Deployments List & Active Deployment Inspection */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Deployment History */}
        <div className="w-80 border-r border-slate-800 bg-slate-900/50 flex flex-col">
          <div className="px-3 py-2 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-slate-400" />
              <span>Deployment History ({deployments.length})</span>
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
            {deployments.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                No deployments found in {environment}. Click "Deploy to {environment.toUpperCase()}" to launch.
              </div>
            ) : (
              deployments.map((dep) => (
                <div
                  key={dep.id}
                  onClick={() => setActiveDeployment(dep)}
                  className={`p-2.5 cursor-pointer text-xs transition ${
                    activeDeployment?.id === dep.id
                      ? "bg-slate-800/80 border-l-2 border-emerald-500"
                      : "hover:bg-slate-800/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[11px] text-slate-300 font-semibold truncate max-w-[140px]">
                      {dep.id.slice(0, 16)}...
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        dep.status === "ACTIVE"
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800/40"
                          : dep.status === "FAILED"
                          ? "bg-rose-950 text-rose-400 border border-rose-800/40"
                          : "bg-blue-950 text-blue-400 border border-blue-800/40 animate-pulse"
                      }`}
                    >
                      {dep.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>{dep.branch}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {new Date(dep.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Active Deployment Details & Actions */}
        <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
          {activeDeployment ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Active Deployment Card */}
              <div className="p-4 bg-slate-900 border-b border-slate-800">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-100 font-mono">
                        {activeDeployment.id}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                        {activeDeployment.environment.toUpperCase()}
                      </span>
                      {activeDeployment.rollbackFromId && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950 text-amber-400 border border-amber-800/40">
                          ROLLED BACK
                        </span>
                      )}
                    </div>
                    {activeDeployment.url && (
                      <a
                        href={activeDeployment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 hover:underline mt-1 font-mono"
                      >
                        <span>{activeDeployment.url}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {/* Actions: Promote, Rollback, Health Check */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleHealthCheck}
                      disabled={checkingHealth}
                      className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition"
                      title="Run Smoke Health Check"
                    >
                      <Activity className={`w-3 h-3 ${checkingHealth ? "animate-spin" : "text-emerald-400"}`} />
                      <span>Check Health</span>
                    </button>

                    {environment === "preview" && (
                      <button
                        onClick={() => handlePromote("staging")}
                        disabled={promoting}
                        className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition"
                      >
                        <ArrowRight className="w-3 h-3" />
                        <span>Promote to Staging</span>
                      </button>
                    )}

                    {environment === "staging" && (
                      <button
                        onClick={() => handlePromote("production")}
                        disabled={promoting}
                        className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition"
                      >
                        <Lock className="w-3 h-3" />
                        <span>Promote to Production</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleRollback(activeDeployment.id)}
                      disabled={rollingBack}
                      className="flex items-center gap-1 px-2.5 py-1 bg-rose-950 hover:bg-rose-900 border border-rose-800/50 text-rose-300 rounded text-xs transition"
                    >
                      <RotateCw className="w-3 h-3" />
                      <span>Rollback</span>
                    </button>
                  </div>
                </div>

                {/* Health Check Status */}
                {activeDeployment.healthCheck && (
                  <div className="mt-3 p-2 bg-slate-950 rounded border border-slate-800 flex items-center justify-between text-xs font-mono">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Status: {activeDeployment.healthCheck.passed ? "HEALTHY (200 OK)" : "UNHEALTHY"}</span>
                    </span>
                    <span className="text-slate-400">
                      Latency: {activeDeployment.healthCheck.latencyMs || 12}ms
                    </span>
                  </div>
                )}
              </div>

              {/* Deployment Logs */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-3 py-1.5 bg-slate-900/80 border-b border-slate-800 text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                  <span>Structured Deployment Logs</span>
                  <span className="font-mono text-[10px] text-slate-500">
                    {activeDeployment.logs?.length || 0} entries
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed space-y-1 bg-slate-950 text-slate-300">
                  {(activeDeployment.logs || []).map((log: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-2 hover:bg-slate-900/50 px-1 rounded">
                      <span className="text-slate-600 shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span
                        className={`font-semibold shrink-0 uppercase text-[10px] ${
                          log.level === "error"
                            ? "text-rose-400"
                            : log.level === "warn"
                            ? "text-amber-400"
                            : "text-emerald-400"
                        }`}
                      >
                        [{log.level}]
                      </span>
                      <span className="text-slate-500 shrink-0">[{log.stage}]</span>
                      <span className="text-slate-200">{log.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
              Select a deployment from the history or deploy a new release.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
