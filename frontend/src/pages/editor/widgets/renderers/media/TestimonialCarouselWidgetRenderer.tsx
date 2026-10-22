/**
 * TestimonialCarouselWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState, useRef, useEffect } from "react";
import type { EditorElement, ElementStyles, TestimonialItem } from "../../../types";

export const TestimonialCarouselWidgetRenderer = ({
  el,
  isPreview: _isPreview,
  mergedStyles,
}: {
  el: EditorElement;
  isPreview: boolean;
  mergedStyles: ElementStyles;
}) => {
  const items: TestimonialItem[] = el.testimonialItems && el.testimonialItems.length > 0
    ? el.testimonialItems
    : [
        {
          id: "1",
          quote: "ForgeStudio transformed how we launch client sites. What used to take weeks now takes hours with incredible quality!",
          name: "Sarah Jenkins",
          role: "VP of Product, TechScale Inc.",
          avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
          rating: 5,
        },
        {
          id: "2",
          quote: "The visual editor and element customization options are second to none. Our conversion rates increased by 42%.",
          name: "Marcus Vance",
          role: "Founder & CEO, GrowthFlow",
          avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
          rating: 5,
        },
        {
          id: "3",
          quote: "Extremely intuitive UI, lightning-fast rendering, and fantastic pre-built components. A absolute game changer!",
          name: "Elena Rostova",
          role: "Head of Design, Studio Craft",
          avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
          rating: 5,
        },
      ];

  const rawSlidesPerView = el.testimonialSlidesPerView || 2;
  const gap = el.testimonialGap ?? 20;
  const autoplay = el.testimonialAutoplay !== false;
  const autoplaySpeed = el.testimonialAutoplaySpeed || 4000;
  const loop = el.testimonialLoop !== false;
  const showNav = el.testimonialShowNav !== false;
  const showDots = el.testimonialShowDots !== false;
  const cardBg = el.testimonialCardBg || "#ffffff";
  const borderRadius = el.testimonialCardBorderRadius || "16px";
  const textColor = el.testimonialTextColor || "#1e293b";
  const starColor = el.testimonialStarColor || "#f59e0b";

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

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

  return (
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
      <div className="overflow-hidden w-full py-3 px-1">
        <div
          className={`flex ${isMouseDown ? "transition-none" : "transition-transform duration-500 ease-out"}`}
          style={{
            gap: `${gap}px`,
            transform: `translateX(calc(-${currentIndex * (100 / effectiveSlidesPerView)}% - ${currentIndex * (gap / effectiveSlidesPerView)}px + ${dragOffset}px))`,
          }}
        >
          {items.map((item) => (
            <div
              key={item.id}
              className="shrink-0 flex flex-col justify-between p-6 shadow-md hover:shadow-xl border border-slate-200/80 transition-all duration-300 relative group/card"
              style={{
                width: `calc((100% - ${(effectiveSlidesPerView - 1) * gap}px) / ${effectiveSlidesPerView})`,
                backgroundColor: cardBg,
                borderRadius,
                color: textColor,
              }}
            >
              {/* Decorative Quote Mark */}
              <div className="absolute top-4 right-5 text-4xl font-serif text-slate-200 pointer-events-none select-none">
                “
              </div>

              {/* Top Rating Stars */}
              <div>
                {item.rating !== undefined && (
                  <div className="flex items-center gap-0.5 mb-3">
                    {Array.from({ length: 5 }).map((_, starIdx) => (
                      <span
                        key={starIdx}
                        className="text-sm"
                        style={{ color: starIdx < (item.rating || 5) ? starColor : "#cbd5e1" }}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                )}

                {/* Quote Text */}
                <p className="text-xs sm:text-sm font-medium leading-relaxed mb-6 italic opacity-90">
                  "{item.quote}"
                </p>
              </div>

              {/* Author Info */}
              <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                {item.avatarUrl ? (
                  <img
                    src={item.avatarUrl}
                    alt={item.name}
                    className="h-10 w-10 rounded-full object-cover border border-slate-200 shrink-0 pointer-events-none"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shrink-0">
                    {item.name.charAt(0)}
                  </div>
                )}

                <div className="min-w-0">
                  <h5 className="text-xs sm:text-sm font-bold tracking-tight truncate">{item.name}</h5>
                  <p className="text-[11px] opacity-75 truncate">{item.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
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
            className={`absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white flex items-center justify-center backdrop-blur shadow-lg transition-all z-20 cursor-pointer ${
              !loop && currentIndex === 0 ? "opacity-30 cursor-not-allowed" : "hover:scale-110"
            }`}
            title="Previous Testimonial"
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
            className={`absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white flex items-center justify-center backdrop-blur shadow-lg transition-all z-20 cursor-pointer ${
              !loop && currentIndex >= maxIndex ? "opacity-30 cursor-not-allowed" : "hover:scale-110"
            }`}
            title="Next Testimonial"
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
                currentIndex === idx ? "w-6 bg-emerald-600" : "w-2 bg-slate-300 hover:bg-slate-400"
              }`}
              title={`Go to testimonial ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
