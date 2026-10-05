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
} from "lucide-react";
import { forgeProjectService } from "../services/forgeProjectService";

interface AiAgentPanelProps {
  projectId: string;
  onOpenFile?: (filePath: string) => void;
}

export const AiAgentPanel: React.FC<AiAgentPanelProps> = ({ projectId, onOpenFile }) => {
  const [activeTab, setActiveTab] = useState<
    "coding" | "creator" | "website" | "tools" | "mcp" | "gateway"
  >("coding");

  // Coding Agent State
  const [codingGoal, setCodingGoal] = useState("");
  const [activeSession, setActiveSession] = useState<any>(null);
  const [currentPlan, setCurrentPlan] = useState<any>(null);
  const [executingPlan, setExecutingPlan] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);

  // Creator State
  const [creatorPrompt, setCreatorPrompt] = useState("");
  const [creatorFramework, setCreatorFramework] = useState<"react" | "nextjs">("react");
  const [creatorPlan, setCreatorPlan] = useState<any>(null);
  const [generatingApp, setGeneratingApp] = useState(false);
  const [creatorSuccess, setCreatorSuccess] = useState<any>(null);

  // Website Agent State
  const [auditReport, setAuditReport] = useState<any>(null);
  const [runningAudit, setRunningAudit] = useState(false);

  // Tools & Approval State
  const [tools, setTools] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);

  // MCP State
  const [mcpServers, setMcpServers] = useState<any[]>([]);
  const [newServerName, setNewServerName] = useState("");
  const [newServerEndpoint, setNewServerEndpoint] = useState("");

  // Gateway & Telemetry State
  const [aiHealth, setAiHealth] = useState<any[]>([]);
  const [aiUsage, setAiUsage] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTabData();
  }, [projectId, activeTab]);

  const loadTabData = async () => {
    try {
      setLoading(true);
      if (activeTab === "tools") {
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
      console.error("Failed to load AI tab data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Coding Agent Handlers
  const handleStartCoding = async () => {
    if (!codingGoal.trim()) return;
    try {
      setExecutingPlan(true);
      const sess = await forgeProjectService.createCodingSession(projectId, { goal: codingGoal });
      setActiveSession(sess);
      const planRes = await forgeProjectService.generateCodingPlan(projectId, sess.sessionId);
      setCurrentPlan(planRes.plan);
    } catch (err: any) {
      alert(`Error starting coding session: ${err.message}`);
    } finally {
      setExecutingPlan(false);
    }
  };

  const handleExecutePlan = async () => {
    if (!activeSession) return;
    try {
      setExecutingPlan(true);
      const res = await forgeProjectService.executeCodingPlan(projectId, activeSession.sessionId);
      setExecutionResult(res);
      alert(`Plan executed successfully! Modified ${res.modifiedFiles.length} files.`);
    } catch (err: any) {
      alert(`Error executing plan: ${err.message}`);
    } finally {
      setExecutingPlan(false);
    }
  };

  // Creator Handlers
  const handleGenerateCreatorPlan = async () => {
    if (!creatorPrompt.trim()) return;
    try {
      setGeneratingApp(true);
      const res = await forgeProjectService.generateCreatorPlan(creatorPrompt, creatorFramework);
      setCreatorPlan(res.plan);
    } catch (err: any) {
      alert(`Error generating creator plan: ${err.message}`);
    } finally {
      setGeneratingApp(false);
    }
  };

  const handleExecuteCreator = async () => {
    if (!creatorPrompt.trim()) return;
    try {
      setGeneratingApp(true);
      const res = await forgeProjectService.createFromPrompt(creatorPrompt, creatorFramework);
      setCreatorSuccess(res);
    } catch (err: any) {
      alert(`Error creating project: ${err.message}`);
    } finally {
      setGeneratingApp(false);
    }
  };

  // Website Agent Handlers
  const handleRunAudit = async () => {
    try {
      setRunningAudit(true);
      const res = await forgeProjectService.auditWebsite(projectId);
      setAuditReport(res.report);
    } catch (err: any) {
      alert(`Error running website audit: ${err.message}`);
    } finally {
      setRunningAudit(false);
    }
  };

  const handleFixFinding = async (findingId: string) => {
    try {
      const res = await forgeProjectService.fixWebsiteFinding(projectId, findingId);
      alert(`Applied targeted fix to: ${res.modifiedFile}`);
      await handleRunAudit();
    } catch (err: any) {
      alert(`Error fixing finding: ${err.message}`);
    }
  };

  // MCP Handlers
  const handleRegisterMcp = async () => {
    if (!newServerName || !newServerEndpoint) return;
    try {
      await forgeProjectService.registerMcpServer(projectId, {
        name: newServerName,
        endpoint: newServerEndpoint,
        trustLevel: "VERIFIED",
      });
      setNewServerName("");
      setNewServerEndpoint("");
      loadTabData();
    } catch (err: any) {
      alert(`Error registering MCP server: ${err.message}`);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-200">
      {/* Subtab Navigation Bar */}
      <div className="h-10 border-b border-slate-800 bg-slate-900/60 px-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab("coding")}
            className={`px-3 py-1 rounded font-medium flex items-center gap-1.5 transition ${
              activeTab === "coding" ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Coding Agent</span>
          </button>

          <button
            onClick={() => setActiveTab("creator")}
            className={`px-3 py-1 rounded font-medium flex items-center gap-1.5 transition ${
              activeTab === "creator" ? "bg-cyan-600/30 text-cyan-300 border border-cyan-500/40" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Creator</span>
          </button>

          <button
            onClick={() => setActiveTab("website")}
            className={`px-3 py-1 rounded font-medium flex items-center gap-1.5 transition ${
              activeTab === "website" ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/40" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Website QA Agent</span>
          </button>

          <button
            onClick={() => setActiveTab("tools")}
            className={`px-3 py-1 rounded font-medium flex items-center gap-1.5 transition ${
              activeTab === "tools" ? "bg-amber-600/30 text-amber-300 border border-amber-500/40" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Tool Execution</span>
          </button>

          <button
            onClick={() => setActiveTab("mcp")}
            className={`px-3 py-1 rounded font-medium flex items-center gap-1.5 transition ${
              activeTab === "mcp" ? "bg-purple-600/30 text-purple-300 border border-purple-500/40" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>MCP Layer</span>
          </button>

          <button
            onClick={() => setActiveTab("gateway")}
            className={`px-3 py-1 rounded font-medium flex items-center gap-1.5 transition ${
              activeTab === "gateway" ? "bg-sky-600/30 text-sky-300 border border-sky-500/40" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Gateway & Usage</span>
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
      <div className="flex-1 overflow-y-auto p-4">
        {/* 1. CODING AGENT TAB */}
        {activeTab === "coding" && (
          <div className="max-w-3xl space-y-4 text-xs">
            <div className="p-4 border border-slate-800 rounded-lg bg-slate-900/40 space-y-3">
              <div className="font-semibold text-sm text-slate-200 flex items-center gap-2">
                <Bot className="w-4 h-4 text-indigo-400" />
                <span>Autonomous Repository Coding Agent</span>
              </div>
              <p className="text-slate-400">
                Analyzes repository context, constructs step-by-step plans, performs multi-file edits, and executes error-driven repair loops.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Add dark mode toggle and connect it to local storage"
                  value={codingGoal}
                  onChange={(e) => setCodingGoal(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 px-3 py-1.5 rounded text-slate-200 outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleStartCoding}
                  disabled={executingPlan || !codingGoal}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded font-medium flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Plan Task</span>
                </button>
              </div>
            </div>

            {currentPlan && (
              <div className="p-4 border border-indigo-900/60 rounded-lg bg-indigo-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-indigo-300">{currentPlan.title}</span>
                  <span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300">
                    Risk: {currentPlan.riskLevel}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {currentPlan.steps?.map((s: any) => (
                    <div key={s.order} className="flex items-center justify-between p-2 rounded bg-slate-900/70 border border-slate-800">
                      <span className="text-slate-300">
                        {s.order}. {s.description}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">{s.targetFiles?.join(", ") || s.action}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleExecutePlan}
                  disabled={executingPlan}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium flex items-center justify-center gap-2"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{executingPlan ? "Executing & Verifying..." : "Approve & Execute Plan"}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* 2. CREATOR TAB */}
        {activeTab === "creator" && (
          <div className="max-w-3xl space-y-4 text-xs">
            <div className="p-4 border border-slate-800 rounded-lg bg-slate-900/40 space-y-3">
              <div className="font-semibold text-sm text-slate-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>AI Creator (Full-Stack Generation)</span>
              </div>
              <p className="text-slate-400">
                Transforms prompt intent into complete Forge projects with routes, components, and responsive themes.
              </p>
              <textarea
                rows={3}
                placeholder="e.g. Build a sleek SaaS analytics dashboard with interactive metrics cards and pricing tiers"
                value={creatorPrompt}
                onChange={(e) => setCreatorPrompt(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 p-2.5 rounded text-slate-200 outline-none focus:border-cyan-500"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Framework:</span>
                  <select
                    value={creatorFramework}
                    onChange={(e: any) => setCreatorFramework(e.target.value)}
                    className="bg-slate-950 border border-slate-700 px-2.5 py-1 rounded text-slate-200"
                  >
                    <option value="react">React + Vite</option>
                    <option value="nextjs">Next.js App Router</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleGenerateCreatorPlan}
                    disabled={generatingApp || !creatorPrompt}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-medium"
                  >
                    Generate Plan
                  </button>
                  <button
                    onClick={handleExecuteCreator}
                    disabled={generatingApp || !creatorPrompt}
                    className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Create Full Project</span>
                  </button>
                </div>
              </div>
            </div>

            {creatorPlan && (
              <div className="p-4 border border-cyan-900/60 rounded-lg bg-cyan-950/20 space-y-2">
                <div className="font-semibold text-cyan-300">Architecture Plan: {creatorPlan.projectName}</div>
                <div className="grid grid-cols-2 gap-2 text-slate-300">
                  <div>Routes: {creatorPlan.routes?.map((r: any) => r.path).join(", ")}</div>
                  <div>Components: {creatorPlan.components?.map((c: any) => c.name).join(", ")}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. WEBSITE AGENT TAB */}
        {activeTab === "website" && (
          <div className="max-w-3xl space-y-4 text-xs">
            <div className="flex items-center justify-between p-4 border border-slate-800 rounded-lg bg-slate-900/40">
              <div>
                <div className="font-semibold text-sm text-slate-200">Website Quality & Responsiveness Audit</div>
                <div className="text-slate-400 mt-0.5">Automated tests for Viewport Overflow, Accessibility (WCAG), and SEO.</div>
              </div>
              <button
                onClick={handleRunAudit}
                disabled={runningAudit}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium flex items-center gap-1.5"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{runningAudit ? "Auditing Preview..." : "Run Quality Audit"}</span>
              </button>
            </div>

            {auditReport && (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-900/60 border border-slate-800 rounded text-center">
                    <div className="text-slate-400 text-[11px]">Overall Score</div>
                    <div className="text-xl font-bold text-emerald-400 mt-1">{auditReport.overallScore}/100</div>
                  </div>
                  <div className="p-3 bg-slate-900/60 border border-slate-800 rounded text-center">
                    <div className="text-slate-400 text-[11px]">Responsive</div>
                    <div className="text-xl font-bold text-cyan-400 mt-1">{auditReport.responsiveScore}%</div>
                  </div>
                  <div className="p-3 bg-slate-900/60 border border-slate-800 rounded text-center">
                    <div className="text-slate-400 text-[11px]">Accessibility</div>
                    <div className="text-xl font-bold text-indigo-400 mt-1">{auditReport.accessibilityScore}%</div>
                  </div>
                  <div className="p-3 bg-slate-900/60 border border-slate-800 rounded text-center">
                    <div className="text-slate-400 text-[11px]">SEO</div>
                    <div className="text-xl font-bold text-amber-400 mt-1">{auditReport.seoScore}%</div>
                  </div>
                </div>

                <div className="border border-slate-800 rounded-lg overflow-hidden divide-y divide-slate-800">
                  <div className="p-2.5 bg-slate-900 font-semibold text-slate-300">Findings & Defects ({auditReport.findings?.length})</div>
                  {auditReport.findings?.length === 0 ? (
                    <div className="p-4 text-center text-slate-500">Zero defects found! Application passed all audits.</div>
                  ) : (
                    auditReport.findings.map((f: any) => (
                      <div key={f.id} className="p-3 flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-slate-200 flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${f.severity === "CRITICAL" ? "bg-rose-500/20 text-rose-400" : "bg-amber-500/20 text-amber-400"}`}>
                              {f.severity}
                            </span>
                            <span>{f.title}</span>
                          </div>
                          <div className="text-slate-400 text-[11px] mt-0.5">{f.description}</div>
                        </div>
                        <button
                          onClick={() => handleFixFinding(f.id)}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs"
                        >
                          Auto-Fix
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. TOOLS TAB */}
        {activeTab === "tools" && (
          <div className="max-w-3xl space-y-4 text-xs">
            <div className="border border-slate-800 rounded-lg overflow-hidden divide-y divide-slate-800">
              <div className="p-2.5 bg-slate-900 font-semibold text-slate-300">Available AI Platform Tools ({tools.length})</div>
              {tools.map((t: any) => (
                <div key={t.id} className="p-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-200 font-mono">{t.name}</div>
                    <div className="text-slate-400 text-[11px]">{t.description}</div>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">{t.category}</span>
                    <span className={`px-2 py-0.5 rounded ${t.riskLevel === "CRITICAL" ? "bg-rose-500/20 text-rose-400" : t.riskLevel === "HIGH" ? "bg-amber-500/20 text-amber-400" : "bg-slate-800 text-slate-400"}`}>
                      {t.riskLevel}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. MCP TAB */}
        {activeTab === "mcp" && (
          <div className="max-w-3xl space-y-4 text-xs">
            <div className="p-4 border border-slate-800 rounded-lg bg-slate-900/40 space-y-3">
              <div className="font-semibold text-sm text-slate-200 flex items-center gap-2">
                <Network className="w-4 h-4 text-purple-400" />
                <span>Model Context Protocol (MCP) Server Integration</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Server Name (e.g. PostgresMCP)"
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                  className="bg-slate-950 border border-slate-700 px-3 py-1.5 rounded text-slate-200 flex-1 outline-none"
                />
                <input
                  type="text"
                  placeholder="Endpoint URL (e.g. http://localhost:8080/mcp)"
                  value={newServerEndpoint}
                  onChange={(e) => setNewServerEndpoint(e.target.value)}
                  className="bg-slate-950 border border-slate-700 px-3 py-1.5 rounded text-slate-200 flex-1 outline-none"
                />
                <button
                  onClick={handleRegisterMcp}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded font-medium"
                >
                  Connect
                </button>
              </div>
            </div>

            <div className="border border-slate-800 rounded-lg overflow-hidden divide-y divide-slate-800">
              <div className="p-2.5 bg-slate-900 font-semibold text-slate-300">Connected MCP Servers ({mcpServers.length})</div>
              {mcpServers.length === 0 ? (
                <div className="p-4 text-center text-slate-500">No external MCP servers connected. Native Forge MCP server active at /api/v1/projects/:id/mcp/rpc.</div>
              ) : (
                mcpServers.map((s: any) => (
                  <div key={s.id} className="p-3 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-200">{s.name}</div>
                      <div className="text-slate-500 text-[11px] font-mono">{s.endpoint}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-500/20 text-emerald-400 font-medium">
                      {s.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 6. GATEWAY & USAGE TAB */}
        {activeTab === "gateway" && (
          <div className="max-w-3xl space-y-4 text-xs">
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
