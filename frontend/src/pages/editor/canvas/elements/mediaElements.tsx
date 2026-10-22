import React from "react";
import { getVimeoId, getYouTubeId } from "../../core/videoEmbed";
import { triggerImagePicker } from "../../inspector/DynamicWidgetInspectors";
import { resolveImageUrl, updateTreeElement } from "../../utils";
import { EmptyPictureIcon } from "../../widgets";
import type { EditorElement, ElementStyles, PageConfig } from "../../types";

/** What renderMediaElements reads: renderElementTree's per-element values, then the editor values it closed over. */
export interface MediaElementsContext {
  el: EditorElement;
  mergedStyles: ElementStyles;
  apiUrl: any;
  compileBackgroundAndBorderStyles: (mergedStyles: ElementStyles) => React.CSSProperties;
  handlePreviewPageNavigate: (targetPage: PageConfig) => void;
  handleSelectElement: (id: string | null, e?: React.MouseEvent<Element, MouseEvent> | undefined) => void;
  isPreview: boolean;
  pages: PageConfig[];
  setElements: React.Dispatch<React.SetStateAction<EditorElement[]>>;
}

/**
 * Canvas renderers: Video, video playlist and image.
 * Moved verbatim from renderElementTree's leaf wrapper in WebsiteEditor.tsx (the element-renderer
 * slots for video, video-playlist, image). A plain function, called in one slot of the wrapper during
 * the editor's render: it returns a fragment of the original slot expressions in their original order,
 * of which only the slot for el.type renders.
 */
export function renderMediaElements({
  el,
  mergedStyles,
  apiUrl,
  compileBackgroundAndBorderStyles,
  handlePreviewPageNavigate,
  handleSelectElement,
  isPreview,
  pages,
  setElements,
}: MediaElementsContext) {
  return (
    <>
        {el.type === "video" && (
          <div
            style={{
              textAlign: mergedStyles.textAlign || "left",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            {(() => {
              const srcUrl = el.src?.trim() || "";
              if (!srcUrl) {
                return (
                  <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 py-10 px-6 text-center transition hover:border-blue-400">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 text-xl font-bold">
                      🎬
                    </div>
                    <h4 className="mt-3 text-xs font-bold text-slate-700">
                      No video selected
                    </h4>
                    <p className="mt-1 text-[11px] text-slate-400 mb-4 max-w-xs">
                      Enter a YouTube, Vimeo, or HTML5 video link, or upload a video file
                    </p>
                    {!isPreview && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectElement(el.id);
                          triggerImagePicker((url) => {
                            setElements((prev) =>
                              updateTreeElement(prev, el.id, (item) => ({ ...item, src: url }))
                            );
                          });
                        }}
                        className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow hover:bg-blue-700 transition cursor-pointer flex items-center gap-1.5"
                      >
                        <span>🎬</span> Select Video
                      </button>
                    )}
                  </div>
                );
              }

              const ytId = getYouTubeId(srcUrl);
              const vimeoId = getVimeoId(srcUrl);
              const isControls = el.videoControls !== false;
              const isAutoplay = Boolean(el.videoAutoplay);
              const isLoop = Boolean(el.videoLoop);
              const isMuted = Boolean(el.videoMuted);

              const alignMarginLeft =
                mergedStyles.textAlign === "center"
                  ? "auto"
                  : mergedStyles.textAlign === "right"
                    ? "auto"
                    : "0";
              const alignMarginRight =
                mergedStyles.textAlign === "center"
                  ? "auto"
                  : mergedStyles.textAlign === "left"
                    ? "auto"
                    : "0";

              const containerStyle: React.CSSProperties = {
                width: mergedStyles.width || "100%",
                maxWidth: "100%",
                height: mergedStyles.height && mergedStyles.height !== "auto" ? mergedStyles.height : undefined,
                borderRadius: mergedStyles.borderRadius || "8px",
                overflow: "hidden",
                boxSizing: "border-box",
                marginLeft: alignMarginLeft,
                marginRight: alignMarginRight,
                ...compileBackgroundAndBorderStyles(mergedStyles),
              };

              if (ytId) {
                const embedParams = new URLSearchParams({
                  autoplay: isAutoplay ? "1" : "0",
                  controls: isControls ? "1" : "0",
                  loop: isLoop ? "1" : "0",
                  mute: isMuted ? "1" : "0",
                  playlist: isLoop ? ytId : "",
                }).toString();

                return (
                  <div style={containerStyle} className="inline-block shadow-sm">
                    <div className="relative w-full aspect-video bg-black overflow-hidden rounded-[inherit]">
                      <iframe
                        src={`https://www.youtube.com/embed/${ytId}?${embedParams}`}
                        title="YouTube video player"
                        className="absolute inset-0 w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                );
              }

              if (vimeoId) {
                const embedParams = new URLSearchParams({
                  autoplay: isAutoplay ? "1" : "0",
                  controls: isControls ? "1" : "0",
                  loop: isLoop ? "1" : "0",
                  muted: isMuted ? "1" : "0",
                }).toString();

                return (
                  <div style={containerStyle} className="inline-block shadow-sm">
                    <div className="relative w-full aspect-video bg-black overflow-hidden rounded-[inherit]">
                      <iframe
                        src={`https://player.vimeo.com/video/${vimeoId}?${embedParams}`}
                        title="Vimeo video player"
                        className="absolute inset-0 w-full h-full border-0"
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                );
              }

              // Direct Video / HTML5 Video file fallback
              return (
                <div style={containerStyle} className="inline-block shadow-sm">
                  <video
                    src={resolveImageUrl(srcUrl, apiUrl)}
                    poster={el.videoPoster ? resolveImageUrl(el.videoPoster, apiUrl) : undefined}
                    controls={isControls}
                    autoPlay={isAutoplay}
                    loop={isLoop}
                    muted={isMuted}
                    playsInline
                    className="w-full h-full object-cover rounded-[inherit]"
                    style={{
                      maxHeight: mergedStyles.height && mergedStyles.height !== "auto" ? mergedStyles.height : "500px",
                    }}
                  >
                    Your browser does not support HTML5 video playback.
                  </video>
                </div>
              );
            })()}
          </div>
        )}

        {el.type === "video-playlist" && (
          <div
            style={{
              textAlign: mergedStyles.textAlign || "left",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            {(() => {
              const items = el.playlistItems || [];
              if (items.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 py-10 px-6 text-center transition hover:border-blue-400">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 text-xl font-bold">
                      📺
                    </div>
                    <h4 className="mt-3 text-xs font-bold text-slate-700">
                      No video playlist items
                    </h4>
                    <p className="mt-1 text-[11px] text-slate-400 mb-4 max-w-xs">
                      Add videos to this playlist from the properties sidebar
                    </p>
                    {!isPreview && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectElement(el.id);
                        }}
                        className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
                      >
                        Manage Playlist
                      </button>
                    )}
                  </div>
                );
              }

              // Determine active item
              const activeIndex = Math.max(
                0,
                items.findIndex((item) => item.id === el.playlistActiveId)
              );
              const activeItem = items[activeIndex] || items[0];
              const isRightPosition = (el.playlistPosition || "right") === "right";
              const playerWidthPercentage = el.playlistPlayerWidth || "65%";

              // Navigation Handlers
              const handlePrev = (e: React.MouseEvent) => {
                e.stopPropagation();
                const prevIndex = (activeIndex - 1 + items.length) % items.length;
                const prevItem = items[prevIndex];
                if (prevItem) {
                  setElements((prev) =>
                    updateTreeElement(prev, el.id, (item) => ({ ...item, playlistActiveId: prevItem.id }))
                  );
                }
              };

              const handleNext = (e: React.MouseEvent) => {
                e.stopPropagation();
                const nextIndex = (activeIndex + 1) % items.length;
                const nextItem = items[nextIndex];
                if (nextItem) {
                  setElements((prev) =>
                    updateTreeElement(prev, el.id, (item) => ({ ...item, playlistActiveId: nextItem.id }))
                  );
                }
              };

              const handleSelectItem = (itemId: string, e: React.MouseEvent) => {
                e.stopPropagation();
                setElements((prev) =>
                  updateTreeElement(prev, el.id, (item) => ({ ...item, playlistActiveId: itemId }))
                );
              };

              // Helper for embedding active video
              const renderActivePlayer = () => {
                const srcUrl = (activeItem?.url || activeItem?.videoUrl || "").trim();
                const posterUrl = activeItem?.thumbnailUrl || activeItem?.thumbnail;
                const ytId = getYouTubeId(srcUrl);
                const vimeoId = getVimeoId(srcUrl);

                if (!srcUrl) {
                  return (
                    <div className="flex h-full min-h-[240px] flex-col items-center justify-center bg-slate-900 text-slate-400 p-6 text-center">
                      <span className="text-2xl mb-2">🎬</span>
                      <p className="text-xs font-medium">No video URL provided for this item</p>
                    </div>
                  );
                }

                if (ytId) {
                  return (
                    <div className="relative w-full aspect-video bg-black overflow-hidden">
                      <iframe
                        src={`https://www.youtube.com/embed/${ytId}?autoplay=1&controls=1`}
                        title={activeItem.title}
                        className="absolute inset-0 w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  );
                }

                if (vimeoId) {
                  return (
                    <div className="relative w-full aspect-video bg-black overflow-hidden">
                      <iframe
                        src={`https://player.vimeo.com/video/${vimeoId}?autoplay=1&controls=1`}
                        title={activeItem.title}
                        className="absolute inset-0 w-full h-full border-0"
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  );
                }

                return (
                  <div className="relative w-full aspect-video bg-black overflow-hidden">
                    <video
                      src={resolveImageUrl(srcUrl, apiUrl)}
                      poster={posterUrl ? resolveImageUrl(posterUrl, apiUrl) : undefined}
                      controls
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    >
                      Your browser does not support HTML5 video playback.
                    </video>
                  </div>
                );
              };

              return (
                <div
                  style={{
                    width: mergedStyles.width || "100%",
                    borderRadius: mergedStyles.borderRadius || "12px",
                    overflow: "hidden",
                    boxSizing: "border-box",
                    ...compileBackgroundAndBorderStyles(mergedStyles),
                  }}
                  className="border border-slate-200 bg-white shadow-md"
                >
                  {/* Playlist Layout Container */}
                  <div
                    className={
                      isRightPosition
                        ? "flex flex-col md:flex-row items-stretch overflow-hidden"
                        : "flex flex-col overflow-hidden"
                    }
                  >
                    {/* Player Section */}
                    <div
                      style={{
                        width: isRightPosition ? playerWidthPercentage : "100%",
                      }}
                      className="flex-1 shrink-0 bg-slate-950 flex flex-col justify-between"
                    >
                      {/* Player Top Header Bar */}
                      <div className="flex items-center justify-between bg-slate-900/90 px-4 py-2.5 text-white border-b border-slate-800 shrink-0">
                        <div className="flex items-center gap-2 overflow-hidden mr-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                            {activeIndex + 1}
                          </span>
                          <h4 className="truncate text-xs font-semibold text-slate-100">
                            {activeItem.title || "Untitled Video"}
                          </h4>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={handlePrev}
                            title="Previous Video"
                            className="rounded px-2 py-1 text-[11px] font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition flex items-center gap-1"
                          >
                            <span>◀</span>
                            <span className="hidden sm:inline">Prev</span>
                          </button>
                          <span className="text-[10px] text-slate-500 px-1">
                            {activeIndex + 1}/{items.length}
                          </span>
                          <button
                            type="button"
                            onClick={handleNext}
                            title="Next Video"
                            className="rounded px-2 py-1 text-[11px] font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition flex items-center gap-1"
                          >
                            <span className="hidden sm:inline">Next</span>
                            <span>▶</span>
                          </button>
                        </div>
                      </div>

                      {/* Video Embed Player */}
                      {renderActivePlayer()}
                    </div>

                    {/* Playlist Sidebar / Bottom List */}
                    <div
                      style={{
                        width: isRightPosition ? `calc(100% - ${playerWidthPercentage})` : "100%",
                      }}
                      className={
                        isRightPosition
                          ? "flex flex-col border-t md:border-t-0 md:border-l border-slate-200 bg-slate-50 max-h-[460px]"
                          : "flex flex-col border-t border-slate-200 bg-slate-50 max-h-[320px]"
                      }
                    >
                      {/* Sidebar Header */}
                      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shrink-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">📺</span>
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            Playlist ({items.length})
                          </h4>
                        </div>
                        <span className="text-[10px] font-semibold text-slate-400">
                          Now Playing: #{activeIndex + 1}
                        </span>
                      </div>

                      {/* Playlist Items List */}
                      <div className="flex-1 overflow-y-auto divide-y divide-slate-200/80 p-1 space-y-1">
                        {items.map((item, idx) => {
                          const isActive = item.id === (el.playlistActiveId || items[0]?.id);
                          return (
                            <button
                              key={item.id || idx}
                              type="button"
                              onClick={(e) => handleSelectItem(item.id, e)}
                              className={`w-full text-left p-2.5 rounded-lg transition flex items-center gap-3 group ${isActive
                                ? "bg-blue-600 text-white shadow-sm ring-1 ring-blue-600"
                                : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/60"
                                }`}
                            >
                              {/* Item Index / Active Icon */}
                              <div
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-xs font-bold ${isActive
                                  ? "bg-white/20 text-white"
                                  : "bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600"
                                  }`}
                              >
                                {isActive ? "▶" : String(idx + 1).padStart(2, "0")}
                              </div>

                              {/* Thumbnail preview if available */}
                              {item.thumbnailUrl && (
                                <img
                                  src={resolveImageUrl(item.thumbnailUrl, apiUrl)}
                                  alt={item.title}
                                  className="h-9 w-14 object-cover rounded border border-black/10 shrink-0"
                                />
                              )}

                              {/* Title & Duration */}
                              <div className="flex-1 min-w-0">
                                <h5
                                  className={`truncate text-xs font-semibold ${isActive ? "text-white" : "text-slate-800 group-hover:text-blue-600"
                                    }`}
                                >
                                  {item.title || `Video ${idx + 1}`}
                                </h5>
                                {item.duration && (
                                  <span
                                    className={`text-[10px] font-mono ${isActive ? "text-blue-100" : "text-slate-400"
                                      }`}
                                  >
                                    ⏱️ {item.duration}
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {el.type === "image" && (() => {
          const getMaskClipPath = (shape?: string) => {
            switch (shape) {
              case "circle": return "circle(50% at 50% 50%)";
              case "rounded": return "inset(0 round 20%)";
              case "blob": return "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)";
              case "hexagon": return "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";
              case "star": return "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)";
              case "diamond": return "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)";
              case "squircle": return "inset(0 round 35%)";
              case "heart": return "polygon(50% 15%, 65% 0%, 85% 0%, 100% 15%, 100% 35%, 50% 90%, 0% 35%, 0% 15%, 15% 0%, 35% 0%)";
              default: return undefined;
            }
          };

          const imageHref = el.href || el.linkUrl || (el.pageId ? `page:${el.pageId}` : "");
          const imageTarget = el.target || "_self";
          const imageRel = imageTarget === "_blank" ? (el.rel || "noopener noreferrer") : el.rel;

          const renderedImg = el.src ? (
            <img
              src={resolveImageUrl(el.src, apiUrl)}
              alt={el.alt || "Uploaded Image"}
              className="inline-block max-w-full"
              style={{
                display: "block",
                width: mergedStyles.width || "100%",
                height: mergedStyles.height || "auto",
                objectFit: (mergedStyles.objectFit as any) || "cover",
                objectPosition: mergedStyles.objectPosition || "center",
                opacity: mergedStyles.opacity !== undefined ? Number(mergedStyles.opacity) : 1,
                borderRadius: mergedStyles.borderRadius || "8px",
                boxSizing: "border-box",
                clipPath: getMaskClipPath(el.imageMaskShape),
                marginLeft:
                  mergedStyles.textAlign === "center"
                    ? "auto"
                    : mergedStyles.textAlign === "right"
                      ? "auto"
                      : "0",
                marginRight:
                  mergedStyles.textAlign === "center"
                    ? "auto"
                    : mergedStyles.textAlign === "left"
                      ? "auto"
                      : "0",
                ...compileBackgroundAndBorderStyles(mergedStyles),
              }}
            />
          ) : null;

          const wrappedImage = imageHref && renderedImg ? (
            <a
              href={imageHref}
              target={imageTarget}
              rel={imageRel}
              onClick={(e) => {
                if (!isPreview) {
                  e.preventDefault();
                  return;
                }
                let targetPage: PageConfig | undefined;
                if (el.pageId && pages) {
                  targetPage = pages.find((p) => p.id === el.pageId);
                }
                if (!targetPage && imageHref && pages) {
                  const clean = imageHref.replace(/^\//, "").split("?")[0].split("#")[0];
                  targetPage = pages.find(
                    (p) =>
                      p.slug === imageHref ||
                      p.slug === `/${clean}` ||
                      p.slug.replace(/^\//, "") === clean ||
                      p.id === clean ||
                      (clean === "" && (p.isHome || p.id === "home"))
                  );
                }
                if (targetPage && imageTarget !== "_blank") {
                  e.preventDefault();
                  handlePreviewPageNavigate(targetPage);
                } else if (imageHref.startsWith("#") && imageHref.length > 1) {
                  e.preventDefault();
                  const targetEl = document.querySelector(imageHref);
                  if (targetEl) targetEl.scrollIntoView({ behavior: "smooth" });
                }
              }}
            >
              {renderedImg}
            </a>
          ) : renderedImg;

          return (
            <div
              style={{
                textAlign: mergedStyles.textAlign || "left",
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              {wrappedImage ? (
                wrappedImage
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 py-8 px-6 text-center transition hover:border-blue-400">
                  <EmptyPictureIcon />
                  <h4 className="mt-3 text-xs font-bold text-slate-700">
                    No image selected
                  </h4>
                  <p className="mt-1 text-[11px] text-slate-400 mb-3">
                    Select or upload an image for this widget
                  </p>
                  {!isPreview && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectElement(el.id);
                        triggerImagePicker((url) => {
                          setElements((prev) =>
                            updateTreeElement(prev, el.id, (item) => ({ ...item, src: url }))
                          );
                        });
                      }}
                      className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow hover:bg-blue-700 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <span>📁</span> Select Image
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })()}
    </>
  );
}
