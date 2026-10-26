/**
 * GalleryWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState } from "react";
import type { EditorElement, ElementStyles, GalleryImageItem } from "../../../types";

export const GalleryWidgetRenderer = ({
  el,
  isPreview: _isPreview,
  mergedStyles,
}: {
  el: EditorElement;
  isPreview: boolean;
  mergedStyles: ElementStyles;
}) => {
  const [activeLightboxImg, setActiveLightboxImg] = useState<GalleryImageItem | null>(null);

  const images = el.galleryImages && el.galleryImages.length > 0
    ? el.galleryImages
    : [
        {
          id: "1",
          url: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&auto=format&fit=crop&q=80",
          caption: "Modern Minimalist Architecture",
          altText: "Modern Architecture",
        },
        {
          id: "2",
          url: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=600&auto=format&fit=crop&q=80",
          caption: "Scandinavian Living Space",
          altText: "Interior Living Room",
        },
        {
          id: "3",
          url: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&auto=format&fit=crop&q=80",
          caption: "Bright Collaborative Workspace",
          altText: "Office Workspace",
        },
        {
          id: "4",
          url: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop&q=80",
          caption: "Glass Highrise Skyscraper",
          altText: "City Skyscraper",
        },
        {
          id: "5",
          url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80",
          caption: "Serene Alpine Lake Reflection",
          altText: "Alpine Nature Landscape",
        },
        {
          id: "6",
          url: "https://images.unsplash.com/photo-1545241047-6083a3684587?w=600&auto=format&fit=crop&q=80",
          caption: "Botanical Plant Oasis",
          altText: "Green Botanical Decor",
        },
      ];

  const cols = el.galleryColumns || 3;
  const gap = el.galleryGap ?? 16;
  const aspectRatio = el.galleryAspectRatio || "square";
  const showCaptions = el.galleryShowCaptions !== false;
  const captionPosition = el.galleryCaptionPosition || "overlay";
  const hoverEffect = el.galleryHoverEffect || "zoom";
  const borderRadius = el.galleryBorderRadius || "16px";

  let aspectClass = "aspect-square";
  if (aspectRatio === "landscape") aspectClass = "aspect-video";
  else if (aspectRatio === "portrait") aspectClass = "aspect-[3/4]";
  else if (aspectRatio === "auto") aspectClass = "aspect-auto";

  let gridColsClass = "grid-cols-1 sm:grid-cols-2 md:grid-cols-3";
  if (cols === 1) gridColsClass = "grid-cols-1";
  else if (cols === 2) gridColsClass = "grid-cols-1 sm:grid-cols-2";
  else if (cols === 3) gridColsClass = "grid-cols-1 sm:grid-cols-2 md:grid-cols-3";
  else if (cols === 4) gridColsClass = "grid-cols-1 sm:grid-cols-2 md:grid-cols-4";
  else if (cols === 5) gridColsClass = "grid-cols-2 sm:grid-cols-3 md:grid-cols-5";
  else if (cols === 6) gridColsClass = "grid-cols-2 sm:grid-cols-3 md:grid-cols-6";

  let hoverClass = "";
  if (hoverEffect === "zoom") hoverClass = "hover:scale-105";
  else if (hoverEffect === "fade") hoverClass = "hover:opacity-80";
  else if (hoverEffect === "lift") hoverClass = "hover:-translate-y-1 hover:shadow-xl";

  return (
    <>
      <div
        className={`grid w-full ${gridColsClass}`}
        style={{
          gap: `${gap}px`,
          fontFamily: mergedStyles.fontFamily,
        }}
      >
        {images.map((img) => (
          <div
            key={img.id}
            className="flex flex-col group cursor-pointer"
            onClick={() => setActiveLightboxImg(img)}
          >
            <div
              className={`relative w-full overflow-hidden bg-slate-100 border border-slate-200/60 shadow-xs transition-all duration-300 ${aspectClass} ${hoverClass}`}
              style={{ borderRadius }}
            >
              <img
                src={img.url}
                alt={img.altText || img.caption || "Gallery Image"}
                className="h-full w-full object-cover transition-transform duration-300"
              />

              {/* Lightbox Zoom Icon on Hover */}
              <div className="absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/60 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 backdrop-blur-xs">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                </svg>
              </div>

              {/* Overlay Caption */}
              {showCaptions && captionPosition === "overlay" && img.caption && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/40 to-transparent p-3 text-white transition-opacity duration-300 opacity-90 group-hover:opacity-100">
                  <p className="text-xs font-semibold tracking-wide drop-shadow-sm leading-tight">
                    {img.caption}
                  </p>
                </div>
              )}
            </div>

            {/* Below Caption */}
            {showCaptions && captionPosition === "below" && img.caption && (
              <p className="mt-1.5 text-xs font-medium text-slate-600 leading-snug">
                {img.caption}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      {activeLightboxImg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm animate-fadeIn"
          onClick={() => setActiveLightboxImg(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveLightboxImg(null)}
              className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/70 text-white hover:bg-slate-900 cursor-pointer"
            >
              ✕
            </button>
            <img
              src={activeLightboxImg.url}
              alt={activeLightboxImg.altText || activeLightboxImg.caption || "Gallery Modal Image"}
              className="max-h-[75vh] w-full object-contain bg-slate-900"
            />
            {activeLightboxImg.caption && (
              <div className="bg-slate-900 p-4 text-center text-white">
                <p className="text-sm font-semibold tracking-wide">{activeLightboxImg.caption}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
