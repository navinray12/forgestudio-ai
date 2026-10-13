import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Database,
  Table,
  Plus,
  Terminal,
  Layers,
  History,
  RefreshCw,
  Server,
  Activity,
  ArrowLeft,
  Trash2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { DataGrid } from "../components/DataGrid";
import { MonacoSqlEditor } from "../components/MonacoSqlEditor";
import { VisualTableDesigner } from "../components/VisualTableDesigner";
import { SchemaVisualizer } from "../components/SchemaVisualizer";
import { MigrationsManager } from "../components/MigrationsManager";
import type { TableSummary, TableDetails, DatabaseStatus, StudioEnvironment } from "../types/studio.types";

const STUDIO_ENVIRONMENTS: StudioEnvironment[] = ["DEVELOPMENT", "PREVIEW", "PRODUCTION"];

function readStoredEnvironment(projectId: string): StudioEnvironment {
  try {
    const stored = localStorage.getItem(`forge.studio.environment.${projectId}`);
    if (stored && (STUDIO_ENVIRONMENTS as string[]).includes(stored)) return stored as StudioEnvironment;
  } catch {
    // Storage may be unavailable; fall back to development.
  }
  return "DEVELOPMENT";
}

export const DatabaseStudioPage: React.FC = () => {
  const params = useParams<{ projectId?: string; websiteId?: string }>();
  const projectId = params.projectId || params.websiteId || "";
  const apiBase = (import.meta as any).env?.VITE_API_URL || "http://localhost:5000";

  const [dbStatus, setDbStatus] = useState<DatabaseStatus | null>(null);
  const [tables, setTables] = useState<TableSummary[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [selectedTableDetails, setSelectedTableDetails] = useState<TableDetails | null>(null);
  const [activeTab, setActiveTab] = useState<"data" | "sql" | "erd" | "migrations">("data");
  const [showDesigner, setShowDesigner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  // Every Studio request names its target database explicitly; the server rejects requests
  // without one instead of defaulting to PRODUCTION.
  const [environment, setEnvironment] = useState<StudioEnvironment>(() => readStoredEnvironment(projectId));
  const isProduction = environment === "PRODUCTION";

  const changeEnvironment = (next: StudioEnvironment) => {
    setEnvironment(next);
    setSelectedTable("");
    setTables([]);
    setDbStatus(null);
    try {
      localStorage.setItem(`forge.studio.environment.${projectId}`, next);
    } catch {
      // Non-critical convenience only.
    }
  };

  const fetchDatabaseStatus = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`${apiBase}/api/v1/projects/${projectId}/database?environment=${environment}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (res.ok) {
        setDbStatus(json);
      }
    } catch (err) {
      console.error("Failed to load database status", err);
    }
  }, [projectId, apiBase, environment]);

  const fetchTables = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/v1/projects/${projectId}/studio/tables?environment=${environment}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (res.ok) {
        const tableList: TableSummary[] = json.data || [];
        setTables(tableList);
        if (!selectedTable && tableList.length > 0) {
          setSelectedTable(tableList[0].name);
        }
      }
    } catch (err) {
      console.error("Failed to load tables", err);
    } finally {
      setLoading(false);
    }
  }, [projectId, apiBase, selectedTable, environment]);

  const fetchTableDetails = useCallback(async (tableName: string) => {
    if (!projectId || !tableName) return;
    try {
      const res = await fetch(
        `${apiBase}/api/v1/projects/${projectId}/studio/tables/${tableName}?environment=${environment}`,
        { credentials: "include" }
      );
      const json = await res.json();
      if (res.ok) {
        setSelectedTableDetails(json.data);
      }
    } catch (err) {
      console.error("Failed to load table details", err);
    }
  }, [projectId, apiBase, environment]);

  useEffect(() => {
    fetchDatabaseStatus();
    fetchTables();
  }, [fetchDatabaseStatus, fetchTables]);

  useEffect(() => {
    if (selectedTable) {
      fetchTableDetails(selectedTable);
    } else {
      setSelectedTableDetails(null);
    }
  }, [selectedTable, fetchTableDetails]);

  const handleProvisionDatabase = async () => {
    setProvisioning(true);
    try {
      const res = await fetch(`${apiBase}/api/v1/projects/${projectId}/database/provision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ environment }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Provisioning failed");
      await fetchDatabaseStatus();
      await fetchTables();
    } catch (err: any) {
      alert(`Provisioning error: ${err.message}`);
    } finally {
      setProvisioning(false);
    }
  };

  const handleDropTable = async (tableName: string) => {
    if (isProduction) {
      const typed = prompt(
        `You are about to drop "${tableName}" from the PRODUCTION database. This cannot be undone.

Type the table name to confirm:`
      );
      if (typed !== tableName) return;
    } else if (!confirm(`Drop table "${tableName}" from ${environment}? This action is irreversible.`)) {
      return;
    }
    try {
      const res = await fetch(
        `${apiBase}/api/v1/projects/${projectId}/studio/tables/${tableName}?environment=${environment}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || "Drop table failed");
      }
      if (selectedTable === tableName) {
        setSelectedTable("");
      }
      fetchTables();
    } catch (err: any) {
      alert(`Error dropping table: ${err.message}`);
    }
  };

  const filteredTables = tables.filter((t) =>
    t.name.toLowerCase().includes(tableSearch.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-4">
          <Link
            to="/dashboard"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>

          <div className="h-4 w-px bg-slate-800" />

          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Database className="w-4 h-4" />
            </div>
            <h1 className="text-sm font-bold text-white tracking-wide">Database Studio</h1>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
              Project: {projectId.slice(0, 8)}...
            </span>
          </div>
        </div>

        {/* Database Telemetry Status Bar */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <label
            className={`flex items-center gap-2 px-2 py-1 rounded-lg border ${
              isProduction
                ? "bg-rose-950/60 border-rose-500/60 text-rose-200"
                : "bg-slate-950 border-slate-800 text-slate-400"
            }`}
          >
            <span className="uppercase tracking-wider text-[10px]">Environment</span>
            <select
              value={environment}
              onChange={(e) => changeEnvironment(e.target.value as StudioEnvironment)}
              className="bg-transparent font-bold focus:outline-none"
              aria-label="Target database environment"
            >
              {STUDIO_ENVIRONMENTS.map((env) => (
                <option key={env} value={env} className="bg-slate-900 text-white">
                  {env}
                </option>
              ))}
            </select>
            {isProduction && <span className="text-[10px] font-bold">LIVE DATA</span>}
          </label>
          {dbStatus?.provisioned ? (
            <div className="flex items-center gap-3 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                READY
              </span>
              <span>•</span>
              <span className="text-slate-300">{dbStatus.data?.dbName}</span>
              <span>•</span>
              <span className="text-slate-500">{dbStatus.data?.host}:{dbStatus.data?.port}</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-amber-400 flex items-center gap-1.5 text-xs">
                <AlertCircle className="w-4 h-4" /> Not Provisioned
              </span>
              <button
                onClick={handleProvisionDatabase}
                disabled={provisioning}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold shadow transition disabled:opacity-50"
              >
                {provisioning ? "Provisioning..." : `Provision ${environment} Database`}
              </button>
            </div>
          )}

          <div className="flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60">
            <button
              onClick={() => setActiveTab("data")}
              className={`px-3 py-1 rounded text-xs font-medium transition ${
                activeTab === "data" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              Data Grid
            </button>
            <button
              onClick={() => setActiveTab("sql")}
              className={`px-3 py-1 rounded text-xs font-medium transition flex items-center gap-1 ${
                activeTab === "sql" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              SQL Runner
            </button>
            <button
              onClick={() => setActiveTab("erd")}
              className={`px-3 py-1 rounded text-xs font-medium transition flex items-center gap-1 ${
                activeTab === "erd" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              ER Diagram
            </button>
            <button
              onClick={() => setActiveTab("migrations")}
              className={`px-3 py-1 rounded text-xs font-medium transition flex items-center gap-1 ${
                activeTab === "migrations" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Migrations
            </button>
          </div>
        </div>
      </header>

      {/* Main Studio Body with Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Tables Sidebar */}
        <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
              Tables ({tables.length})
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => fetchTables()}
                disabled={loading}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="Refresh tables"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={() => setShowDesigner(true)}
                className="flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                New
              </button>
            </div>
          </div>

          <div className="p-2 border-b border-slate-800">
            <input
              type="text"
              placeholder="Filter tables..."
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-xs">
            {filteredTables.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-xs">
                No tables found
              </div>
            ) : (
              filteredTables.map((t) => (
                <div
                  key={t.name}
                  onClick={() => {
                    setSelectedTable(t.name);
                    setActiveTab("data");
                  }}
                  className={`group flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition select-none ${
                    selectedTable === t.name && activeTab === "data"
                      ? "bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/40"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Table className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{t.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-500 group-hover:text-slate-400">
                      {t.columnCount} cols
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDropTable(t.name);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-rose-400 transition"
                      title="Drop table"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Workspace Canvas Pane */}
        <main className="flex-1 p-4 overflow-hidden bg-slate-950">
          {activeTab === "data" && (
            selectedTable ? (
              <DataGrid
                projectId={projectId}
                tableName={selectedTable}
                tableDetails={selectedTableDetails}
                apiBase={apiBase}
                environment={environment}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
                <Database className="w-12 h-12 opacity-30" />
                <p className="text-sm font-mono">Select a table or create one using the Table Designer</p>
                <button
                  onClick={() => setShowDesigner(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold shadow transition"
                >
                  Create New Table
                </button>
              </div>
            )
          )}

          {activeTab === "sql" && (
            <MonacoSqlEditor projectId={projectId} apiBase={apiBase} environment={environment} />
          )}

          {activeTab === "erd" && (
            <SchemaVisualizer projectId={projectId} apiBase={apiBase} environment={environment} />
          )}

          {activeTab === "migrations" && (
            <MigrationsManager projectId={projectId} apiBase={apiBase} />
          )}
        </main>
      </div>

      {/* Visual Table Designer Modal */}
      <VisualTableDesigner
        projectId={projectId}
        apiBase={apiBase}
        environment={environment}
        isOpen={showDesigner}
        onClose={() => setShowDesigner(false)}
        onTableCreated={(newTable) => {
          fetchTables();
          setSelectedTable(newTable);
          setActiveTab("data");
        }}
      />
    </div>
  );
};
export default DatabaseStudioPage;
