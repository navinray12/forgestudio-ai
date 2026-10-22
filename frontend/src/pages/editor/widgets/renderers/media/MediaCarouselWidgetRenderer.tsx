/**
 * MediaCarouselWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState, useRef, useEffect } from "react";
import type { EditorElement, ElementStyles, MediaCarouselItem } from "../../../types";
import { getEmbedVideoUrl } from "../embed";

export const MediaCarouselWidgetRenderer = ({
  el,
  isPreview: _isPreview,
  mergedStyles,
}: {
  el: EditorElement;
  isPreview: boolean;
  mergedStyles: ElementStyles;
}) => {
  const items = el.mediaCarouselItems || [];
  const rawSlidesPerView = el.mediaCarouselSlidesPerView || 3;
  const gap = el.mediaCarouselGap ?? 16;
  const autoplay = el.mediaCarouselAutoplay !== false;
  const autoplaySpeed = el.mediaCarouselAutoplaySpeed || 3500;
  const loop = el.mediaCarouselLoop !== false;
  const showNav = el.mediaCarouselShowNav !== false;
  const showDots = el.mediaCarouselShowDots !== false;
  const aspectRatio = el.mediaCarouselAspectRatio || "landscape";
  const borderRadius = el.mediaCarouselBorderRadius || "16px";
  const transition = el.mediaCarouselTransition || "slide";
  const transitionSpeed = el.mediaCarouselTransitionSpeed || 500;
  const imageSizing = el.mediaCarouselImageSizing || "cover";
  const cardBg = el.mediaCarouselCardBg || "#0f172a";

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [selectedLightboxMedia, setSelectedLightboxMedia] = useState<MediaCarouselItem | null>(null);

  // Responsive slides per view calculation
  const containerRef = useRef<HTMLDivElement>(null);
  const [effectiveSlidesPerView, setEffectiveSlidesPerView] = useState<number>(rawSlidesPerView);

  useEffect(() => {
    const updateResponsiveSlides = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      if (width < 640) {
        setEffectiveSlidesPerView(1);
      } else if (width < 1024) {
        setEffectiveSlidesPerView(Math.min(rawSlidesPerView, 2));
      } else {
        setEffectiveSlidesPerView(rawSlidesPerView);
      }
    };

    updateResponsiveSlides();
    window.addEventListener("resize", updateResponsiveSlides);
    return () => window.removeEventListener("resize", updateResponsiveSlides);
  }, [rawSlidesPerView]);

  // Drag / Swipe State
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [draggedFar, setDraggedFar] = useState(false);

  const maxIndex = Math.max(0, items.length - effectiveSlidesPerView);

  const handleNext = () => {
    setCurrentIndex((prev) => {
      if (prev >= maxIndex) {
        return loop ? 0 : prev;
      }
      return prev + 1;
    });
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => {
      if (prev <= 0) {
        return loop ? maxIndex : 0;
      }
      return prev - 1;
    });
  };

  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    setTouchStartX(clientX);
    setIsMouseDown(true);
    setDraggedFar(false);
    setDragOffset(0);
  };

  const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (touchStartX === null || !isMouseDown) return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const diff = clientX - touchStartX;
    setDragOffset(diff);
    if (Math.abs(diff) > 8) {
      setDraggedFar(true);
    }
  };

  const handleDragEnd = () => {
    if (touchStartX === null) return;
    if (dragOffset < -40) {
      handleNext();
    } else if (dragOffset > 40) {
      handlePrev();
    }
    setTouchStartX(null);
    setIsMouseDown(false);
    setDragOffset(0);
  };

  useEffect(() => {
    if (!autoplay || isHovered || isMouseDown || maxIndex === 0) return;
    const timer = setInterval(() => {
      handleNext();
    }, autoplaySpeed);
    return () => clearInterval(timer);
  }, [autoplay, isHovered, isMouseDown, maxIndex, autoplaySpeed, loop]);

  const aspectStyleMap: Record<string, string> = {
    square: "aspect-square",
    landscape: "aspect-16/9",
    portrait: "aspect-3/4",
    video: "aspect-21/9",
    auto: "h-64",
  };

  // Empty State
  if (!items || items.length === 0) {
    return (
      <div
        className="w-full flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-cyan-200 bg-cyan-50/40 text-center"
        style={{
          marginTop: mergedStyles.marginTop,
          marginBottom: mergedStyles.marginBottom,
        }}
      >
        <div className="h-12 w-12 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center text-xl mb-3 shadow-xs">
          🎡
        </div>
        <h4 className="text-sm font-bold text-slate-800">Media Carousel</h4>
        <p className="text-xs text-slate-500 max-w-xs mt-1">
          No media items added yet. Use "+ Add Image" or "+ Add Video" in the Inspector Panel to populate your carousel.
        </p>
      </div>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        className="w-full relative group overflow-hidden select-none"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          if (isMouseDown) handleDragEnd();
        }}
        onMouseDown={handleDragStart}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
        style={{
          fontFamily: mergedStyles.fontFamily,
          marginTop: mergedStyles.marginTop,
          marginBottom: mergedStyles.marginBottom,
          cursor: isMouseDown ? "grabbing" : "grab",
        }}
      >
        {/* Track Container */}
        <div className="overflow-hidden w-full py-2">
          {transition === "fade" ? (
            <div className="relative w-full overflow-hidden" style={{ borderRadius }}>
              {items.map((item, idx) => {
                const isVideo = item.type === "video" || !!item.videoUrl;
                const isSelected = idx === currentIndex;
                return (
                  <div
                    key={item.id}
                    className={`w-full transition-all duration-500 ${
                      isSelected ? "relative opacity-100 z-10" : "absolute inset-0 opacity-0 z-0 pointer-events-none"
                    }`}
                    onClick={(e) => {
                      if (draggedFar) {
                        e.stopPropagation();
                        return;
                      }
                      setSelectedLightboxMedia(item);
                    }}
                  >
                    <div className={`w-full overflow-hidden relative shadow-lg ${aspectStyleMap[aspectRatio] || "aspect-16/9"}`} style={{ backgroundColor: cardBg, borderRadius }}>
                      <img
                        src={item.url || item.posterUrl || "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800"}
                        alt={item.altText || item.title || "Carousel Media"}
                        className="w-full h-full pointer-events-none"
                        style={{ objectFit: imageSizing as any }}
                        loading="lazy"
                      />

                      {/* Top Type Badge */}
                      <div className="absolute top-3 left-3 z-10">
                        {isVideo ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-900/80 px-2.5 py-1 text-[10px] font-bold text-cyan-200 backdrop-blur shadow-sm border border-cyan-400/30">
                            <span>🎬</span> VIDEO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-900/80 px-2.5 py-1 text-[10px] font-bold text-indigo-200 backdrop-blur shadow-sm border border-indigo-400/30">
                            <span>📷</span> IMAGE
                          </span>
                        )}
                      </div>

                      {/* Video Play Overlay */}
                      {isVideo && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition">
                          <div className="h-12 w-12 rounded-full bg-cyan-600/90 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition border border-white/40">
                            <span className="text-lg pl-0.5">▶</span>
                          </div>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-90 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 text-white">
                        {item.title && <h5 className="text-sm font-bold text-white drop-shadow">{item.title}</h5>}
                        {item.caption && <p className="text-xs font-normal text-slate-200 drop-shadow line-clamp-2 mt-0.5">{item.caption}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              className={`flex ${isMouseDown ? "transition-none" : "transition-transform ease-out"}`}
              style={{
                gap: `${gap}px`,
                transitionDuration: `${transitionSpeed}ms`,
                transform: `translateX(calc(-${currentIndex * (100 / effectiveSlidesPerView)}% - ${currentIndex * (gap / effectiveSlidesPerView)}px + ${dragOffset}px))`,
              }}
            >
              {items.map((item) => {
                const isVideo = item.type === "video" || !!item.videoUrl;
                return (
                  <div
                    key={item.id}
                    className="shrink-0 group/card relative overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer"
                    style={{
                      width: `calc((100% - ${(effectiveSlidesPerView - 1) * gap}px) / ${effectiveSlidesPerView})`,
                      borderRadius,
                      backgroundColor: cardBg,
                    }}
                    onClick={(e) => {
                      if (draggedFar) {
                        e.stopPropagation();
                        return;
                      }
                      setSelectedLightboxMedia(item);
                    }}
                  >
                    <div className={`w-full overflow-hidden relative ${aspectStyleMap[aspectRatio] || "aspect-16/9"}`}>
                      <img
                        src={item.url || item.posterUrl || "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800"}
                        alt={item.altText || item.title || "Carousel Media"}
                        className="w-full h-full transition-transform duration-500 group-hover/card:scale-105 pointer-events-none"
                        style={{ objectFit: imageSizing as any }}
                        loading="lazy"
                      />

                      {/* Top Type Badge */}
                      <div className="absolute top-2.5 left-2.5 z-10">
                        {isVideo ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-950/85 px-2 py-0.5 text-[9px] font-bold text-cyan-300 backdrop-blur shadow-xs border border-cyan-500/30">
                            <span>🎬</span> VIDEO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/85 px-2 py-0.5 text-[9px] font-bold text-slate-200 backdrop-blur shadow-xs border border-slate-700/40">
                            <span>📷</span> IMAGE
                          </span>
                        )}
                      </div>

                      {/* Video Play Overlay */}
                      {isVideo && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover/card:bg-black/45 transition duration-300">
                          <div className="h-10 w-10 rounded-full bg-cyan-600/90 text-white flex items-center justify-center shadow-lg transform group-hover/card:scale-110 transition border border-white/50">
                            <span className="text-sm pl-0.5">▶</span>
                          </div>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-85 group-hover/card:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3 text-white">
                        {item.title && (
                          <h5 className="text-xs font-bold text-white drop-shadow line-clamp-1">{item.title}</h5>
                        )}
                        {item.caption && (
                          <p className="text-[11px] font-medium text-slate-200 drop-shadow line-clamp-2 mt-0.5">{item.caption}</p>
                        )}
                        <span className="text-[9px] text-cyan-300 font-semibold mt-1 flex items-center gap-1">
                          <span>{isVideo ? "🎬 Click to Watch Video" : "🔍 Click to View Image"}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Navigation Arrows */}
        {showNav && maxIndex > 0 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              disabled={!loop && currentIndex === 0}
              className={`absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white flex items-center justify-center backdrop-blur shadow-lg transition-all z-20 cursor-pointer ${
                !loop && currentIndex === 0 ? "opacity-30 cursor-not-allowed" : "hover:scale-110"
              }`}
              title="Previous Slide"
            >
              <span className="text-base font-bold">‹</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              disabled={!loop && currentIndex >= maxIndex}
              className={`absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white flex items-center justify-center backdrop-blur shadow-lg transition-all z-20 cursor-pointer ${
                !loop && currentIndex >= maxIndex ? "opacity-30 cursor-not-allowed" : "hover:scale-110"
              }`}
              title="Next Slide"
            >
              <span className="text-base font-bold">›</span>
            </button>
          </>
        )}

        {/* Dots Pagination */}
        {showDots && maxIndex > 0 && (
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {Array.from({ length: maxIndex + 1 }).map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                  currentIndex === idx ? "w-6 bg-cyan-600" : "w-2 bg-slate-300 hover:bg-slate-400"
                }`}
                title={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Lightbox / Video Player Modal */}
      {selectedLightboxMedia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm animate-fade-in"
          onClick={() => setSelectedLightboxMedia(null)}
        >
          <div
            className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl p-4 border border-slate-700 shadow-2xl flex flex-col items-center overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedLightboxMedia(null)}
              className="absolute top-3 right-3 text-slate-400 hover:text-white text-xl font-bold bg-slate-800/80 rounded-full h-8 w-8 flex items-center justify-center transition cursor-pointer z-10"
              title="Close modal"
            >
              ✕
            </button>

            {/* Media Display Area */}
            <div className="w-full flex-1 flex items-center justify-center overflow-hidden rounded-xl bg-black min-h-[300px]">
              {(selectedLightboxMedia.type === "video" || !!selectedLightboxMedia.videoUrl) ? (
                <div className="w-full aspect-16/9 relative">
                  <iframe
                    src={getEmbedVideoUrl(selectedLightboxMedia.videoUrl || selectedLightboxMedia.url)}
                    title={selectedLightboxMedia.title || "Video Player"}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <img
                  src={selectedLightboxMedia.url}
                  alt={selectedLightboxMedia.altText || selectedLightboxMedia.title || "Enlarged view"}
                  className="max-h-[70vh] max-w-full rounded-xl object-contain shadow-2xl"
                />
              )}
            </div>

            {/* Title & Caption */}
            {(selectedLightboxMedia.title || selectedLightboxMedia.caption) && (
              <div className="mt-3 w-full text-center px-4">
                {selectedLightboxMedia.title && (
                  <h4 className="text-base font-bold text-white">{selectedLightboxMedia.title}</h4>
                )}
                {selectedLightboxMedia.caption && (
                  <p className="mt-1 text-xs text-slate-300 font-normal">{selectedLightboxMedia.caption}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
