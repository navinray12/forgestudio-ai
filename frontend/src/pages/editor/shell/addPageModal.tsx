import React from "react";
import { slugFromName } from "../core/pageManagement";

/** What renderAddPageModal reads: the Add Page modal state, its setters and the create handler. */
export interface AddPageModalDeps {
  handleCreateNewPage: () => void;
  isAddPageModalOpen: boolean;
  newPageName: string;
  newPageSlug: string;
  setIsAddPageModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setNewPageName: React.Dispatch<React.SetStateAction<string>>;
  setNewPageSlug: React.Dispatch<React.SetStateAction<string>>;
}

/**
 * The editor's Add Page modal (title and slug inputs, presets, Cancel / Create Page), moved verbatim
 * from WebsiteEditor.tsx's JSX return. A plain function that returns the same expression the editor
 * rendered in that slot (false while closed), so the element tree and the autoFocus input are unchanged.
 */
export function renderAddPageModal({
  handleCreateNewPage,
  isAddPageModalOpen,
  newPageName,
  newPageSlug,
  setIsAddPageModalOpen,
  setNewPageName,
  setNewPageSlug,
}: AddPageModalDeps): React.ReactNode {
  return (
      isAddPageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <span>✨</span>
                <span>Add New Website Page</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddPageModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400">Quick Presets:</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { name: "About Us", slug: "/about" },
                  { name: "Contact", slug: "/contact" },
                  { name: "Services", slug: "/services" },
                  { name: "Pricing", slug: "/pricing" },
                  { name: "Blog", slug: "/blog" },
                ].map((preset) => (
                  <button
                    key={preset.slug}
                    type="button"
                    onClick={() => {
                      setNewPageName(preset.name);
                      setNewPageSlug(preset.slug);
                    }}
                    className={`px-2.5 py-1 text-xs rounded-lg border transition font-medium cursor-pointer ${
                      newPageName === preset.name
                        ? "bg-blue-600 text-white border-blue-500 font-bold"
                        : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white"
                    }`}
                  >
                    + {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Page Title / Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. About, Services, Contact, Pricing"
                  value={newPageName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewPageName(val);
                    if (!newPageSlug || newPageSlug === slugFromName(newPageName)) {
                      setNewPageSlug(slugFromName(val));
                    }
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white outline-none focus:border-blue-500 transition"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  URL Path / Slug
                </label>
                <input
                  type="text"
                  placeholder="e.g. /about, /services, /contact"
                  value={newPageSlug}
                  onChange={(e) => setNewPageSlug(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white outline-none focus:border-blue-500 transition font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddPageModalOpen(false)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateNewPage}
                disabled={!newPageName.trim()}
                className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-500 disabled:opacity-50 transition cursor-pointer"
              >
                Create Page
              </button>
            </div>
          </div>
        </div>
      )
  );
}
