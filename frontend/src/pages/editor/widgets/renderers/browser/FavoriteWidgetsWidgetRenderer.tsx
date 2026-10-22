/**
 * FavoriteWidgetsWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState, useEffect } from "react";
import type { EditorElement, ElementStyles } from "../../../types";

// ==========================================
// FAVORITE WIDGETS WIDGET RENDERER
// ==========================================
export const FavoriteWidgetsWidgetRenderer = ({
  el: _el,
  isPreview: _isPreview,
  mergedStyles,
}: {
  el: EditorElement;
  isPreview?: boolean;
  mergedStyles?: ElementStyles | any;
}) => {
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("forgestudio_favorite_widgets");
      if (saved) return JSON.parse(saved);
    } catch {}
    return ["heading", "text", "button", "image"];
  });

  const [favComponents, setFavComponents] = useState<Array<{ id: string; name: string }>>(() => {
    try {
      const saved = localStorage.getItem("forgestudio_reusable_components");
      if (saved) {
        const parsed = JSON.parse(saved);
        return Object.entries(parsed)
          .filter(([_id, c]: any) => c.isFavorite)
          .map(([id, c]: any) => ({ id, name: c.name }));
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    const handleStorage = () => {
      try {
        const savedFavs = localStorage.getItem("forgestudio_favorite_widgets");
        if (savedFavs) setFavorites(JSON.parse(savedFavs));
        const savedComps = localStorage.getItem("forgestudio_reusable_components");
        if (savedComps) {
          const parsed = JSON.parse(savedComps);
          setFavComponents(
            Object.entries(parsed)
              .filter(([_id, c]: any) => c.isFavorite)
              .map(([id, c]: any) => ({ id, name: c.name }))
          );
        }
      } catch {}
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const widgetIcons: Record<string, string> = {
    container: "📦",
    heading: "🔤",
    text: "📝",
    image: "🖼️",
    button: "🔘",
    posts: "📰",
    "share-buttons": "🔗",
    portfolio: "💼",
    slides: "🎞️",
    form: "📋",
    login: "🔐",
    "nav-menu": "🧭",
    "animated-headline": "✨",
    "price-table": "🏷️",
    "price-list": "📋",
    gallery: "🖼️",
    "flip-box": "🔄",
    "call-to-action": "🎯",
    "media-carousel": "🎡",
    "testimonial-carousel": "💬",
    "search-bar": "🔍",
    "import-asset": "📁",
    lottie: "🎨",
    "code-highlight": "💻",
    "video-playlist": "📺",
    "mega-menu": "📑",
    "off-canvas": "🚪",
  };

  return (
    <div
      className="w-full rounded-2xl border border-amber-300 bg-amber-50/40 p-5 shadow-sm transition hover:border-amber-400"
      style={mergedStyles as React.CSSProperties}
    >
      <div className="flex items-center justify-between border-b border-amber-200/80 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500 text-white text-base shadow-sm">
            ⭐
          </span>
          <div>
            <h3 className="text-sm font-bold text-amber-950">Favorite Widgets & Quick Access</h3>
            <p className="text-[11px] font-medium text-amber-700/80">Pinned website widgets and custom components</p>
          </div>
        </div>
        <span className="rounded-full bg-amber-200/80 px-2.5 py-1 text-[10px] font-extrabold text-amber-900 uppercase tracking-wider">
          {favorites.length + favComponents.length} Pinned Items
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {favorites.map((type) => (
          <div
            key={`canvas_fav_${type}`}
            className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-white p-3 shadow-xs hover:border-amber-400 hover:shadow-sm transition"
          >
            <span className="text-xl">{widgetIcons[type] || "📦"}</span>
            <div className="overflow-hidden">
              <span className="block text-xs font-bold text-slate-800 capitalize truncate">{type.replace("-", " ")}</span>
              <span className="block text-[9px] font-semibold text-amber-600">Favorite Widget</span>
            </div>
          </div>
        ))}

        {favComponents.map((comp) => (
          <div
            key={`canvas_fav_comp_${comp.id}`}
            className="flex items-center gap-2.5 rounded-xl border border-purple-200 bg-purple-50/80 p-3 shadow-xs hover:border-purple-400 hover:shadow-sm transition"
          >
            <span className="text-xl">🧩</span>
            <div className="overflow-hidden">
              <span className="block text-xs font-bold text-purple-900 truncate">{comp.name}</span>
              <span className="block text-[9px] font-semibold text-purple-600">Reusable Component</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
