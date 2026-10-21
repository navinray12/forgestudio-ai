import React from "react";
import type { PostItem } from "../../types";

/** What renderPostsControls reads: the editor values and callbacks the inline JSX used. */
export interface PostsControlsDeps {
  selectedElementAny: any;
  updateSelectedProp: (key: string, value: any) => void;
}

/**
 * Selected-element inspector: Posts layout & content controls (F-174).
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 4740-4982 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderPostsControls({
  selectedElementAny,
  updateSelectedProp,
}: PostsControlsDeps): React.ReactNode {
  return (
                    selectedElementAny.type === "posts" && (
                      <div className="space-y-4 pt-2 border-t border-slate-100">
                        <div className="border-b border-slate-100 pb-2">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-purple-600 flex items-center gap-1.5">
                            <span>📰</span> Posts Layout Controls
                          </h3>
                        </div>

                        {/* Columns Selector */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Grid Columns
                          </label>
                          <select
                            value={selectedElementAny.postsColumns || 3}
                            onChange={(e) => updateSelectedProp("postsColumns", parseInt(e.target.value, 10))}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                          >
                            <option value={1}>1 Column (Stack)</option>
                            <option value={2}>2 Columns</option>
                            <option value={3}>3 Columns</option>
                            <option value={4}>4 Columns</option>
                          </select>
                        </div>

                        {/* Gap / Spacing */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Grid Gap (Spacing)
                          </label>
                          <select
                            value={selectedElementAny.postsGap ?? 20}
                            onChange={(e) => updateSelectedProp("postsGap", parseInt(e.target.value, 10))}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                          >
                            <option value={12}>12px (Compact)</option>
                            <option value={16}>16px (Small)</option>
                            <option value={20}>20px (Medium)</option>
                            <option value={24}>24px (Large)</option>
                            <option value={32}>32px (Extra Large)</option>
                          </select>
                        </div>

                        {/* Featured Image Height */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Featured Image Height
                          </label>
                          <select
                            value={selectedElementAny.postsImageHeight || "180px"}
                            onChange={(e) => updateSelectedProp("postsImageHeight", e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                          >
                            <option value="140px">140px (Small)</option>
                            <option value="180px">180px (Standard)</option>
                            <option value="220px">220px (Tall)</option>
                            <option value="260px">260px (Extra Tall)</option>
                            <option value="auto">Auto (Natural Ratio)</option>
                          </select>
                        </div>

                        {/* Alignment */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Content Alignment
                          </label>
                          <select
                            value={selectedElementAny.postsAlignment || "left"}
                            onChange={(e) => updateSelectedProp("postsAlignment", e.target.value as any)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                          >
                            <option value="left">Left Aligned</option>
                            <option value="center">Center Aligned</option>
                            <option value="right">Right Aligned</option>
                          </select>
                        </div>

                        {/* Visibility Toggles */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                          <span className="block text-[11px] font-bold text-slate-600 mb-1">
                            Display Elements
                          </span>
                          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedElementAny.postsShowImage !== false}
                              onChange={(e) => updateSelectedProp("postsShowImage", e.target.checked)}
                              className="rounded border-slate-300 text-blue-600"
                            />
                            <span>Featured Image</span>
                          </label>
                          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedElementAny.postsShowDate !== false}
                              onChange={(e) => updateSelectedProp("postsShowDate", e.target.checked)}
                              className="rounded border-slate-300 text-blue-600"
                            />
                            <span>Date & Author Metadata</span>
                          </label>
                          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedElementAny.postsShowExcerpt !== false}
                              onChange={(e) => updateSelectedProp("postsShowExcerpt", e.target.checked)}
                              className="rounded border-slate-300 text-blue-600"
                            />
                            <span>Post Excerpt</span>
                          </label>
                          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedElementAny.postsShowReadMore !== false}
                              onChange={(e) => updateSelectedProp("postsShowReadMore", e.target.checked)}
                              className="rounded border-slate-300 text-blue-600"
                            />
                            <span>Read More Link</span>
                          </label>
                        </div>

                        {/* Post Items Editor */}
                        <div className="pt-2">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-bold text-slate-700">
                              Post Items ({selectedElementAny.posts?.length || 0})
                            </h4>
                            <button
                              type="button"
                              onClick={() => {
                                const currentPosts = selectedElementAny.posts || [];
                                const newPost: PostItem = {
                                  id: "post_" + Math.random().toString(36).substring(2, 9),
                                  title: "New Blog Article",
                                  excerpt: "Short excerpt or summary of the blog post.",
                                  date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                                  author: "Author",
                                  image: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&q=80",
                                  readMoreText: "Read Article →",
                                  readMoreUrl: "#",
                                };
                                updateSelectedProp("posts", [...currentPosts, newPost]);
                              }}
                              className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded shadow-xs"
                            >
                              + Add Post
                            </button>
                          </div>

                          <div className="space-y-3">
                            {(selectedElementAny.posts || []).map((post, idx) => (
                              <div key={post.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs space-y-2">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                                  <span className="text-[11px] font-bold text-slate-800 truncate max-w-[170px]">
                                    Post #{idx + 1}: {post.title || "Untitled"}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updatedPosts = (selectedElementAny.posts || []).filter((p) => p.id !== post.id);
                                      updateSelectedProp("posts", updatedPosts);
                                    }}
                                    className="text-[10px] font-bold text-red-500 hover:text-red-700 hover:underline"
                                  >
                                    Remove
                                  </button>
                                </div>

                                <div>
                                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                    Title
                                  </label>
                                  <input
                                    type="text"
                                    value={post.title}
                                    onChange={(e) => {
                                      const updatedPosts = (selectedElementAny.posts || []).map((p) =>
                                        p.id === post.id ? { ...p, title: e.target.value } : p
                                      );
                                      updateSelectedProp("posts", updatedPosts);
                                    }}
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                    Excerpt
                                  </label>
                                  <textarea
                                    rows={2}
                                    value={post.excerpt}
                                    onChange={(e) => {
                                      const updatedPosts = (selectedElementAny.posts || []).map((p) =>
                                        p.id === post.id ? { ...p, excerpt: e.target.value } : p
                                      );
                                      updateSelectedProp("posts", updatedPosts);
                                    }}
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                      Date
                                    </label>
                                    <input
                                      type="text"
                                      value={post.date || ""}
                                      onChange={(e) => {
                                        const updatedPosts = (selectedElementAny.posts || []).map((p) =>
                                          p.id === post.id ? { ...p, date: e.target.value } : p
                                        );
                                        updateSelectedProp("posts", updatedPosts);
                                      }}
                                      placeholder="Sep 1, 2026"
                                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                      Author
                                    </label>
                                    <input
                                      type="text"
                                      value={post.author || ""}
                                      onChange={(e) => {
                                        const updatedPosts = (selectedElementAny.posts || []).map((p) =>
                                          p.id === post.id ? { ...p, author: e.target.value } : p
                                        );
                                        updateSelectedProp("posts", updatedPosts);
                                      }}
                                      placeholder="Jane Doe"
                                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
  );
}
