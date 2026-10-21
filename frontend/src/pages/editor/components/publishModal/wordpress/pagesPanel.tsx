import React from "react";

/** What renderPagesPanel reads: the PublishModal values and callbacks the inline JSX used. */
export interface PagesPanelDeps {
  draggedWpPageId: number | null;
  dropTargetWpPageId: number | null;
  dropWpPosition: "BEFORE" | "AFTER" | null;
  editingPageId: number | null;
  handleCreateOrUpdateWpPage: (e: React.FormEvent<Element>) => Promise<void>;
  handleDeleteWpPage: (pageId: number, force: boolean) => Promise<void>;
  handleDuplicateWpPage: (pageId: number, pageTitle: string) => Promise<void>;
  handleFetchWpPages: (overrideFilter?: string | undefined) => Promise<void>;
  handleImportPageToEditor: (pageId: number) => Promise<void>;
  handleReorderWpPage: (sourceId: number, targetId: number, position: "BEFORE" | "AFTER") => Promise<void>;
  handleUploadMediaFile: (e: React.ChangeEvent<HTMLInputElement, Element>) => Promise<void>;
  isCreatingPage: boolean;
  isImportingWpPageId: number | null;
  isLoadingWpPages: boolean;
  isReorderingWpPages: boolean;
  isUploadingMedia: boolean;
  mediaFormData: { title: string; altText: string; caption: string; description: string; };
  mediaUploadError: string | null;
  mediaUploadSuccess: any;
  pageFormData: { title: string; slug: string; status: string; parent: number; content: string; };
  setDraggedWpPageId: React.Dispatch<React.SetStateAction<number | null>>;
  setDropTargetWpPageId: React.Dispatch<React.SetStateAction<number | null>>;
  setDropWpPosition: React.Dispatch<React.SetStateAction<"BEFORE" | "AFTER" | null>>;
  setEditingPageId: React.Dispatch<React.SetStateAction<number | null>>;
  setIsCreatingPage: React.Dispatch<React.SetStateAction<boolean>>;
  setMediaFormData: React.Dispatch<React.SetStateAction<{ title: string; altText: string; caption: string; description: string; }>>;
  setPageFormData: React.Dispatch<React.SetStateAction<{ title: string; slug: string; status: string; parent: number; content: string; }>>;
  setShowMediaUploadModal: React.Dispatch<React.SetStateAction<boolean>>;
  setWpPageSearch: React.Dispatch<React.SetStateAction<string>>;
  setWpPageStatusFilter: React.Dispatch<React.SetStateAction<string>>;
  showMediaUploadModal: boolean;
  showWpPagesPanel: boolean;
  uploadProgress: number;
  wpPageSearch: string;
  wpPageStatusFilter: string;
  wpPages: any[];
}

/**
 * WordPress pages panel: media upload, search / filter, create / edit form, pages table (import, duplicate,
 * delete, drag reorder).
 * Moved verbatim from PublishModal.tsx's JSX return (lines 2513-2925 before the move). A plain
 * function, not a component: PublishModal calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderPagesPanel({
  draggedWpPageId,
  dropTargetWpPageId,
  dropWpPosition,
  editingPageId,
  handleCreateOrUpdateWpPage,
  handleDeleteWpPage,
  handleDuplicateWpPage,
  handleFetchWpPages,
  handleImportPageToEditor,
  handleReorderWpPage,
  handleUploadMediaFile,
  isCreatingPage,
  isImportingWpPageId,
  isLoadingWpPages,
  isReorderingWpPages,
  isUploadingMedia,
  mediaFormData,
  mediaUploadError,
  mediaUploadSuccess,
  pageFormData,
  setDraggedWpPageId,
  setDropTargetWpPageId,
  setDropWpPosition,
  setEditingPageId,
  setIsCreatingPage,
  setMediaFormData,
  setPageFormData,
  setShowMediaUploadModal,
  setWpPageSearch,
  setWpPageStatusFilter,
  showMediaUploadModal,
  showWpPagesPanel,
  uploadProgress,
  wpPageSearch,
  wpPageStatusFilter,
  wpPages,
}: PagesPanelDeps): React.ReactNode {
  return (
                  showWpPagesPanel && (
                    <div className="rounded-xl border border-indigo-900/60 bg-slate-900/95 p-4 space-y-4 shadow-xl">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base">📄</span>
                          <h4 className="text-xs font-extrabold text-white tracking-wide uppercase">
                            WordPress Page Manager
                          </h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPageId(null);
                              setPageFormData({ title: "", slug: "", status: "draft", parent: 0, content: "" });
                              setIsCreatingPage(!isCreatingPage);
                              setShowMediaUploadModal(false);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-extrabold transition cursor-pointer"
                          >
                            {isCreatingPage ? "✕ Cancel" : "+ Create Page"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowMediaUploadModal(!showMediaUploadModal);
                              setIsCreatingPage(false);
                              setEditingPageId(null);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold transition cursor-pointer"
                          >
                            {showMediaUploadModal ? "✕ Close Upload" : "🖼️ Upload Media"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFetchWpPages()}
                            disabled={isLoadingWpPages}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-bold transition cursor-pointer"
                          >
                            🔄 Refresh
                          </button>
                        </div>
                      </div>

                      {/* Media Upload Panel */}
                      {showMediaUploadModal && (
                        <div className="p-3.5 rounded-lg border border-emerald-700/50 bg-emerald-950/20 space-y-3">
                          <h5 className="text-[11px] font-extrabold text-emerald-300 uppercase tracking-wider">
                            Upload Media to WordPress Library (F-493)
                          </h5>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <label className="block text-[10px] text-slate-400 font-bold mb-0.5">Media Title</label>
                              <input
                                type="text"
                                placeholder="Optional title..."
                                value={mediaFormData.title}
                                onChange={(e) => setMediaFormData({ ...mediaFormData, title: e.target.value })}
                                className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white outline-none focus:border-emerald-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400 font-bold mb-0.5">Alt Text</label>
                              <input
                                type="text"
                                placeholder="Image accessibility alt text..."
                                value={mediaFormData.altText}
                                onChange={(e) => setMediaFormData({ ...mediaFormData, altText: e.target.value })}
                                className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white outline-none focus:border-emerald-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400 font-bold mb-0.5">Caption</label>
                              <input
                                type="text"
                                placeholder="Media caption..."
                                value={mediaFormData.caption}
                                onChange={(e) => setMediaFormData({ ...mediaFormData, caption: e.target.value })}
                                className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white outline-none focus:border-emerald-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400 font-bold mb-0.5">Description</label>
                              <input
                                type="text"
                                placeholder="Detailed description..."
                                value={mediaFormData.description}
                                onChange={(e) => setMediaFormData({ ...mediaFormData, description: e.target.value })}
                                className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white outline-none focus:border-emerald-500"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3 pt-1">
                            <label className="flex-1 flex flex-col items-center justify-center p-3 rounded-lg border-2 border-dashed border-emerald-600/50 bg-slate-900/60 hover:bg-slate-800/80 cursor-pointer transition">
                              <span className="text-xs font-bold text-emerald-300">Choose File to Upload</span>
                              <span className="text-[10px] text-slate-400">Supported: JPG, PNG, GIF, WEBP, PDF (Max 10MB)</span>
                              <input
                                type="file"
                                disabled={isUploadingMedia}
                                accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                                onChange={handleUploadMediaFile}
                                className="hidden"
                              />
                            </label>
                          </div>

                          {isUploadingMedia && (
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] font-bold text-emerald-400">
                                <span>Uploading file to WordPress...</span>
                                <span>{uploadProgress}%</span>
                              </div>
                              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                              </div>
                            </div>
                          )}

                          {mediaUploadError && (
                            <div className="p-2 rounded bg-rose-950/60 border border-rose-800 text-[11px] font-medium text-rose-300">
                              ⚠️ {mediaUploadError}
                            </div>
                          )}

                          {mediaUploadSuccess && (
                            <div className="p-3.5 rounded bg-emerald-950/80 border border-emerald-700 text-xs text-emerald-200 space-y-1">
                              <div className="font-bold flex items-center gap-1.5 text-emerald-300">
                                <span>✅ Upload Successful!</span>
                                <span className="bg-emerald-900 text-emerald-100 text-[10px] px-1.5 py-0.5 rounded">ID: #{mediaUploadSuccess.id}</span>
                              </div>
                              <div className="text-[11px] text-slate-300 truncate font-mono">
                                URL: <a href={mediaUploadSuccess.url} target="_blank" rel="noreferrer" className="underline hover:text-emerald-300">{mediaUploadSuccess.url}</a>
                              </div>
                              <div className="text-[10px] text-slate-400 flex gap-3">
                                <span>Filename: {mediaUploadSuccess.filename}</span>
                                <span>MIME: {mediaUploadSuccess.mimeType}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Search & Filter Bar */}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Search pages by title or slug..."
                          value={wpPageSearch}
                          onChange={(e) => setWpPageSearch(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleFetchWpPages()}
                          className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500 font-sans"
                        />
                        <select
                          value={wpPageStatusFilter}
                          onChange={(e) => {
                            setWpPageStatusFilter(e.target.value);
                            handleFetchWpPages(e.target.value);
                          }}
                          className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
                        >
                          <option value="any">All Statuses</option>
                          <option value="publish">Published</option>
                          <option value="draft">Drafts</option>
                          <option value="pending">Pending</option>
                          <option value="private">Private</option>
                          <option value="trash">Trash</option>
                        </select>
                      </div>

                      {/* Create / Edit Form */}
                      {(isCreatingPage || editingPageId) && (
                        <form onSubmit={handleCreateOrUpdateWpPage} className="p-3.5 rounded-lg border border-indigo-700/50 bg-indigo-950/20 space-y-3">
                          <h5 className="text-[11px] font-extrabold text-indigo-300 uppercase tracking-wider">
                            {editingPageId ? `Edit WordPress Page (ID: ${editingPageId})` : "Create New WordPress Page"}
                          </h5>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <label className="block text-[10px] text-slate-400 font-bold mb-0.5">Page Title *</label>
                              <input
                                type="text"
                                required
                                placeholder="e.g. About Us"
                                value={pageFormData.title}
                                onChange={(e) => setPageFormData({ ...pageFormData, title: e.target.value })}
                                className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400 font-bold mb-0.5">URL Slug</label>
                              <input
                                type="text"
                                placeholder="e.g. about-us"
                                value={pageFormData.slug}
                                onChange={(e) => setPageFormData({ ...pageFormData, slug: e.target.value })}
                                className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white outline-none focus:border-indigo-500 font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400 font-bold mb-0.5">Status</label>
                              <select
                                value={pageFormData.status}
                                onChange={(e) => setPageFormData({ ...pageFormData, status: e.target.value })}
                                className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white outline-none focus:border-indigo-500"
                              >
                                <option value="draft">Draft</option>
                                <option value="publish">Publish</option>
                                <option value="pending">Pending Review</option>
                                <option value="private">Private</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400 font-bold mb-0.5">Parent Page ID</label>
                              <input
                                type="number"
                                min="0"
                                value={pageFormData.parent}
                                onChange={(e) => setPageFormData({ ...pageFormData, parent: Number(e.target.value) })}
                                className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white outline-none focus:border-indigo-500 font-mono"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-[10px] text-slate-400 font-bold mb-0.5">Page Content (HTML/Gutenberg Blocks)</label>
                              <textarea
                                rows={3}
                                placeholder="Page content or HTML markup..."
                                value={pageFormData.content}
                                onChange={(e) => setPageFormData({ ...pageFormData, content: e.target.value })}
                                className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white outline-none focus:border-indigo-500 font-mono"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setIsCreatingPage(false);
                                setEditingPageId(null);
                              }}
                              className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={isLoadingWpPages}
                              className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition disabled:opacity-50"
                            >
                              {editingPageId ? "Update Page" : "Create Page"}
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Pages Table */}
                      {wpPages.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-lg">
                          No WordPress pages found matching your filters.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs text-slate-300">
                            <thead className="text-[10px] uppercase bg-slate-950/80 text-slate-400 border-b border-slate-800">
                              <tr>
                                <th className="w-8 px-2 py-2 text-center" title="Drag handle to reorder">⋮⋮</th>
                                <th className="px-3 py-2">ID</th>
                                <th className="px-3 py-2">Title / Slug</th>
                                <th className="px-3 py-2">Status</th>
                                <th className="px-3 py-2">Parent</th>
                                <th className="px-3 py-2">Order</th>
                                <th className="px-3 py-2">Modified</th>
                                <th className="px-3 py-2 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 font-sans">
                              {wpPages.map((page: any) => (
                                <tr
                                  key={page.id}
                                  draggable={!isLoadingWpPages && !isReorderingWpPages}
                                  onDragStart={(e) => {
                                    setDraggedWpPageId(page.id);
                                    e.dataTransfer.setData("text/plain", String(page.id));
                                    e.dataTransfer.effectAllowed = "move";
                                  }}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    if (draggedWpPageId === page.id) return;
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const midpoint = rect.top + rect.height / 2;
                                    const pos = e.clientY < midpoint ? "BEFORE" : "AFTER";
                                    setDropTargetWpPageId(page.id);
                                    setDropWpPosition(pos);
                                  }}
                                  onDragLeave={() => {
                                    if (dropTargetWpPageId === page.id) {
                                      setDropTargetWpPageId(null);
                                      setDropWpPosition(null);
                                    }
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    if (draggedWpPageId && dropTargetWpPageId && dropWpPosition) {
                                      handleReorderWpPage(draggedWpPageId, dropTargetWpPageId, dropWpPosition);
                                    }
                                  }}
                                  onDragEnd={() => {
                                    setDraggedWpPageId(null);
                                    setDropTargetWpPageId(null);
                                    setDropWpPosition(null);
                                  }}
                                  className={`hover:bg-slate-800/40 transition border-b border-slate-800/60 ${
                                    draggedWpPageId === page.id ? "opacity-40 bg-blue-950/40" : ""
                                  } ${
                                    dropTargetWpPageId === page.id && dropWpPosition === "BEFORE"
                                      ? "border-t-2 border-t-blue-500 bg-blue-950/30"
                                      : ""
                                  } ${
                                    dropTargetWpPageId === page.id && dropWpPosition === "AFTER"
                                      ? "border-b-2 border-b-blue-500 bg-blue-950/30"
                                      : ""
                                  }`}
                                >
                                  <td className="w-8 px-2 py-2 text-center text-slate-400 cursor-grab active:cursor-grabbing font-bold select-none hover:text-white">
                                    ⋮⋮
                                  </td>
                                  <td className="px-3 py-2 font-mono text-[11px] text-slate-400">#{page.id}</td>
                                  <td className="px-3 py-2">
                                    <div className="font-bold text-white text-xs">{page.title}</div>
                                    <div className="text-[10px] font-mono text-blue-400">{page.slug}</div>
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                      page.status === 'publish' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                      page.status === 'draft' ? 'bg-slate-800 text-slate-300 border border-slate-700' :
                                      page.status === 'trash' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                                      'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    }`}>
                                      {page.status}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 font-mono text-[11px] text-slate-400">
                                    {page.parent > 0 ? `#${page.parent}` : "—"}
                                  </td>
                                  <td className="px-3 py-2 font-mono text-[11px] text-slate-400">
                                    {page.menuOrder ?? 0}
                                  </td>
                                  <td className="px-3 py-2 text-[10px] text-slate-400">
                                    {page.modified ? new Date(page.modified).toLocaleDateString() : "—"}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleImportPageToEditor(page.id)}
                                        disabled={isImportingWpPageId === page.id}
                                        className="px-2 py-0.5 rounded bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[10px] font-bold shadow-sm transition flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                                        title="Import WordPress page and open in ForgeStudio Visual Editor"
                                      >
                                        {isImportingWpPageId === page.id ? "Importing..." : "⚡ Edit in ForgeStudio"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingPageId(page.id);
                                          setPageFormData({
                                            title: page.title || "",
                                            slug: page.slug || "",
                                            status: page.status || "draft",
                                            parent: page.parent || 0,
                                            content: page.content || "",
                                          });
                                          setIsCreatingPage(false);
                                        }}
                                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-blue-300 text-[10px] font-bold border border-slate-700"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDuplicateWpPage(page.id, page.title)}
                                        disabled={isLoadingWpPages}
                                        className="px-2 py-0.5 rounded bg-indigo-950/60 hover:bg-indigo-900 text-indigo-300 text-[10px] font-bold border border-indigo-800 transition disabled:opacity-50 cursor-pointer"
                                      >
                                        Duplicate
                                      </button>
                                      {page.status === 'trash' ? (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteWpPage(page.id, true)}
                                          className="px-2 py-0.5 rounded bg-rose-950/60 hover:bg-rose-900 text-rose-300 text-[10px] font-bold border border-rose-800"
                                        >
                                          Delete Permanently
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteWpPage(page.id, false)}
                                          className="px-2 py-0.5 rounded bg-amber-950/60 hover:bg-amber-900 text-amber-300 text-[10px] font-bold border border-amber-800"
                                        >
                                          Trash
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
  );
}
