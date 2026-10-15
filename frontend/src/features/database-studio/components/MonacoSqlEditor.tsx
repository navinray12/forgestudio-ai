import React, { useState, useEffect } from "react";
import MonacoEditor from "@monaco-editor/react";
import { Play, Clock, CheckCircle2, AlertTriangle, Database, Download } from "lucide-react";
import type { QueryResult, StudioEnvironment } from "../types/studio.types";

interface MonacoSqlEditorProps {
  projectId: string;
  apiBase: string;
  environment: StudioEnvironment;
  defaultQuery?: string;
}

export const MonacoSqlEditor: React.FC<MonacoSqlEditorProps> = ({
  projectId,
  apiBase,
  environment,
  defaultQuery = "SELECT * FROM information_schema.tables WHERE table_schema = 'public' LIMIT 50;",
}) => {
  const [sql, setSql] = useState<string>(defaultQuery);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // PRODUCTION queries run read-only on the server unless writes are explicitly allowed
  // (owners/admins only). The opt-in resets whenever the environment changes.
  const [allowWrite, setAllowWrite] = useState(false);
  const isProduction = environment === "PRODUCTION";
  useEffect(() => setAllowWrite(false), [environment]);

  const handleRunQuery = async () => {
    if (!sql.trim()) return;
    let confirmEnvironment: string | undefined;
    if (isProduction && allowWrite) {
      const typed = window.prompt(
        'This query can change LIVE PRODUCTION data. Type PRODUCTION to authorize this execution:'
      );
      if (typed !== "PRODUCTION") return;
      confirmEnvironment = typed;
    }
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/v1/projects/${projectId}/studio/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sql, environment, allowWrite: isProduction ? allowWrite : undefined, confirmEnvironment }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Query execution failed");
      }

      setResult(json.data);
    } catch (err: any) {
      setError(err.message || "Query execution failed");
      setResult(null);
    } finally {
      setRunning(false);
    }
  };

  const handleExportJson = () => {
    if (!result?.rows) return;
    const blob = new Blob([JSON.stringify(result.rows, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `query-results-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-lg border border-slate-800 overflow-hidden shadow-xl">
      {/* Editor Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 font-mono">
            <Database className="w-4 h-4 text-indigo-400" /> SQL Query Runner
          </span>
          <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
            Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">Ctrl</kbd>+<kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">Enter</kbd> to run
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isProduction && (
            <label className="flex items-center gap-1.5 text-[11px] font-mono text-rose-300">
              <input
                type="checkbox"
                checked={allowWrite}
                onChange={(e) => setAllowWrite(e.target.checked)}
              />
              Allow writes to PRODUCTION (confirmation required per execution)
            </label>
          )}
          {result && (
            <button
              onClick={handleExportJson}
              className="flex items-center gap-1 px-2.5 py-1 text-slate-400 hover:text-white rounded text-xs hover:bg-slate-800 transition"
              title="Export results as JSON"
            >
              <Download className="w-3.5 h-3.5" />
              JSON
            </button>
          )}

          <button
            onClick={handleRunQuery}
            disabled={running || !sql.trim()}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white rounded text-xs font-semibold shadow transition"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${running ? "animate-pulse" : ""}`} />
            {running ? "Executing..." : "Run Query"}
          </button>
        </div>
      </div>

      {/* Monaco Code Editor Pane */}
      <div className="h-64 border-b border-slate-800">
        <MonacoEditor
          height="100%"
          language="sql"
          theme="vs-dark"
          value={sql}
          onChange={(val) => setSql(val || "")}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: "on",
            wordWrap: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
          }}
          onMount={(editor, monaco) => {
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
              handleRunQuery();
            });
          }}
        />
      </div>

      {/* Results / Status Bar */}
      <div className="flex-1 flex flex-col min-h-0 bg-slate-950">
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900/60 border-b border-slate-800 text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-3">
            <span>Query Results</span>
            {result && (
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {result.rowCount} {result.rowCount === 1 ? "row" : "rows"}
              </span>
            )}
          </div>

          {result && (
            <div className="flex items-center gap-1.5 text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              <span>{result.durationMs}ms</span>
            </div>
          )}
        </div>

        {error ? (
          <div className="p-4 m-4 rounded bg-rose-950/40 border border-rose-800/80 text-rose-300 font-mono text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 whitespace-pre-wrap">{error}</div>
          </div>
        ) : !result ? (
          <div className="flex-1 flex items-center justify-center text-slate-600 text-xs font-mono">
            Execute a query to view results
          </div>
        ) : result.rows.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-xs font-mono">
            Query returned 0 rows.
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse text-left text-xs font-mono">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 sticky top-0 z-10 text-slate-400">
                  <th className="w-10 px-3 py-2 text-center border-r border-slate-800">#</th>
                  {result.fields.map((f) => (
                    <th key={f.name} className="px-4 py-2 border-r border-slate-800 whitespace-nowrap text-slate-300 font-semibold">
                      {f.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {result.rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-900/60 transition">
                    <td className="w-10 px-3 py-1.5 text-center text-slate-600 border-r border-slate-800">
                      {rIdx + 1}
                    </td>
                    {result.fields.map((f) => {
                      const val = row[f.name];
                      const display = val === null ? "NULL" : typeof val === "object" ? JSON.stringify(val) : String(val);
                      return (
                        <td
                          key={f.name}
                          className={`px-4 py-1.5 border-r border-slate-800 max-w-xs truncate ${
                            val === null ? "text-slate-600 italic" : "text-slate-200"
                          }`}
                          title={display}
                        >
                          {display}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
export default MonacoSqlEditor;
