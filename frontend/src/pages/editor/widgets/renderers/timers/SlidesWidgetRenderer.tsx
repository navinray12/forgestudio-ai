/**
 * SlidesWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState, useEffect } from "react";
import type { EditorElement, ElementStyles } from "../../../types";

// ==========================================
// CANVAS WIDGET RUNTIME RENDERERS
// ==========================================

export const SlidesWidgetRenderer = ({
  el,
  isPreview,
  mergedStyles,
}: {
  el: EditorElement;
  isPreview: boolean;
  mergedStyles: ElementStyles;
}) => {
  const items = el.slidesItems && el.slidesItems.length > 0 ? el.slidesItems : [];
  const [currentIdx, setCurrentIdx] = useState(el.slidesActiveIndex ?? 0);

  useEffect(() => {
    if (el.slidesActiveIndex !== undefined && el.slidesActiveIndex >= 0 && el.slidesActiveIndex < items.length) {
      setCurrentIdx(el.slidesActiveIndex);
    }
  }, [el.slidesActiveIndex, items.length]);

  const autoplay = el.slidesAutoplay !== false;
  const intervalTime = el.slidesAutoplayInterval || 4000;
  const transition = el.slidesTransition || "slide";
  const height = el.slidesHeight || "450px";
  const align = el.slidesAlignment || "center";
  const showArrows = el.slidesShowArrows !== false;
  const showDots = el.slidesShowDots !== false;

  useEffect(() => {
    if (!autoplay || items.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % items.length);
    }, intervalTime);

    return () => clearInterval(timer);
  }, [autoplay, items.length, intervalTime]);

  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIdx((prev) => (prev - 1 + items.length) % items.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIdx((prev) => (prev + 1) % items.length);
  };

  const handleDotClick = (idx: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIdx(idx);
  };

  const flexAlignClass = align === "center" ? "items-center text-center" : align === "right" ? "items-end text-right" : "items-start text-left";
  const buttonJustifyClass = align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-start";

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-8 text-center bg-slate-50/50">
        <p className="text-sm font-bold text-slate-600">No Slides Created</p>
        <p className="text-xs text-slate-400 mt-1">Use the right properties panel to add slide items.</p>
      </div>
    );
  }

  const validIndex = Math.max(0, Math.min(currentIdx, items.length - 1));
  const currentSlide = items[validIndex] || items[0];

  return (
    <div
      className="relative overflow-hidden rounded-2xl shadow-lg transition-all select-none"
      style={{
        width: "100%",
        height: height,
        backgroundColor: currentSlide.bgColor || "#0f172a",
        boxSizing: "border-box",
      }}
    >
      {/* Slide Background Image & Overlay */}
      {items.map((slide, idx) => {
        const isActive = idx === validIndex;
        return (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-all duration-700 ease-in-out ${
              isActive ? "opacity-100 z-10 translate-x-0 pointer-events-auto" : transition === "fade" ? "opacity-0 z-0 pointer-events-none" : "opacity-0 z-0 translate-x-8 pointer-events-none"
            }`}
            style={{
              backgroundImage: slide.bgImage ? `url(${slide.bgImage})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundColor: slide.bgColor || "#0f172a",
            }}
          >
            {/* Dark Gradient Overlay for optimal contrast */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/30" />

            {/* Slide Content */}
            <div className={`relative z-20 flex h-full flex-col justify-center px-8 sm:px-14 py-10 ${flexAlignClass}`}>
              <div className="max-w-2xl">
                <h2
                  className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight drop-shadow-md"
                  style={{ fontFamily: mergedStyles.fontFamily }}
                >
                  {slide.title}
                </h2>

                {slide.description && (
                  <p
                    className="mt-3 text-xs sm:text-base text-slate-200 leading-relaxed font-normal drop-shadow-xs max-w-xl"
                    style={{ fontFamily: mergedStyles.fontFamily }}
                  >
                    {slide.description}
                  </p>
                )}

                {slide.buttonText && (
                  <div className={`mt-6 flex items-center ${buttonJustifyClass}`}>
                    <a
                      href={slide.buttonUrl || "#"}
                      onClick={(e) => {
                        if (!isPreview) e.preventDefault();
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 sm:px-6 sm:py-3 text-xs sm:text-sm font-bold text-slate-900 shadow-xl transition-all duration-300 hover:bg-slate-100 hover:scale-105 active:scale-95 cursor-pointer"
                    >
                      <span>{slide.buttonText}</span>
                      <svg className="h-4 w-4 text-slate-800" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Navigation Arrows */}
      {showArrows && items.length > 1 && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute left-3 top-1/2 z-40 -translate-y-1/2 flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition hover:bg-black/80 hover:scale-110 active:scale-95 shadow-lg border border-white/20 cursor-pointer"
            title="Previous Slide"
          >
            <svg className="h-5 w-5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleNext}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute right-3 top-1/2 z-40 -translate-y-1/2 flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition hover:bg-black/80 hover:scale-110 active:scale-95 shadow-lg border border-white/20 cursor-pointer"
            title="Next Slide"
          >
            <svg className="h-5 w-5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </>
      )}

      {/* Navigation Dots Indicator */}
      {showDots && items.length > 1 && (
        <div className="absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/40 backdrop-blur-md px-3.5 py-1.5 border border-white/10">
          {items.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={(e) => handleDotClick(idx, e)}
              onMouseDown={(e) => e.stopPropagation()}
              className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                idx === validIndex ? "w-7 bg-white" : "w-2.5 bg-white/40 hover:bg-white/80"
              }`}
              title={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
