/**
 * LoopCarouselWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState, useEffect } from "react";
import type { EditorElement, ElementStyles, LoopCarouselItem } from "../../../types";

export const LoopCarouselWidgetRenderer = ({
  el,
  isPreview,
  mergedStyles,
}: {
  el: EditorElement;
  isPreview: boolean;
  mergedStyles: ElementStyles;
}) => {
  // Dynamic Content Binding: if dynamic CPT entries are attached to element
  const dynamicCptItems: LoopCarouselItem[] = Array.isArray((el as any).cptEntries) && (el as any).cptEntries.length > 0
    ? (el as any).cptEntries.map((entry: any, i: number) => ({
      id: entry.id || `cpt-${i}`,
      title: entry.title || entry.name || "Untitled Entry",
      description: entry.data?.description || entry.data?.excerpt || entry.description || "",
      imageUrl: entry.data?.image || entry.data?.featuredImage || entry.imageUrl || "",
      badge: entry.data?.category || entry.badge || "",
      buttonText: entry.data?.buttonText || "Read More",
      linkUrl: entry.slug ? `/entry/${entry.slug}` : "#",
    }))
    : [];

  const items = el.loopCarouselItems && el.loopCarouselItems.length > 0
    ? el.loopCarouselItems
    : dynamicCptItems;
  const slidesPerView = el.loopCarouselSlidesPerView || 3;
  const gap = el.loopCarouselGap ?? 20;
  const autoplay = el.loopCarouselAutoplay !== false;
  const autoplaySpeed = el.loopCarouselAutoplaySpeed || 3500;
  const loop = el.loopCarouselLoop !== false;
  const showNav = el.loopCarouselShowNav !== false;
  const showDots = el.loopCarouselShowDots !== false;
  const transition = el.loopCarouselTransition || "slide";
  const cardBg = el.loopCarouselCardBg || "#ffffff";
  const borderRadius = el.loopCarouselBorderRadius || "16px";
  const textColor = el.loopCarouselTextColor || "#1e293b";

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Gesture State
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isMouseDown, setIsMouseDown] = useState(false);

  const maxIndex = Math.max(0, items.length - slidesPerView);

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
    if (!autoplay || isHovered || isMouseDown || maxIndex === 0 || transition === "continuous") return;
    const timer = setInterval(() => {
      handleNext();
    }, autoplaySpeed);
    return () => clearInterval(timer);
  }, [autoplay, isHovered, isMouseDown, maxIndex, autoplaySpeed, loop, transition]);

  const continuousItems = transition === "continuous" ? [...items, ...items, ...items] : items;

  return (
    <div
      className="w-full relative group overflow-hidden select-none py-2"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        if (isMouseDown) handleDragEnd();
      }}
      onMouseDown={transition !== "continuous" ? handleDragStart : undefined}
      onMouseMove={transition !== "continuous" ? handleDragMove : undefined}
      onMouseUp={transition !== "continuous" ? handleDragEnd : undefined}
      onTouchStart={transition !== "continuous" ? handleDragStart : undefined}
      onTouchMove={transition !== "continuous" ? handleDragMove : undefined}
      onTouchEnd={transition !== "continuous" ? handleDragEnd : undefined}
      style={{
        fontFamily: mergedStyles.fontFamily,
        marginTop: mergedStyles.marginTop,
        marginBottom: mergedStyles.marginBottom,
      }}
    >
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-purple-300 bg-purple-50/50 rounded-2xl text-center">
          <span className="text-2xl mb-1">🔁</span>
          <h4 className="text-sm font-bold text-purple-900">Empty Loop Carousel</h4>
          <p className="text-xs text-purple-600 max-w-xs mt-1">
            Add items in the Properties Inspector to populate this loop carousel.
          </p>
        </div>
      ) : transition === "fade" ? (
        /* Fade Transition Mode */
        <div className="relative w-full overflow-hidden min-h-[260px] flex items-center justify-center">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out flex flex-col justify-between p-6 shadow-md border border-slate-100 ${
                currentIndex === idx ? "opacity-100 z-10 pointer-events-auto" : "opacity-0 z-0 pointer-events-none"
              }`}
              style={{
                backgroundColor: cardBg,
                borderRadius,
                color: textColor,
              }}
            >
              {item.imageUrl && (
                <div className="relative h-36 w-full overflow-hidden rounded-lg mb-3">
                  <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
                  {item.badge && (
                    <span className="absolute top-2 right-2 rounded-full bg-purple-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow">
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
              {!item.imageUrl && item.badge && (
                <div className="mb-2">
                  <span className="inline-block rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-bold text-purple-700">
                    {item.badge}
                  </span>
                </div>
              )}
              <h3 className="text-lg font-extrabold tracking-tight mb-1">{item.title}</h3>
              {item.description && <p className="text-xs opacity-80 leading-relaxed mb-4">{item.description}</p>}
              {item.buttonText && (
                <a
                  href={item.linkUrl || "#"}
                  onClick={(e) => {
                    if (!isPreview) e.preventDefault();
                  }}
                  className="mt-auto inline-flex items-center justify-center rounded-lg bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-purple-700"
                >
                  {item.buttonText}
                </a>
              )}
            </div>
          ))}
        </div>
      ) : transition === "continuous" ? (
        /* Continuous Marquee Ticker Loop */
        <div className="overflow-hidden w-full py-1">
          <div
            className={`flex transition-transform duration-1000 linear ${isHovered ? "pause" : ""}`}
            style={{
              gap: `${gap}px`,
              animation: autoplay ? `marqueeLoop ${Math.max(10, items.length * 4)}s linear infinite` : "none",
            }}
          >
            {continuousItems.map((item, idx) => (
              <div
                key={`${item.id}-${idx}`}
                className="shrink-0 flex flex-col justify-between p-5 shadow-sm border border-slate-200/80 transition hover:shadow-md hover:-translate-y-1"
                style={{
                  width: `calc((100% - ${(slidesPerView - 1) * gap}px) / ${slidesPerView})`,
                  backgroundColor: cardBg,
                  borderRadius,
                  color: textColor,
                }}
              >
                {item.imageUrl && (
                  <div className="relative h-32 w-full overflow-hidden rounded-lg mb-3">
                    <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
                    {item.badge && (
                      <span className="absolute top-2 right-2 rounded-full bg-purple-600 px-2 py-0.5 text-[9px] font-bold text-white shadow">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
                {!item.imageUrl && item.badge && (
                  <div className="mb-1.5">
                    <span className="inline-block rounded-full bg-purple-100 px-2 py-0.5 text-[9px] font-bold text-purple-700">
                      {item.badge}
                    </span>
                  </div>
                )}
                <h3 className="text-sm font-bold leading-snug mb-1">{item.title}</h3>
                {item.description && <p className="text-xs opacity-75 line-clamp-2 mb-3">{item.description}</p>}
                {item.buttonText && (
                  <a
                    href={item.linkUrl || "#"}
                    onClick={(e) => {
                      if (!isPreview) e.preventDefault();
                    }}
                    className="mt-auto inline-flex items-center justify-center rounded-md bg-purple-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-purple-700 transition"
                  >
                    {item.buttonText}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Default Slide Track Loop */
        <div className="overflow-hidden w-full py-1">
          <div
            className={`flex ${isMouseDown ? "transition-none" : "transition-transform duration-500 ease-out"}`}
            style={{
              gap: `${gap}px`,
              transform: `translateX(calc(-${currentIndex * (100 / slidesPerView)}% - ${currentIndex * (gap / slidesPerView)}px + ${dragOffset}px))`,
            }}
          >
            {items.map((item) => (
              <div
                key={item.id}
                className="shrink-0 flex flex-col justify-between p-5 shadow-sm border border-slate-200/80 transition duration-200 hover:shadow-md hover:-translate-y-1"
                style={{
                  width: `calc((100% - ${(slidesPerView - 1) * gap}px) / ${slidesPerView})`,
                  backgroundColor: cardBg,
                  borderRadius,
                  color: textColor,
                }}
              >
                {item.imageUrl && (
                  <div className="relative h-32 w-full overflow-hidden rounded-lg mb-3">
                    <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
                    {item.badge && (
                      <span className="absolute top-2 right-2 rounded-full bg-purple-600 px-2 py-0.5 text-[9px] font-bold text-white shadow">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
                {!item.imageUrl && item.badge && (
                  <div className="mb-1.5">
                    <span className="inline-block rounded-full bg-purple-100 px-2 py-0.5 text-[9px] font-bold text-purple-700">
                      {item.badge}
                    </span>
                  </div>
                )}
                <h3 className="text-sm font-bold leading-snug mb-1">{item.title}</h3>
                {item.description && <p className="text-xs opacity-75 line-clamp-2 mb-3">{item.description}</p>}
                {item.buttonText && (
                  <a
                    href={item.linkUrl || "#"}
                    onClick={(e) => {
                      if (!isPreview) e.preventDefault();
                    }}
                    className="mt-auto inline-flex items-center justify-center rounded-md bg-purple-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-purple-700 transition"
                  >
                    {item.buttonText}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Arrows */}
      {showNav && maxIndex > 0 && transition !== "continuous" && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            disabled={!loop && currentIndex === 0}
            className={`absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-purple-900/80 hover:bg-purple-900 text-white flex items-center justify-center backdrop-blur shadow-lg transition-all z-20 cursor-pointer ${
              !loop && currentIndex === 0 ? "opacity-30 cursor-not-allowed" : "hover:scale-110"
            }`}
            title="Previous Item"
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
            className={`absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-purple-900/80 hover:bg-purple-900 text-white flex items-center justify-center backdrop-blur shadow-lg transition-all z-20 cursor-pointer ${
              !loop && currentIndex >= maxIndex ? "opacity-30 cursor-not-allowed" : "hover:scale-110"
            }`}
            title="Next Item"
          >
            <span className="text-base font-bold">›</span>
          </button>
        </>
      )}

      {/* Dots Pagination */}
      {showDots && maxIndex > 0 && transition !== "continuous" && (
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
                currentIndex === idx ? "w-6 bg-purple-600" : "w-2 bg-slate-300 hover:bg-slate-400"
              }`}
              title={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
