import React, { useState, useEffect } from "react";
import {
  Package,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle,
  RotateCw,
  Sparkles,
  Shield,
  ExternalLink,
  Layers,
  Search,
} from "lucide-react";
import { forgeProjectService } from "../services/forgeProjectService";

interface DependencyPanelProps {
  projectId: string;
}

export const DependencyPanel: React.FC<DependencyPanelProps> = ({ projectId }) => {
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [pkgName, setPkgName] = useState("");
  const [pkgVersion, setPkgVersion] = useState("");
  const [isDev, setIsDev] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [aiModal, setAiModal] = useState<{ conflict: any; explanation?: any } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const loadDependencies = async () => {
    try {
      setLoading(true);
      const res = await forgeProjectService.getDependencies(projectId);
      setAnalysis(res.analysis);
    } catch (err: any) {
      console.error("Failed to load dependencies:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDependencies();
  }, [projectId]);

  const handleInstall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkgName.trim()) return;
    try {
      setInstalling(true);
      await forgeProjectService.installDependency(projectId, {
        name: pkgName.trim(),
        version: pkgVersion.trim() || undefined,
        isDev,
      });
      setInstallModalOpen(false);
      setPkgName("");
      setPkgVersion("");
      await loadDependencies();
    } catch (err: any) {
      alert(`Install failed: ${err.message}`);
    } finally {
      setInstalling(false);
    }
  };

  const handleRemove = async (name: string) => {
    if (!window.confirm(`Are you sure you want to remove '${name}'?`)) return;
    try {
      await forgeProjectService.removeDependency(projectId, name);
      await loadDependencies();
    } catch (err: any) {
      alert(`Remove failed: ${err.message}`);
    }
  };

  const handleAskAiAboutConflict = async (conflict: any) => {
    try {
      setAiLoading(true);
      setAiModal({ conflict });
      const exp = await forgeProjectService.explainDependencyFailure(
        projectId,
        conflict.conflictReason || "Peer dependency conflict"
      );
      setAiModal({ conflict, explanation: exp });
    } catch (err: any) {
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 font-mono text-xs gap-2">
        <RotateCw className="w-4 h-4 animate-spin text-blue-400" />
        <span>Analyzing project dependencies and lockfiles...</span>
      </div>
    );
  }

  const directDeps = (analysis?.directDependencies || []).filter((d: any) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 overflow-hidden font-sans select-none">
      {/* Top Header Summary */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold text-slate-100">
            <Package className="w-4 h-4 text-blue-400" />
            <span>Dependency Manager</span>
          </div>

          <span className="px-2 py-0.5 rounded bg-blue-950/80 border border-blue-800/60 text-blue-300 font-mono text-[10px] uppercase font-semibold">
            {analysis?.packageManager || "npm"}
          </span>

          {analysis?.peerConflicts?.length > 0 && (
            <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-800/60 text-amber-300 font-mono text-[10px] flex items-center gap-1 font-semibold">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span>{analysis.peerConflicts.length} Peer Conflict(s)</span>
            </span>
          )}

          {analysis?.outdatedCount > 0 && (
            <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/60 text-cyan-300 font-mono text-[10px]">
              {analysis.outdatedCount} Outdated
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter dependencies..."
              className="pl-7 pr-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 w-40"
            />
          </div>

          <button
            onClick={() => setInstallModalOpen(true)}
            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold flex items-center gap-1 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Install Package</span>
          </button>
        </div>
      </div>

      {/* Peer Dependency Warnings Banner */}
      {analysis?.peerConflicts?.length > 0 && (
        <div className="p-2.5 bg-amber-950/40 border-b border-amber-900/60 space-y-1.5">
          {analysis.peerConflicts.map((c: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-xs text-amber-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{c.conflictReason}</span>
              </div>
              <button
                onClick={() => handleAskAiAboutConflict(c)}
                className="px-2 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-300 text-[11px] flex items-center gap-1 hover:bg-purple-900 transition"
              >
                <Sparkles className="w-3 h-3 text-purple-400" />
                <span>Ask AI</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Dependencies Table */}
      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-500 font-mono text-[11px]">
              <th className="pb-2 font-semibold">Package</th>
              <th className="pb-2 font-semibold">Installed</th>
              <th className="pb-2 font-semibold">Latest</th>
              <th className="pb-2 font-semibold">Type</th>
              <th className="pb-2 font-semibold">License</th>
              <th className="pb-2 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900 font-mono">
            {directDeps.map((dep: any) => (
              <tr key={dep.name} className="hover:bg-slate-900/50 transition">
                <td className="py-2 font-semibold text-slate-200">{dep.name}</td>
                <td className="py-2 text-slate-300">{dep.version}</td>
                <td className="py-2">
                  <span
                    className={
                      dep.isOutdated
                        ? dep.updateType === "major"
                          ? "text-rose-400 font-semibold"
                          : "text-amber-400 font-semibold"
                        : "text-emerald-400"
                    }
                  >
                    {dep.latestVersion}
                  </span>
                </td>
                <td className="py-2">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-sans uppercase ${
                      dep.type === "devDependency"
                        ? "bg-slate-800 text-slate-400"
                        : "bg-blue-950 text-blue-300 border border-blue-900"
                    }`}
                  >
                    {dep.type === "devDependency" ? "dev" : "prod"}
                  </span>
                </td>
                <td className="py-2 text-slate-400">{dep.license || "MIT"}</td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => handleRemove(dep.name)}
                    className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-slate-800 transition"
                    title="Remove package"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Install Package Modal */}
      {installModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-100 mb-1">Install Package</h3>
            <p className="text-xs text-slate-400 mb-4">
              Add a production or development dependency to your project.
            </p>
            <form onSubmit={handleInstall} className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">Package Name</label>
                <input
                  type="text"
                  value={pkgName}
                  onChange={(e) => setPkgName(e.target.value)}
                  placeholder="e.g. framer-motion, zustand, @tanstack/react-query"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">Version (optional)</label>
                <input
                  type="text"
                  value={pkgVersion}
                  onChange={(e) => setPkgVersion(e.target.value)}
                  placeholder="latest (or ^18.2.0)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isDevCheck"
                  checked={isDev}
                  onChange={(e) => setIsDev(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0"
                />
                <label htmlFor="isDevCheck" className="text-xs text-slate-300 cursor-pointer">
                  Save as Development Dependency (--save-dev)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setInstallModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={installing}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold flex items-center gap-1.5"
                >
                  {installing && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{installing ? "Installing..." : "Install"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Conflict Modal */}
      {aiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-slate-900 border border-purple-500/80 rounded-xl p-5 shadow-2xl">
            <div className="flex items-center gap-2 text-purple-300 font-bold text-sm mb-2">
              <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
              <span>AI Dependency Conflict Analysis</span>
            </div>

            {aiLoading ? (
              <div className="py-6 flex items-center justify-center text-slate-400 gap-2">
                <RotateCw className="w-4 h-4 animate-spin text-purple-400" />
                <span>Consulting dependency intelligence...</span>
              </div>
            ) : (
              aiModal.explanation && (
                <div className="space-y-3 text-xs leading-relaxed">
                  <div>
                    <span className="font-bold text-slate-200 block mb-1">Diagnosis:</span>
                    <p className="text-slate-300 bg-slate-950 p-2.5 rounded border border-slate-800">
                      {aiModal.explanation.diagnosis}
                    </p>
                  </div>
                  <div>
                    <span className="font-bold text-slate-200 block mb-1">Probable Cause:</span>
                    <p className="text-slate-400">{aiModal.explanation.probableCause}</p>
                  </div>
                  <div>
                    <span className="font-bold text-slate-200 block mb-1">Recommended Actions:</span>
                    <ul className="list-disc pl-5 space-y-1 text-slate-300">
                      {aiModal.explanation.recommendedActions.map((act: string, idx: number) => (
                        <li key={idx}>{act}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )
            )}

            <div className="flex justify-end pt-4">
              <button
                onClick={() => setAiModal(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
