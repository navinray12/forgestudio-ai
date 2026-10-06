/**
 * ForgeStudio Modules 46–52: Application Runtime & Infrastructure Panel
 * Visual control center for Serverless Functions, Queues, Cron Scheduler,
 * Event Bus & Webhooks, Realtime Engine, Cache/KV Layer, and API Gateway.
 */

import React, { useState, useEffect } from "react";
import {
  Zap,
  Layers,
  Clock,
  Radio,
  Wifi,
  Database,
  Network,
  Play,
  RotateCw,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Code,
  ShieldCheck,
  Send,
  RefreshCw,
  FileText,
  Activity,
  ListFilter,
  Eye,
} from "lucide-react";
import { forgeProjectService } from "../services/forgeProjectService";

interface AppRuntimePanelProps {
  projectId: string;
}

type RuntimeTab = "functions" | "queues" | "scheduler" | "events" | "realtime" | "kv" | "gateway";

export const AppRuntimePanel: React.FC<AppRuntimePanelProps> = ({ projectId }) => {
  const [activeTab, setActiveTab] = useState<RuntimeTab>("functions");
  const [loading, setLoading] = useState(false);

  // Module 46: Functions State
  const [functions, setFunctions] = useState<any[]>([]);
  const [selectedFn, setSelectedFn] = useState<any>(null);
  const [fnCode, setFnCode] = useState(`exports.handler = async (payload, context) => {\n  console.log("Processing payload:", payload);\n  return { success: true, processedAt: new Date().toISOString() };\n};`);
  const [fnInvokePayload, setFnInvokePayload] = useState('{\n  "message": "Hello from Forge"\n}');
  const [fnInvokeResult, setFnInvokeResult] = useState<any>(null);
  const [showCreateFnModal, setShowCreateFnModal] = useState(false);
  const [newFnName, setNewFnName] = useState("");

  // Module 47: Queues State
  const [queues, setQueues] = useState<any[]>([]);
  const [selectedQueue, setSelectedQueue] = useState<any>(null);
  const [queueMetrics, setQueueMetrics] = useState<any>(null);
  const [queueJobs, setQueueJobs] = useState<any[]>([]);
  const [showCreateQueueModal, setShowCreateQueueModal] = useState(false);
  const [newQueueName, setNewQueueName] = useState("");

  // Module 48: Scheduler State
  const [schedules, setSchedules] = useState<any[]>([]);
  const [showCreateScheduleModal, setShowCreateScheduleModal] = useState(false);
  const [newScheduleName, setNewScheduleName] = useState("");
  const [newScheduleCron, setNewScheduleCron] = useState("*/15 * * * *");
  const [newScheduleTarget, setNewScheduleTarget] = useState("FUNCTION");
  const [newScheduleDest, setNewScheduleDest] = useState("");

  // Module 49: Events State
  const [topics, setTopics] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [publishEventPayload, setPublishEventPayload] = useState('{\n  "action": "user.signup",\n  "userId": "u_123"\n}');

  // Module 50: Realtime State
  const [channels, setChannels] = useState<any[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>("general");
  const [presenceList, setPresenceList] = useState<any[]>([]);
  const [broadcastEvent, setBroadcastEvent] = useState("message");
  const [broadcastData, setBroadcastData] = useState('{\n  "text": "Live broadcast update"\n}');

  // Module 51: KV State
  const [kvNamespaces, setKvNamespaces] = useState<any[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string>("");
  const [kvKeys, setKvKeys] = useState<any[]>([]);
  const [newKvKey, setNewKvKey] = useState("");
  const [newKvVal, setNewKvVal] = useState("");

  // Module 52: Gateway State
  const [gatewayRoutes, setGatewayRoutes] = useState<any[]>([]);
  const [schemas, setSchemas] = useState<any[]>([]);
  const [showCreateRouteModal, setShowCreateRouteModal] = useState(false);
  const [newRoutePath, setNewRoutePath] = useState("/api/v1/custom");
  const [newRouteMethod, setNewRouteMethod] = useState("GET");
  const [newRouteTarget, setNewRouteTarget] = useState("FUNCTION");
  const [newRouteDest, setNewRouteDest] = useState("");

  // Initial load
  useEffect(() => {
    loadTabContent();
  }, [projectId, activeTab]);

  const loadTabContent = async () => {
    try {
      setLoading(true);
      if (activeTab === "functions") {
        const res = await forgeProjectService.listRuntimeFunctions(projectId);
        setFunctions(res.functions || []);
        if (res.functions?.length > 0 && !selectedFn) {
          setSelectedFn(res.functions[0]);
          setFnCode(res.functions[0].code);
        }
      } else if (activeTab === "queues") {
        const res = await forgeProjectService.listTaskQueues(projectId);
        setQueues(res.queues || []);
        if (res.queues?.length > 0) {
          const q = res.queues[0];
          setSelectedQueue(q);
          loadQueueData(q.id);
        }
      } else if (activeTab === "scheduler") {
        const res = await forgeProjectService.listCronSchedules(projectId);
        setSchedules(res.schedules || []);
      } else if (activeTab === "events") {
        const [tRes, sRes] = await Promise.all([
          forgeProjectService.listEventTopics(projectId),
          forgeProjectService.listEventSubscriptions(projectId),
        ]);
        setTopics(tRes.topics || []);
        setSubscriptions(sRes.subscriptions || []);
      } else if (activeTab === "realtime") {
        const res = await forgeProjectService.listRealtimeChannels(projectId);
        setChannels(res.channels || []);
        if (res.channels?.length > 0) {
          setSelectedChannel(res.channels[0].name);
        }
      } else if (activeTab === "kv") {
        const res = await forgeProjectService.listKvNamespaces(projectId);
        setKvNamespaces(res.namespaces || []);
        if (res.namespaces?.length > 0) {
          setSelectedNamespace(res.namespaces[0].name);
          loadKvKeys(res.namespaces[0].name);
        }
      } else if (activeTab === "gateway") {
        const [rRes, sRes] = await Promise.all([
          forgeProjectService.listGatewayRoutes(projectId),
          forgeProjectService.listSchemas(projectId),
        ]);
        setGatewayRoutes(rRes.routes || []);
        setSchemas(sRes.schemas || []);
      }
    } catch (err) {
      console.error("Error loading runtime tab:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadQueueData = async (queueId: string) => {
    try {
      const [mRes, jRes] = await Promise.all([
        forgeProjectService.getQueueMetrics(projectId, queueId),
        forgeProjectService.listQueueJobs(projectId, queueId),
      ]);
      setQueueMetrics(mRes.metrics);
      setQueueJobs(jRes.jobs || []);
    } catch (err) {
      console.error("Error loading queue details:", err);
    }
  };

  const loadKvKeys = async (ns: string) => {
    try {
      const res = await forgeProjectService.listKvKeys(projectId, ns);
      setKvKeys(res.keys || []);
    } catch (err) {
      console.error("Error loading KV keys:", err);
    }
  };

  // Handlers
  const handleCreateFunction = async () => {
    if (!newFnName) return;
    try {
      const res = await forgeProjectService.createRuntimeFunction(projectId, {
        name: newFnName,
        code: fnCode,
        runtime: "nodejs20",
      });
      setShowCreateFnModal(false);
      setNewFnName("");
      loadTabContent();
    } catch (err: any) {
      alert(`Error creating function: ${err.message}`);
    }
  };

  const handleInvokeFunction = async () => {
    if (!selectedFn) return;
    try {
      let parsed = {};
      try { parsed = JSON.parse(fnInvokePayload); } catch {}
      const res = await forgeProjectService.invokeRuntimeFunction(projectId, selectedFn.id, parsed);
      setFnInvokeResult(res.result);
    } catch (err: any) {
      alert(`Error invoking function: ${err.message}`);
    }
  };

  const handleCreateQueue = async () => {
    if (!newQueueName) return;
    try {
      await forgeProjectService.createTaskQueue(projectId, { name: newQueueName });
      setShowCreateQueueModal(false);
      setNewQueueName("");
      loadTabContent();
    } catch (err: any) {
      alert(`Error creating queue: ${err.message}`);
    }
  };

  const handleCreateSchedule = async () => {
    if (!newScheduleName || !newScheduleDest) return;
    try {
      await forgeProjectService.createCronSchedule(projectId, {
        name: newScheduleName,
        cronExpression: newScheduleCron,
        targetType: newScheduleTarget,
        targetDestination: newScheduleDest,
      });
      setShowCreateScheduleModal(false);
      setNewScheduleName("");
      setNewScheduleDest("");
      loadTabContent();
    } catch (err: any) {
      alert(`Error creating schedule: ${err.message}`);
    }
  };

  const handleTriggerSchedule = async (scheduleId: string) => {
    try {
      const res = await forgeProjectService.triggerCronSchedule(projectId, scheduleId);
      alert(`Schedule triggered! Status: ${res.execution?.status} (${res.execution?.durationMs}ms)`);
    } catch (err: any) {
      alert(`Error triggering schedule: ${err.message}`);
    }
  };

  const handleCreateRoute = async () => {
    if (!newRoutePath || !newRouteDest) return;
    try {
      await forgeProjectService.createGatewayRoute(projectId, {
        path: newRoutePath,
        method: newRouteMethod,
        targetType: newRouteTarget,
        targetDestination: newRouteDest,
      });
      setShowCreateRouteModal(false);
      setNewRoutePath("/api/v1/custom");
      setNewRouteDest("");
      loadTabContent();
    } catch (err: any) {
      alert(`Error creating route: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 font-sans text-xs">
      {/* Top Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2 bg-slate-900/60">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("functions")}
            className={`px-3 py-1.5 rounded font-medium flex items-center gap-1.5 transition ${
              activeTab === "functions" ? "bg-amber-600/30 text-amber-300 border border-amber-500/40" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Functions</span>
          </button>

          <button
            onClick={() => setActiveTab("queues")}
            className={`px-3 py-1.5 rounded font-medium flex items-center gap-1.5 transition ${
              activeTab === "queues" ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Queues & Jobs</span>
          </button>

          <button
            onClick={() => setActiveTab("scheduler")}
            className={`px-3 py-1.5 rounded font-medium flex items-center gap-1.5 transition ${
              activeTab === "scheduler" ? "bg-cyan-600/30 text-cyan-300 border border-cyan-500/40" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Scheduler</span>
          </button>

          <button
            onClick={() => setActiveTab("events")}
            className={`px-3 py-1.5 rounded font-medium flex items-center gap-1.5 transition ${
              activeTab === "events" ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/40" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span>Event Bus</span>
          </button>

          <button
            onClick={() => setActiveTab("realtime")}
            className={`px-3 py-1.5 rounded font-medium flex items-center gap-1.5 transition ${
              activeTab === "realtime" ? "bg-rose-600/30 text-rose-300 border border-rose-500/40" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Wifi className="w-3.5 h-3.5 text-rose-400" />
            <span>Realtime</span>
          </button>

          <button
            onClick={() => setActiveTab("kv")}
            className={`px-3 py-1.5 rounded font-medium flex items-center gap-1.5 transition ${
              activeTab === "kv" ? "bg-teal-600/30 text-teal-300 border border-teal-500/40" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Database className="w-3.5 h-3.5 text-teal-400" />
            <span>Cache / KV</span>
          </button>

          <button
            onClick={() => setActiveTab("gateway")}
            className={`px-3 py-1.5 rounded font-medium flex items-center gap-1.5 transition ${
              activeTab === "gateway" ? "bg-purple-600/30 text-purple-300 border border-purple-500/40" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Network className="w-3.5 h-3.5 text-purple-400" />
            <span>API Gateway</span>
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
        {/* TAB 1: FUNCTIONS */}
        {activeTab === "functions" && (
          <div className="grid grid-cols-12 gap-4 h-full">
            <div className="col-span-4 bg-slate-900 border border-slate-800 rounded p-3 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-slate-300">Serverless Functions</span>
                <button
                  onClick={() => setShowCreateFnModal(true)}
                  className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-medium flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> New Function
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2">
                {functions.length === 0 ? (
                  <div className="text-slate-500 py-6 text-center">No functions deployed yet.</div>
                ) : (
                  functions.map((fn) => (
                    <div
                      key={fn.id}
                      onClick={() => { setSelectedFn(fn); setFnCode(fn.code); }}
                      className={`p-2.5 rounded border cursor-pointer transition ${
                        selectedFn?.id === fn.id
                          ? "bg-amber-950/30 border-amber-500/40 text-amber-200"
                          : "bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span>{fn.name}</span>
                        <span className="text-[10px] bg-emerald-950 border border-emerald-500/30 text-emerald-400 px-1.5 py-0.5 rounded">
                          {fn.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        Runtime: {fn.runtime} • Timeout: {fn.timeoutMs}ms
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="col-span-8 bg-slate-900 border border-slate-800 rounded p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Code className="w-4 h-4 text-amber-400" />
                  <span className="font-semibold">{selectedFn ? selectedFn.name : "Function Code & Sandbox"}</span>
                </div>
                <button
                  onClick={handleInvokeFunction}
                  disabled={!selectedFn}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded font-medium flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" /> Run Sandbox
                </button>
              </div>

              <textarea
                value={fnCode}
                onChange={(e) => setFnCode(e.target.value)}
                className="w-full h-44 bg-slate-950 font-mono text-[11px] p-2.5 rounded border border-slate-800 text-amber-300 focus:outline-none"
                placeholder="exports.handler = async (payload, context) => { ... }"
              />

              <div className="grid grid-cols-2 gap-3 mt-3 flex-1">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 font-semibold mb-1">Payload JSON</span>
                  <textarea
                    value={fnInvokePayload}
                    onChange={(e) => setFnInvokePayload(e.target.value)}
                    className="flex-1 bg-slate-950 font-mono text-[11px] p-2 rounded border border-slate-800 text-slate-300 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 font-semibold mb-1">Output Response</span>
                  <pre className="flex-1 bg-slate-950 font-mono text-[11px] p-2 rounded border border-slate-800 text-emerald-400 overflow-auto">
                    {fnInvokeResult ? JSON.stringify(fnInvokeResult, null, 2) : "// Awaiting execution..."}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: QUEUES */}
        {activeTab === "queues" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Durable Task Queues</span>
                {selectedQueue && (
                  <span className="text-[11px] text-indigo-400 font-mono">({selectedQueue.name})</span>
                )}
              </div>
              <button
                onClick={() => setShowCreateQueueModal(true)}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Create Queue
              </button>
            </div>

            {queueMetrics && (
              <div className="grid grid-cols-5 gap-3">
                <div className="bg-slate-900 border border-slate-800 p-2.5 rounded">
                  <div className="text-[10px] text-slate-400">Queued</div>
                  <div className="text-base font-bold text-amber-400">{queueMetrics.queued}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-2.5 rounded">
                  <div className="text-[10px] text-slate-400">Processing</div>
                  <div className="text-base font-bold text-cyan-400">{queueMetrics.processing}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-2.5 rounded">
                  <div className="text-[10px] text-slate-400">Completed</div>
                  <div className="text-base font-bold text-emerald-400">{queueMetrics.completed}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-2.5 rounded">
                  <div className="text-[10px] text-slate-400">Failed</div>
                  <div className="text-base font-bold text-rose-400">{queueMetrics.failed}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-2.5 rounded">
                  <div className="text-[10px] text-slate-400">Dead Letter (DLQ)</div>
                  <div className="text-base font-bold text-purple-400">{queueMetrics.deadLetter}</div>
                </div>
              </div>
            )}

            <div className="bg-slate-900 border border-slate-800 rounded overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-800/60 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-3">Job ID</th>
                    <th className="py-2 px-3">Name</th>
                    <th className="py-2 px-3">Priority</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Attempts</th>
                    <th className="py-2 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {queueJobs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">
                        No jobs currently in queue.
                      </td>
                    </tr>
                  ) : (
                    queueJobs.map((j) => (
                      <tr key={j.id} className="hover:bg-slate-800/30">
                        <td className="py-2 px-3 text-slate-400">{j.id.slice(0, 8)}...</td>
                        <td className="py-2 px-3 font-semibold text-slate-200">{j.name}</td>
                        <td className="py-2 px-3 text-cyan-400">{j.priority}</td>
                        <td className="py-2 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                            j.status === "COMPLETED" ? "bg-emerald-950 text-emerald-400" :
                            j.status === "FAILED" ? "bg-rose-950 text-rose-400" :
                            j.status === "DEAD_LETTER" ? "bg-purple-950 text-purple-400" :
                            "bg-amber-950 text-amber-400"
                          }`}>
                            {j.status}
                          </span>
                        </td>
                        <td className="py-2 px-3">{j.attempts}/{j.maxAttempts}</td>
                        <td className="py-2 px-3">
                          {j.status === "DEAD_LETTER" && (
                            <button
                              onClick={async () => {
                                await forgeProjectService.replayDlqJob(projectId, j.queueId, j.id);
                                loadQueueData(j.queueId);
                              }}
                              className="px-2 py-0.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-[10px]"
                            >
                              Replay DLQ
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: SCHEDULER */}
        {activeTab === "scheduler" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Cron Schedules & Automated Timers</span>
              <button
                onClick={() => setShowCreateScheduleModal(true)}
                className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> New Cron Schedule
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {schedules.map((sch) => (
                <div key={sch.id} className="bg-slate-900 border border-slate-800 rounded p-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-200">{sch.name}</span>
                      <span className="bg-cyan-950 border border-cyan-500/30 text-cyan-400 px-1.5 py-0.5 rounded text-[10px] font-mono">
                        {sch.cronExpression}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mb-2">
                      Target: <span className="text-slate-300 font-mono">{sch.targetType} → {sch.targetDestination}</span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Next Run: {sch.nextRunAt ? new Date(sch.nextRunAt).toLocaleTimeString() : "Pending"}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800">
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Active
                    </span>
                    <button
                      onClick={() => handleTriggerSchedule(sch.id)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded text-[10px] font-medium flex items-center gap-1"
                    >
                      <Play className="w-3 h-3" /> Trigger Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: EVENT BUS */}
        {activeTab === "events" && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded p-3">
              <span className="font-semibold text-slate-200 mb-2 block">Event Topics ({topics.length})</span>
              <div className="space-y-2">
                {topics.map((t) => (
                  <div key={t.id} className="p-2 bg-slate-950 border border-slate-800 rounded flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-emerald-400">{t.name}</div>
                      <div className="text-[10px] text-slate-500">{t.description || "Project Event Stream"}</div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{new Date(t.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded p-3">
              <span className="font-semibold text-slate-200 mb-2 block">Active Subscriptions ({subscriptions.length})</span>
              <div className="space-y-2">
                {subscriptions.map((s) => (
                  <div key={s.id} className="p-2 bg-slate-950 border border-slate-800 rounded flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-300">{s.name}</div>
                      <div className="text-[10px] text-cyan-400 font-mono">{s.destinationType}</div>
                    </div>
                    <span className="text-[10px] bg-emerald-950 text-emerald-400 px-1.5 py-0.5 rounded">Active</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: REALTIME */}
        {activeTab === "realtime" && (
          <div className="grid grid-cols-2 gap-4 h-full">
            <div className="bg-slate-900 border border-slate-800 rounded p-3 flex flex-col">
              <span className="font-semibold text-slate-200 mb-2">Realtime Channels</span>
              <div className="space-y-2 flex-1">
                {channels.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => setSelectedChannel(c.name)}
                    className={`p-2.5 rounded border cursor-pointer ${
                      selectedChannel === c.name ? "bg-rose-950/30 border-rose-500/40 text-rose-300" : "bg-slate-950 border-slate-800"
                    }`}
                  >
                    <div className="font-semibold">#{c.name}</div>
                    <div className="text-[10px] text-slate-500">Policy: {c.authPolicy}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded p-3 flex flex-col">
              <span className="font-semibold text-slate-200 mb-2">Broadcast Message to #{selectedChannel}</span>
              <input
                type="text"
                value={broadcastEvent}
                onChange={(e) => setBroadcastEvent(e.target.value)}
                placeholder="Event Name"
                className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 font-mono mb-2"
              />
              <textarea
                value={broadcastData}
                onChange={(e) => setBroadcastData(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded p-2 text-rose-300 font-mono mb-2"
              />
              <button
                onClick={async () => {
                  let d = {};
                  try { d = JSON.parse(broadcastData); } catch {}
                  await forgeProjectService.broadcastRealtimeMessage(projectId, selectedChannel, { event: broadcastEvent, data: d });
                  alert("Message broadcasted!");
                }}
                className="py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" /> Broadcast Now
              </button>
            </div>
          </div>
        )}

        {/* TAB 6: CACHE / KV */}
        {activeTab === "kv" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Namespaced Key-Value Store</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Key"
                  value={newKvKey}
                  onChange={(e) => setNewKvKey(e.target.value)}
                  className="bg-slate-900 border border-slate-800 px-2 py-1 rounded text-slate-200"
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={newKvVal}
                  onChange={(e) => setNewKvVal(e.target.value)}
                  className="bg-slate-900 border border-slate-800 px-2 py-1 rounded text-slate-200"
                />
                <button
                  onClick={async () => {
                    if (!newKvKey || !selectedNamespace) return;
                    await forgeProjectService.setKvKey(projectId, selectedNamespace, newKvKey, { value: newKvVal });
                    setNewKvKey("");
                    setNewKvVal("");
                    loadKvKeys(selectedNamespace);
                  }}
                  className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded font-medium"
                >
                  Set Key
                </button>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded overflow-hidden">
              <table className="w-full text-left font-mono text-[11px]">
                <thead className="bg-slate-800/60 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-3">Key</th>
                    <th className="py-2 px-3">Value</th>
                    <th className="py-2 px-3">Tags</th>
                    <th className="py-2 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {kvKeys.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-500">
                        No keys set in this namespace.
                      </td>
                    </tr>
                  ) : (
                    kvKeys.map((k) => (
                      <tr key={k.id} className="hover:bg-slate-800/30">
                        <td className="py-2 px-3 text-teal-300 font-semibold">{k.key}</td>
                        <td className="py-2 px-3 text-slate-300 truncate max-w-xs">{JSON.stringify(k.value)}</td>
                        <td className="py-2 px-3 text-slate-400">{(k.tags || []).join(", ") || "-"}</td>
                        <td className="py-2 px-3">
                          <button
                            onClick={async () => {
                              await forgeProjectService.deleteKvKey(projectId, selectedNamespace, k.key);
                              loadKvKeys(selectedNamespace);
                            }}
                            className="p-1 text-slate-500 hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 7: API GATEWAY */}
        {activeTab === "gateway" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Configured API Gateway Routes</span>
              <button
                onClick={() => setShowCreateRouteModal(true)}
                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded font-medium flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> New Route
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded overflow-hidden">
              <table className="w-full text-left font-mono text-[11px]">
                <thead className="bg-slate-800/60 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-3">Method</th>
                    <th className="py-2 px-3">Path</th>
                    <th className="py-2 px-3">Target</th>
                    <th className="py-2 px-3">Rate Limit</th>
                    <th className="py-2 px-3">Auth</th>
                    <th className="py-2 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {gatewayRoutes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">
                        No custom gateway routes configured.
                      </td>
                    </tr>
                  ) : (
                    gatewayRoutes.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-800/30">
                        <td className="py-2 px-3 text-purple-400 font-bold">{r.method}</td>
                        <td className="py-2 px-3 text-slate-200">{r.path}</td>
                        <td className="py-2 px-3 text-slate-400">{r.targetType}: {r.targetDestination}</td>
                        <td className="py-2 px-3 text-slate-400">{r.rateLimitPerMin}/min</td>
                        <td className="py-2 px-3">{r.requireAuth ? "Required" : "Public"}</td>
                        <td className="py-2 px-3">
                          <button
                            onClick={async () => {
                              await forgeProjectService.deleteGatewayRoute(projectId, r.id);
                              loadTabContent();
                            }}
                            className="p-1 text-slate-500 hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* CREATE FUNCTION MODAL */}
      {showCreateFnModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 w-96 space-y-3">
            <span className="font-semibold text-slate-200">Create Serverless Function</span>
            <input
              type="text"
              placeholder="Function Name (e.g. auth-hook)"
              value={newFnName}
              onChange={(e) => setNewFnName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-slate-200"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCreateFnModal(false)}
                className="px-3 py-1.5 text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFunction}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded font-medium"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE QUEUE MODAL */}
      {showCreateQueueModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 w-96 space-y-3">
            <span className="font-semibold text-slate-200">Create Task Queue</span>
            <input
              type="text"
              placeholder="Queue Name (e.g. email-notifications)"
              value={newQueueName}
              onChange={(e) => setNewQueueName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-slate-200"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCreateQueueModal(false)}
                className="px-3 py-1.5 text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateQueue}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE SCHEDULE MODAL */}
      {showCreateScheduleModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 w-96 space-y-3">
            <span className="font-semibold text-slate-200">Create Cron Schedule</span>
            <input
              type="text"
              placeholder="Schedule Name"
              value={newScheduleName}
              onChange={(e) => setNewScheduleName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-slate-200"
            />
            <input
              type="text"
              placeholder="Cron Expression (* * * * *)"
              value={newScheduleCron}
              onChange={(e) => setNewScheduleCron(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-slate-200 font-mono"
            />
            <select
              value={newScheduleTarget}
              onChange={(e) => setNewScheduleTarget(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-slate-200"
            >
              <option value="FUNCTION">Target: Function</option>
              <option value="QUEUE_JOB">Target: Queue Job</option>
              <option value="WEBHOOK">Target: Webhook</option>
            </select>
            <input
              type="text"
              placeholder="Target Destination Name / URL"
              value={newScheduleDest}
              onChange={(e) => setNewScheduleDest(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-slate-200"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCreateScheduleModal(false)}
                className="px-3 py-1.5 text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSchedule}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium"
              >
                Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE ROUTE MODAL */}
      {showCreateRouteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 w-96 space-y-3">
            <span className="font-semibold text-slate-200">Create Gateway Route</span>
            <input
              type="text"
              placeholder="Path (e.g. /api/v1/checkout)"
              value={newRoutePath}
              onChange={(e) => setNewRoutePath(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-slate-200"
            />
            <select
              value={newRouteMethod}
              onChange={(e) => setNewRouteMethod(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-slate-200"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
              <option value="*">* (All Methods)</option>
            </select>
            <select
              value={newRouteTarget}
              onChange={(e) => setNewRouteTarget(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-slate-200"
            >
              <option value="FUNCTION">Target: Function</option>
              <option value="DATA_API">Target: Data API</option>
              <option value="STATIC">Target: Static JSON</option>
              <option value="PROXY">Target: HTTP Proxy</option>
            </select>
            <input
              type="text"
              placeholder="Destination Function Name or URL"
              value={newRouteDest}
              onChange={(e) => setNewRouteDest(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-slate-200"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCreateRouteModal(false)}
                className="px-3 py-1.5 text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRoute}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded font-medium"
              >
                Create Route
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
