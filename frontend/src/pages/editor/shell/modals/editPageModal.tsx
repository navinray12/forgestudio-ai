import React from "react";

/** What renderEditPageModal reads: the editor values and callbacks the inline JSX used. */
export interface EditPageModalDeps {
  editPageName: string;
  editPageSlug: string;
  handleSaveEditPage: () => void;
  isEditPageModalOpen: boolean;
  setEditPageName: React.Dispatch<React.SetStateAction<string>>;
  setEditPageSlug: React.Dispatch<React.SetStateAction<string>>;
  setIsEditPageModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Edit Page modal (rename / re-slug a page). Note: only openEditPageModal opens it and nothing references that handler today; moved unchanged.
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 14451-14519 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderEditPageModal({
  editPageName,
  editPageSlug,
  handleSaveEditPage,
  isEditPageModalOpen,
  setEditPageName,
  setEditPageSlug,
  setIsEditPageModalOpen,
}: EditPageModalDeps): React.ReactNode {
  return (
      isEditPageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <span>✏️</span>
                <span>Edit Page Settings</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEditPageModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Page Title / Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. About Us, Our Services, Contact"
                  value={editPageName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditPageName(val);
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
                  value={editPageSlug}
                  onChange={(e) => setEditPageSlug(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white outline-none focus:border-blue-500 transition font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsEditPageModalOpen(false)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditPage}
                disabled={!editPageName.trim()}
                className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-500 disabled:opacity-50 transition cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )
  );
}
