import React, { useState, useEffect } from "react";
import {
  GitBranch,
  GitCommit,
  GitPullRequest,
  RotateCw,
  Plus,
  Minus,
  Check,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  ArrowUp,
  ArrowDown,
  Layers,
  FileCode,
  Shield,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Archive,
  Tag,
  GitFork,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { forgeProjectService } from "../services/forgeProjectService";

interface GitPanelProps {
  projectId: string;
  onOpenFile?: (filePath: string) => void;
}

export const GitPanel: React.FC<GitPanelProps> = ({ projectId, onOpenFile }) => {
  const [activeSubTab, setActiveSubTab] = useState<"changes" | "branches" | "history" | "github" | "stashes">("changes");
  const [status, setStatus] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [pullRequests, setPullRequests] = useState<any[]>([]);
  const [stashes, setStashes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Commit form
  const [commitMessage, setCommitMessage] = useState("");
  const [committing, setCommitting] = useState(false);

  // Branch management
  const [newBranchName, setNewBranchName] = useState("");
  const [creatingBranch, setCreatingBranch] = useState(false);

  // PR Form
  const [prTitle, setPrTitle] = useState("");
  const [prBody, setPrBody] = useState("");
  const [prSource, setPrSource] = useState("");
  const [creatingPr, setCreatingPr] = useState(false);

  // Sync / Push / Pull
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [selectedDiff, setSelectedDiff] = useState<any>(null);

  const loadGitState = async () => {
    try {
      setLoading(true);
      const [statusRes, branchRes, histRes, prRes, stashRes] = await Promise.all([
        forgeProjectService.getGitStatus(projectId).catch(() => ({ success: false, status: null })),
        forgeProjectService.listGitBranches(projectId).catch(() => ({ success: false, branches: [] })),
        forgeProjectService.getGitHistory(projectId, { limit: 30 }).catch(() => ({ success: false, history: [] })),
        forgeProjectService.listGithubPrs(projectId).catch(() => ({ success: false, pullRequests: [] })),
        forgeProjectService.listGitStashes(projectId).catch(() => ({ success: false, stashes: [] })),
      ]);

      if (statusRes.status) {
        setStatus(statusRes.status);
        setPrSource(statusRes.status.branch);
      }
      setBranches(branchRes.branches || []);
      setHistory(histRes.history || []);
      setPullRequests(prRes.pullRequests || []);
      setStashes(stashRes.stashes || []);
    } catch (e) {
      console.warn("Could not load Git state:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGitState();
  }, [projectId]);

  const handleStage = async (path: string | "all") => {
    try {
      await forgeProjectService.stageGitFiles(projectId, path === "all" ? "all" : [path]);
      await loadGitState();
    } catch (err: any) {
      alert(`Stage failed: ${err.message}`);
    }
  };

  const handleUnstage = async (path: string | "all") => {
    try {
      await forgeProjectService.unstageGitFiles(projectId, path === "all" ? "all" : [path]);
      await loadGitState();
    } catch (err: any) {
      alert(`Unstage failed: ${err.message}`);
    }
  };

  const handleCommit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitMessage.trim()) return;
    try {
      setCommitting(true);
      await forgeProjectService.commitGit(projectId, { message: commitMessage.trim() });
      setCommitMessage("");
      await loadGitState();
    } catch (err: any) {
      alert(`Commit error: ${err.message}`);
    } finally {
      setCommitting(false);
    }
  };

  const handlePush = async (force = false) => {
    if (force && !confirm("Warning: Force pushing will overwrite remote branch history. Confirm force push?")) return;
    try {
      setPushing(true);
      await forgeProjectService.pushGithubRemote(projectId, { force });
      alert("Successfully pushed commits to GitHub remote!");
      await loadGitState();
    } catch (err: any) {
      alert(`Push error: ${err.message}`);
    } finally {
      setPushing(false);
    }
  };

  const handlePull = async () => {
    try {
      setPulling(true);
      await forgeProjectService.pullGithubRemote(projectId);
      alert("Branch successfully pulled and up to date!");
      await loadGitState();
    } catch (err: any) {
      alert(`Pull error: ${err.message}`);
    } finally {
      setPulling(false);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    try {
      setCreatingBranch(true);
      await forgeProjectService.createGitBranch(projectId, { name: newBranchName.trim() });
      await forgeProjectService.switchGitBranch(projectId, { name: newBranchName.trim() });
      setNewBranchName("");
      await loadGitState();
    } catch (err: any) {
      alert(`Create branch error: ${err.message}`);
    } finally {
      setCreatingBranch(false);
    }
  };

  const handleSwitchBranch = async (branchName: string) => {
    try {
      await forgeProjectService.switchGitBranch(projectId, { name: branchName });
      await loadGitState();
    } catch (err: any) {
      alert(`Switch branch error: ${err.message}`);
    }
  };

  const handleCreatePr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prTitle.trim() || !prSource.trim()) return;
    try {
      setCreatingPr(true);
      await forgeProjectService.createGithubPr(projectId, {
        title: prTitle.trim(),
        body: prBody.trim(),
        sourceBranch: prSource,
        targetBranch: "main",
      });
      alert("Pull request created successfully!");
      setPrTitle("");
      setPrBody("");
      await loadGitState();
      setActiveSubTab("github");
    } catch (err: any) {
      alert(`Create PR error: ${err.message}`);
    } finally {
      setCreatingPr(false);
    }
  };

  const handleViewDiff = async (filePath: string, staged: boolean) => {
    try {
      const res = await forgeProjectService.getGitDiff(projectId, { filePath, staged });
      if (res.diff && res.diff.length > 0) {
        setSelectedDiff(res.diff[0]);
      }
    } catch (e) {
      console.warn("Could not load diff:", e);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 overflow-hidden font-sans select-none">
      {/* Top Header & Sub-Tabs */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-semibold text-slate-100">
            <GitBranch className="w-4 h-4 text-emerald-400" />
            <span>Source Control ({status?.branch || "main"})</span>
          </div>

          <div className="flex bg-slate-950 p-0.5 rounded border border-slate-800">
            {(
              [
                { id: "changes", label: `Changes (${(status?.staged?.length || 0) + (status?.unstaged?.length || 0) + (status?.untracked?.length || 0)})` },
                { id: "branches", label: `Branches (${branches.length})` },
                { id: "history", label: `History (${history.length})` },
                { id: "github", label: `GitHub PRs (${pullRequests.length})` },
                { id: "stashes", label: `Stashes (${stashes.length})` },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveSubTab(t.id)}
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition ${
                  activeSubTab === t.id
                    ? "bg-slate-800 text-slate-100 shadow-xs"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status && (
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mr-2">
              <span className="flex items-center gap-0.5 text-blue-400" title="Commits ahead of remote">
                <ArrowUp className="w-3 h-3" />
                {status.aheadCount || 0}
              </span>
              <span className="flex items-center gap-0.5 text-amber-400" title="Commits behind remote">
                <ArrowDown className="w-3 h-3" />
                {status.behindCount || 0}
              </span>
            </div>
          )}

          <button
            onClick={handlePull}
            disabled={pulling}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition disabled:opacity-50"
            title="Pull from GitHub"
          >
            <ArrowDown className={`w-3 h-3 ${pulling ? "animate-spin" : ""}`} />
            <span>Pull</span>
          </button>

          <button
            onClick={() => handlePush(false)}
            disabled={pushing}
            className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition disabled:opacity-50"
            title="Push commits to GitHub"
          >
            <ArrowUp className={`w-3 h-3 ${pushing ? "animate-spin" : ""}`} />
            <span>Push</span>
          </button>

          <button
            onClick={loadGitState}
            disabled={loading}
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition"
            title="Refresh Git status"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* SUBTAB 1: CHANGES & COMMIT FORM */}
        {activeSubTab === "changes" && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left Column: Staging, Unstaged, and Untracked */}
            <div className="w-96 border-r border-slate-800 bg-slate-900/50 flex flex-col overflow-hidden">
              {/* Commit Input Box */}
              <form onSubmit={handleCommit} className="p-3 border-b border-slate-800 bg-slate-900">
                <div className="relative">
                  <textarea
                    rows={2}
                    placeholder="Message (Ctrl+Enter to commit)"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        handleCommit(e);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono resize-none"
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-slate-500">
                    {status?.staged?.length || 0} file(s) staged
                  </span>
                  <button
                    type="submit"
                    disabled={committing || !commitMessage.trim() || status?.staged?.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold shadow-xs transition disabled:opacity-40"
                  >
                    <GitCommit className="w-3.5 h-3.5" />
                    <span>{committing ? "Committing..." : "Commit"}</span>
                  </button>
                </div>
              </form>

              {/* Changes Lists */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2 space-y-3">
                {/* Staged Changes */}
                <div>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1 px-1">
                    <span>STAGED CHANGES ({status?.staged?.length || 0})</span>
                    {status?.staged?.length > 0 && (
                      <button
                        onClick={() => handleUnstage("all")}
                        className="text-[10px] text-slate-400 hover:text-slate-200"
                        title="Unstage all"
                      >
                        Unstage All
                      </button>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {(status?.staged || []).map((file: any) => (
                      <div
                        key={file.path}
                        className="flex items-center justify-between p-1 rounded hover:bg-slate-800/60 text-xs font-mono group cursor-pointer"
                        onClick={() => handleViewDiff(file.path, true)}
                      >
                        <span className="text-emerald-400 truncate max-w-[240px]">{file.path}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnstage(file.path);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200"
                          title="Unstage file"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Changes / Unstaged */}
                <div className="pt-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1 px-1">
                    <span>CHANGES ({status?.unstaged?.length || 0})</span>
                    {status?.unstaged?.length > 0 && (
                      <button
                        onClick={() => handleStage("all")}
                        className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium"
                        title="Stage all changes"
                      >
                        Stage All
                      </button>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {(status?.unstaged || []).map((file: any) => (
                      <div
                        key={file.path}
                        className="flex items-center justify-between p-1 rounded hover:bg-slate-800/60 text-xs font-mono group cursor-pointer"
                        onClick={() => handleViewDiff(file.path, false)}
                      >
                        <span className="text-amber-400 truncate max-w-[240px]">{file.path}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStage(file.path);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200"
                          title="Stage file"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Untracked Files */}
                {status?.untracked?.length > 0 && (
                  <div className="pt-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1 px-1">
                      <span>UNTRACKED ({status.untracked.length})</span>
                    </div>
                    <div className="space-y-0.5">
                      {status.untracked.map((path: string) => (
                        <div
                          key={path}
                          className="flex items-center justify-between p-1 rounded hover:bg-slate-800/60 text-xs font-mono group"
                        >
                          <span className="text-slate-400 truncate max-w-[240px]">{path}</span>
                          <button
                            onClick={() => handleStage(path)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200"
                            title="Track & stage file"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Diff Preview */}
            <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
              {selectedDiff ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="px-3 py-2 bg-slate-900 border-b border-slate-800 text-xs font-mono flex items-center justify-between">
                    <span className="font-semibold text-slate-200">{selectedDiff.filePath}</span>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-emerald-400">+{selectedDiff.additions}</span>
                      <span className="text-rose-400">-{selectedDiff.deletions}</span>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed divide-y divide-slate-800/20 bg-slate-950">
                    {(selectedDiff.chunks || []).map((chunk: any, cIdx: number) => (
                      <div key={cIdx} className="space-y-0.5 py-1">
                        {chunk.lines.map((line: string, lIdx: number) => (
                          <div
                            key={lIdx}
                            className={`px-2 py-0.5 rounded-xs ${
                              line.startsWith("+")
                                ? "bg-emerald-950/40 text-emerald-300"
                                : line.startsWith("-")
                                ? "bg-rose-950/40 text-rose-300"
                                : "text-slate-400"
                            }`}
                          >
                            {line}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
                  Select a changed or staged file from the left to inspect inline diff.
                </div>
              )}
            </div>
          </div>
        )}

        {/* SUBTAB 2: BRANCH MANAGEMENT */}
        {activeSubTab === "branches" && (
          <div className="flex-1 p-4 overflow-y-auto max-w-3xl">
            {/* Create Branch */}
            <form onSubmit={handleCreateBranch} className="flex items-center gap-2 mb-4">
              <input
                type="text"
                placeholder="New branch name (e.g. feature/checkout-flow)"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
              />
              <button
                type="submit"
                disabled={creatingBranch || !newBranchName.trim()}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold transition disabled:opacity-40 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create & Switch</span>
              </button>
            </form>

            {/* Branch List */}
            <div className="border border-slate-800 rounded-md divide-y divide-slate-800 bg-slate-900/60">
              {branches.map((b) => (
                <div key={b.name} className="p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-mono">
                    <GitBranch className={`w-4 h-4 ${b.isCurrent ? "text-emerald-400" : "text-slate-500"}`} />
                    <span className={`font-semibold ${b.isCurrent ? "text-slate-100" : "text-slate-300"}`}>
                      {b.name}
                    </span>
                    {b.isCurrent && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                        ACTIVE
                      </span>
                    )}
                    {b.isProtected && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-950 text-indigo-400 border border-indigo-800/40">
                        PROTECTED
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-slate-500">{b.commitHash?.slice(0, 7)}</span>
                    {!b.isCurrent && (
                      <button
                        onClick={() => handleSwitchBranch(b.name)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition"
                      >
                        Checkout
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUBTAB 3: COMMIT HISTORY GRAPH */}
        {activeSubTab === "history" && (
          <div className="flex-1 overflow-y-auto p-4 max-w-4xl">
            <div className="border border-slate-800 rounded-md divide-y divide-slate-800 bg-slate-900/60 font-mono text-xs">
              {history.map((c) => (
                <div key={c.hash} className="p-3 hover:bg-slate-850/50 transition flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200">{c.message}</span>
                      {c.isHead && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                          HEAD
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-slate-500 text-[11px] mt-1">
                      <span>{c.author?.name}</span>
                      <span>{new Date(c.timestamp).toLocaleString()}</span>
                      <span className="text-slate-400">branch: {c.branch}</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-slate-950 rounded text-slate-400 border border-slate-800 text-[11px]">
                    {c.hash.slice(0, 7)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUBTAB 4: GITHUB WORKFLOW & PULL REQUESTS */}
        {activeSubTab === "github" && (
          <div className="flex-1 p-4 overflow-y-auto max-w-4xl space-y-4">
            {/* Create PR Form */}
            <form onSubmit={handleCreatePr} className="p-4 bg-slate-900 border border-slate-800 rounded-md space-y-2.5">
              <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <GitPullRequest className="w-4 h-4 text-cyan-400" />
                <span>Create GitHub Pull Request</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="PR Title"
                  value={prTitle}
                  onChange={(e) => setPrTitle(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
                <input
                  type="text"
                  placeholder="Source branch (e.g. main)"
                  value={prSource}
                  onChange={(e) => setPrSource(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
              <textarea
                rows={2}
                placeholder="Description of changes and PR context..."
                value={prBody}
                onChange={(e) => setPrBody(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-sans resize-none"
              />
              <button
                type="submit"
                disabled={creatingPr || !prTitle.trim() || !prSource.trim()}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold transition disabled:opacity-40"
              >
                {creatingPr ? "Creating..." : "Open Pull Request"}
              </button>
            </form>

            {/* Pull Requests List */}
            <div className="border border-slate-800 rounded-md divide-y divide-slate-800 bg-slate-900/60 text-xs">
              <div className="px-3 py-2 bg-slate-900 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                Pull Requests ({pullRequests.length})
              </div>
              {pullRequests.length === 0 ? (
                <div className="p-4 text-center text-slate-500">No open pull requests found.</div>
              ) : (
                pullRequests.map((pr) => (
                  <div key={pr.githubPrNumber} className="p-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-200">
                          #{pr.githubPrNumber} {pr.title}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-950 text-cyan-400 border border-cyan-800/40">
                          {pr.status}
                        </span>
                      </div>
                      <div className="text-slate-500 text-[11px] font-mono mt-1">
                        {pr.sourceBranch} ➜ {pr.targetBranch} | {new Date(pr.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    {pr.url && (
                      <a
                        href={pr.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-mono text-[11px]"
                      >
                        <span>View on GitHub</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* SUBTAB 5: STASHES */}
        {activeSubTab === "stashes" && (
          <div className="flex-1 p-4 overflow-y-auto max-w-3xl">
            <div className="border border-slate-800 rounded-md divide-y divide-slate-800 bg-slate-900/60 text-xs">
              <div className="px-3 py-2 bg-slate-900 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                Saved Stashes ({stashes.length})
              </div>
              {stashes.length === 0 ? (
                <div className="p-4 text-center text-slate-500">No saved stashes.</div>
              ) : (
                stashes.map((s) => (
                  <div key={s.id} className="p-3 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-200 font-mono">stash@&#123;{s.index}&#125;</span>:{" "}
                      <span className="text-slate-300">{s.message}</span>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        branch: {s.branch} | {new Date(s.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          await forgeProjectService.applyGitStash(projectId, s.index, true);
                          await loadGitState();
                        }}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs"
                      >
                        Pop
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
