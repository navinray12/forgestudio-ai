import React from "react";

/** What renderTabBar reads: the PublishModal values and callbacks the inline JSX used. */
export interface TabBarDeps {
  activeTab: "internal" | "wordpress" | "sftp" | "zip";
  setActiveTab: React.Dispatch<React.SetStateAction<"internal" | "wordpress" | "sftp" | "zip">>;
  sftpVerified: boolean;
  wpStatus: any;
}

/**
 * Destination tab bar: ForgeStudio Live, WordPress, SFTP and static ZIP.
 * Moved verbatim from PublishModal.tsx's JSX return (lines 1011-1058 before the move). A plain
 * function, not a component: PublishModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderTabBar({
  activeTab,
  setActiveTab,
  sftpVerified,
  wpStatus,
}: TabBarDeps): React.ReactNode {
  return (
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab("internal")}
            className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition cursor-pointer ${
              activeTab === "internal"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            ForgeStudio Live
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("wordpress")}
            className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "wordpress"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <span>WordPress Destination</span>
            {wpStatus?.isConnected && <span className="h-2 w-2 rounded-full bg-emerald-400"></span>}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("sftp")}
            className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "sftp"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <span>SFTP Server</span>
            {sftpVerified && <span className="h-2 w-2 rounded-full bg-emerald-400"></span>}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("zip")}
            className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "zip"
                ? "border-purple-500 text-purple-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <span>Static ZIP Export</span>
          </button>
        </div>
  );
}
