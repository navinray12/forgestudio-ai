/**
 * ForgeStudio Modules 53–56: Developer Operations, Observability, Security & Feature Flags Panel
 * Unified enterprise panel for Preview Environments, APM & Observability, SAST/Secret Security,
 * and Feature Flags & Remote Configuration.
 */

import React, { useState, useEffect } from "react";
import {
  Globe,
  Activity,
  ShieldAlert,
  ToggleLeft,
  ToggleRight,
  Plus,
  RotateCw,
  Play,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Sparkles,
  Search,
  Filter,
  Layers,
  ArrowRight,
  ShieldCheck,
  Code,
  Gauge,
  Sliders,
  Radio,
  FileText,
  Lock,
  ChevronDown,
  ChevronRight,
  Cpu,
} from "lucide-react";
import { forgeProjectService } from "../services/forgeProjectService";

interface DeveloperOpsSecurityPanelProps {
  projectId: string;
}

type MainTab = "previews" | "observability" | "security" | "flags";
type ObsSubTab = "logs" | "traces" | "issues";
type FlagSubTab = "flags" | "config";

export const DeveloperOpsSecurityPanel: React.FC<DeveloperOpsSecurityPanelProps> = ({ projectId }) => {
  const [activeTab, setActiveTab] = useState<MainTab>("previews");
  const [loading, setLoading] = useState(false);

  // ------------------------------------------------------------
  // MODULE 53: Preview Environments State
  // ------------------------------------------------------------
  const [previews, setPreviews] = useState<any[]>([]);
  const [showCreatePreview, setShowCreatePreview] = useState(false);
  const [newPreviewName, setNewPreviewName] = useState("");
  const [newPreviewBranch, setNewPreviewBranch] = useState("feature/new-screen");
  const [newPreviewTtl, setNewPreviewTtl] = useState(72);
  const [promotingEnvId, setPromotingEnvId] = useState<string | null>(null);

  const loadPreviews = async () => {
    try {
      setLoading(true);
      const res = await forgeProjectService.listPreviewEnvironments(projectId);
      setPreviews(res.environments || []);
    } catch (err) {
      console.warn("Failed to load previews:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePreview = async () => {
    if (!newPreviewName.trim()) return;
    try {
      setLoading(true);
      await forgeProjectService.createPreviewEnvironment(projectId, {
        name: newPreviewName,
        branch: newPreviewBranch,
        ttlHours: newPreviewTtl,
      });
      setShowCreatePreview(false);
      setNewPreviewName("");
      await loadPreviews();
    } catch (err: any) {
      alert("Failed to create preview: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePromote = async (envId: string, target: "staging" | "production") => {
    try {
      setPromotingEnvId(envId);
      const res = await forgeProjectService.promotePreviewEnvironment(projectId, envId, target);
      alert(`Promoted to ${target.toUpperCase()}! URL: ${res.promotion.url}`);
      await loadPreviews();
    } catch (err: any) {
      alert("Promotion failed: " + err.message);
    } finally {
      setPromotingEnvId(null);
    }
  };

  const handleExtendTtl = async (envId: string) => {
    try {
      await forgeProjectService.extendPreviewTtl(projectId, envId, 24);
      await loadPreviews();
    } catch (err: any) {
      alert("Failed to extend TTL: " + err.message);
    }
  };

  const handleTeardown = async (envId: string) => {
    if (!confirm("Are you sure you want to teardown this preview environment?")) return;
    try {
      await forgeProjectService.teardownPreviewEnvironment(projectId, envId);
      await loadPreviews();
    } catch (err: any) {
      alert("Failed to teardown: " + err.message);
    }
  };

  // ------------------------------------------------------------
  // MODULE 54: Developer Observability State
  // ------------------------------------------------------------
  const [obsSubTab, setObsSubTab] = useState<ObsSubTab>("logs");
  const [apmMetrics, setApmMetrics] = useState<any>(null);
  const [obsLogs, setObsLogs] = useState<any[]>([]);
  const [logFilterLevel, setLogFilterLevel] = useState<string>("");
  const [logFilterSearch, setLogFilterSearch] = useState<string>("");
  const [obsIssues, setObsIssues] = useState<any[]>([]);
  const [activeIssueDiagnostic, setActiveIssueDiagnostic] = useState<any>(null);
  const [selectedTraceId, setSelectedTraceId] = useState<string>("");
  const [activeTraceData, setActiveTraceData] = useState<any>(null);

  const loadObservabilityData = async () => {
    try {
      setLoading(true);
      const [mRes, lRes, iRes] = await Promise.all([
        forgeProjectService.getApmMetrics(projectId).catch(() => ({ metrics: null })),
        forgeProjectService.queryObservabilityLogs(projectId, {
          level: logFilterLevel || undefined,
          search: logFilterSearch || undefined,
          limit: 100,
        }).catch(() => ({ logs: [] })),
        forgeProjectService.listObservabilityIssues(projectId).catch(() => ({ issues: [] })),
      ]);
      setApmMetrics(mRes.metrics);
      setObsLogs(lRes.logs || []);
      setObsIssues(iRes.issues || []);
    } catch (err) {
      console.warn("Failed to load observability data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDiagnoseIssue = async (issueId: string) => {
    try {
      const res = await forgeProjectService.diagnoseObservabilityIssue(projectId, issueId);
      setActiveIssueDiagnostic(res.diagnostic);
    } catch (err: any) {
      alert("AI Diagnosis failed: " + err.message);
    }
  };

  const handleLoadTrace = async (traceId: string) => {
    try {
      setSelectedTraceId(traceId);
      const res = await forgeProjectService.getTrace(projectId, traceId);
      setActiveTraceData(res.trace);
      setObsSubTab("traces");
    } catch (err: any) {
      alert("Failed to load trace: " + err.message);
    }
  };

  // ------------------------------------------------------------
  // MODULE 55: Application Security Scanning State
  // ------------------------------------------------------------
  const [latestScan, setLatestScan] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [activeRemediation, setActiveRemediation] = useState<any>(null);

  const loadSecurityScan = async () => {
    try {
      setLoading(true);
      const res = await forgeProjectService.getLatestSecurityScan(projectId);
      setLatestScan(res.scan);
    } catch (err) {
      console.warn("Failed to load security scan:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunSecurityScan = async (scanType: string = "FULL") => {
    try {
      setScanning(true);
      const res = await forgeProjectService.runSecurityScan(projectId, scanType);
      setLatestScan(res.scan);
    } catch (err: any) {
      alert("Security scan failed: " + err.message);
    } finally {
      setScanning(false);
    }
  };

  const handleGenerateRemediation = async (findingId: string) => {
    try {
      const res = await forgeProjectService.generateSecurityRemediation(projectId, findingId);
      setActiveRemediation(res.remediation);
    } catch (err: any) {
      alert("Remediation generation failed: " + err.message);
    }
  };

  // ------------------------------------------------------------
  // MODULE 56: Feature Flags & Remote Configuration State
  // ------------------------------------------------------------
  const [flagSubTab, setFlagSubTab] = useState<FlagSubTab>("flags");
  const [flags, setFlags] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const [showCreateFlag, setShowCreateFlag] = useState(false);
  const [newFlagKey, setNewFlagKey] = useState("");
  const [newFlagName, setNewFlagName] = useState("");
  const [newFlagRollout, setNewFlagRollout] = useState(100);
  const [newFlagDefault, setNewFlagDefault] = useState(true);

  // Remote config state
  const [showCreateConfig, setShowCreateConfig] = useState(false);
  const [newConfigKey, setNewConfigKey] = useState("");
  const [newConfigValue, setNewConfigValue] = useState("");

  const loadFlagsAndConfig = async () => {
    try {
      setLoading(true);
      const [fRes, cRes] = await Promise.all([
        forgeProjectService.listFeatureFlags(projectId).catch(() => ({ flags: [] })),
        forgeProjectService.listRemoteConfigs(projectId).catch(() => ({ configs: [] })),
      ]);
      setFlags(fRes.flags || []);
      setConfigs(cRes.configs || []);
    } catch (err) {
      console.warn("Failed to load flags/config:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFlag = async (key: string, current: boolean) => {
    try {
      await forgeProjectService.toggleFeatureFlag(projectId, key, !current);
      await loadFlagsAndConfig();
    } catch (err: any) {
      alert("Toggle failed: " + err.message);
    }
  };

  const handleCreateFlag = async () => {
    if (!newFlagKey.trim()) return;
    try {
      setLoading(true);
      await forgeProjectService.createFeatureFlag(projectId, {
        key: newFlagKey,
        name: newFlagName || newFlagKey,
        defaultValue: newFlagDefault,
        rolloutPercentage: newFlagRollout,
        isEnabled: true,
      });
      setShowCreateFlag(false);
      setNewFlagKey("");
      setNewFlagName("");
      await loadFlagsAndConfig();
    } catch (err: any) {
      alert("Failed to create flag: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!newConfigKey.trim()) return;
    try {
      let parsedVal: any = newConfigValue;
      try {
        parsedVal = JSON.parse(newConfigValue);
      } catch {}
      await forgeProjectService.setRemoteConfig(projectId, {
        key: newConfigKey,
        value: parsedVal,
        environment: "all",
      });
      setShowCreateConfig(false);
      setNewConfigKey("");
      setNewConfigValue("");
      await loadFlagsAndConfig();
    } catch (err: any) {
      alert("Failed to save config: " + err.message);
    }
  };

  // Tab switcher effect
  useEffect(() => {
    if (activeTab === "previews") loadPreviews();
    else if (activeTab === "observability") loadObservabilityData();
    else if (activeTab === "security") loadSecurityScan();
    else if (activeTab === "flags") loadFlagsAndConfig();
  }, [projectId, activeTab]);

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 select-none">
      {/* Top Main Navigation */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("previews")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "previews"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-indigo-400" />
            <span>Preview Environments</span>
            {previews.length > 0 && (
              <span className="px-1.5 py-0.2 bg-indigo-500/30 text-indigo-200 text-[10px] rounded-full">
                {previews.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("observability")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "observability"
                ? "bg-cyan-600 text-white shadow-xs"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>Observability & APM</span>
            {obsIssues.length > 0 && (
              <span className="px-1.5 py-0.2 bg-rose-500/30 text-rose-300 text-[10px] rounded-full">
                {obsIssues.length} issues
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("security")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "security"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Security Scanner</span>
            {latestScan && (
              <span className={`px-1.5 py-0.2 text-[10px] rounded-full ${
                latestScan.score >= 80 ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
              }`}>
                {latestScan.score}/100
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("flags")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "flags"
                ? "bg-amber-600 text-white shadow-xs"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <ToggleRight className="w-3.5 h-3.5 text-amber-400" />
            <span>Feature Flags & Config</span>
            {flags.length > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-500/30 text-amber-200 text-[10px] rounded-full">
                {flags.length}
              </span>
            )}
          </button>
        </div>

        <button
          onClick={() => {
            if (activeTab === "previews") loadPreviews();
            else if (activeTab === "observability") loadObservabilityData();
            else if (activeTab === "security") loadSecurityScan();
            else if (activeTab === "flags") loadFlagsAndConfig();
          }}
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded"
          title="Refresh Current View"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Main Panel Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ============================================================ */}
        {/* MODULE 53: PREVIEW ENVIRONMENTS                              */}
        {/* ============================================================ */}
        {activeTab === "previews" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Ephemeral Preview Environments</h3>
                <p className="text-xs text-slate-400">
                  Branch & pull request isolated deployments with isolated databases and automatic TTL teardown.
                </p>
              </div>
              <button
                onClick={() => setShowCreatePreview(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Preview</span>
              </button>
            </div>

            {/* Create Preview Modal */}
            {showCreatePreview && (
              <div className="p-4 bg-slate-900 border border-indigo-500/30 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                  Deploy Ephemeral Preview Environment
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Environment Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Checkout Redesign"
                      value={newPreviewName}
                      onChange={(e) => setNewPreviewName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Source Git Branch</label>
                    <input
                      type="text"
                      placeholder="feature/branch-name"
                      value={newPreviewBranch}
                      onChange={(e) => setNewPreviewBranch(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">TTL Auto-Expiry (Hours)</label>
                    <input
                      type="number"
                      value={newPreviewTtl}
                      onChange={(e) => setNewPreviewTtl(parseInt(e.target.value, 10) || 72)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowCreatePreview(false)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreatePreview}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded"
                  >
                    Provision & Deploy
                  </button>
                </div>
              </div>
            )}

            {/* Previews Grid */}
            {previews.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-xl">
                <Globe className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No active preview environments for this project.</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Create a preview to test changes in an isolated branch environment.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {previews.map((prev) => (
                  <div
                    key={prev.id}
                    className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3 hover:border-slate-700 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-200">{prev.name}</span>
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                              prev.status === "ACTIVE"
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : prev.status === "EXPIRED"
                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {prev.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          branch: <span className="text-indigo-400">{prev.branch}</span>
                        </div>
                      </div>

                      <a
                        href={prev.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded transition"
                        title="Open Preview URL"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    <div className="text-[11px] font-mono text-slate-500 truncate bg-slate-950 px-2 py-1 rounded">
                      {prev.url}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>TTL: {prev.ttlHours}h</span>
                        {prev.databaseBranchId && (
                          <span className="text-cyan-400 ml-1">• DB schema isolated</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleExtendTtl(prev.id)}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px]"
                          title="Add 24 hours to TTL"
                        >
                          +24h TTL
                        </button>

                        <button
                          onClick={() => handlePromote(prev.id, "staging")}
                          disabled={promotingEnvId === prev.id}
                          className="px-2 py-1 bg-cyan-700/60 hover:bg-cyan-600 text-cyan-100 rounded text-[10px] font-semibold"
                        >
                          Promote Staging
                        </button>

                        <button
                          onClick={() => handlePromote(prev.id, "production")}
                          disabled={promotingEnvId === prev.id}
                          className="px-2 py-1 bg-emerald-700/60 hover:bg-emerald-600 text-emerald-100 rounded text-[10px] font-semibold"
                        >
                          Promote Prod
                        </button>

                        <button
                          onClick={() => handleTeardown(prev.id)}
                          className="p-1 text-rose-400 hover:text-rose-200 hover:bg-rose-950/40 rounded"
                          title="Teardown environment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* MODULE 54: DEVELOPER OBSERVABILITY                           */}
        {/* ============================================================ */}
        {activeTab === "observability" && (
          <div className="space-y-4">
            {/* APM Telemetry Cards */}
            {apmMetrics && (
              <div className="grid grid-cols-5 gap-3">
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    Throughput
                  </div>
                  <div className="text-lg font-bold text-cyan-400 mt-1">
                    {apmMetrics.requestsPerSecond} <span className="text-xs text-slate-400 font-normal">req/s</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    p50 / p90 Latency
                  </div>
                  <div className="text-lg font-bold text-slate-200 mt-1">
                    {apmMetrics.latencyMs.p50}ms <span className="text-xs text-slate-400 font-normal">/ {apmMetrics.latencyMs.p90}ms</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    Error Rate
                  </div>
                  <div className={`text-lg font-bold mt-1 ${
                    apmMetrics.errorRatePercent > 5 ? "text-rose-400" : "text-emerald-400"
                  }`}>
                    {apmMetrics.errorRatePercent}%
                  </div>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    Memory RSS
                  </div>
                  <div className="text-lg font-bold text-indigo-400 mt-1">
                    {apmMetrics.memoryUsageMb} <span className="text-xs text-slate-400 font-normal">MB</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    Open Issues
                  </div>
                  <div className={`text-lg font-bold mt-1 ${
                    apmMetrics.openIssuesCount > 0 ? "text-rose-400" : "text-emerald-400"
                  }`}>
                    {apmMetrics.openIssuesCount}
                  </div>
                </div>
              </div>
            )}

            {/* Sub-navigation */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <button
                onClick={() => setObsSubTab("logs")}
                className={`px-3 py-1 rounded text-xs font-semibold ${
                  obsSubTab === "logs" ? "bg-slate-800 text-cyan-300" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Structured Logs ({obsLogs.length})
              </button>
              <button
                onClick={() => setObsSubTab("issues")}
                className={`px-3 py-1 rounded text-xs font-semibold ${
                  obsSubTab === "issues" ? "bg-slate-800 text-rose-300" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Tracked Issues & Exceptions ({obsIssues.length})
              </button>
              <button
                onClick={() => setObsSubTab("traces")}
                className={`px-3 py-1 rounded text-xs font-semibold ${
                  obsSubTab === "traces" ? "bg-slate-800 text-indigo-300" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Distributed Tracing Waterfall
              </button>
            </div>

            {/* Logs Explorer Sub-view */}
            {obsSubTab === "logs" && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search log messages, metadata or stack..."
                      value={logFilterSearch}
                      onChange={(e) => setLogFilterSearch(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && loadObservabilityData()}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-hidden focus:border-cyan-500"
                    />
                  </div>

                  <select
                    value={logFilterLevel}
                    onChange={(e) => setLogFilterLevel(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300"
                  >
                    <option value="">All Levels</option>
                    <option value="debug">Debug</option>
                    <option value="info">Info</option>
                    <option value="warn">Warn</option>
                    <option value="error">Error</option>
                    <option value="fatal">Fatal</option>
                  </select>

                  <button
                    onClick={loadObservabilityData}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg"
                  >
                    Filter Logs
                  </button>
                </div>

                <div className="p-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs max-h-96 overflow-y-auto space-y-1">
                  {obsLogs.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-xs">No matching logs found.</div>
                  ) : (
                    obsLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start gap-2 p-1.5 rounded hover:bg-slate-900/60 leading-relaxed group"
                      >
                        <span className="text-slate-600 select-none text-[10px] w-18 shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${
                            log.level === "error" || log.level === "fatal"
                              ? "bg-rose-500/20 text-rose-400"
                              : log.level === "warn"
                              ? "bg-amber-500/20 text-amber-400"
                              : log.level === "debug"
                              ? "bg-slate-700 text-slate-300"
                              : "bg-cyan-500/20 text-cyan-300"
                          }`}
                        >
                          {log.level.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold px-1 rounded bg-slate-900 shrink-0">
                          [{log.source}]
                        </span>
                        <span className="text-slate-300 flex-1 break-all">{log.message}</span>
                        {log.traceId && (
                          <button
                            onClick={() => handleLoadTrace(log.traceId)}
                            className="text-[10px] text-indigo-400 hover:underline shrink-0 opacity-80 group-hover:opacity-100"
                          >
                            trace: {log.traceId.slice(0, 8)}
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Issues Sub-view */}
            {obsSubTab === "issues" && (
              <div className="space-y-3">
                {activeIssueDiagnostic && (
                  <div className="p-4 bg-indigo-950/40 border border-indigo-500/40 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                        {activeIssueDiagnostic.summary}
                      </span>
                      <button
                        onClick={() => setActiveIssueDiagnostic(null)}
                        className="text-slate-400 hover:text-slate-200 text-xs"
                      >
                        Dismiss
                      </button>
                    </div>
                    <p className="text-xs text-slate-300">
                      <strong>Root Cause:</strong> {activeIssueDiagnostic.rootCause}
                    </p>
                    <p className="text-xs text-emerald-300 font-mono bg-slate-950 p-2 rounded">
                      <strong>Suggested Fix:</strong> {activeIssueDiagnostic.suggestedFix}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  {obsIssues.length === 0 ? (
                    <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400">
                      Zero unresolved runtime exceptions! System running cleanly.
                    </div>
                  ) : (
                    obsIssues.map((issue) => (
                      <div
                        key={issue.id}
                        className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between hover:border-slate-700 transition"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 bg-rose-500/20 text-rose-300 text-[10px] font-bold rounded">
                              {issue.type}
                            </span>
                            <span className="text-xs font-semibold text-slate-200">{issue.title}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            Seen {issue.occurrenceCount} times • Last: {new Date(issue.lastSeenAt).toLocaleTimeString()}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDiagnoseIssue(issue.id)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>AI Root Cause</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Traces Sub-view */}
            {obsSubTab === "traces" && (
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">
                    Trace Waterfall {selectedTraceId && `(${selectedTraceId})`}
                  </span>
                  {activeTraceData && (
                    <span className="text-xs text-cyan-400 font-mono">
                      Total Duration: {activeTraceData.totalDurationMs}ms
                    </span>
                  )}
                </div>

                {!activeTraceData || activeTraceData.spans.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">
                    Click "trace" on any structured log line above to visualize the span tree.
                  </p>
                ) : (
                  <div className="space-y-1.5 font-mono text-xs">
                    {activeTraceData.spans.map((span: any) => (
                      <div
                        key={span.id}
                        className="p-2 bg-slate-950 border border-slate-800 rounded flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-indigo-400 font-bold">{span.service}</span>
                          <span className="text-slate-300">› {span.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-cyan-400">{span.durationMs}ms</span>
                          <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                            span.status === "OK" ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                          }`}>
                            {span.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* MODULE 55: APPLICATION SECURITY SCANNING                     */}
        {/* ============================================================ */}
        {activeTab === "security" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Application Security Scanner</h3>
                <p className="text-xs text-slate-400">
                  Static Application Security Testing (SAST), Secret Leak Detection, and Dependency CVE Audits.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRunSecurityScan("FULL")}
                  disabled={scanning}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>{scanning ? "Scanning..." : "Run Security Scan"}</span>
                </button>
              </div>
            </div>

            {/* Score & Gate Summary */}
            {latestScan && (
              <div className="grid grid-cols-5 gap-3">
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Security Score</div>
                  <div className={`text-xl font-bold mt-1 ${
                    latestScan.score >= 80 ? "text-emerald-400" : "text-rose-400"
                  }`}>
                    {latestScan.score} <span className="text-xs text-slate-500 font-normal">/ 100</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">CI/CD Gate</div>
                  <div className={`text-sm font-bold mt-2 flex items-center gap-1 ${
                    latestScan.passedGates ? "text-emerald-400" : "text-rose-400"
                  }`}>
                    {latestScan.passedGates ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    <span>{latestScan.passedGates ? "PASSED" : "FAILED (BLOCKED)"}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="text-[10px] text-rose-400 font-semibold uppercase">Critical Issues</div>
                  <div className="text-xl font-bold text-rose-400 mt-1">{latestScan.criticalCount}</div>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="text-[10px] text-amber-400 font-semibold uppercase">High Severity</div>
                  <div className="text-xl font-bold text-amber-400 mt-1">{latestScan.highCount}</div>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Medium / Low</div>
                  <div className="text-xl font-bold text-slate-300 mt-1">
                    {latestScan.mediumCount} / {latestScan.lowCount}
                  </div>
                </div>
              </div>
            )}

            {/* AI Auto-Remediation Patch Modal */}
            {activeRemediation && (
              <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    {activeRemediation.summary}
                  </span>
                  <button
                    onClick={() => setActiveRemediation(null)}
                    className="text-slate-400 hover:text-slate-200 text-xs"
                  >
                    Close
                  </button>
                </div>
                <pre className="p-2.5 bg-slate-950 text-emerald-300 text-xs font-mono rounded overflow-x-auto">
                  {activeRemediation.patchCode}
                </pre>
              </div>
            )}

            {/* Findings List */}
            <div className="space-y-2">
              {!latestScan || latestScan.findings.length === 0 ? (
                <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400">
                  No security vulnerabilities detected! Run a scan to analyze code and dependencies.
                </div>
              ) : (
                latestScan.findings.map((finding: any) => (
                  <div
                    key={finding.id}
                    className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2 hover:border-slate-700 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            finding.severity === "CRITICAL"
                              ? "bg-rose-500 text-white"
                              : finding.severity === "HIGH"
                              ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                              : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {finding.severity}
                        </span>
                        <span className="text-xs font-bold text-slate-200">{finding.title}</span>
                        <span className="text-[10px] text-slate-500 font-mono">[{finding.ruleId}]</span>
                      </div>

                      <button
                        onClick={() => handleGenerateRemediation(finding.id)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>AI Auto-Patch</span>
                      </button>
                    </div>

                    <p className="text-xs text-slate-400">{finding.description}</p>

                    <div className="text-[11px] font-mono text-slate-500">
                      Location: <span className="text-slate-300">{finding.filePath}:{finding.lineNumber || 1}</span>
                    </div>

                    <div className="p-2 bg-slate-950 rounded text-[11px] text-emerald-400 font-mono">
                      Remediation: {finding.remediation}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODULE 56: FEATURE FLAGS & REMOTE CONFIGURATION              */}
        {/* ============================================================ */}
        {activeTab === "flags" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Feature Flags & Remote Configuration</h3>
                <p className="text-xs text-slate-400">
                  Multivariate toggles, percentage-based rollouts, user targeting, and live remote config parameters.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCreateFlag(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Flag</span>
                </button>
                <button
                  onClick={() => setShowCreateConfig(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Config</span>
                </button>
              </div>
            </div>

            {/* Create Flag Modal */}
            {showCreateFlag && (
              <div className="p-4 bg-slate-900 border border-amber-500/30 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                  Create Feature Flag
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Key Name</label>
                    <input
                      type="text"
                      placeholder="e.g. enable_new_checkout"
                      value={newFlagKey}
                      onChange={(e) => setNewFlagKey(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Human Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Modern Checkout Flow"
                      value={newFlagName}
                      onChange={(e) => setNewFlagName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Rollout Percentage (0-100%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={newFlagRollout}
                      onChange={(e) => setNewFlagRollout(parseInt(e.target.value, 10) || 100)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowCreateFlag(false)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateFlag}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded"
                  >
                    Save Flag
                  </button>
                </div>
              </div>
            )}

            {/* Create Config Modal */}
            {showCreateConfig && (
              <div className="p-4 bg-slate-900 border border-cyan-500/30 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                  Set Remote Configuration Parameter
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Config Key</label>
                    <input
                      type="text"
                      placeholder="e.g. max_file_upload_mb"
                      value={newConfigKey}
                      onChange={(e) => setNewConfigKey(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-hidden focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Value (JSON or Primitive)</label>
                    <input
                      type="text"
                      placeholder="50 or { max: 100 }"
                      value={newConfigValue}
                      onChange={(e) => setNewConfigValue(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-hidden focus:border-cyan-500"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowCreateConfig(false)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveConfig}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded"
                  >
                    Save Config
                  </button>
                </div>
              </div>
            )}

            {/* Flags Grid */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Feature Flags ({flags.length})
              </h4>
              {flags.length === 0 ? (
                <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400">
                  No feature flags configured. Create flags to control progressive rollouts.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {flags.map((flag) => (
                    <div
                      key={flag.id}
                      className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-3 hover:border-slate-700 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-200">{flag.name}</div>
                          <div className="text-[11px] font-mono text-amber-400 mt-0.5">{flag.key}</div>
                        </div>

                        <button
                          onClick={() => handleToggleFlag(flag.key, flag.isEnabled)}
                          className="flex items-center gap-1.5 cursor-pointer"
                        >
                          {flag.isEnabled ? (
                            <ToggleRight className="w-6 h-6 text-emerald-400" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-slate-600" />
                          )}
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Rollout: <strong>{flag.rolloutPercentage}%</strong></span>
                        <span className="font-mono text-slate-500">
                          default: {JSON.stringify(flag.defaultValue)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Remote Config Grid */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Remote Configuration ({configs.length})
              </h4>
              {configs.length === 0 ? (
                <div className="p-6 text-center bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-slate-500">
                  No remote configuration keys defined.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {configs.map((cfg) => (
                    <div
                      key={cfg.id}
                      className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-bold text-cyan-300 font-mono">{cfg.key}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          value: <span className="text-slate-200">{JSON.stringify(cfg.value)}</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-500 bg-slate-950 px-2 py-0.5 rounded">
                        v{cfg.version}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
