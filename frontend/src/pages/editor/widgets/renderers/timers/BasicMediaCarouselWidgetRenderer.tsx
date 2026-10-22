/**
 * BasicMediaCarouselWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState, useEffect } from "react";
import type { EditorElement, ElementStyles } from "../../../types";

/* F-212: Basic Media Carousel Renderer */
export const BasicMediaCarouselWidgetRenderer = ({
  el,
  isPreview: _isPreview,
  mergedStyles,
}: {
  el: EditorElement;
  isPreview: boolean;
  mergedStyles: ElementStyles;
}) => {
  const items = el.mediaCarouselItems && el.mediaCarouselItems.length > 0 ? el.mediaCarouselItems : [
    { id: "1", type: "image" as const, url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80", title: "Alpine Lake", caption: "Serene Nature" },
    { id: "2", type: "video" as const, url: "https://images.unsplash.com/photo-1511818966892-d7d671e672a2?w=800&auto=format&fit=crop&q=80", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "Demo Video", caption: "Product Overview" },
  ];
  const [currentIndex, setCurrentIndex] = useState(0);
  const slidesPerView = el.mediaCarouselSlidesPerView || 2;
  const gap = el.mediaCarouselGap ?? 12;
  const showNav = el.mediaCarouselShowNav !== false;
  const showDots = el.mediaCarouselShowDots !== false;
  const autoplay = el.mediaCarouselAutoplay ?? true;
  const speed = el.mediaCarouselAutoplaySpeed || 3000;
  const borderRadius = el.mediaCarouselBorderRadius || "12px";

  useEffect(() => {
    if (!autoplay || items.length <= slidesPerView) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % (items.length - slidesPerView + 1 || 1));
    }, speed);
    return () => clearInterval(timer);
  }, [autoplay, speed, items.length, slidesPerView]);

  return (
    <div
      className="w-full relative transition-all"
      style={{
        marginTop: mergedStyles.marginTop,
        marginBottom: mergedStyles.marginBottom,
      }}
    >
      <div className="relative overflow-hidden w-full">
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{
            gap: `${gap}px`,
            transform: `translateX(-${currentIndex * (100 / slidesPerView)}%)`,
          }}
        >
          {items.map((item) => (
            <div
              key={item.id}
              className="relative flex-shrink-0 group overflow-hidden bg-slate-900 border border-slate-200/50 shadow-sm"
              style={{
                width: `calc((100% - ${(slidesPerView - 1) * gap}px) / ${slidesPerView})`,
                borderRadius,
                height: "220px",
              }}
            >
              <img
                src={item.url || "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80"}
                alt={item.title || "Media item"}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex flex-col justify-end p-3 text-white">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300 flex items-center gap-1">
                  {item.type === "video" ? "🎬 Video" : "📷 Image"}
                </span>
                <h5 className="text-xs font-bold leading-tight line-clamp-1">{item.title || "Untitled Media"}</h5>
                {item.caption && <p className="text-[10px] text-slate-300 line-clamp-1">{item.caption}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showNav && items.length > slidesPerView && (
        <>
          <button
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/90 text-slate-800 shadow-md flex items-center justify-center text-xs font-bold disabled:opacity-30 hover:bg-white transition z-10"
          >
            ❮
          </button>
          <button
            onClick={() => setCurrentIndex((prev) => Math.min(items.length - slidesPerView, prev + 1))}
            disabled={currentIndex >= items.length - slidesPerView}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/90 text-slate-800 shadow-md flex items-center justify-center text-xs font-bold disabled:opacity-30 hover:bg-white transition z-10"
          >
            ❯
          </button>
        </>
      )}

      {showDots && items.length > slidesPerView && (
        <div className="flex justify-center gap-1.5 mt-3">
          {Array.from({ length: items.length - slidesPerView + 1 }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-2 rounded-full transition-all ${currentIndex === idx ? "w-5 bg-blue-600" : "w-2 bg-slate-300"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
