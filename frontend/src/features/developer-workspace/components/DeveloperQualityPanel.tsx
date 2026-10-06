/**
 * ForgeStudio Modules 43–45: Quality, API Testing & Browser DevTools Panel
 * Complete workbench for Automated Tests, API Studio (REST/GraphQL/WS),
 * and live Browser DevTools (Console, Network, DOM, Web Vitals, Storage).
 */

import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  XCircle,
  Play,
  RotateCw,
  Plus,
  Trash2,
  Send,
  Terminal,
  Activity,
  Layers,
  Code,
  Sparkles,
  Search,
  Eye,
  FileText,
  Radio,
  Sliders,
  Gauge,
  Database,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  FolderPlus,
  UploadCloud,
} from "lucide-react";
import { forgeProjectService } from "../services/forgeProjectService";

interface DeveloperQualityPanelProps {
  projectId: string;
}

type QualityTab = "testing" | "api" | "devtools";

export const DeveloperQualityPanel: React.FC<DeveloperQualityPanelProps> = ({ projectId }) => {
  const [activeTab, setActiveTab] = useState<QualityTab>("testing");
  const [loading, setLoading] = useState(false);

  // ------------------------------------------------------------
  // MODULE 43: Automated Testing State
  // ------------------------------------------------------------
  const [testSuites, setTestSuites] = useState<any[]>([]);
  const [testRuns, setTestRuns] = useState<any[]>([]);
  const [activeTestRun, setActiveTestRun] = useState<any>(null);
  const [runningTests, setRunningTests] = useState(false);

  // ------------------------------------------------------------
  // MODULE 44: API Testing Studio State
  // ------------------------------------------------------------
  const [collections, setCollections] = useState<any[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);

  // Active Request Builder
  const [reqMethod, setReqMethod] = useState("GET");
  const [reqUrl, setReqUrl] = useState("{{baseUrl}}/api/projects");
  const [reqHeaders, setReqHeaders] = useState('{\n  "Accept": "application/json"\n}');
  const [reqBody, setReqBody] = useState('{\n  "title": "New Item"\n}');
  const [activeExecutionResult, setActiveExecutionResult] = useState<any>(null);
  const [sendingRequest, setSendingRequest] = useState(false);

  // ------------------------------------------------------------
  // MODULE 45: Browser DevTools State
  // ------------------------------------------------------------
  const [devtoolsSubTab, setDevtoolsSubTab] = useState<"console" | "network" | "vitals" | "dom" | "storage">("console");
  const [devtoolsState, setDevtoolsState] = useState<any>({
    consoleLogs: [],
    networkLogs: [],
    domTree: null,
    vitals: { lcpMs: 620, fidMs: 14, cls: 0.01, fcpMs: 410, ttfbMs: 80, memoryHeapMb: 26.4 },
    storage: { localStorage: {}, sessionStorage: {}, cookies: {} },
  });
  const [aiRuntimeAnalysis, setAiRuntimeAnalysis] = useState<any>(null);
  const [analyzingAi, setAnalyzingAi] = useState(false);

  // Modals
  const [showCreateCollectionModal, setShowCreateCollectionModal] = useState(false);
  const [newCollName, setNewCollName] = useState("");
  const [showCreateReqModal, setShowCreateReqModal] = useState(false);
  const [newReqName, setNewReqName] = useState("");

  useEffect(() => {
    loadTabContent();
  }, [projectId, activeTab]);

  const loadTabContent = async () => {
    try {
      setLoading(true);
      if (activeTab === "testing") {
        const [sRes, rRes] = await Promise.all([
          forgeProjectService.listTestSuites(projectId),
          forgeProjectService.listTestRuns(projectId),
        ]);
        setTestSuites(sRes.suites || []);
        setTestRuns(rRes.runs || []);
        if (rRes.runs?.length > 0) {
          setActiveTestRun(rRes.runs[0]);
        }
      } else if (activeTab === "api") {
        const cRes = await forgeProjectService.listApiCollections(projectId);
        setCollections(cRes.collections || []);
        if (cRes.collections?.length > 0 && !selectedCollection) {
          const first = cRes.collections[0];
          setSelectedCollection(first);
          loadCollectionRequests(first.id);
        }
      } else if (activeTab === "devtools") {
        const dRes = await forgeProjectService.getDevToolsState(projectId);
        if (dRes.state) {
          setDevtoolsState(dRes.state);
        }
      }
    } catch (err) {
      console.error("Error loading quality panel content:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadCollectionRequests = async (collId: string) => {
    try {
      const res = await forgeProjectService.listApiRequests(projectId, collId);
      setRequests(res.requests || []);
      if (res.requests?.length > 0) {
        selectRequestForEditing(res.requests[0]);
      }
    } catch (err) {
      console.error("Error loading requests:", err);
    }
  };

  const selectRequestForEditing = (r: any) => {
    setSelectedRequest(r);
    setReqMethod(r.method || "GET");
    setReqUrl(r.url || "");
    setReqHeaders(JSON.stringify(r.headers || {}, null, 2));
    setReqBody(typeof r.body === "string" ? r.body : JSON.stringify(r.body || {}, null, 2));
    setActiveExecutionResult(null);
  };

  // Module 43: Run Tests
  const handleRunAllTests = async () => {
    try {
      setRunningTests(true);
      const res = await forgeProjectService.runProjectTests(projectId, { trigger: "MANUAL" });
      setActiveTestRun(res.testRun);
      loadTabContent();
    } catch (err: any) {
      alert(`Error running tests: ${err.message}`);
    } finally {
      setRunningTests(false);
    }
  };

  // Module 44: Send Request
  const handleSendApiRequest = async () => {
    if (!selectedRequest) return;
    try {
      setSendingRequest(true);
      let parsedHeaders = {};
      let parsedBody = {};
      try { parsedHeaders = JSON.parse(reqHeaders); } catch {}
      try { parsedBody = JSON.parse(reqBody); } catch {}

      // Temporary update on server before execution
      const res = await forgeProjectService.executeApiRequest(projectId, selectedRequest.id, {
        baseUrl: "http://localhost:5000",
      });
      setActiveExecutionResult(res.result);
    } catch (err: any) {
      alert(`Request execution failed: ${err.message}`);
    } finally {
      setSendingRequest(false);
    }
  };

  const handleRunFullCollection = async () => {
    if (!selectedCollection) return;
    try {
      setSendingRequest(true);
      const res = await forgeProjectService.runApiCollection(projectId, selectedCollection.id);
      alert(`Collection Run: ${res.runRecord?.status} (${res.runRecord?.passedAssertions} passed, ${res.runRecord?.failedAssertions} failed)`);
    } catch (err: any) {
      alert(`Error running collection: ${err.message}`);
    } finally {
      setSendingRequest(false);
    }
  };

  // Module 45: Analyze Error with AI
  const handleAnalyzeRuntimeError = async () => {
    try {
      setAnalyzingAi(true);
      const res = await forgeProjectService.analyzeDevToolsErrorWithAi(projectId);
      setAiRuntimeAnalysis(res.analysis);
    } catch (err: any) {
      alert(`AI Diagnostic error: ${err.message}`);
    } finally {
      setAnalyzingAi(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 font-sans text-xs">
      {/* Top Header / Module Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2 bg-slate-900/60">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("testing")}
            className={`px-3 py-1.5 rounded font-medium flex items-center gap-1.5 transition ${
              activeTab === "testing"
                ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Automated Testing (M43)</span>
          </button>

          <button
            onClick={() => setActiveTab("api")}
            className={`px-3 py-1.5 rounded font-medium flex items-center gap-1.5 transition ${
              activeTab === "api"
                ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Send className="w-3.5 h-3.5 text-indigo-400" />
            <span>API Testing Studio (M44)</span>
          </button>

          <button
            onClick={() => setActiveTab("devtools")}
            className={`px-3 py-1.5 rounded font-medium flex items-center gap-1.5 transition ${
              activeTab === "devtools"
                ? "bg-amber-600/30 text-amber-300 border border-amber-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            <span>Browser DevTools & Inspector (M45)</span>
          </button>
        </div>

        <button
          onClick={loadTabContent}
          className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800"
          title="Refresh"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-4">
        {/* ============================================================ */}
        {/* MODULE 43: AUTOMATED TESTING PLATFORM                        */}
        {/* ============================================================ */}
        {activeTab === "testing" && (
          <div className="grid grid-cols-12 gap-4 h-full">
            {/* Left: Test Suites & Actions */}
            <div className="col-span-4 bg-slate-900 border border-slate-800 rounded p-3 flex flex-col">
              <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                <span className="font-semibold text-slate-200">Test Suites ({testSuites.length})</span>
                <button
                  onClick={handleRunAllTests}
                  disabled={runningTests}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded font-medium flex items-center gap-1.5"
                >
                  <Play className={`w-3 h-3 ${runningTests ? "animate-spin" : ""}`} /> Run All
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2">
                {testSuites.length === 0 ? (
                  <div className="text-slate-500 py-6 text-center">No test files found in project.</div>
                ) : (
                  testSuites.map((s) => (
                    <div
                      key={s.id}
                      className="p-2.5 bg-slate-950 border border-slate-800 rounded flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-slate-200">{s.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{s.filePath}</div>
                      </div>
                      <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-cyan-400 font-mono">
                        {s.testType}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right: Test Run Results & Coverage */}
            <div className="col-span-8 bg-slate-900 border border-slate-800 rounded p-4 flex flex-col">
              {activeTestRun ? (
                <div className="space-y-4 flex-1 overflow-y-auto">
                  {/* Summary Bar */}
                  <div className="flex items-center justify-between bg-slate-950 p-3 rounded border border-slate-800">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded font-bold text-xs ${
                        activeTestRun.status === "PASSED" ? "bg-emerald-950 text-emerald-400 border border-emerald-500/30" : "bg-rose-950 text-rose-400 border border-rose-500/30"
                      }`}>
                        {activeTestRun.status}
                      </span>
                      <span className="text-slate-300 font-semibold">
                        {activeTestRun.passed} Passed / {activeTestRun.failed} Failed / {activeTestRun.total} Total
                      </span>
                    </div>
                    <span className="text-slate-500 font-mono text-[11px]">
                      Duration: {activeTestRun.durationMs}ms
                    </span>
                  </div>

                  {/* Coverage Meters */}
                  {activeTestRun.coverage && (
                    <div className="grid grid-cols-4 gap-2">
                      <div className="bg-slate-950 border border-slate-800 p-2 rounded text-center">
                        <div className="text-[10px] text-slate-400">Statements</div>
                        <div className="text-base font-bold text-emerald-400">{activeTestRun.coverage.statements.pct}%</div>
                      </div>
                      <div className="bg-slate-950 border border-slate-800 p-2 rounded text-center">
                        <div className="text-[10px] text-slate-400">Branches</div>
                        <div className="text-base font-bold text-cyan-400">{activeTestRun.coverage.branches.pct}%</div>
                      </div>
                      <div className="bg-slate-950 border border-slate-800 p-2 rounded text-center">
                        <div className="text-[10px] text-slate-400">Functions</div>
                        <div className="text-base font-bold text-indigo-400">{activeTestRun.coverage.functions.pct}%</div>
                      </div>
                      <div className="bg-slate-950 border border-slate-800 p-2 rounded text-center">
                        <div className="text-[10px] text-slate-400">Lines</div>
                        <div className="text-base font-bold text-teal-400">{activeTestRun.coverage.lines.pct}%</div>
                      </div>
                    </div>
                  )}

                  {/* Test Cases Results List */}
                  <div className="space-y-1.5">
                    <span className="font-semibold text-slate-300 block">Executed Test Cases</span>
                    {activeTestRun.results?.map((tc: any, i: number) => (
                      <div
                        key={i}
                        className={`p-2 rounded border font-mono text-[11px] flex items-start gap-2 ${
                          tc.status === "PASSED" ? "bg-slate-950/60 border-slate-800/80 text-slate-300" : "bg-rose-950/20 border-rose-500/40 text-rose-300"
                        }`}
                      >
                        {tc.status === "PASSED" ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{tc.name}</span>
                            <span className="text-[10px] text-slate-500">{tc.durationMs}ms</span>
                          </div>
                          {tc.error && (
                            <div className="text-[10px] text-rose-400 mt-1 bg-rose-950/40 p-1.5 rounded">
                              {tc.error.message}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* AI Diagnostic Card (if failure occurred) */}
                  {activeTestRun.aiDiagnostic && (
                    <div className="p-3 bg-purple-950/30 border border-purple-500/40 rounded space-y-1.5">
                      <div className="flex items-center gap-1.5 text-purple-300 font-semibold">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <span>AI Root-Cause Diagnostic</span>
                      </div>
                      <div className="text-[11px] text-slate-300">{activeTestRun.aiDiagnostic.summary}</div>
                      <div className="text-[10px] text-purple-200 bg-purple-950/60 p-2 rounded font-mono">
                        {activeTestRun.aiDiagnostic.suggestedFix}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-slate-500 m-auto text-center">
                  Click "Run All" to execute test harness and view coverage.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODULE 44: API TESTING STUDIO                                */}
        {/* ============================================================ */}
        {activeTab === "api" && (
          <div className="grid grid-cols-12 gap-4 h-full">
            {/* Left: Collections & Requests Directory */}
            <div className="col-span-3 bg-slate-900 border border-slate-800 rounded p-3 flex flex-col">
              <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                <span className="font-semibold text-slate-200">Collections</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowCreateCollectionModal(true)}
                    className="p-1 text-indigo-400 hover:bg-slate-800 rounded"
                    title="New Collection"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleRunFullCollection}
                    disabled={!selectedCollection}
                    className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium text-[10px]"
                  >
                    Run
                  </button>
                </div>
              </div>

              <div className="space-y-1 overflow-y-auto flex-1">
                {collections.map((c) => (
                  <div key={c.id} className="space-y-1">
                    <div
                      onClick={() => { setSelectedCollection(c); loadCollectionRequests(c.id); }}
                      className={`p-2 rounded cursor-pointer font-semibold ${
                        selectedCollection?.id === c.id ? "bg-indigo-950/40 text-indigo-300 border border-indigo-500/30" : "text-slate-400 hover:bg-slate-800/40"
                      }`}
                    >
                      📁 {c.name}
                    </div>

                    {selectedCollection?.id === c.id && (
                      <div className="pl-4 space-y-1">
                        {requests.map((r) => (
                          <div
                            key={r.id}
                            onClick={() => selectRequestForEditing(r)}
                            className={`p-1.5 rounded cursor-pointer flex items-center justify-between text-[11px] ${
                              selectedRequest?.id === r.id ? "bg-slate-800 text-slate-100 font-semibold" : "text-slate-400 hover:bg-slate-900"
                            }`}
                          >
                            <span className="truncate">{r.name}</span>
                            <span className="font-mono text-[9px] text-cyan-400 font-bold">{r.method}</span>
                          </div>
                        ))}
                        <button
                          onClick={() => setShowCreateReqModal(true)}
                          className="w-full text-left p-1 text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Add Request
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Request Builder & Response Inspector */}
            <div className="col-span-9 bg-slate-900 border border-slate-800 rounded p-4 flex flex-col">
              {/* Request URL Bar */}
              <div className="flex items-center gap-2 mb-3">
                <select
                  value={reqMethod}
                  onChange={(e) => setReqMethod(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 font-bold font-mono text-cyan-400"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                  <option value="DELETE">DELETE</option>
                </select>

                <input
                  type="text"
                  value={reqUrl}
                  onChange={(e) => setReqUrl(e.target.value)}
                  placeholder="{{baseUrl}}/api/v1/..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-1.5 font-mono text-slate-200"
                />

                <button
                  onClick={handleSendApiRequest}
                  disabled={sendingRequest || !selectedRequest}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded font-semibold flex items-center gap-1.5"
                >
                  <Send className={`w-3.5 h-3.5 ${sendingRequest ? "animate-pulse" : ""}`} /> Send
                </button>
              </div>

              {/* Request Payload / Response Split */}
              <div className="grid grid-cols-2 gap-3 flex-1 overflow-hidden">
                <div className="flex flex-col space-y-2">
                  <span className="font-semibold text-slate-400">Request Body JSON</span>
                  <textarea
                    value={reqBody}
                    onChange={(e) => setReqBody(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded p-2.5 font-mono text-[11px] text-indigo-300 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-400">Response</span>
                    {activeExecutionResult && (
                      <div className="flex items-center gap-2 font-mono text-[10px]">
                        <span className={`px-1.5 py-0.5 rounded font-bold ${
                          activeExecutionResult.statusCode < 400 ? "bg-emerald-950 text-emerald-400" : "bg-rose-950 text-rose-400"
                        }`}>
                          {activeExecutionResult.statusCode}
                        </span>
                        <span className="text-slate-400">{activeExecutionResult.durationMs}ms</span>
                        <span className="text-slate-500">{activeExecutionResult.sizeBytes} B</span>
                      </div>
                    )}
                  </div>

                  <pre className="flex-1 bg-slate-950 border border-slate-800 rounded p-2.5 font-mono text-[11px] text-slate-200 overflow-auto">
                    {activeExecutionResult ? JSON.stringify(activeExecutionResult.responseBody, null, 2) : "// Awaiting send..."}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODULE 45: BROWSER DEVTOOLS & RUNTIME INSPECTOR              */}
        {/* ============================================================ */}
        {activeTab === "devtools" && (
          <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded overflow-hidden">
            {/* DevTools Subtab Navigation */}
            <div className="flex items-center justify-between border-b border-slate-800 px-3 py-1.5 bg-slate-950">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setDevtoolsSubTab("console")}
                  className={`px-2.5 py-1 rounded font-medium ${
                    devtoolsSubTab === "console" ? "bg-slate-800 text-amber-300" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Console ({devtoolsState.consoleLogs?.length || 0})
                </button>
                <button
                  onClick={() => setDevtoolsSubTab("network")}
                  className={`px-2.5 py-1 rounded font-medium ${
                    devtoolsSubTab === "network" ? "bg-slate-800 text-cyan-300" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Network ({devtoolsState.networkLogs?.length || 0})
                </button>
                <button
                  onClick={() => setDevtoolsSubTab("vitals")}
                  className={`px-2.5 py-1 rounded font-medium ${
                    devtoolsSubTab === "vitals" ? "bg-slate-800 text-emerald-300" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Web Vitals & Performance
                </button>
                <button
                  onClick={() => setDevtoolsSubTab("dom")}
                  className={`px-2.5 py-1 rounded font-medium ${
                    devtoolsSubTab === "dom" ? "bg-slate-800 text-indigo-300" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  DOM Tree
                </button>
                <button
                  onClick={() => setDevtoolsSubTab("storage")}
                  className={`px-2.5 py-1 rounded font-medium ${
                    devtoolsSubTab === "storage" ? "bg-slate-800 text-rose-300" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Storage
                </button>
              </div>

              <button
                onClick={handleAnalyzeRuntimeError}
                disabled={analyzingAi}
                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded font-medium flex items-center gap-1.5 text-[11px]"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-200" />
                <span>Analyze Errors with AI</span>
              </button>
            </div>

            {/* Subtab Contents */}
            <div className="flex-1 overflow-auto p-3">
              {/* CONSOLE */}
              {devtoolsSubTab === "console" && (
                <div className="space-y-1 font-mono text-[11px]">
                  {devtoolsState.consoleLogs?.length === 0 ? (
                    <div className="text-slate-500 py-6 text-center font-sans">No console logs captured yet.</div>
                  ) : (
                    devtoolsState.consoleLogs?.map((l: any, i: number) => (
                      <div
                        key={i}
                        className={`p-1.5 rounded flex items-start gap-2 border-b border-slate-900 ${
                          l.level === "error" ? "bg-rose-950/20 text-rose-300" :
                          l.level === "warn" ? "bg-amber-950/20 text-amber-300" :
                          "text-slate-300"
                        }`}
                      >
                        <span className="text-slate-500 text-[10px] shrink-0">{new Date(l.timestamp).toLocaleTimeString()}</span>
                        <span className="font-semibold shrink-0 uppercase text-[9px] px-1 py-0.5 rounded bg-slate-800">
                          {l.level}
                        </span>
                        <span className="flex-1">{l.message}</span>
                        {l.sourceFile && (
                          <span className="text-slate-500 text-[10px] shrink-0 underline cursor-pointer">
                            {l.sourceFile}:{l.lineNumber || 1}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* NETWORK */}
              {devtoolsSubTab === "network" && (
                <table className="w-full text-left font-mono text-[11px]">
                  <thead className="text-slate-500 border-b border-slate-800">
                    <tr>
                      <th className="py-1 px-2">Method</th>
                      <th className="py-1 px-2">URL</th>
                      <th className="py-1 px-2">Status</th>
                      <th className="py-1 px-2">Duration</th>
                      <th className="py-1 px-2">Initiator</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {devtoolsState.networkLogs?.map((n: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-800/30">
                        <td className="py-1.5 px-2 font-bold text-cyan-400">{n.method}</td>
                        <td className="py-1.5 px-2 text-slate-300 truncate max-w-sm">{n.url}</td>
                        <td className="py-1.5 px-2">
                          <span className={`px-1 rounded text-[10px] ${n.status < 400 ? "text-emerald-400" : "text-rose-400"}`}>
                            {n.status}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-slate-400">{n.durationMs}ms</td>
                        <td className="py-1.5 px-2 text-slate-500">{n.initiator}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* WEB VITALS */}
              {devtoolsSubTab === "vitals" && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded">
                    <span className="text-[10px] text-slate-400">Largest Contentful Paint (LCP)</span>
                    <div className="text-xl font-bold text-emerald-400 mt-1">{devtoolsState.vitals?.lcpMs} ms</div>
                    <span className="text-[10px] text-slate-500">Good (&lt; 2.5s)</span>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded">
                    <span className="text-[10px] text-slate-400">First Input Delay (FID)</span>
                    <div className="text-xl font-bold text-cyan-400 mt-1">{devtoolsState.vitals?.fidMs} ms</div>
                    <span className="text-[10px] text-slate-500">Good (&lt; 100ms)</span>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded">
                    <span className="text-[10px] text-slate-400">Cumulative Layout Shift (CLS)</span>
                    <div className="text-xl font-bold text-indigo-400 mt-1">{devtoolsState.vitals?.cls}</div>
                    <span className="text-[10px] text-slate-500">Good (&lt; 0.1)</span>
                  </div>
                </div>
              )}

              {/* DOM TREE */}
              {devtoolsSubTab === "dom" && (
                <div className="bg-slate-950 border border-slate-800 p-3 rounded font-mono text-[11px] text-indigo-300">
                  <pre>{JSON.stringify(devtoolsState.domTree || { root: "div#app", children: ["header", "main", "footer"] }, null, 2)}</pre>
                </div>
              )}

              {/* STORAGE */}
              {devtoolsSubTab === "storage" && (
                <div className="bg-slate-950 border border-slate-800 p-3 rounded font-mono text-[11px]">
                  <span className="font-semibold text-slate-400 block mb-1">localStorage</span>
                  <pre className="text-teal-300 mb-3">{JSON.stringify(devtoolsState.storage?.localStorage || {}, null, 2)}</pre>
                  <span className="font-semibold text-slate-400 block mb-1">Cookies</span>
                  <pre className="text-slate-300">{JSON.stringify(devtoolsState.storage?.cookies || {}, null, 2)}</pre>
                </div>
              )}

              {/* AI RUNTIME DIAGNOSTIC CARD */}
              {aiRuntimeAnalysis && (
                <div className="mt-4 p-3 bg-purple-950/40 border border-purple-500/40 rounded space-y-1.5 font-sans">
                  <div className="flex items-center gap-1.5 text-purple-300 font-semibold">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span>AI Runtime Diagnostic</span>
                  </div>
                  <div className="text-xs text-slate-200">{aiRuntimeAnalysis.summary}</div>
                  <div className="text-[11px] text-slate-300">{aiRuntimeAnalysis.rootCause}</div>
                  <div className="text-[10px] text-purple-200 bg-purple-950/80 p-2 rounded font-mono">
                    {aiRuntimeAnalysis.suggestedPatch}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CREATE COLLECTION MODAL */}
      {showCreateCollectionModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 w-96 space-y-3">
            <span className="font-semibold text-slate-200">New API Collection</span>
            <input
              type="text"
              placeholder="Collection Name (e.g. Auth & Users API)"
              value={newCollName}
              onChange={(e) => setNewCollName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-slate-200"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCreateCollectionModal(false)} className="px-3 py-1.5 text-slate-400 hover:text-slate-200">
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!newCollName) return;
                  await forgeProjectService.createApiCollection(projectId, { name: newCollName });
                  setShowCreateCollectionModal(false);
                  setNewCollName("");
                  loadTabContent();
                }}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE REQUEST MODAL */}
      {showCreateReqModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 w-96 space-y-3">
            <span className="font-semibold text-slate-200">Add API Test Request</span>
            <input
              type="text"
              placeholder="Request Name (e.g. Get User Profile)"
              value={newReqName}
              onChange={(e) => setNewReqName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-slate-200"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCreateReqModal(false)} className="px-3 py-1.5 text-slate-400 hover:text-slate-200">
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!newReqName || !selectedCollection) return;
                  await forgeProjectService.createApiRequest(projectId, selectedCollection.id, {
                    name: newReqName,
                    method: "GET",
                    url: "{{baseUrl}}/api/v1/health",
                  });
                  setShowCreateReqModal(false);
                  setNewReqName("");
                  loadCollectionRequests(selectedCollection.id);
                }}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium"
              >
                Add Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
