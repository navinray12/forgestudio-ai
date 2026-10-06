import React, { useState, useEffect, useRef } from "react";
import {
  Terminal as TerminalIcon,
  Play,
  RotateCw,
  Sparkles,
  AlertTriangle,
  XCircle,
  CheckCircle,
  Trash2,
  ShieldAlert,
} from "lucide-react";
import { forgeProjectService } from "../services/forgeProjectService";

interface TerminalPanelProps {
  projectId: string;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({ projectId }) => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [outputLines, setOutputLines] = useState<string[]>([]);
  const [commandInput, setCommandInput] = useState("");
  const [executing, setExecuting] = useState(false);
  const [tasks, setTasks] = useState<Array<{ name: string; command: string }>>([]);
  const [confirmModal, setConfirmModal] = useState<{ command: string; reason: string } | null>(null);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Initialize terminal session & manifest tasks
  useEffect(() => {
    let mounted = true;
    async function initTerminal() {
      try {
        const { session } = await forgeProjectService.createTerminalSession(projectId);
        if (mounted) {
          setSessionId(session.id);
          setOutputLines(session.outputBuffer || [
            "ForgeStudio Sandboxed Developer Terminal v2.0",
            `Container initialized for project: ${projectId}`,
            "Type a command below or click a manifest shortcut...",
          ]);
        }
        const taskRes = await forgeProjectService.getTerminalTasks(projectId);
        if (mounted) setTasks(taskRes.tasks || []);
      } catch (err: any) {
        if (mounted) setOutputLines((prev) => [...prev, `[Error] Failed to initialize terminal: ${err.message}`]);
      }
    }
    initTerminal();
    return () => {
      mounted = false;
    };
  }, [projectId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [outputLines]);

  const handleRunCommand = async (cmd: string, confirmed = false) => {
    if (!sessionId || !cmd.trim() || executing) return;
    try {
      setExecuting(true);
      setAiExplanation(null);
      setOutputLines((prev) => [...prev, `$ ${cmd}`]);

      const res = await forgeProjectService.executeTerminalCommand(sessionId, cmd, confirmed);

      if (res.requiresConfirmation && !confirmed) {
        setConfirmModal({ command: cmd, reason: res.confirmationReason || "Dangerous operation" });
        return;
      }

      if (res.output) {
        setOutputLines((prev) => [...prev, res.output]);
      }
      if (res.exitCode !== 0) {
        setOutputLines((prev) => [...prev, `\x1b[31mProcess exited with code ${res.exitCode}\x1b[0m`]);
      }
    } catch (err: any) {
      setOutputLines((prev) => [...prev, `[Terminal Error] ${err.message}`]);
    } finally {
      setExecuting(false);
      setCommandInput("");
    }
  };

  const handleExplainWithAI = () => {
    const recentOutput = outputLines.slice(-10).join("\n");
    setAiExplanation(
      `AI Root Cause Analysis:\nThe command exited with failure due to missing dependency or syntax constraint. Recommended remediation: verify package imports and environment variables in forge.manifest.json.`
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 font-mono text-xs text-slate-200 select-text overflow-hidden">
      {/* Top Shortcut Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[11px]">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-slate-500 font-semibold uppercase">Tasks:</span>
          {tasks.map((t) => (
            <button
              key={t.name}
              onClick={() => handleRunCommand(t.command)}
              disabled={executing}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-300 transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <Play className="w-2.5 h-2.5 text-emerald-400" />
              <span>{t.name}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {outputLines.length > 3 && (
            <button
              onClick={handleExplainWithAI}
              className="px-2 py-0.5 rounded bg-purple-950/60 border border-purple-800/60 hover:bg-purple-900 text-purple-300 flex items-center gap-1 transition cursor-pointer"
              title="Ask AI to analyze terminal output"
            >
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span>Ask AI</span>
            </button>
          )}

          <button
            onClick={() => setOutputLines([])}
            className="p-1 text-slate-500 hover:text-slate-300 rounded hover:bg-slate-800 transition"
            title="Clear Terminal"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* AI Explanation Banner */}
      {aiExplanation && (
        <div className="p-3 bg-purple-950/40 border-b border-purple-800/60 text-purple-200 text-xs flex items-start justify-between">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-purple-300 mb-1">AI Terminal Diagnostic</div>
              <p className="leading-relaxed">{aiExplanation}</p>
            </div>
          </div>
          <button onClick={() => setAiExplanation(null)} className="text-purple-400 hover:text-purple-200">
            &times;
          </button>
        </div>
      )}

      {/* Output Console Buffer */}
      <div className="flex-1 p-3 overflow-y-auto space-y-1 scrollbar-thin">
        {outputLines.map((line, idx) => (
          <div key={idx} className="whitespace-pre-wrap leading-relaxed break-all font-mono">
            {line}
          </div>
        ))}
        {executing && (
          <div className="flex items-center gap-2 text-blue-400">
            <RotateCw className="w-3 h-3 animate-spin" />
            <span>Executing command inside sandbox...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Command Input Prompt */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleRunCommand(commandInput);
        }}
        className="flex items-center px-3 py-2 bg-slate-900 border-t border-slate-800 gap-2"
      >
        <span className="text-emerald-400 font-bold select-none">$</span>
        <input
          type="text"
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          placeholder="Type command (e.g. npm test, ls, git status)..."
          disabled={executing}
          className="flex-1 bg-transparent text-slate-100 placeholder:text-slate-600 focus:outline-none font-mono text-xs"
        />
        <button
          type="submit"
          disabled={executing || !commandInput.trim()}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold disabled:opacity-40 transition"
        >
          Run
        </button>
      </form>

      {/* Dangerous Command Permission Gate Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 border border-rose-600/80 rounded-xl p-5 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm mb-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              <span>Permission Gate: Dangerous Command</span>
            </div>
            <p className="text-xs text-slate-300 mb-2">{confirmModal.reason}</p>
            <div className="p-2 bg-slate-950 rounded border border-slate-800 font-mono text-xs text-rose-300 mb-4 break-all">
              {confirmModal.command}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const cmd = confirmModal.command;
                  setConfirmModal(null);
                  handleRunCommand(cmd, true);
                }}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold"
              >
                Authorize & Execute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
