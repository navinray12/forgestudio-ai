import React from "react";
import { API_ORIGIN, downloadAuthenticatedFile } from "../../../../../utils/downloadFile";
import type { PageConfig } from "../../../types";

/** What renderZipExportTab reads: the PublishModal values and callbacks the inline JSX used. */
export interface ZipExportTabDeps {
  activeTab: "internal" | "wordpress" | "sftp" | "zip";
  pages: PageConfig[];
  setZipExportError: React.Dispatch<React.SetStateAction<string | null>>;
  websiteId: string | undefined;
  zipExportError: string | null;
}

/**
 * Static ZIP export tab.
 * Moved verbatim from PublishModal.tsx's JSX return (lines 3469-3516 before the move). A plain
 * function, not a component: PublishModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderZipExportTab({
  activeTab,
  pages,
  setZipExportError,
  websiteId,
  zipExportError,
}: ZipExportTabDeps): React.ReactNode {
  return (
          activeTab === "zip" && (
            <div className="space-y-4 animate-fadeIn">
              <div className="rounded-xl border border-purple-900/40 bg-purple-950/20 p-4">
                <h4 className="text-xs font-bold text-purple-400">1-Click Static Website Export (.zip)</h4>
                <p className="text-[11px] text-slate-300 mt-1">
                  Download a production-optimized static website bundle ready for instant self-hosting on AWS S3, Cloudflare Pages, Netlify, Vercel, Apache, or Nginx.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-2">
                <span className="block text-[10px] uppercase font-bold text-slate-400">Included in Bundle</span>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                  <li>HTML pages for all {pages.length} website routes with SEO meta tags</li>
                  <li>Clean standalone stylesheet (<code className="text-blue-400">styles.css</code>) with responsive media queries</li>
                  <li>Lightweight interactive JavaScript runtime (<code className="text-blue-400">runtime.js</code>)</li>
                  <li>Form handling scripts and asset references</li>
                </ul>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setZipExportError(null);
                    downloadAuthenticatedFile(
                      `${API_ORIGIN}/api/v1/websites/${websiteId}/export/zip?type=static`,
                      "website-static-export.zip"
                    ).catch((err: Error) => setZipExportError(err.message));
                  }}
                  className="w-full text-center rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs py-3 shadow-lg shadow-purple-600/30 transition cursor-pointer"
                >
                  📦 Download Static Website Bundle (.zip)
                </button>
                {zipExportError && (
                  <p role="alert" className="text-xs text-red-400">
                    Export failed: {zipExportError}
                  </p>
                )}
                <a
                  href="/api/plugins/wordpress/download"
                  download
                  className="w-full text-center rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-semibold text-xs py-2 transition"
                >
                  🔌 Download WordPress Connector Plugin (.zip)
                </a>
              </div>
            </div>
          )
  );
}
