/**
 * NestedCarouselWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState, useEffect } from "react";
import type { EditorElement, ElementStyles } from "../../../types";

export const NestedCarouselWidgetRenderer = ({
  el,
  isPreview: _isPreview,
  mergedStyles,
  renderElementTree,
}: {
  el: EditorElement;
  isPreview: boolean;
  mergedStyles: ElementStyles;
  renderElementTree: (el: EditorElement) => React.ReactNode;
}) => {
  const slides = el.children && el.children.length > 0 ? el.children : [];
  const slidesPerView = el.nestedCarouselSlidesPerView || 1;
  const gap = el.nestedCarouselGap ?? 20;
  const autoplay = el.nestedCarouselAutoplay !== false;
  const autoplaySpeed = el.nestedCarouselAutoplaySpeed || 5000;
  const loop = el.nestedCarouselLoop !== false;
  const showNav = el.nestedCarouselShowNav !== false;
  const showDots = el.nestedCarouselShowDots !== false;
  const borderRadius = el.nestedCarouselBorderRadius || "16px";

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Drag / Swipe State
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isMouseDown, setIsMouseDown] = useState(false);

  const maxIndex = Math.max(0, slides.length - slidesPerView);

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
    const targetEl = e.target as HTMLElement;
    if (targetEl && (targetEl.tagName === "INPUT" || targetEl.tagName === "TEXTAREA" || targetEl.isContentEditable)) {
      return;
    }
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    setTouchStartX(clientX);
    setIsMouseDown(true);
    setDragOffset(0);
  };

  const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (touchStartX === null || !isMouseDown) return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const diff = clientX - touchStartX;
    setDragOffset(diff);
  };

  const handleDragEnd = () => {
    if (touchStartX === null) return;
    if (dragOffset < -50) {
      handleNext();
    } else if (dragOffset > 50) {
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

  return (
    <div
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
      }}
    >
      {/* Empty State */}
      {slides.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-indigo-300 bg-indigo-50/50 rounded-2xl text-center">
          <span className="text-2xl mb-1">🎠</span>
          <h4 className="text-sm font-bold text-indigo-900">Empty Nested Carousel</h4>
          <p className="text-xs text-indigo-600 max-w-xs mt-1">
            Add slide containers to display nested elements inside this carousel.
          </p>
        </div>
      ) : (
        /* Track Container */
        <div className="overflow-hidden w-full py-2 px-1">
          <div
            className={`flex ${isMouseDown ? "transition-none" : "transition-transform duration-500 ease-out"}`}
            style={{
              gap: `${gap}px`,
              transform: `translateX(calc(-${currentIndex * (100 / slidesPerView)}% - ${currentIndex * (gap / slidesPerView)}px + ${dragOffset}px))`,
            }}
          >
            {slides.map((slide) => (
              <div
                key={slide.id}
                className="shrink-0 relative transition-all duration-300"
                style={{
                  width: `calc((100% - ${(slidesPerView - 1) * gap}px) / ${slidesPerView})`,
                  borderRadius,
                }}
              >
                {renderElementTree(slide)}
              </div>
            ))}
          </div>
        </div>
      )}

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
            className={`absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-indigo-900/80 hover:bg-indigo-900 text-white flex items-center justify-center backdrop-blur shadow-lg transition-all z-20 cursor-pointer ${
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
            className={`absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-indigo-900/80 hover:bg-indigo-900 text-white flex items-center justify-center backdrop-blur shadow-lg transition-all z-20 cursor-pointer ${
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
        <div className="flex items-center justify-center gap-1.5 mt-3 z-20 relative">
          {Array.from({ length: maxIndex + 1 }).map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(idx);
              }}
              className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                currentIndex === idx ? "w-6 bg-indigo-600" : "w-2 bg-slate-300 hover:bg-slate-400"
              }`}
              title={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
