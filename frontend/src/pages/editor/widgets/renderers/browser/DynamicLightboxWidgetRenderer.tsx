/**
 * DynamicLightboxWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState, useEffect } from "react";
import type { EditorElement, ElementStyles } from "../../../types";

/* F-219: Dynamic Lightbox Renderer */
export const DynamicLightboxWidgetRenderer = ({
  el,
  isPreview: _isPreview,
  mergedStyles,
}: {
  el: EditorElement;
  isPreview: boolean;
  mergedStyles: ElementStyles;
}) => {
  const items = el.lightboxItems && el.lightboxItems.length > 0 ? el.lightboxItems : [
    { id: "1", url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&auto=format&fit=crop&q=80", caption: "Serene Alpine Mountain Reflections" },
    { id: "2", url: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1200&auto=format&fit=crop&q=80", caption: "Minimalist Modern Glass Architecture" },
    { id: "3", url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80", caption: "Dynamic Vibrant Digital Art Motion" },
  ];
  const [isOpen, setIsOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const triggerText = el.lightboxTriggerText || "🔍 Open Dynamic Lightbox";
  const maxWidth = el.lightboxMaxWidth || "900px";

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") setIsOpen(false);
      if (e.key === "ArrowRight") setActiveIdx((prev) => (prev + 1) % items.length);
      if (e.key === "ArrowLeft") setActiveIdx((prev) => (prev - 1 + items.length) % items.length);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, items.length]);

  return (
    <div
      className="w-full transition-all"
      style={{
        marginTop: mergedStyles.marginTop,
        marginBottom: mergedStyles.marginBottom,
      }}
    >
      <button
        onClick={() => setIsOpen(true)}
        className="w-full py-3 px-6 rounded-xl bg-slate-900 text-white font-bold text-sm shadow-md hover:bg-slate-800 transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
      >
        <span>{triggerText}</span>
        <span className="text-xs bg-slate-800 text-blue-400 px-2 py-0.5 rounded-full font-mono">
          {items.length} items
        </span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fadeIn">
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-5 right-5 h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center font-bold text-lg transition z-50 cursor-pointer"
          >
            ✕
          </button>

          <div className="relative w-full flex flex-col items-center" style={{ maxWidth }}>
            <div className="relative overflow-hidden rounded-2xl bg-black shadow-2xl w-full flex items-center justify-center min-h-[300px] max-h-[70vh]">
              <img
                src={items[activeIdx]?.url}
                alt={items[activeIdx]?.caption || "Lightbox item"}
                className="max-w-full max-h-[70vh] object-contain animate-zoomIn"
              />
              {items[activeIdx]?.caption && (
                <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent text-white text-center text-sm font-medium">
                  {items[activeIdx].caption}
                </div>
              )}
            </div>

            {items.length > 1 && (
              <>
                <button
                  onClick={() => setActiveIdx((prev) => (prev - 1 + items.length) % items.length)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/20 text-white hover:bg-white/40 flex items-center justify-center font-bold text-lg transition z-10 cursor-pointer"
                >
                  ❮
                </button>
                <button
                  onClick={() => setActiveIdx((prev) => (prev + 1) % items.length)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/20 text-white hover:bg-white/40 flex items-center justify-center font-bold text-lg transition z-10 cursor-pointer"
                >
                  ❯
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
