import React, { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  RefreshCw,
  Key,
  ArrowUpDown,
  Check,
  X,
  Database,
  Filter,
} from "lucide-react";
import type { StudioEnvironment, TableDetails } from "../types/studio.types";

interface DataGridProps {
  projectId: string;
  tableName: string;
  tableDetails: TableDetails | null;
  apiBase: string;
  environment: StudioEnvironment;
}

export const DataGrid: React.FC<DataGridProps> = ({
  projectId,
  tableName,
  tableDetails,
  apiBase,
  environment,
}) => {
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [sortBy, setSortBy] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"ASC" | "DESC">("ASC");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline editing state: { rowIndex, colName, value }
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    colName: string;
    originalValue: any;
    currentValue: string;
  } | null>(null);

  // New row modal state
  const [showAddRowModal, setShowAddRowModal] = useState(false);
  const [newRowData, setNewRowData] = useState<Record<string, string>>({});
  const [mutating, setMutating] = useState(false);

  const primaryKeyCol = tableDetails?.columns.find((c) => c.isPrimaryKey)?.name || "";

  const fetchRows = useCallback(async () => {
    if (!tableName) return;
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        environment,
      });
      if (sortBy) {
        query.set("sortBy", sortBy);
        query.set("sortOrder", sortOrder);
      }

      const res = await fetch(
        `${apiBase}/api/v1/projects/${projectId}/studio/tables/${tableName}/rows?${query.toString()}`,
        { credentials: "include" }
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Failed to load table rows");
      }
      setRows(json.data || []);
      setTotal(json.pagination?.total || 0);
    } catch (err: any) {
      setError(err.message || "Failed to load rows");
    } finally {
      setLoading(false);
    }
  }, [projectId, tableName, page, limit, sortBy, sortOrder, apiBase, environment]);

  useEffect(() => {
    setPage(1);
    setEditingCell(null);
  }, [tableName]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const handleSort = (colName: string) => {
    if (sortBy === colName) {
      setSortOrder(sortOrder === "ASC" ? "DESC" : "ASC");
    } else {
      setSortBy(colName);
      setSortOrder("ASC");
    }
  };

  const handleSaveCell = async () => {
    if (!editingCell || !primaryKeyCol) return;
    const row = rows[editingCell.rowIndex];
    if (!row) return;

    setMutating(true);
    try {
      let parsedValue: any = editingCell.currentValue;
      if (parsedValue === "null" || parsedValue === "") {
        parsedValue = null;
      }

      const res = await fetch(
        `${apiBase}/api/v1/projects/${projectId}/studio/tables/${tableName}/rows?environment=${environment}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            action: "UPDATE",
            primaryKeyColumn: primaryKeyCol,
            primaryKeyValue: row[primaryKeyCol],
            data: { [editingCell.colName]: parsedValue },
          }),
        }
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Update failed");
      }

      // Update local row state
      setRows((prev) => {
        const next = [...prev];
        next[editingCell.rowIndex] = {
          ...next[editingCell.rowIndex],
          [editingCell.colName]: parsedValue,
        };
        return next;
      });
      setEditingCell(null);
    } catch (err: any) {
      alert(`Update error: ${err.message}`);
    } finally {
      setMutating(false);
    }
  };

  const handleDeleteRow = async (row: Record<string, any>) => {
    if (!primaryKeyCol) {
      alert("Cannot delete row: Table has no primary key defined.");
      return;
    }
    const pkValue = row[primaryKeyCol];
    if (!confirm(`Are you sure you want to delete row with ${primaryKeyCol} = "${pkValue}"?`)) {
      return;
    }

    setMutating(true);
    try {
      const res = await fetch(
        `${apiBase}/api/v1/projects/${projectId}/studio/tables/${tableName}/rows?environment=${environment}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            action: "DELETE",
            primaryKeyColumn: primaryKeyCol,
            primaryKeyValue: pkValue,
          }),
        }
      );

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || "Delete failed");
      }

      fetchRows();
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    } finally {
      setMutating(false);
    }
  };

  const handleCreateRow = async (e: React.FormEvent) => {
    e.preventDefault();
    setMutating(true);
    try {
      const dataToInsert: Record<string, any> = {};
      for (const [key, val] of Object.entries(newRowData)) {
        if (val.trim() !== "") {
          dataToInsert[key] = val;
        }
      }

      const res = await fetch(
        `${apiBase}/api/v1/projects/${projectId}/studio/tables/${tableName}/rows?environment=${environment}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            action: "INSERT",
            primaryKeyColumn: primaryKeyCol || "id",
            data: dataToInsert,
          }),
        }
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Insert failed");
      }

      setShowAddRowModal(false);
      setNewRowData({});
      fetchRows();
    } catch (err: any) {
      alert(`Insert error: ${err.message}`);
    } finally {
      setMutating(false);
    }
  };

  const columns = tableDetails?.columns || [];
  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 rounded-lg border border-slate-800 overflow-hidden shadow-xl">
      {/* Top Action Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-400" />
            <span className="font-semibold text-white tracking-wide">{tableName}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
              {total} {total === 1 ? "row" : "rows"}
            </span>
          </div>
          {primaryKeyCol && (
            <span className="text-xs text-amber-400 flex items-center gap-1 font-mono">
              <Key className="w-3 h-3" /> PK: {primaryKeyCol}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchRows()}
            disabled={loading}
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition disabled:opacity-50"
            title="Refresh rows"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={() => {
              setNewRowData({});
              setShowAddRowModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-medium transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Insert Row
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/50 border-b border-rose-800 text-rose-300 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Grid Table Container */}
      <div className="flex-1 overflow-auto relative">
        {loading && rows.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-slate-500 gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading records...</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-2">
            <Database className="w-8 h-8 opacity-40" />
            <p className="text-sm">No records found in table "{tableName}".</p>
            <button
              onClick={() => setShowAddRowModal(true)}
              className="mt-2 text-xs text-indigo-400 hover:underline"
            >
              Insert the first record
            </button>
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-xs font-mono">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 sticky top-0 z-10 select-none">
                <th className="w-12 px-3 py-2 text-center text-slate-500 font-semibold border-r border-slate-800">
                  #
                </th>
                {columns.map((col) => (
                  <th
                    key={col.name}
                    onClick={() => handleSort(col.name)}
                    className="px-4 py-2.5 font-semibold text-slate-300 border-r border-slate-800 hover:bg-slate-900 cursor-pointer transition whitespace-nowrap"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {col.isPrimaryKey && <Key className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                        <span className={col.isPrimaryKey ? "text-amber-300" : ""}>{col.name}</span>
                        <span className="text-[10px] text-slate-500 font-normal uppercase">
                          {col.dataType}
                        </span>
                      </div>
                      <ArrowUpDown className="w-3 h-3 text-slate-500 shrink-0" />
                    </div>
                  </th>
                ))}
                <th className="w-16 px-3 py-2 text-center text-slate-500 font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-800/40 transition group">
                  <td className="w-12 px-3 py-2 text-center text-slate-500 border-r border-slate-800">
                    {(page - 1) * limit + rIdx + 1}
                  </td>
                  {columns.map((col) => {
                    const isEditing =
                      editingCell?.rowIndex === rIdx && editingCell?.colName === col.name;
                    const val = row[col.name];
                    const displayVal =
                      val === null
                        ? "NULL"
                        : typeof val === "object"
                        ? JSON.stringify(val)
                        : String(val);

                    return (
                      <td
                        key={col.name}
                        onDoubleClick={() => {
                          if (primaryKeyCol) {
                            setEditingCell({
                              rowIndex: rIdx,
                              colName: col.name,
                              originalValue: val,
                              currentValue: val === null ? "" : String(val),
                            });
                          }
                        }}
                        className={`px-4 py-2 border-r border-slate-800 whitespace-nowrap max-w-xs truncate ${
                          val === null ? "text-slate-500 italic" : "text-slate-200"
                        } ${isEditing ? "p-1 bg-indigo-950/40" : ""}`}
                        title={displayVal}
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editingCell.currentValue}
                              onChange={(e) =>
                                setEditingCell({
                                  ...editingCell,
                                  currentValue: e.target.value,
                                })
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveCell();
                                if (e.key === "Escape") setEditingCell(null);
                              }}
                              autoFocus
                              className="w-full bg-slate-950 border border-indigo-500 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                            />
                            <button
                              onClick={handleSaveCell}
                              disabled={mutating}
                              className="text-emerald-400 hover:text-emerald-300 p-0.5"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingCell(null)}
                              className="text-slate-400 hover:text-white p-0.5"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          displayVal
                        )}
                      </td>
                    );
                  })}
                  <td className="w-16 px-3 py-2 text-center">
                    <button
                      onClick={() => handleDeleteRow(row)}
                      disabled={mutating}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition"
                      title="Delete row"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950 border-t border-slate-800 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
            className="bg-slate-900 border border-slate-700 text-slate-200 rounded px-2 py-1 text-xs focus:outline-none"
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="ml-2">
            Showing {Math.min((page - 1) * limit + 1, total)} to{" "}
            {Math.min(page * limit, total)} of {total} records
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="p-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Add Row Modal */}
      {showAddRowModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
              <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
                <Plus className="w-4 h-4 text-indigo-400" /> Insert Row into "{tableName}"
              </h3>
              <button
                onClick={() => setShowAddRowModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRow} className="p-6 overflow-y-auto space-y-4 flex-1">
              {columns.map((col) => (
                <div key={col.name}>
                  <label className="block text-xs font-mono font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                    {col.isPrimaryKey && <Key className="w-3.5 h-3.5 text-amber-400" />}
                    <span>{col.name}</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      ({col.dataType}) {col.isNullable ? "• nullable" : "• required"}
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder={col.defaultValue ? `Default: ${col.defaultValue}` : "NULL"}
                    value={newRowData[col.name] || ""}
                    onChange={(e) =>
                      setNewRowData({ ...newRowData, [col.name]: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-md px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none font-mono"
                  />
                </div>
              ))}

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddRowModal(false)}
                  className="px-4 py-2 rounded-md text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={mutating}
                  className="px-4 py-2 rounded-md text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-2 shadow"
                >
                  {mutating ? "Inserting..." : "Insert Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default DataGrid;
