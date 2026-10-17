/**
 * SearchBarWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState } from "react";
import type { EditorElement, ElementStyles } from "../../../types";

// ==========================================
// SEARCH BAR WIDGET RENDERER
// ==========================================
export const SearchBarWidgetRenderer = ({
  el,
  isPreview,
  mergedStyles,
}: {
  el: EditorElement;
  isPreview?: boolean;
  mergedStyles?: ElementStyles | any;
}) => {
  const placeholder = el.searchPlaceholder || el.content || "Search site content, pages & items...";
  const buttonText = el.searchButtonText || "Search";
  const icon = el.searchIcon || "🔍";
  const actionType = el.searchAction || "modal";
  const redirectUrl = el.searchRedirectUrl || "/search?q=";
  const showButton = el.searchShowButton !== false;

  const [query, setQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<{ title: string; snippet: string; category: string }[]>([]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    if (actionType === "redirect") {
      if (isPreview) {
        window.location.href = `${redirectUrl}${encodeURIComponent(query.trim())}`;
      } else {
        alert(`Search triggered for: "${query}". Would redirect to: ${redirectUrl}${encodeURIComponent(query.trim())}`);
      }
    } else {
      const mockMatches = [
        { title: `Search result for "${query}"`, snippet: "Match found in main website content block.", category: "Page Content" },
        { title: "Documentation & Resources", snippet: `Articles and help items containing "${query}".`, category: "Guides" },
        { title: "Product Showcase", snippet: `Catalog items relevant to "${query}".`, category: "Products" },
      ];
      setSearchResults(mockMatches);
      setIsModalOpen(true);
    }
  };

  return (
    <div className="w-full relative select-none">
      <form
        onSubmit={handleSearchSubmit}
        className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm transition hover:border-blue-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20"
        style={mergedStyles as React.CSSProperties}
      >
        <span className="pl-2 text-base text-slate-400 shrink-0">{icon}</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent px-2 py-1 text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="text-xs text-slate-400 hover:text-slate-600 px-1 cursor-pointer"
            title="Clear"
          >
            ✕
          </button>
        )}
        {showButton && (
          <button
            type="submit"
            className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 active:scale-95 cursor-pointer"
          >
            {buttonText}
          </button>
        )}
      </form>

      {/* Interactive Live Search Modal */}
      {isModalOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span>🔍 Search Results</span>
              <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-semibold">"{query}"</span>
            </h4>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="text-xs text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {searchResults.map((res, i) => (
              <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/50 p-2.5 hover:bg-blue-50/50 hover:border-blue-200 transition cursor-pointer">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">{res.title}</span>
                  <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">{res.category}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">{res.snippet}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
