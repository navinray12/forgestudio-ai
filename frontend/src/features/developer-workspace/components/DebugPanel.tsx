import React, { useState, useEffect } from "react";
import {
  Bug,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Sparkles,
  Layers,
  Eye,
  CheckCircle,
  Radio,
  Plus,
  Trash2,
} from "lucide-react";
import { forgeProjectService } from "../services/forgeProjectService";

interface DebugPanelProps {
  projectId: string;
  onJumpToSource?: (file: string, line: number) => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ projectId, onJumpToSource }) => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [watchInput, setWatchInput] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);

  const handleStartDebug = async () => {
    try {
      setLoading(true);
      const res = await forgeProjectService.startDebugSession(projectId, "fullstack");
      setSession(res.session);
    } catch (err: any) {
      alert(`Debug session failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStepOver = async () => {
    if (!session) return;
    try {
      const res = await forgeProjectService.stepDebug(projectId, session.id);
      setSession({ ...session, ...res.session });
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleAddWatch = () => {
    if (!watchInput.trim() || !session) return;
    const newWatch = { id: `w_${Date.now()}`, expression: watchInput.trim(), result: `42` };
    setSession({
      ...session,
      watchExpressions: [...(session.watchExpressions || []), newWatch],
    });
    setWatchInput("");
  };

  const handleAskAiDebug = async () => {
    if (!session) return;
    try {
      const res = await forgeProjectService.askAiDebug(projectId, session.id, {
        errorMessage: "TypeError: Cannot read properties of undefined (reading 'title')",
        sourceFile: session.currentFrame?.file || "src/App.tsx",
        line: session.currentFrame?.line || 12,
      });
      setAiAnalysis(res);
    } catch (err: any) {
      alert(`AI Debug failed: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 overflow-hidden font-sans select-none">
      {/* Top Header & Step Controls */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-purple-400" />
          <span className="font-bold text-slate-100">Debugging & Diagnostics</span>
          {session && (
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                session.status === "PAUSED"
                  ? "bg-amber-950 text-amber-400 border border-amber-900"
                  : "bg-emerald-950 text-emerald-400 border border-emerald-900"
              }`}
            >
              {session.status}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {!session ? (
            <button
              onClick={handleStartDebug}
              disabled={loading}
              className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-sm transition cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Start Debugger</span>
            </button>
          ) : (
            <>
              <button
                onClick={handleStepOver}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                title="Step Over (F10)"
              >
                <SkipForward className="w-3.5 h-3.5 text-blue-400" />
                <span>Step Over</span>
              </button>

              <button
                onClick={handleAskAiDebug}
                className="px-2.5 py-1 bg-purple-950/80 hover:bg-purple-900 text-purple-300 border border-purple-800 rounded text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                title="Ask AI to investigate active breakpoint / exception"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Ask AI to Debug</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* AI Debug Suggestion Overlay */}
      {aiAnalysis && (
        <div className="p-3 bg-purple-950/40 border-b border-purple-900/60 text-xs space-y-2">
          <div className="flex items-center justify-between text-purple-300 font-bold">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
              <span>{aiAnalysis.analysis}</span>
            </span>
            <button onClick={() => setAiAnalysis(null)} className="text-purple-400 hover:text-purple-200">
              &times;
            </button>
          </div>
          <p className="text-slate-300 leading-relaxed">{aiAnalysis.rootCause}</p>
          {aiAnalysis.suggestedPatch && (
            <div className="bg-slate-950 p-2.5 rounded border border-purple-900 font-mono text-[11px] space-y-1">
              <div className="text-slate-500 font-bold">Suggested Fix ({aiAnalysis.suggestedPatch.file}):</div>
              <div className="text-rose-400 line-through">{aiAnalysis.suggestedPatch.originalCode}</div>
              <div className="text-emerald-400 font-semibold">{aiAnalysis.suggestedPatch.replacementCode}</div>
            </div>
          )}
        </div>
      )}

      {/* Main Debug Workspace: 3 Columns (Call Stack, Variables, Watch) */}
      {session ? (
        <div className="flex-1 grid grid-cols-3 divide-x divide-slate-800 overflow-hidden text-xs">
          {/* 1. Call Stack */}
          <div className="flex flex-col bg-slate-950 overflow-hidden">
            <div className="p-2.5 bg-slate-900/50 border-b border-slate-800 font-semibold text-slate-400 text-[11px] uppercase tracking-wider">
              Call Stack
            </div>
            <div className="flex-1 p-2 space-y-1 overflow-y-auto font-mono">
              {(session.callStack || []).map((frame: any) => (
                <div
                  key={frame.id}
                  onClick={() => onJumpToSource?.(frame.file, frame.line)}
                  className="p-1.5 rounded hover:bg-slate-800/80 cursor-pointer flex items-center justify-between text-slate-300 group"
                >
                  <span className="font-semibold text-blue-400 group-hover:text-blue-300">
                    {frame.functionName}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {frame.file}:{frame.line}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Variables & Scopes */}
          <div className="flex flex-col bg-slate-950 overflow-hidden">
            <div className="p-2.5 bg-slate-900/50 border-b border-slate-800 font-semibold text-slate-400 text-[11px] uppercase tracking-wider">
              Scope Variables
            </div>
            <div className="flex-1 p-2 space-y-1 overflow-y-auto font-mono">
              {(session.variables || []).map((v: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-1 text-slate-300">
                  <span className="text-purple-300">{v.name}:</span>
                  <span
                    className={
                      v.isSensitive
                        ? "text-slate-500 italic"
                        : v.type === "number"
                        ? "text-cyan-400"
                        : "text-amber-300"
                    }
                  >
                    {v.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Watch Expressions */}
          <div className="flex flex-col bg-slate-950 overflow-hidden">
            <div className="p-2.5 bg-slate-900/50 border-b border-slate-800 font-semibold text-slate-400 text-[11px] uppercase tracking-wider flex items-center justify-between">
              <span>Watch Expressions</span>
            </div>
            <div className="p-2 border-b border-slate-800">
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={watchInput}
                  onChange={(e) => setWatchInput(e.target.value)}
                  placeholder="e.g. state.count"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none"
                />
                <button
                  onClick={handleAddWatch}
                  className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="flex-1 p-2 space-y-1 overflow-y-auto font-mono">
              {(session.watchExpressions || []).map((w: any) => (
                <div key={w.id} className="flex items-center justify-between p-1 text-slate-300">
                  <span className="text-slate-400">{w.expression}:</span>
                  <span className="text-emerald-400 font-semibold">{w.result}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs">
          <Bug className="w-8 h-8 opacity-40 mb-2 text-purple-400" />
          <p>Debugger is idle. Click &quot;Start Debugger&quot; to inspect call stack, scopes, and variables.</p>
        </div>
      )}
    </div>
  );
};
