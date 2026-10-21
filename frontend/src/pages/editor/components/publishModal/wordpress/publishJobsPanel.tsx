import React from "react";

/** What renderPublishJobsPanel reads: the PublishModal values and callbacks the inline JSX used. */
export interface PublishJobsPanelDeps {
  activeWpJob: any;
  cancellingJobId: string | null;
  handleCancelWpJob: (jobId: string) => Promise<void>;
  handleEnqueueWpPublishJob: (pageId?: string) => Promise<void>;
  handleRetryWpJob: (jobId: string) => Promise<void>;
  isCreatingJob: boolean;
  isLoadingWpJobs: boolean;
  loadWpJobs: (pageId?: string | undefined) => Promise<void>;
  retryingJobId: string | null;
  wpJobFeedback: string | null;
  wpJobs: any[];
}

/**
 * WordPress background publishing jobs panel (F-498): active job tracker and jobs history.
 * Moved verbatim from PublishModal.tsx's JSX return (lines 2186-2338 before the move). A plain
 * function, not a component: PublishModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderPublishJobsPanel({
  activeWpJob,
  cancellingJobId,
  handleCancelWpJob,
  handleEnqueueWpPublishJob,
  handleRetryWpJob,
  isCreatingJob,
  isLoadingWpJobs,
  loadWpJobs,
  retryingJobId,
  wpJobFeedback,
  wpJobs,
}: PublishJobsPanelDeps): React.ReactNode {
  return (
                  <div className="rounded-xl border border-cyan-900/50 bg-slate-900/90 p-4 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div>
                        <h4 className="text-xs font-black text-white uppercase tracking-wide flex items-center gap-1.5">
                          <span>⚡</span> WordPress Asynchronous Publishing Jobs (F-498)
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Durable queue orchestration layer for background job processing, step progress tracking, cancellation, and retry controls.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEnqueueWpPublishJob("default")}
                          disabled={isCreatingJob || (activeWpJob && (activeWpJob.status === "QUEUED" || activeWpJob.status === "RUNNING"))}
                          className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-black text-[11px] transition shadow disabled:opacity-50 cursor-pointer flex items-center gap-1"
                        >
                          <span>+</span> {isCreatingJob ? "Enqueuing..." : "Queue Publish Job"}
                        </button>
                        <button
                          type="button"
                          onClick={() => loadWpJobs()}
                          disabled={isLoadingWpJobs}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-bold transition cursor-pointer"
                        >
                          🔄 Refresh Jobs
                        </button>
                      </div>
                    </div>

                    {wpJobFeedback && (
                      <div className="p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-800/40 text-cyan-300 text-xs font-semibold">
                        ℹ️ {wpJobFeedback}
                      </div>
                    )}

                    {/* Active Job Step Tracker Card */}
                    {activeWpJob && (activeWpJob.status === "QUEUED" || activeWpJob.status === "RUNNING") && (
                      <div className="p-3.5 rounded-xl bg-cyan-950/50 border border-cyan-700/60 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="animate-spin text-cyan-400 text-sm">🔄</span>
                            <span className="text-xs font-black text-white uppercase">
                              Active Job #{activeWpJob.id}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-cyan-900 text-cyan-200 text-[10px] font-black font-mono">
                              {activeWpJob.status}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCancelWpJob(activeWpJob.id)}
                            disabled={cancellingJobId === activeWpJob.id}
                            className="px-2.5 py-1 rounded bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 font-bold text-[10px] transition cursor-pointer"
                          >
                            {cancellingJobId === activeWpJob.id ? "Cancelling..." : "Cancel Job"}
                          </button>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-bold text-cyan-300">
                            <span>Step: {activeWpJob.step || "Processing..."}</span>
                            <span>{activeWpJob.progressPercent || 50}%</span>
                          </div>
                          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-cyan-400 transition-all duration-500 rounded-full animate-pulse"
                              style={{ width: `${activeWpJob.progressPercent || 50}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Jobs History List Table */}
                    <div className="space-y-2">
                      <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                        <span>Publishing Jobs Queue History</span>
                        <span>Total: {wpJobs.length}</span>
                      </div>

                      {isLoadingWpJobs ? (
                        <div className="py-6 text-center text-xs text-slate-400 italic">
                          Loading background publishing jobs...
                        </div>
                      ) : wpJobs.length === 0 ? (
                        <div className="py-4 text-center text-xs text-slate-500 bg-slate-950/40 rounded-lg border border-slate-800">
                          No background publishing jobs queued yet. Click "Queue Publish Job" above to enqueue an async publish operation.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {wpJobs.map((job) => (
                            <div
                              key={job.id}
                              className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-slate-700 flex items-center justify-between gap-3 text-xs transition"
                            >
                              <div className="space-y-1 truncate">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase border ${
                                      job.status === "COMPLETED"
                                        ? "bg-emerald-950 border-emerald-800 text-emerald-300"
                                        : job.status === "RUNNING"
                                        ? "bg-cyan-950 border-cyan-800 text-cyan-300 animate-pulse"
                                        : job.status === "QUEUED"
                                        ? "bg-amber-950 border-amber-800 text-amber-300"
                                        : job.status === "CANCELLED"
                                        ? "bg-slate-800 border-slate-700 text-slate-400"
                                        : "bg-rose-950 border-rose-800 text-rose-300"
                                    }`}
                                  >
                                    {job.status}
                                  </span>
                                  <span className="font-mono text-slate-300 font-bold">#{job.id}</span>
                                  <span className="text-slate-400 text-[10px]">Page: {job.payload?.pageId || "default"}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 flex items-center gap-3">
                                  <span>🕒 {new Date(job.createdAt).toLocaleString()}</span>
                                  <span>Attempts: {job.attempts || 0}/{job.maxAttempts || 3}</span>
                                  {job.lastError && (
                                    <span className="text-rose-400 truncate max-w-xs">Error: {job.lastError}</span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {(job.status === "FAILED" || job.status === "CANCELLED") && (
                                  <button
                                    type="button"
                                    onClick={() => handleRetryWpJob(job.id)}
                                    disabled={retryingJobId === job.id}
                                    className="px-2.5 py-1 rounded bg-indigo-950 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 text-[10px] font-bold transition cursor-pointer"
                                  >
                                    {retryingJobId === job.id ? "Retrying..." : "🔄 Retry"}
                                  </button>
                                )}
                                {(job.status === "QUEUED" || job.status === "RUNNING") && (
                                  <button
                                    type="button"
                                    onClick={() => handleCancelWpJob(job.id)}
                                    disabled={cancellingJobId === job.id}
                                    className="px-2.5 py-1 rounded bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 text-[10px] font-bold transition cursor-pointer"
                                  >
                                    {cancellingJobId === job.id ? "Cancelling..." : "✕ Cancel"}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
  );
}
