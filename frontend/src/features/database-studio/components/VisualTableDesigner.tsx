import React, { useState } from "react";
import { Plus, Trash2, Key, X, Table, ShieldCheck } from "lucide-react";
import type { ColumnDefinition } from "../types/studio.types";

interface VisualTableDesignerProps {
  projectId: string;
  apiBase: string;
  isOpen: boolean;
  onClose: () => void;
  onTableCreated: (tableName: string) => void;
}

const DATA_TYPES = [
  { label: "UUID (Unique ID)", value: "UUID" },
  { label: "VARCHAR (Short Text)", value: "VARCHAR(255)" },
  { label: "TEXT (Long Content)", value: "TEXT" },
  { label: "INTEGER (32-bit)", value: "INTEGER" },
  { label: "BIGINT (64-bit)", value: "BIGINT" },
  { label: "BOOLEAN (True / False)", value: "BOOLEAN" },
  { label: "TIMESTAMPTZ (Date with Timezone)", value: "TIMESTAMPTZ" },
  { label: "JSONB (JSON Document)", value: "JSONB" },
  { label: "NUMERIC (Precise Decimal)", value: "NUMERIC(10,2)" },
];

export const VisualTableDesigner: React.FC<VisualTableDesignerProps> = ({
  projectId,
  apiBase,
  isOpen,
  onClose,
  onTableCreated,
}) => {
  const [tableName, setTableName] = useState("");
  const [columns, setColumns] = useState<ColumnDefinition[]>([
    {
      name: "id",
      type: "UUID",
      isPrimaryKey: true,
      isNullable: false,
      defaultValue: "gen_random_uuid()",
    },
    {
      name: "created_at",
      type: "TIMESTAMPTZ",
      isPrimaryKey: false,
      isNullable: false,
      defaultValue: "now()",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddColumn = () => {
    setColumns([
      ...columns,
      {
        name: `column_${columns.length + 1}`,
        type: "VARCHAR(255)",
        isPrimaryKey: false,
        isNullable: true,
        defaultValue: null,
      },
    ]);
  };

  const handleRemoveColumn = (index: number) => {
    if (columns.length <= 1) return;
    setColumns(columns.filter((_, idx) => idx !== index));
  };

  const handleUpdateColumn = (index: number, updates: Partial<ColumnDefinition>) => {
    setColumns(
      columns.map((col, idx) => {
        if (idx === index) {
          return { ...col, ...updates };
        }
        return col;
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableName.trim()) {
      setError("Please provide a valid table name.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBase}/api/v1/projects/${projectId}/studio/tables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: tableName.trim(),
          columns,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Failed to create table");
      }

      onTableCreated(tableName.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create table");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-950 text-indigo-400 border border-indigo-800/60">
              <Table className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Visual DDL Table Designer
              </h2>
              <p className="text-xs text-slate-400">
                Design a new relational table and apply schema changes instantly.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-950/40 border border-rose-800 text-rose-300 text-xs rounded-md">
            {error}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Table Name Input */}
          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
              Table Name
            </label>
            <input
              type="text"
              placeholder="e.g. products, customers, orders"
              value={tableName}
              onChange={(e) => setTableName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
              required
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-600 focus:outline-none font-mono"
            />
          </div>

          {/* Columns Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                Columns Configuration
              </span>
              <button
                type="button"
                onClick={handleAddColumn}
                className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 rounded text-xs font-medium transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Column
              </button>
            </div>

            <div className="space-y-2.5">
              {columns.map((col, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 text-xs font-mono"
                >
                  <div className="flex-1 min-w-[130px]">
                    <input
                      type="text"
                      placeholder="column_name"
                      value={col.name}
                      onChange={(e) =>
                        handleUpdateColumn(idx, {
                          name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                        })
                      }
                      required
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="w-48">
                    <select
                      value={col.type}
                      onChange={(e) => handleUpdateColumn(idx, { type: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                    >
                      {DATA_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-32">
                    <input
                      type="text"
                      placeholder="Default"
                      value={col.defaultValue || ""}
                      onChange={(e) =>
                        handleUpdateColumn(idx, {
                          defaultValue: e.target.value.trim() ? e.target.value : null,
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white focus:outline-none placeholder-slate-600 text-xs"
                    />
                  </div>

                  <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer select-none px-2">
                    <input
                      type="checkbox"
                      checked={col.isPrimaryKey || false}
                      onChange={(e) =>
                        handleUpdateColumn(idx, {
                          isPrimaryKey: e.target.checked,
                          isNullable: e.target.checked ? false : col.isNullable,
                        })
                      }
                      className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0"
                    />
                    <Key className={`w-3.5 h-3.5 ${col.isPrimaryKey ? "text-amber-400" : "text-slate-600"}`} />
                    <span>PK</span>
                  </label>

                  <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer select-none px-2">
                    <input
                      type="checkbox"
                      checked={col.isNullable ?? true}
                      disabled={col.isPrimaryKey}
                      onChange={(e) =>
                        handleUpdateColumn(idx, { isNullable: e.target.checked })
                      }
                      className="rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-0"
                    />
                    <span>Null</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => handleRemoveColumn(idx)}
                    disabled={columns.length <= 1}
                    className="p-1 text-slate-500 hover:text-rose-400 disabled:opacity-30 disabled:hover:text-slate-500 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 bg-indigo-950/20 border border-indigo-900/40 rounded-lg flex items-start gap-2.5 text-xs text-indigo-300">
            <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <p>
              Changes will be executed against your isolated project database and automatically tracked in the schema migration journal.
            </p>
          </div>

          {/* Actions */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-2 shadow-lg"
            >
              {loading ? "Creating..." : "Create Table"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default VisualTableDesigner;
