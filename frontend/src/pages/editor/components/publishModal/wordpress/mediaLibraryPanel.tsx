import React from "react";

/** What renderMediaLibraryPanel reads: the PublishModal values and callbacks the inline JSX used. */
export interface MediaLibraryPanelDeps {
  editMediaMetaForm: { title: string; altText: string; caption: string; description: string; };
  handleFetchWpMedia: (pageOverride?: number | undefined) => Promise<void>;
  handleSaveMediaMetadata: () => Promise<void>;
  isEditingMediaMeta: boolean;
  isLoadingWpMedia: boolean;
  isUpdatingMediaMeta: boolean;
  selectedMediaDetail: any;
  setDeleteMediaForceOption: React.Dispatch<React.SetStateAction<boolean>>;
  setEditMediaMetaForm: React.Dispatch<React.SetStateAction<{ title: string; altText: string; caption: string; description: string; }>>;
  setIsCreatingPage: React.Dispatch<React.SetStateAction<boolean>>;
  setIsEditingMediaMeta: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedMediaDetail: React.Dispatch<any>;
  setShowDeleteMediaModal: React.Dispatch<React.SetStateAction<number | null>>;
  setShowMediaUploadModal: React.Dispatch<React.SetStateAction<boolean>>;
  setWpMediaOrder: React.Dispatch<React.SetStateAction<"ASC" | "DESC">>;
  setWpMediaOrderby: React.Dispatch<React.SetStateAction<"date" | "modified" | "title" | "filename">>;
  setWpMediaSearch: React.Dispatch<React.SetStateAction<string>>;
  setWpMediaTypeFilter: React.Dispatch<React.SetStateAction<"all" | "image" | "document">>;
  showMediaUploadModal: boolean;
  showWpMediaLibrary: boolean;
  wpMediaList: any[];
  wpMediaOrder: "ASC" | "DESC";
  wpMediaOrderby: "date" | "modified" | "title" | "filename";
  wpMediaPagination: { page: number; perPage: number; total: number; totalPages: number; };
  wpMediaSearch: string;
  wpMediaTypeFilter: "all" | "image" | "document";
}

/**
 * WordPress media library panel (F-494): search / filter / sort, metadata editing, grid, pagination.
 * Moved verbatim from PublishModal.tsx's JSX return (lines 2934-3224 before the move). A plain
 * function, not a component: PublishModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderMediaLibraryPanel({
  editMediaMetaForm,
  handleFetchWpMedia,
  handleSaveMediaMetadata,
  isEditingMediaMeta,
  isLoadingWpMedia,
  isUpdatingMediaMeta,
  selectedMediaDetail,
  setDeleteMediaForceOption,
  setEditMediaMetaForm,
  setIsCreatingPage,
  setIsEditingMediaMeta,
  setSelectedMediaDetail,
  setShowDeleteMediaModal,
  setShowMediaUploadModal,
  setWpMediaOrder,
  setWpMediaOrderby,
  setWpMediaSearch,
  setWpMediaTypeFilter,
  showMediaUploadModal,
  showWpMediaLibrary,
  wpMediaList,
  wpMediaOrder,
  wpMediaOrderby,
  wpMediaPagination,
  wpMediaSearch,
  wpMediaTypeFilter,
}: MediaLibraryPanelDeps): React.ReactNode {
  return (
                  showWpMediaLibrary && (
                    <div className="rounded-xl border border-emerald-900/60 bg-slate-900/95 p-4 space-y-4 shadow-xl">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base">🖼️</span>
                          <h4 className="text-xs font-extrabold text-white tracking-wide uppercase">
                            WordPress Media Library Manager
                          </h4>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono font-bold">
                            Total: {wpMediaPagination.total} items
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowMediaUploadModal(!showMediaUploadModal);
                              setIsCreatingPage(false);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold transition cursor-pointer"
                          >
                            {showMediaUploadModal ? "✕ Close Upload" : "+ Upload New Media"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFetchWpMedia()}
                            disabled={isLoadingWpMedia}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-bold transition cursor-pointer"
                          >
                            🔄 Refresh
                          </button>
                        </div>
                      </div>

                      {/* Search & Filter & Sort Bar */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                        <input
                          type="text"
                          placeholder="Search media by title or filename..."
                          value={wpMediaSearch}
                          onChange={(e) => setWpMediaSearch(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleFetchWpMedia(1)}
                          className="sm:col-span-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white outline-none focus:border-emerald-500 font-sans"
                        />
                        <select
                          value={wpMediaTypeFilter}
                          onChange={(e) => {
                            setWpMediaTypeFilter(e.target.value as any);
                            handleFetchWpMedia(1);
                          }}
                          className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500"
                        >
                          <option value="all">All Media Types</option>
                          <option value="image">Images Only</option>
                          <option value="document">Documents Only</option>
                        </select>
                        <select
                          value={`${wpMediaOrderby}_${wpMediaOrder}`}
                          onChange={(e) => {
                            const [by, ord] = e.target.value.split("_");
                            setWpMediaOrderby(by as any);
                            setWpMediaOrder(ord as any);
                            handleFetchWpMedia(1);
                          }}
                          className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500"
                        >
                          <option value="date_DESC">Newest First (Date ↓)</option>
                          <option value="date_ASC">Oldest First (Date ↑)</option>
                          <option value="title_ASC">Title (A-Z)</option>
                          <option value="title_DESC">Title (Z-A)</option>
                          <option value="filename_ASC">Filename (A-Z)</option>
                        </select>
                      </div>

                      {/* Media Edit Metadata Drawer / Card */}
                      {selectedMediaDetail && (
                        <div className="p-3.5 rounded-lg border border-emerald-700/50 bg-emerald-950/20 space-y-3">
                          <div className="flex items-center justify-between">
                            <h5 className="text-[11px] font-extrabold text-emerald-300 uppercase tracking-wider">
                              Media Item Metadata (ID: #{selectedMediaDetail.id})
                            </h5>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedMediaDetail(null);
                                setIsEditingMediaMeta(false);
                              }}
                              className="text-xs text-slate-400 hover:text-white"
                            >
                              ✕ Close Details
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                            {/* Preview box */}
                            <div className="flex flex-col items-center justify-center p-2 rounded bg-slate-950/60 border border-slate-800 text-center">
                              {selectedMediaDetail.mimeType?.startsWith("image/") ? (
                                <img
                                  src={selectedMediaDetail.url}
                                  alt={selectedMediaDetail.altText || selectedMediaDetail.title}
                                  className="max-h-32 object-contain rounded mb-2"
                                />
                              ) : (
                                <div className="text-3xl my-3">📄</div>
                              )}
                              <span className="text-[10px] font-mono text-slate-400 truncate max-w-full">
                                {selectedMediaDetail.filename}
                              </span>
                              <span className="text-[9px] text-slate-500">
                                {selectedMediaDetail.mimeType} {selectedMediaDetail.filesize ? `• ${Math.round(selectedMediaDetail.filesize / 1024)} KB` : ""}
                              </span>
                            </div>

                            {/* Metadata Edit Form */}
                            <div className="md:col-span-2 space-y-2">
                              <div>
                                <label className="block text-[10px] text-slate-400 font-bold mb-0.5">Title</label>
                                <input
                                  type="text"
                                  disabled={!isEditingMediaMeta}
                                  value={editMediaMetaForm.title}
                                  onChange={(e) => setEditMediaMetaForm({ ...editMediaMetaForm, title: e.target.value })}
                                  className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white outline-none focus:border-emerald-500 disabled:opacity-70"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-400 font-bold mb-0.5">Alt Text (Accessibility)</label>
                                <input
                                  type="text"
                                  disabled={!isEditingMediaMeta}
                                  value={editMediaMetaForm.altText}
                                  onChange={(e) => setEditMediaMetaForm({ ...editMediaMetaForm, altText: e.target.value })}
                                  className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white outline-none focus:border-emerald-500 disabled:opacity-70"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-400 font-bold mb-0.5">Caption</label>
                                <input
                                  type="text"
                                  disabled={!isEditingMediaMeta}
                                  value={editMediaMetaForm.caption}
                                  onChange={(e) => setEditMediaMetaForm({ ...editMediaMetaForm, caption: e.target.value })}
                                  className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white outline-none focus:border-emerald-500 disabled:opacity-70"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-400 font-bold mb-0.5">Description</label>
                                <textarea
                                  rows={2}
                                  disabled={!isEditingMediaMeta}
                                  value={editMediaMetaForm.description}
                                  onChange={(e) => setEditMediaMetaForm({ ...editMediaMetaForm, description: e.target.value })}
                                  className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white outline-none focus:border-emerald-500 disabled:opacity-70"
                                />
                              </div>

                              <div className="flex justify-end gap-2 pt-1">
                                {isEditingMediaMeta ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setIsEditingMediaMeta(false)}
                                      className="px-3 py-1 rounded bg-slate-800 text-slate-300 text-xs font-bold"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleSaveMediaMetadata}
                                      disabled={isUpdatingMediaMeta}
                                      className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition disabled:opacity-50"
                                    >
                                      {isUpdatingMediaMeta ? "Saving..." : "Save Metadata"}
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setIsEditingMediaMeta(true)}
                                    className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition"
                                  >
                                    ✏️ Edit Metadata
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Media Grid / Library Listing */}
                      {wpMediaList.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-lg">
                          No WordPress media items found matching your filters.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {wpMediaList.map((item: any) => (
                            <div
                              key={item.id}
                              className={`group relative rounded-lg border bg-slate-950/60 p-2 flex flex-col justify-between transition hover:border-emerald-500/70 ${
                                selectedMediaDetail?.id === item.id ? "border-emerald-500 bg-emerald-950/20" : "border-slate-800"
                              }`}
                            >
                              <div className="aspect-video w-full rounded overflow-hidden bg-slate-900 flex items-center justify-center mb-2 border border-slate-800/80">
                                {item.mimeType?.startsWith("image/") ? (
                                  <img
                                    src={item.url}
                                    alt={item.altText || item.title}
                                    className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                                  />
                                ) : (
                                  <span className="text-2xl text-slate-500">📄</span>
                                )}
                              </div>

                              <div className="space-y-0.5 mb-2">
                                <div className="font-bold text-white text-xs truncate" title={item.title || item.filename}>
                                  {item.title || item.filename}
                                </div>
                                <div className="text-[10px] font-mono text-slate-400 truncate" title={item.filename}>
                                  {item.filename}
                                </div>
                                <div className="flex items-center justify-between text-[9px] text-slate-500">
                                  <span>#{item.id}</span>
                                  <span>{item.mimeType?.split("/")[1]?.toUpperCase() || "FILE"}</span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedMediaDetail(item);
                                    setEditMediaMetaForm({
                                      title: item.title || "",
                                      altText: item.altText || "",
                                      caption: item.caption || "",
                                      description: item.description || "",
                                    });
                                    setIsEditingMediaMeta(false);
                                  }}
                                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-blue-300 text-[10px] font-bold border border-slate-700"
                                >
                                  Details
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowDeleteMediaModal(item.id);
                                    setDeleteMediaForceOption(false);
                                  }}
                                  className="px-2 py-0.5 rounded bg-rose-950/60 hover:bg-rose-900 text-rose-300 text-[10px] font-bold border border-rose-800"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Pagination Footer */}
                      {wpMediaPagination.totalPages > 1 && (
                        <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs text-slate-400">
                          <div>
                            Showing page <span className="font-bold text-white">{wpMediaPagination.page}</span> of{" "}
                            <span className="font-bold text-white">{wpMediaPagination.totalPages}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={wpMediaPagination.page <= 1 || isLoadingWpMedia}
                              onClick={() => handleFetchWpMedia(wpMediaPagination.page - 1)}
                              className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold disabled:opacity-50"
                            >
                              ← Previous
                            </button>
                            <button
                              type="button"
                              disabled={wpMediaPagination.page >= wpMediaPagination.totalPages || isLoadingWpMedia}
                              onClick={() => handleFetchWpMedia(wpMediaPagination.page + 1)}
                              className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold disabled:opacity-50"
                            >
                              Next →
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
  );
}
