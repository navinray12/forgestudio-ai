import React from "react";
import type { TabType } from "../types";
import { Archive, Clock, Download, Edit3, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";

/** What renderBackupsTab reads: the ManagedSiteModal values and callbacks the inline JSX used. */
export interface BackupsTabDeps {
  activeTab: TabType;
  backupPolicy: { enabled: boolean; cronExpression: string; retainCount: number; trigger: string; };
  backupPolicySaving: boolean;
  backups: any[];
  backupsLoading: boolean;
  fetchBackups: () => Promise<void>;
  handleDownloadBackup: (backupId: string) => void;
  handleSaveBackupPolicy: (e: React.FormEvent<Element>) => Promise<void>;
  setBackupPolicy: React.Dispatch<React.SetStateAction<{ enabled: boolean; cronExpression: string; retainCount: number; trigger: string; }>>;
  setCreateBackupModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setDeleteBackupConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setDeleteTargetBackup: React.Dispatch<any>;
  setNewBackupLabel: React.Dispatch<React.SetStateAction<string>>;
  setNewBackupNotes: React.Dispatch<React.SetStateAction<string>>;
  setRenameBackupModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setRenameLabel: React.Dispatch<React.SetStateAction<string>>;
  setRenameNotes: React.Dispatch<React.SetStateAction<string>>;
  setRestoreConfirmModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setRestoreTargetBackup: React.Dispatch<any>;
  setTargetBackup: React.Dispatch<any>;
}

/**
 * Backups suite tab: policy, snapshots list and actions.
 * Moved verbatim from ManagedSiteModal.tsx's JSX return (lines 2813-3027 before the move). A plain
 * function, not a component: ManagedSiteModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderBackupsTab({
  activeTab,
  backupPolicy,
  backupPolicySaving,
  backups,
  backupsLoading,
  fetchBackups,
  handleDownloadBackup,
  handleSaveBackupPolicy,
  setBackupPolicy,
  setCreateBackupModalOpen,
  setDeleteBackupConfirmOpen,
  setDeleteTargetBackup,
  setNewBackupLabel,
  setNewBackupNotes,
  setRenameBackupModalOpen,
  setRenameLabel,
  setRenameNotes,
  setRestoreConfirmModalOpen,
  setRestoreTargetBackup,
  setTargetBackup,
}: BackupsTabDeps): React.ReactNode {
  return (
              activeTab === "backups" && (
                <div className="space-y-6">
                  {/* Header & Create Snapshot Button */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Archive className="w-5 h-5 text-blue-400" />
                        Website Backups & Snapshots
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Capture full-state snapshots of your website pages, layouts, and global styles with 1-click restore.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={fetchBackups}
                        disabled={backupsLoading}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                        title="Refresh Backups"
                      >
                        <RefreshCw className={`w-4 h-4 ${backupsLoading ? "animate-spin" : ""}`} />
                      </button>
                      <button
                        onClick={() => {
                          setNewBackupLabel(`Manual Snapshot - ${new Date().toLocaleDateString()}`);
                          setNewBackupNotes("");
                          setCreateBackupModalOpen(true);
                        }}
                        className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition"
                      >
                        <Plus className="w-4 h-4" />
                        Create Backup
                      </button>
                    </div>
                  </div>

                  {/* Automated Backups Policy Card */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
                    <form onSubmit={handleSaveBackupPolicy} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            <Clock className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Automated Backup Schedule</h4>
                            <p className="text-[11px] text-slate-400">Regularly safeguard live modifications on a scheduled cadence</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={backupPolicy.enabled}
                            onChange={(e) => setBackupPolicy({ ...backupPolicy, enabled: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>

                      {backupPolicy.enabled && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-800/80">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                              Backup Frequency
                            </label>
                            <select
                              value={backupPolicy.cronExpression === "0 2 * * 0" ? "weekly" : "daily"}
                              onChange={(e) => {
                                const cron = e.target.value === "weekly" ? "0 2 * * 0" : "0 2 * * *";
                                setBackupPolicy({ ...backupPolicy, cronExpression: cron });
                              }}
                              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                            >
                              <option value="daily">Daily (Every night at 02:00 UTC)</option>
                              <option value="weekly">Weekly (Sunday at 02:00 UTC)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                              Retention Limit (Snapshots Kept)
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="30"
                              value={backupPolicy.retainCount}
                              onChange={(e) => setBackupPolicy({ ...backupPolicy, retainCount: parseInt(e.target.value) || 7 })}
                              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end pt-2">
                        <button
                          type="submit"
                          disabled={backupPolicySaving}
                          className="rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-1.5 text-xs font-semibold text-slate-200 transition disabled:opacity-50"
                        >
                          {backupPolicySaving ? "Saving Schedule..." : "Save Policy"}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Snapshots List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Available Snapshots ({backups.length})
                      </h4>
                    </div>

                    {backupsLoading ? (
                      <div className="p-8 text-center border border-slate-800 rounded-xl bg-slate-950/40 text-xs text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" />
                        Loading snapshots...
                      </div>
                    ) : backups.length === 0 ? (
                      <div className="p-8 text-center border border-slate-800 rounded-xl bg-slate-950/40 text-xs text-slate-500">
                        <Archive className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        No snapshots available yet. Create your first backup or publish changes to generate an automated safety point.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-800/80 rounded-xl border border-slate-800 bg-slate-950/40 overflow-hidden">
                        {backups.map((b: any) => {
                          const triggerBadge = () => {
                            if (b.trigger === "pre-publish") {
                              return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">Pre-Publish Safety</span>;
                            }
                            if (b.trigger === "scheduled") {
                              return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Scheduled</span>;
                            }
                            if (b.trigger === "restore-point") {
                              return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">Pre-Restore Safety</span>;
                            }
                            return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">Manual</span>;
                          };

                          const formatSize = (bytes: number) => {
                            if (!bytes) return "—";
                            if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
                            return Math.round(bytes / 1024) + " KB";
                          };

                          return (
                            <div key={b.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-900/50 transition">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-sm text-slate-100">{b.label}</span>
                                  {triggerBadge()}
                                </div>
                                {b.notes && (
                                  <p className="text-xs text-slate-400">{b.notes}</p>
                                )}
                                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                                  <span>{new Date(b.createdAt).toLocaleString()}</span>
                                  <span>&bull;</span>
                                  <span>{formatSize(b.sizeBytes)}</span>
                                  <span>&bull;</span>
                                  <span>{b.pageCount || 0} page(s)</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 self-end sm:self-center">
                                <button
                                  onClick={() => {
                                    setRestoreTargetBackup(b);
                                    setRestoreConfirmModalOpen(true);
                                  }}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-medium transition"
                                  title="Restore snapshot"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>Restore</span>
                                </button>
                                <button
                                  onClick={() => handleDownloadBackup(b.id)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                                  title="Download snapshot JSON"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setTargetBackup(b);
                                    setRenameLabel(b.label);
                                    setRenameNotes(b.notes || "");
                                    setRenameBackupModalOpen(true);
                                  }}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                                  title="Rename backup"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setDeleteTargetBackup(b);
                                    setDeleteBackupConfirmOpen(true);
                                  }}
                                  className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition"
                                  title="Delete backup"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
  );
}
