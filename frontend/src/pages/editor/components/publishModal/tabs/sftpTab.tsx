import React from "react";

/** What renderSftpTab reads: the PublishModal values and callbacks the inline JSX used. */
export interface SftpTabDeps {
  activeTab: "internal" | "wordpress" | "sftp" | "zip";
  handleSyncSftp: () => Promise<void>;
  handleTestSftp: () => Promise<void>;
  isSyncingSftp: boolean;
  isTestingSftp: boolean;
  setSftpHost: React.Dispatch<React.SetStateAction<string>>;
  setSftpPassword: React.Dispatch<React.SetStateAction<string>>;
  setSftpPort: React.Dispatch<React.SetStateAction<string>>;
  setSftpRemotePath: React.Dispatch<React.SetStateAction<string>>;
  setSftpUsername: React.Dispatch<React.SetStateAction<string>>;
  sftpFeedback: { type: "success" | "error"; message: string; } | null;
  sftpHost: string;
  sftpPassword: string;
  sftpPort: string;
  sftpRemotePath: string;
  sftpUsername: string;
}

/**
 * SFTP server tab: connection settings, test connection and sync.
 * Moved verbatim from PublishModal.tsx's JSX return (lines 3371-3467 before the move). A plain
 * function, not a component: PublishModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderSftpTab({
  activeTab,
  handleSyncSftp,
  handleTestSftp,
  isSyncingSftp,
  isTestingSftp,
  setSftpHost,
  setSftpPassword,
  setSftpPort,
  setSftpRemotePath,
  setSftpUsername,
  sftpFeedback,
  sftpHost,
  sftpPassword,
  sftpPort,
  sftpRemotePath,
  sftpUsername,
}: SftpTabDeps): React.ReactNode {
  return (
          activeTab === "sftp" && (
            <div className="space-y-4 animate-fadeIn">
              <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-4">
                <h4 className="text-xs font-bold text-amber-400">SFTP Direct Server Deployment</h4>
                <p className="text-[11px] text-slate-300 mt-1">
                  Publish compiled static website files directly to any Linux/UNIX web server, cPanel, AWS EC2, or DigitalOcean droplet via SSH File Transfer Protocol.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Server Host / IP</label>
                  <input
                    type="text"
                    placeholder="e.g. sftp.example.com or 203.0.113.10"
                    value={sftpHost}
                    onChange={(e) => setSftpHost(e.target.value)}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white placeholder-slate-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Port</label>
                  <input
                    type="number"
                    value={sftpPort}
                    onChange={(e) => setSftpPort(e.target.value)}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Username</label>
                  <input
                    type="text"
                    placeholder="e.g. deploy or root"
                    value={sftpUsername}
                    onChange={(e) => setSftpUsername(e.target.value)}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Password / SSH Key</label>
                  <input
                    type="password"
                    placeholder="••••••••••••"
                    value={sftpPassword}
                    onChange={(e) => setSftpPassword(e.target.value)}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300">Remote Directory Path</label>
                <input
                  type="text"
                  placeholder="e.g. /var/www/html or /public_html"
                  value={sftpRemotePath}
                  onChange={(e) => setSftpRemotePath(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white"
                />
              </div>

              {sftpFeedback && (
                <div
                  className={`rounded-lg p-2.5 text-xs font-semibold text-center ${
                    sftpFeedback.type === "success"
                      ? "bg-emerald-950/60 border border-emerald-500/50 text-emerald-300"
                      : "bg-rose-950/60 border border-rose-500/50 text-rose-300"
                  }`}
                >
                  {sftpFeedback.message}
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleTestSftp}
                  disabled={isTestingSftp}
                  className="rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 text-xs font-bold transition cursor-pointer"
                >
                  {isTestingSftp ? "Testing..." : "Test Connection"}
                </button>
                <button
                  type="button"
                  onClick={handleSyncSftp}
                  disabled={isSyncingSftp}
                  className="rounded-lg bg-amber-600 hover:bg-amber-500 text-white px-5 py-2 text-xs font-bold transition shadow-lg shadow-amber-600/30 cursor-pointer"
                >
                  {isSyncingSftp ? "Syncing Files..." : "Deploy via SFTP Now"}
                </button>
              </div>
            </div>
          )
  );
}
