import React from "react";
import { resolveImageUrl } from "../../utils";
import { LoopGridWidgetRenderer, ShareButtonsWidgetRenderer, SlidesWidgetRenderer } from "../../widgets";
import type { DeviceMode, EditorElement, ElementStyles, PageConfig } from "../../types";

/** What renderDynamicContentElements reads: renderElementTree's per-element values, then the editor values it closed over. */
export interface DynamicContentElementsContext {
  el: EditorElement;
  mergedStyles: ElementStyles;
  activeDevice: DeviceMode;
  activePageId: string;
  activePreviewPageId: string;
  apiUrl: any;
  isPreview: boolean;
  pages: PageConfig[];
  setActivePageId: React.Dispatch<React.SetStateAction<string>>;
  setActivePreviewPageId: React.Dispatch<React.SetStateAction<string>>;
}

/**
 * Canvas renderers: Posts, loop grid, share buttons, portfolio and slides.
 * Moved verbatim from renderElementTree's leaf wrapper in WebsiteEditor.tsx (the element-renderer
 * slots for posts, loop-grid, share-buttons, portfolio, slides). A plain function, called in one slot of the wrapper during
 * the editor's render: it returns a fragment of the original slot expressions in their original order,
 * of which only the slot for el.type renders.
 */
export function renderDynamicContentElements({
  el,
  mergedStyles,
  activeDevice,
  activePageId,
  activePreviewPageId,
  apiUrl,
  isPreview,
  pages,
  setActivePageId,
  setActivePreviewPageId,
}: DynamicContentElementsContext) {
  return (
    <>
        {el.type === "posts" && (() => {
          const postsList = el.posts && el.posts.length > 0 ? el.posts : [];
          const columns = el.postsColumns || 3;
          const gap = el.postsGap ?? 20;
          const imageHeight = el.postsImageHeight || "180px";
          const align = el.postsAlignment || "left";
          const showImage = el.postsShowImage !== false;
          const showDate = el.postsShowDate !== false;
          const showExcerpt = el.postsShowExcerpt !== false;
          const showReadMore = el.postsShowReadMore !== false;

          let gridColsStyle: React.CSSProperties = {};
          if (activeDevice === "mobile") {
            gridColsStyle = { gridTemplateColumns: "repeat(1, minmax(0, 1fr))" };
          } else if (activeDevice === "tablet") {
            gridColsStyle = { gridTemplateColumns: `repeat(${Math.min(columns, 2)}, minmax(0, 1fr))` };
          } else {
            gridColsStyle = { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` };
          }

          return (
            <div style={{ width: "100%", boxSizing: "border-box" }}>
              {postsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-8 text-center bg-slate-50/50">
                  <p className="text-xs font-bold text-slate-600">No Posts Configured</p>
                  <p className="text-[10px] text-slate-400 mt-1">Use the right properties panel to add blog posts.</p>
                </div>
              ) : (
                <div
                  className="grid"
                  style={{ gap: `${gap}px`, ...gridColsStyle }}
                >
                  {postsList.map((post) => (
                    <article
                      key={post.id}
                      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs transition hover:shadow-md hover:-translate-y-0.5"
                      style={{ textAlign: align }}
                    >
                      {showImage && post.image && (
                        <div className="relative overflow-hidden bg-slate-100" style={{ height: imageHeight }}>
                          <img
                            src={resolveImageUrl(post.image, apiUrl)}
                            alt={post.title}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          />
                        </div>
                      )}
                      <div className="flex flex-1 flex-col p-5">
                        {showDate && (post.date || post.author) && (
                          <div className="mb-2 flex items-center text-[11px] font-medium text-slate-400 gap-2">
                            {post.date && <span>{post.date}</span>}
                            {post.date && post.author && <span>•</span>}
                            {post.author && <span>By {post.author}</span>}
                          </div>
                        )}
                        <h3 className="text-base font-bold text-slate-900 leading-snug group-hover:text-blue-600 transition mb-2">
                          {post.title}
                        </h3>
                        {showExcerpt && post.excerpt && (
                          <p className="text-xs text-slate-600 leading-relaxed flex-1 mb-4">
                            {post.excerpt}
                          </p>
                        )}
                        {showReadMore && (
                          <div className="mt-auto">
                            <a
                              href={post.readMoreUrl || "#"}
                              onClick={(e) => {
                                if (!isPreview) e.preventDefault();
                              }}
                              className="inline-flex items-center text-xs font-bold text-blue-600 hover:text-blue-800 transition gap-1"
                            >
                              <span>{post.readMoreText || "Read More →"}</span>
                            </a>
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {el.type === "loop-grid" && (
          <LoopGridWidgetRenderer
            el={el}
            isPreview={isPreview}
            mergedStyles={mergedStyles}
            activeDevice={activeDevice}
            pages={pages}
            onSwitchPage={(target) => {
              if (isPreview) setActivePreviewPageId(target.id);
              else setActivePageId(target.id);
            }}
            apiUrl={apiUrl}
          />
        )}

        {el.type === "share-buttons" && (
          <ShareButtonsWidgetRenderer
            el={el}
            isPreview={isPreview}
            mergedStyles={mergedStyles}
            pages={pages}
            activePageId={isPreview ? activePreviewPageId : activePageId}
          />
        )}

        {el.type === "portfolio" && (() => {
          const items = el.portfolioItems && el.portfolioItems.length > 0 ? el.portfolioItems : [];
          const columns = el.portfolioColumns || 3;
          const gap = el.portfolioGap ?? 24;
          const imageHeight = el.portfolioImageHeight || "240px";
          const align = el.portfolioAlignment || "left";
          const showCategory = el.portfolioShowCategory !== false;
          const showDescription = el.portfolioShowDescription !== false;
          const showLink = el.portfolioShowLink !== false;

          let colClass = "grid-cols-3";
          if (columns === 1) colClass = "grid-cols-1";
          else if (columns === 2) colClass = "grid-cols-1 md:grid-cols-2";
          else if (columns === 3) colClass = "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
          else if (columns === 4) colClass = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";

          if (activeDevice === "mobile") colClass = "grid-cols-1";
          else if (activeDevice === "tablet" && columns > 2) colClass = "grid-cols-2";

          const textAlignClass = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
          const flexJustifyClass = align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-start";

          return (
            <div style={{ width: "100%", boxSizing: "border-box" }}>
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-8 text-center bg-slate-50/50">
                  <p className="text-sm font-bold text-slate-600">No Portfolio Items Created</p>
                  <p className="text-xs text-slate-400 mt-1">Use the right properties panel to add projects & works.</p>
                </div>
              ) : (
                <div
                  className={`grid ${colClass}`}
                  style={{ gap: `${gap}px` }}
                >
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-slate-300"
                    >
                      {/* Image Thumbnail with Overlay */}
                      <div
                        className="relative overflow-hidden bg-slate-100"
                        style={{ height: imageHeight }}
                      >
                        <img
                          src={item.image || "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&auto=format&fit=crop&q=80"}
                          alt={item.title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        {showCategory && item.category && (
                          <div className="absolute top-3 left-3">
                            <span className="inline-block rounded-full bg-slate-900/80 backdrop-blur-md px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-xs">
                              {item.category}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Content Card */}
                      <div className={`flex flex-col flex-1 p-5 ${textAlignClass}`}>
                        <h4
                          className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition"
                          style={{ fontFamily: mergedStyles.fontFamily }}
                        >
                          {item.title}
                        </h4>

                        {showDescription && item.description && (
                          <p
                            className="mt-2 text-xs text-slate-600 leading-relaxed flex-1 line-clamp-3"
                            style={{ fontFamily: mergedStyles.fontFamily }}
                          >
                            {item.description}
                          </p>
                        )}

                        {showLink && (
                          <div className={`mt-4 flex items-center ${flexJustifyClass}`}>
                            <a
                              href={item.url || "#"}
                              onClick={(e) => {
                                if (!isPreview) e.preventDefault();
                              }}
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition"
                            >
                              <span>View Project</span>
                              <svg className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="5" y1="12" x2="19" y2="12" />
                                <polyline points="12 5 19 12 12 19" />
                              </svg>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {el.type === "slides" && (
          <SlidesWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}
    </>
  );
}
