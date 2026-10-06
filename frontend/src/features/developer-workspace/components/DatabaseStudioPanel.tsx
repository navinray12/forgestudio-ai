import React, { useState, useEffect } from "react";
import {
  Database,
  Table,
  Plus,
  Play,
  RotateCw,
  Trash2,
  Edit2,
  FileText,
  Download,
  Upload,
  Search,
  Check,
  X,
  AlertTriangle,
  Code,
  Layers,
  Archive,
  Cpu,
  Key,
  ShieldCheck,
  Zap,
  Copy,
} from "lucide-react";
import { forgeProjectService } from "../services/forgeProjectService";

interface DatabaseStudioPanelProps {
  projectId: string;
}

export const DatabaseStudioPanel: React.FC<DatabaseStudioPanelProps> = ({ projectId }) => {
  const [activeTab, setActiveTab] = useState<"browser" | "sql" | "schema" | "migrations" | "api">("browser");
  const [databases, setDatabases] = useState<any[]>([]);
  const [activeDatabase, setActiveDatabase] = useState<any>(null);
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [tableData, setTableData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // SQL Editor State
  const [sqlQuery, setSqlQuery] = useState("SELECT * FROM users LIMIT 25;");
  const [sqlResult, setSqlResult] = useState<any>(null);
  const [queryRunning, setQueryRunning] = useState(false);
  const [queryHistory, setQueryHistory] = useState<any[]>([]);
  const [explainResult, setExplainResult] = useState<any>(null);

  // Schema & ER State
  const [introspectedSchema, setIntrospectedSchema] = useState<any>(null);
  const [showCreateTableModal, setShowCreateTableModal] = useState(false);
  const [newTableName, setNewTableName] = useState("");
  const [newTableCols, setNewTableCols] = useState<Array<{ name: string; type: string; nullable: boolean; isPrimaryKey: boolean }>>([
    { name: "id", type: "uuid", nullable: false, isPrimaryKey: true },
    { name: "name", type: "varchar(255)", nullable: false, isPrimaryKey: false },
    { name: "created_at", type: "timestamptz", nullable: false, isPrimaryKey: false },
  ]);

  // Migrations & Backups State
  const [migrations, setMigrations] = useState<any[]>([]);
  const [backups, setBackups] = useState<any[]>([]);
  const [dbMetrics, setDbMetrics] = useState<any>(null);

  // API Layer State
  const [apiConfigs, setApiConfigs] = useState<any[]>([]);
  const [openApiSpec, setOpenApiSpec] = useState<any>(null);
  const [typedClientCode, setTypedClientCode] = useState<string>("");

  // Modals & Inline Row Editing
  const [showAddRowModal, setShowAddRowModal] = useState(false);
  const [newRowValues, setNewRowValues] = useState<Record<string, any>>({});
  const [editingRow, setEditingRow] = useState<any>(null);

  // 1. Initial Load
  useEffect(() => {
    initDatabase();
  }, [projectId]);

  const initDatabase = async () => {
    try {
      setLoading(true);
      const res = await forgeProjectService.getDatabase(projectId, "development");
      if (res.database) {
        setActiveDatabase(res.database);
        loadDatabaseDetails(res.database.id);
      }
    } catch (err) {
      console.error("Failed to load database:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadDatabaseDetails = async (dbId: string) => {
    try {
      const tablesRes = await forgeProjectService.listDatabaseTables(projectId, dbId);
      setTables(tablesRes.tables || []);
      if (tablesRes.tables?.length > 0) {
        const firstTable = tablesRes.tables[0].name;
        setSelectedTable(firstTable);
        loadTableRows(dbId, firstTable);
      }
      const metricsRes = await forgeProjectService.getDatabaseMetrics(projectId, dbId);
      setDbMetrics(metricsRes.metrics);
    } catch (err) {
      console.error("Error loading db details:", err);
    }
  };

  const loadTableRows = async (dbId: string, tableName: string) => {
    try {
      setLoading(true);
      const res = await forgeProjectService.getTableData(projectId, dbId, tableName, { page: 1, limit: 25 });
      setTableData(res.data);
    } catch (err) {
      console.error("Error loading table rows:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunSql = async () => {
    if (!activeDatabase?.id || !sqlQuery.trim()) return;
    try {
      setQueryRunning(true);
      setExplainResult(null);
      const res = await forgeProjectService.executeSqlQuery(projectId, activeDatabase.id, sqlQuery);
      setSqlResult(res.result);
      loadQueryHistory();
    } catch (err: any) {
      alert(`Query failed: ${err.message}`);
    } finally {
      setQueryRunning(false);
    }
  };

  const handleExplainSql = async () => {
    if (!activeDatabase?.id || !sqlQuery.trim()) return;
    try {
      setQueryRunning(true);
      const res = await forgeProjectService.explainSqlQuery(projectId, activeDatabase.id, sqlQuery, false);
      setExplainResult(res.result);
    } catch (err: any) {
      alert(`Explain failed: ${err.message}`);
    } finally {
      setQueryRunning(false);
    }
  };

  const loadQueryHistory = async () => {
    if (!activeDatabase?.id) return;
    const res = await forgeProjectService.getQueryHistory(projectId, activeDatabase.id);
    setQueryHistory(res.history || []);
  };

  const handleCreateTable = async () => {
    if (!activeDatabase?.id || !newTableName.trim()) return;
    try {
      setLoading(true);
      await forgeProjectService.createTable(projectId, activeDatabase.id, {
        tableName: newTableName.trim(),
        columns: newTableCols,
      });
      setShowCreateTableModal(false);
      setNewTableName("");
      loadDatabaseDetails(activeDatabase.id);
    } catch (err: any) {
      alert(`Create table failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSeedTable = async () => {
    if (!activeDatabase?.id || !selectedTable) return;
    try {
      setLoading(true);
      await forgeProjectService.seedTableData(projectId, activeDatabase.id, selectedTable, 5);
      loadTableRows(activeDatabase.id, selectedTable);
    } catch (err: any) {
      alert(`Seed failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRow = async () => {
    if (!activeDatabase?.id || !selectedTable) return;
    try {
      await forgeProjectService.insertTableRow(projectId, activeDatabase.id, selectedTable, newRowValues);
      setShowAddRowModal(false);
      setNewRowValues({});
      loadTableRows(activeDatabase.id, selectedTable);
    } catch (err: any) {
      alert(`Add row failed: ${err.message}`);
    }
  };

  const handleDeleteRow = async (pkVal: any) => {
    if (!activeDatabase?.id || !selectedTable) return;
    if (!confirm("Are you sure you want to delete this row?")) return;
    try {
      await forgeProjectService.deleteTableRow(projectId, activeDatabase.id, selectedTable, "id", pkVal);
      loadTableRows(activeDatabase.id, selectedTable);
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const loadSchemaTab = async () => {
    if (!activeDatabase?.id) return;
    const res = await forgeProjectService.introspectDatabaseSchema(projectId, activeDatabase.id);
    setIntrospectedSchema(res.schema);
  };

  const loadMigrationsTab = async () => {
    if (!activeDatabase?.id) return;
    const migRes = await forgeProjectService.listDatabaseMigrations(projectId, activeDatabase.id);
    setMigrations(migRes.migrations || []);
    const bakRes = await forgeProjectService.listDatabaseBackups(projectId, activeDatabase.id);
    setBackups(bakRes.backups || []);
  };

  const loadApiTab = async () => {
    if (!activeDatabase?.id) return;
    const cfgRes = await forgeProjectService.getApiConfigs(projectId, activeDatabase.id);
    setApiConfigs(cfgRes.configs || []);
    const spec = await forgeProjectService.getOpenApiSpec(projectId, activeDatabase.id);
    setOpenApiSpec(spec);
    const client = await forgeProjectService.getTypedClientCode(projectId, activeDatabase.id);
    setTypedClientCode(client.client?.typescriptCode || "");
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 font-sans select-none">
      {/* Studio Navigation Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900/70">
        <div className="flex items-center gap-1.5 text-xs overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("browser")}
            className={`px-2.5 py-1 rounded font-medium flex items-center gap-1.5 transition ${
              activeTab === "browser"
                ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Table className="w-3.5 h-3.5 text-emerald-400" />
            <span>Table Browser</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("sql");
              loadQueryHistory();
            }}
            className={`px-2.5 py-1 rounded font-medium flex items-center gap-1.5 transition ${
              activeTab === "sql"
                ? "bg-blue-600/30 text-blue-300 border border-blue-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Code className="w-3.5 h-3.5 text-blue-400" />
            <span>SQL Editor</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("schema");
              loadSchemaTab();
            }}
            className={`px-2.5 py-1 rounded font-medium flex items-center gap-1.5 transition ${
              activeTab === "schema"
                ? "bg-purple-600/30 text-purple-300 border border-purple-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>Schema & ER Diagram</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("migrations");
              loadMigrationsTab();
            }}
            className={`px-2.5 py-1 rounded font-medium flex items-center gap-1.5 transition ${
              activeTab === "migrations"
                ? "bg-amber-600/30 text-amber-300 border border-amber-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Archive className="w-3.5 h-3.5 text-amber-400" />
            <span>Migrations & Backups</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("api");
              loadApiTab();
            }}
            className={`px-2.5 py-1 rounded font-medium flex items-center gap-1.5 transition ${
              activeTab === "api"
                ? "bg-cyan-600/30 text-cyan-300 border border-cyan-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>Data / API Layer</span>
          </button>
        </div>

        {/* Database Engine Status */}
        <div className="flex items-center gap-3 text-xs">
          {dbMetrics && (
            <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>PostgreSQL 16 ({activeDatabase?.schemaName})</span>
              <span className="text-slate-600">•</span>
              <span>{(dbMetrics.storageUsedBytes / 1024).toFixed(1)} KB used</span>
            </span>
          )}
        </div>
      </div>

      {/* Main Tab Views */}
      <div className="flex-1 overflow-hidden p-3 bg-slate-950">
        {/* TAB 1: Table Browser */}
        {activeTab === "browser" && (
          <div className="h-full flex flex-col gap-3">
            {/* Table Selector Toolbar */}
            <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-lg border border-slate-800">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-semibold">Table:</span>
                <select
                  value={selectedTable}
                  onChange={(e) => {
                    setSelectedTable(e.target.value);
                    if (activeDatabase?.id) loadTableRows(activeDatabase.id, e.target.value);
                  }}
                  className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 font-medium"
                >
                  {tables.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name} ({t.rowCount} rows)
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setShowCreateTableModal(true)}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>New Table</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSeedTable}
                  className="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 rounded text-xs flex items-center gap-1.5"
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Seed Mock Rows</span>
                </button>

                <button
                  onClick={() => setShowAddRowModal(true)}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Insert Row</span>
                </button>
              </div>
            </div>

            {/* Data Grid */}
            <div className="flex-1 overflow-auto bg-slate-900 border border-slate-800 rounded-lg">
              {tableData && tableData.rows?.length > 0 ? (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 sticky top-0">
                      {tableData.columns.map((c: string) => (
                        <th key={c} className="p-2.5 font-semibold text-slate-300">
                          {c}
                        </th>
                      ))}
                      <th className="p-2.5 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {tableData.rows.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition">
                        {tableData.columns.map((c: string) => (
                          <td key={c} className="p-2.5 text-slate-300 max-w-xs truncate">
                            {typeof row[c] === "object" ? JSON.stringify(row[c]) : String(row[c] ?? "NULL")}
                          </td>
                        ))}
                        <td className="p-2.5 text-right font-sans">
                          <button
                            onClick={() => handleDeleteRow(row.id || row[tableData.columns[0]])}
                            className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-950/40"
                            title="Delete Row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-500">
                  <Table className="w-8 h-8 text-slate-600 mb-2" />
                  <p className="text-sm font-medium text-slate-400">No rows found in table '{selectedTable}'</p>
                  <p className="text-xs text-slate-500 mt-1">Insert a new record or click 'Seed Mock Rows' to populate data.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: SQL Editor */}
        {activeTab === "sql" && (
          <div className="h-full flex flex-col gap-3">
            <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-lg p-3">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                <span className="text-xs font-semibold text-slate-300">Interactive SQL Console</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExplainSql}
                    disabled={queryRunning}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
                  >
                    Explain Query
                  </button>
                  <button
                    onClick={handleRunSql}
                    disabled={queryRunning}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Run Query</span>
                  </button>
                </div>
              </div>

              <textarea
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                className="w-full flex-1 bg-slate-950 border border-slate-800 rounded p-3 font-mono text-xs text-slate-200 resize-none focus:outline-hidden focus:border-blue-500"
                rows={5}
              />
            </div>

            {/* Explain Plan Warnings */}
            {explainResult && (
              <div className="bg-purple-950/40 border border-purple-500/40 p-3 rounded-lg text-xs space-y-1">
                <div className="font-semibold text-purple-300 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-purple-400" />
                  <span>Query Execution Plan • Est. Cost: {explainResult.estimatedCost}</span>
                </div>
                {explainResult.warnings.map((w: string, i: number) => (
                  <p key={i} className="text-amber-300 text-[11px]">• {w}</p>
                ))}
              </div>
            )}

            {/* Query Results */}
            <div className="h-1/2 overflow-auto bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono text-xs">
              {sqlResult ? (
                <div>
                  <div className="text-slate-400 font-sans text-xs pb-2 border-b border-slate-800 flex items-center justify-between">
                    <span>Result: {sqlResult.rowCount} rows returned in {sqlResult.durationMs}ms</span>
                  </div>
                  <table className="w-full text-left text-xs border-collapse mt-2">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        {sqlResult.columns.map((c: string) => (
                          <th key={c} className="p-2 font-semibold text-slate-300">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-[11px]">
                      {sqlResult.rows.map((r: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-800/40">
                          {sqlResult.columns.map((c: string) => (
                            <td key={c} className="p-2 text-slate-300 truncate max-w-xs">
                              {typeof r[c] === "object" ? JSON.stringify(r[c]) : String(r[c] ?? "NULL")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-slate-500 text-center py-6 font-sans">Run a SQL query above to view results</div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: Schema & ER Diagram */}
        {activeTab === "schema" && (
          <div className="h-full overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-300">Schema Architecture & Entity Relationships</span>
              <button
                onClick={() => setShowCreateTableModal(true)}
                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Table</span>
              </button>
            </div>

            {introspectedSchema?.tables ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {introspectedSchema.tables.map((t: any) => (
                  <div key={t.name} className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-bold text-sm text-slate-200 flex items-center gap-1.5">
                        <Table className="w-4 h-4 text-purple-400" />
                        <span>{t.name}</span>
                      </span>
                      <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">
                        {t.rowCount} rows
                      </span>
                    </div>

                    <div className="space-y-1 font-mono text-xs">
                      {t.columns.map((c: any) => (
                        <div key={c.name} className="flex items-center justify-between text-[11px]">
                          <span className={c.isPrimaryKey ? "text-amber-400 font-bold" : "text-slate-300"}>
                            {c.isPrimaryKey && "🔑 "}
                            {c.name}
                          </span>
                          <span className="text-slate-500">{c.type}</span>
                        </div>
                      ))}
                    </div>

                    {t.relationships?.length > 0 && (
                      <div className="pt-2 border-t border-slate-800/60 font-sans text-[11px] text-cyan-400">
                        {t.relationships.map((rel: any) => (
                          <div key={rel.id} className="flex items-center gap-1">
                            <span>→ References {rel.targetTable} ({rel.targetColumns.join(", ")})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-500 text-center py-8">Loading schema definitions...</div>
            )}
          </div>
        )}

        {/* TAB 4: Migrations & Backups */}
        {activeTab === "migrations" && (
          <div className="h-full overflow-y-auto space-y-6">
            {/* Migrations */}
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
                <span className="text-xs font-semibold text-slate-300">Schema Migrations</span>
              </div>
              <div className="space-y-2">
                {migrations.length === 0 ? (
                  <div className="text-slate-500 text-xs">No pending or historical migrations.</div>
                ) : (
                  migrations.map((m) => (
                    <div key={m.id} className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-slate-200">{m.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">Checksum: {m.checksum?.slice(0, 16)}...</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        m.status === "APPLIED" ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/40" : "bg-amber-950/60 text-amber-400"
                      }`}>
                        {m.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Backups */}
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
                <span className="text-xs font-semibold text-slate-300">Database Backups & Snapshots</span>
                <button
                  onClick={async () => {
                    if (!activeDatabase?.id) return;
                    await forgeProjectService.createDatabaseBackup(projectId, activeDatabase.id, "manual-snapshot");
                    loadMigrationsTab();
                  }}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold"
                >
                  Create Backup
                </button>
              </div>
              <div className="space-y-2">
                {backups.map((b) => (
                  <div key={b.id} className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-slate-200">{b.name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{new Date(b.createdAt).toLocaleString()} • {(b.sizeBytes / 1024).toFixed(1)} KB</div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!confirm("Restore database from this backup? All current table rows will be replaced.")) return;
                        await forgeProjectService.restoreDatabaseBackup(projectId, activeDatabase.id, b.id);
                        alert("Database restored successfully!");
                      }}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: Data / API Layer */}
        {activeTab === "api" && (
          <div className="h-full overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-300">Autogenerated Project REST APIs & SDK Client</span>
            </div>

            {/* Exposed Endpoints List */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2 text-xs">
              <span className="text-slate-400 font-semibold block mb-2">Exposed Table Endpoints</span>
              {apiConfigs.map((cfg) => (
                <div key={cfg.id} className="flex items-center justify-between bg-slate-950 p-2.5 rounded border border-slate-850">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-cyan-400">/api/v1/projects/{projectId}/data/{cfg.tableName}</span>
                    <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">
                      {cfg.allowedOperations?.join(", ")}
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-400">Active</span>
                </div>
              ))}
            </div>

            {/* Typed Client SDK Code */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Typed TypeScript Client SDK (client.ts)</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(typedClientCode);
                    alert("Client SDK copied to clipboard!");
                  }}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Code</span>
                </button>
              </div>
              <pre className="p-3 bg-slate-950 rounded font-mono text-[11px] text-slate-300 overflow-x-auto max-h-60 leading-relaxed border border-slate-800">
                {typedClientCode}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: Create Table */}
      {showCreateTableModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-sm text-slate-200">Create New Table</span>
              <button onClick={() => setShowCreateTableModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Table Name</label>
              <input
                type="text"
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                placeholder="e.g. products, customers"
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-200"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-400 block">Columns</label>
              {newTableCols.map((col, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <input
                    type="text"
                    value={col.name}
                    onChange={(e) => {
                      const updated = [...newTableCols];
                      updated[i].name = e.target.value;
                      setNewTableCols(updated);
                    }}
                    placeholder="column_name"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200"
                  />
                  <select
                    value={col.type}
                    onChange={(e) => {
                      const updated = [...newTableCols];
                      updated[i].type = e.target.value;
                      setNewTableCols(updated);
                    }}
                    className="bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200"
                  >
                    <option value="uuid">uuid</option>
                    <option value="varchar(255)">varchar(255)</option>
                    <option value="text">text</option>
                    <option value="integer">integer</option>
                    <option value="boolean">boolean</option>
                    <option value="timestamptz">timestamptz</option>
                    <option value="jsonb">jsonb</option>
                  </select>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowCreateTableModal(false)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTable}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold"
              >
                Create Table
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Insert Row */}
      {showAddRowModal && tableData && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-sm text-slate-200">Insert Row into {selectedTable}</span>
              <button onClick={() => setShowAddRowModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto">
              {tableData.columns
                .filter((c: string) => c !== "id")
                .map((col: string) => (
                  <div key={col}>
                    <label className="text-xs text-slate-400 block mb-1">{col}</label>
                    <input
                      type="text"
                      onChange={(e) =>
                        setNewRowValues((prev) => ({ ...prev, [col]: e.target.value }))
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-200"
                    />
                  </div>
                ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowAddRowModal(false)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleAddRow}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold"
              >
                Save Row
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
