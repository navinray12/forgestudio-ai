import React, { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, LayoutTemplate, RefreshCw, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { developerPlatformService, type AppGenerationRun } from "../services/developerPlatformService";

interface AppGenerationPanelProps {
  projectId: string;
  onLog?: (message: string, type?: "info" | "success" | "warn" | "error") => void;
}

const ACTIVE = new Set(["QUEUED", "PLANNING", "GENERATING_SOURCE", "WRITING_SOURCE"]);

const STATUS_LABEL: Record<AppGenerationRun["status"], string> = {
  QUEUED: "Queued",
  PLANNING: "Planning the data model",
  GENERATING_SOURCE: "Generating and checking source",
  WRITING_SOURCE: "Writing files",
  SOURCE_WRITTEN: "Source written (not built or deployed)",
  FAILED: "Failed",
};

/**
 * Generates application source from requirements (AI provider) or an approved template. Status is
 * read from the server's durable run record, so it survives reloads and never claims more than the
 * pipeline actually did.
 */
export const AppGenerationPanel: React.FC<AppGenerationPanelProps> = ({ projectId, onLog }) => {
  const [mode, setMode] = useState<"AI_PROVIDER" | "APPROVED_TEMPLATE">("AI_PROVIDER");
  const [brief, setBrief] = useState("");
  const [templates, setTemplates] = useState<Array<{ id: string; applicationName: string; entities: string[] }>>([]);
  const [templateId, setTemplateId] = useState("");
  const [runs, setRuns] = useState<AppGenerationRun[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await developerPlatformService.listAppGenerations(projectId);
      setRuns(res.runs);
      return res.runs;
    } catch (err: any) {
      setError(err.message);
      return [];
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
    developerPlatformService
      .listAppGenerationTemplates(projectId)
      .then((res) => {
        setTemplates(res.templates);
        setTemplateId((current) => current || res.templates[0]?.id || "");
      })
      .catch(() => setTemplates([]));
  }, [projectId, refresh]);

  // Poll while a run is in progress.
  useEffect(() => {
    if (!runs.some((r) => ACTIVE.has(r.status))) return;
    pollTimer.current = window.setTimeout(() => void refresh(), 2000);
    return () => {
      if (pollTimer.current) window.clearTimeout(pollTimer.current);
    };
  }, [runs, refresh]);

  const start = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const input = mode === "AI_PROVIDER" ? { mode, brief } as const : { mode, templateId } as const;
      const { run } = await developerPlatformService.startAppGeneration(projectId, input, crypto.randomUUID());
      onLog?.(`Application generation started (${run.mode === "AI_PROVIDER" ? "AI provider" : "template"})`, "info");
      await refresh();
    } catch (err: any) {
      setError(err.message);
      onLog?.(`Application generation could not start: ${err.message}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const retry = async (runId: string) => {
    setError(null);
    try {
      await developerPlatformService.retryAppGeneration(projectId, runId);
      await refresh();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const busy = submitting || runs.some((r) => ACTIVE.has(r.status));
  const canStart = mode === "AI_PROVIDER" ? brief.trim().length >= 10 : Boolean(templateId);

  return (
    <div className="space-y-4">
      <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-4 space-y-3">
        <div className="flex gap-2">
          <button
            onClick={() => setMode("AI_PROVIDER")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${mode === "AI_PROVIDER" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200 bg-slate-800"}`}
          >
            <Sparkles className="w-3.5 h-3.5" /> From requirements (AI)
          </button>
          <button
            onClick={() => setMode("APPROVED_TEMPLATE")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${mode === "APPROVED_TEMPLATE" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200 bg-slate-800"}`}
          >
            <LayoutTemplate className="w-3.5 h-3.5" /> Approved template
          </button>
        </div>

        {mode === "AI_PROVIDER" ? (
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={4}
            maxLength={4000}
            placeholder="Describe the application: who uses it, what they record, and what they can do."
            className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          />
        ) : (
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-xs text-slate-200"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.applicationName} ({t.entities.join(", ")})
              </option>
            ))}
          </select>
        )}

        <div className="flex items-center justify-between">
          <p className="text-[11px] text-slate-500">
            Writes source under <code>forge-app/</code>. Nothing is installed, migrated or deployed.
          </p>
          <button
            onClick={start}
            disabled={busy || !canStart}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-semibold disabled:opacity-50"
          >
            {busy ? "Generation running…" : "Generate"}
          </button>
        </div>
        {error && <p className="text-xs text-rose-400">{error}</p>}
      </div>

      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-slate-300">Generation runs</h4>
        <button onClick={() => void refresh()} className="p-1 text-slate-400 hover:text-slate-200" title="Refresh runs">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {runs.length === 0 && <p className="text-xs text-slate-500">No generation runs yet.</p>}

      {runs.map((run) => (
        <div key={run.id} className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-semibold text-slate-200">
              {ACTIVE.has(run.status) && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />}
              {run.status === "SOURCE_WRITTEN" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              {run.status === "FAILED" && <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
              {STATUS_LABEL[run.status]}
            </span>
            <span className="text-slate-500 font-mono">{new Date(run.createdAt).toLocaleString()}</span>
          </div>
          <div className="text-slate-400">
            {run.mode === "AI_PROVIDER"
              ? `AI provider: ${run.provider ?? "—"}${run.model ? ` (${run.model})` : ""} · calls ${run.providerCalls}` +
                (run.inputTokens !== null ? ` · ${run.inputTokens} in / ${run.outputTokens} out tokens` : " · usage not reported")
              : `Approved template: ${run.templateId}`}
          </div>
          {run.appModel && (
            <div className="text-slate-300">
              {run.appModel.applicationName}: {run.appModel.entities.map((e) => `${e.name} (${e.fields.length} fields)`).join(", ")}
            </div>
          )}
          {run.status === "SOURCE_WRITTEN" && (
            <div className="text-slate-400">{run.files.filter((f) => f.written).length} files written.</div>
          )}
          {run.status === "FAILED" && (
            <div className="flex items-start justify-between gap-2">
              <span className="text-rose-300">
                {run.errorCode}: {run.errorMessage}
              </span>
              <button onClick={() => void retry(run.id)} disabled={busy} className="shrink-0 px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 disabled:opacity-50">
                Retry
              </button>
            </div>
          )}
          {run.diagnostics.length > 0 && (
            <details className="text-slate-500">
              <summary className="cursor-pointer">Diagnostics ({run.diagnostics.length})</summary>
              <ul className="mt-1 space-y-0.5">
                {run.diagnostics.map((d, i) => (
                  <li key={i} className={d.severity === "error" ? "text-rose-400" : d.severity === "warn" ? "text-amber-400" : ""}>
                    {d.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ))}
    </div>
  );
};
