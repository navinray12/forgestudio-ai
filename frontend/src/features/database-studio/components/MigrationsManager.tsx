import React, { useState, useEffect } from "react";
import { History, ChevronDown, ChevronRight, RefreshCw, Clock, CheckCircle2 } from "lucide-react";
import type { MigrationRecord } from "../types/studio.types";

interface MigrationsManagerProps {
  projectId: string;
  apiBase: string;
}

export const MigrationsManager: React.FC<MigrationsManagerProps> = ({ projectId, apiBase }) => {
  const [migrations, setMigrations] = useState<MigrationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchMigrations = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/v1/projects/${projectId}/studio/migrations`, {
        credentials: "include",
      });
      const json = await res.json();
      if (res.ok) {
        setMigrations(json.data || []);
      }
    } catch (err) {
      console.error("Failed to load migrations", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMigrations();
  }, [projectId]);

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-lg border border-slate-800 overflow-hidden shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <History className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="text-xs font-semibold text-white tracking-wide font-mono">
              Database Migrations Tracker
            </h3>
            <span className="text-[11px] text-slate-500">
              {migrations.length} {migrations.length === 1 ? "migration" : "migrations"} recorded in journal
            </span>
          </div>
        </div>

        <button
          onClick={fetchMigrations}
          disabled={loading}
          className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
          title="Refresh migrations"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Migration List */}
      <div className="flex-1 overflow-auto p-4 space-y-3 font-mono">
        {loading && migrations.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-slate-500 gap-2 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Loading migration history...</span>
          </div>
        ) : migrations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs gap-1.5">
            <History className="w-6 h-6 opacity-30" />
            <p>No schema migrations applied yet.</p>
          </div>
        ) : (
          migrations.map((m) => {
            const isExpanded = expandedId === m.id;
            return (
              <div
                key={m.id}
                className="bg-slate-950 border border-slate-800/80 rounded-lg overflow-hidden transition"
              >
                <div
                  onClick={() => setExpandedId(isExpanded ? null : m.id)}
                  className="px-4 py-3 flex items-center justify-between hover:bg-slate-900/60 cursor-pointer select-none text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span className="font-semibold text-slate-200">{m.migrationName}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-900/60 text-indigo-400">
                      Batch #{m.batchNumber}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-slate-500 text-[11px]">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {m.executionTimeMs}ms
                    </span>
                    <span>{new Date(m.appliedAt).toLocaleString()}</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 bg-slate-900/40 border-t border-slate-800/60 text-xs">
                    <pre className="p-3 bg-slate-950 rounded border border-slate-800 text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      {m.sqlScript}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
export default MigrationsManager;
