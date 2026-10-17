/**
 * ImageCarouselWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState, useRef, useEffect } from "react";
import type { EditorElement, ElementStyles, ImageCarouselItem } from "../../../types";

/* F-210: Image Carousel Renderer */
export const ImageCarouselWidgetRenderer = ({
  el,
  isPreview,
  mergedStyles,
}: {
  el: EditorElement;
  isPreview: boolean;
  mergedStyles: ElementStyles;
}) => {
  const items: ImageCarouselItem[] = el.imageCarouselItems?.length
    ? el.imageCarouselItems
    : [
        {
          id: "1",
          url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
          alt: "Abstract Visual Art",
          caption: "Abstract Geometry",
          title: "Modern Visuals",
        },
        {
          id: "2",
          url: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=800&q=80",
          alt: "Digital Workspace",
          caption: "Clean Digital Workspace",
          title: "Workspace",
        },
        {
          id: "3",
          url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80",
          alt: "Responsive Motion",
          caption: "Dynamic Motion",
          title: "Interactive Motion",
        },
      ];

  const rawSlidesPerView = el.imageCarouselSlidesPerView ?? 3;
  const gap = el.imageCarouselGap ?? 16;
  const autoplay = el.imageCarouselAutoplay ?? true;
  const autoplaySpeed = el.imageCarouselAutoplaySpeed ?? 3000;
  const loop = el.imageCarouselLoop ?? true;
  const showNav = el.imageCarouselShowNav ?? true;
  const showDots = el.imageCarouselShowDots ?? true;
  const transition = el.imageCarouselTransition || "slide";
  const imageSizing = el.imageCarouselImageSizing || "cover";
  const height = el.imageCarouselHeight || "320px";
  const alignment = el.imageCarouselAlignment || "center";
  const slideRadius = el.imageCarouselBorderRadius || "16px";
  const aspectRatio = el.imageCarouselAspectRatio || "landscape";

  // State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isMouseDown, setIsMouseDown] = useState(false);

  // Device-aware slides per view adjustments
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

  const maxIndex = Math.max(0, items.length - effectiveSlidesPerView);

  // Keep index in safe range when items or slidesPerView change
  useEffect(() => {
    if (currentIndex > maxIndex) {
      setCurrentIndex(maxIndex);
    }
  }, [maxIndex, currentIndex]);

  // Autoplay Effect
  useEffect(() => {
    if (!autoplay || isHovered || isMouseDown || maxIndex <= 0) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= maxIndex) {
          return loop ? 0 : prev;
        }
        return prev + 1;
      });
    }, Math.max(1000, autoplaySpeed));

    return () => clearInterval(timer);
  }, [autoplay, autoplaySpeed, isHovered, isMouseDown, maxIndex, loop]);

  const handlePrev = () => {
    setCurrentIndex((prev) => {
      if (prev <= 0) {
        return loop ? maxIndex : 0;
      }
      return prev - 1;
    });
  };

  const handleNext = () => {
    setCurrentIndex((prev) => {
      if (prev >= maxIndex) {
        return loop ? 0 : maxIndex;
      }
      return prev + 1;
    });
  };

  // Drag / Swipe handlers
  const handlePointerDown = (clientX: number) => {
    setIsMouseDown(true);
    setDragStartX(clientX);
    setDragOffset(0);
  };

  const handlePointerMove = (clientX: number) => {
    if (!isMouseDown || dragStartX === null) return;
    const diff = clientX - dragStartX;
    setDragOffset(diff);
  };

  const handlePointerUp = () => {
    if (!isMouseDown) return;
    setIsMouseDown(false);
    if (Math.abs(dragOffset) > 40) {
      if (dragOffset < 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
    setDragOffset(0);
    setDragStartX(null);
  };

  const alignClass =
    alignment === "left" ? "justify-start text-left" : alignment === "right" ? "justify-end text-right" : "justify-center text-center";

  const getAspectClass = () => {
    switch (aspectRatio) {
      case "square":
        return "aspect-square";
      case "portrait":
        return "aspect-[3/4]";
      case "video":
        return "aspect-video";
      case "landscape":
        return "aspect-[16/10]";
      default:
        return "";
    }
  };

  return (
    <div
      ref={containerRef}
      className={`w-full flex flex-col ${alignClass} relative group select-none transition-all`}
      style={{
        marginTop: mergedStyles.marginTop,
        marginBottom: mergedStyles.marginBottom,
        paddingTop: mergedStyles.paddingTop,
        paddingRight: mergedStyles.paddingRight,
        paddingBottom: mergedStyles.paddingBottom,
        paddingLeft: mergedStyles.paddingLeft,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        if (isMouseDown) handlePointerUp();
      }}
    >
      <div className="relative w-full overflow-hidden rounded-2xl">
        {transition === "fade" ? (
          /* Fade Transition View */
          <div
            className={`relative w-full overflow-hidden ${getAspectClass()}`}
            style={{ height: aspectRatio === "auto" ? height : undefined }}
            onMouseDown={(e) => handlePointerDown(e.clientX)}
            onMouseMove={(e) => handlePointerMove(e.clientX)}
            onMouseUp={handlePointerUp}
            onTouchStart={(e) => handlePointerDown(e.touches[0].clientX)}
            onTouchMove={(e) => handlePointerMove(e.touches[0].clientX)}
            onTouchEnd={handlePointerUp}
          >
            {items.map((item, idx) => {
              const isActive = idx === currentIndex;
              return (
                <div
                  key={item.id}
                  className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                    isActive ? "opacity-100 z-10 pointer-events-auto" : "opacity-0 z-0 pointer-events-none"
                  }`}
                >
                  <a
                    href={item.linkUrl || "#"}
                    onClick={(e) => {
                      if (!isPreview || !item.linkUrl) e.preventDefault();
                    }}
                    className="block h-full w-full relative overflow-hidden group/slide"
                    style={{ borderRadius: slideRadius }}
                  >
                    <img
                      src={item.url}
                      alt={item.alt || item.title || `Slide ${idx + 1}`}
                      className="h-full w-full transition-transform duration-500 group-hover/slide:scale-105"
                      style={{ objectFit: imageSizing as any }}
                    />
                    {(item.title || item.caption) && (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 text-white text-left">
                        {item.title && <h4 className="text-sm font-bold leading-tight drop-shadow">{item.title}</h4>}
                        {item.caption && <p className="text-xs text-slate-200 opacity-90 line-clamp-1 mt-0.5">{item.caption}</p>}
                      </div>
                    )}
                  </a>
                </div>
              );
            })}
          </div>
        ) : (
          /* Slide Track Transition View */
          <div
            className="overflow-hidden w-full py-1 cursor-grab active:cursor-grabbing"
            onMouseDown={(e) => handlePointerDown(e.clientX)}
            onMouseMove={(e) => handlePointerMove(e.clientX)}
            onMouseUp={handlePointerUp}
            onTouchStart={(e) => handlePointerDown(e.touches[0].clientX)}
            onTouchMove={(e) => handlePointerMove(e.touches[0].clientX)}
            onTouchEnd={handlePointerUp}
          >
            <div
              className={`flex ${isMouseDown ? "transition-none" : "transition-transform duration-500 ease-out"}`}
              style={{
                gap: `${gap}px`,
                transform: `translateX(calc(-${currentIndex * (100 / effectiveSlidesPerView)}% - ${
                  currentIndex * (gap / effectiveSlidesPerView)
                }px + ${dragOffset}px))`,
              }}
            >
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className="shrink-0 flex flex-col overflow-hidden relative shadow-xs transition duration-300 hover:shadow-md group/slide"
                  style={{
                    width: `calc((100% - ${(effectiveSlidesPerView - 1) * gap}px) / ${effectiveSlidesPerView})`,
                    borderRadius: slideRadius,
                  }}
                >
                  <a
                    href={item.linkUrl || "#"}
                    onClick={(e) => {
                      if (!isPreview || !item.linkUrl) e.preventDefault();
                    }}
                    className={`block w-full relative overflow-hidden ${getAspectClass()}`}
                    style={{ height: aspectRatio === "auto" ? height : undefined }}
                  >
                    <img
                      src={item.url}
                      alt={item.alt || item.title || `Slide ${idx + 1}`}
                      className="h-full w-full transition-transform duration-500 group-hover/slide:scale-105"
                      style={{ objectFit: imageSizing as any }}
                    />
                    {(item.title || item.caption) && (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-3 text-white text-left">
                        {item.title && <h4 className="text-xs font-bold leading-tight drop-shadow">{item.title}</h4>}
                        {item.caption && <p className="text-[11px] text-slate-200 opacity-90 line-clamp-1 mt-0.5">{item.caption}</p>}
                      </div>
                    )}
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Previous Button */}
        {showNav && maxIndex > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            disabled={!loop && currentIndex === 0}
            className={`absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white flex items-center justify-center backdrop-blur shadow-md transition-all z-20 cursor-pointer ${
              !loop && currentIndex === 0 ? "opacity-30 cursor-not-allowed" : "hover:scale-110 active:scale-95"
            }`}
            title="Previous Image"
          >
            <span className="text-lg font-bold leading-none">‹</span>
          </button>
        )}

        {/* Next Button */}
        {showNav && maxIndex > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            disabled={!loop && currentIndex >= maxIndex}
            className={`absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white flex items-center justify-center backdrop-blur shadow-md transition-all z-20 cursor-pointer ${
              !loop && currentIndex >= maxIndex ? "opacity-30 cursor-not-allowed" : "hover:scale-110 active:scale-95"
            }`}
            title="Next Image"
          >
            <span className="text-lg font-bold leading-none">›</span>
          </button>
        )}
      </div>

      {/* Pagination Dots */}
      {showDots && maxIndex > 0 && (
        <div className="flex items-center justify-center gap-1.5 mt-3.5 z-20 relative">
          {Array.from({ length: maxIndex + 1 }).map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(idx);
              }}
              className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                currentIndex === idx ? "w-6 bg-blue-600 shadow-xs" : "w-2 bg-slate-300 hover:bg-slate-400"
              }`}
              title={`Jump to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
