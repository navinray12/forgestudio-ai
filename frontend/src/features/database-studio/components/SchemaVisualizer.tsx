import React, { useState, useEffect } from "react";
import { Key, ArrowRight, RefreshCw, Layers, Search } from "lucide-react";
import type { TableNode, TableEdge } from "../types/studio.types";

interface SchemaVisualizerProps {
  projectId: string;
  apiBase: string;
}

export const SchemaVisualizer: React.FC<SchemaVisualizerProps> = ({ projectId, apiBase }) => {
  const [nodes, setNodes] = useState<TableNode[]>([]);
  const [edges, setEdges] = useState<TableEdge[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const fetchDiagram = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/v1/projects/${projectId}/studio/diagram`, {
        credentials: "include",
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setNodes(json.data.tables || []);
        setEdges(json.data.relationships || []);
      }
    } catch (err) {
      console.error("Failed to load schema diagram", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagram();
  }, [projectId]);

  const filteredNodes = nodes.filter((n) =>
    n.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-lg border border-slate-800 overflow-hidden shadow-xl">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Layers className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="text-xs font-semibold text-white tracking-wide font-mono">
              Entity-Relationship (ER) Diagram
            </h3>
            <span className="text-[11px] text-slate-500">
              {nodes.length} tables • {edges.length} foreign key relationships
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-48">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search tables..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 pl-8 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            onClick={fetchDiagram}
            disabled={loading}
            className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
            title="Refresh diagram"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 overflow-auto p-6 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
        {loading && nodes.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-slate-500 gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-xs font-mono">Synthesizing entity schema...</span>
          </div>
        ) : filteredNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-2">
            <Layers className="w-8 h-8 opacity-40" />
            <span className="text-xs font-mono">No tables discovered in schema</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredNodes.map((table) => {
              const relatedEdges = edges.filter(
                (e) => e.sourceTable === table.name || e.targetTable === table.name
              );

              return (
                <div
                  key={table.id}
                  className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-lg hover:border-indigo-500/50 transition flex flex-col"
                >
                  <div className="px-4 py-2.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-indigo-300">
                      {table.name}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {table.columns.length} cols
                    </span>
                  </div>

                  <div className="p-3 divide-y divide-slate-800/40 font-mono text-xs">
                    {table.columns.map((col) => (
                      <div
                        key={col.name}
                        className="py-1.5 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          {col.isPrimaryKey ? (
                            <Key className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          ) : (
                            <div className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span
                            className={
                              col.isPrimaryKey
                                ? "text-amber-300 font-medium truncate"
                                : "text-slate-300 truncate"
                            }
                          >
                            {col.name}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 uppercase shrink-0">
                          {col.type}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Relationship Badges */}
                  {relatedEdges.length > 0 && (
                    <div className="px-3 py-2 bg-slate-900/30 border-t border-slate-800/60 text-[10px] font-mono space-y-1">
                      <span className="text-slate-500 uppercase font-semibold block text-[9px]">
                        Relations
                      </span>
                      {relatedEdges.map((rel) => {
                        const isSource = rel.sourceTable === table.name;
                        return (
                          <div
                            key={rel.id}
                            className="flex items-center gap-1 text-slate-400 truncate"
                          >
                            {isSource ? (
                              <>
                                <span className="text-indigo-400 truncate">{rel.sourceColumn}</span>
                                <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
                                <span className="text-slate-300 truncate">
                                  {rel.targetTable}.{rel.targetColumn}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="text-slate-500 truncate">
                                  {rel.sourceTable}.{rel.sourceColumn}
                                </span>
                                <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
                                <span className="text-emerald-400 truncate">{rel.targetColumn}</span>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
export default SchemaVisualizer;
