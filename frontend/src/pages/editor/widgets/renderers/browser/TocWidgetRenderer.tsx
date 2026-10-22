/**
 * TocWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState, useEffect } from "react";
import type { EditorElement, ElementStyles } from "../../../types";

export const TocWidgetRenderer = ({
  el,
  elements,
  isPreview,
  mergedStyles,
}: {
  el: EditorElement;
  elements: EditorElement[];
  isPreview: boolean;
  mergedStyles: ElementStyles;
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);

  const title = el.tocTitle !== undefined ? el.tocTitle : "Table of Contents";
  const showTitle = el.tocShowTitle !== false;
  const includedLevels = el.tocIncludedLevels || (["h1", "h2", "h3", "h4", "h5", "h6"] as ("h1" | "h2" | "h3" | "h4" | "h5" | "h6")[]);
  const indentPerLevel = el.tocIndentPerLevel ?? 14;
  const itemGap = el.tocItemGap ?? 6;
  const markerStyle = el.tocMarkerStyle || "bullet";
  const cardBg = el.tocCardBg || "#ffffff";
  const borderColor = el.tocBorderColor || "#e2e8f0";
  const textColor = el.tocTextColor || "#334155";
  const hoverColor = el.tocHoverColor || "#2563eb";
  const titleColor = el.tocTitleColor || "#0f172a";
  const alignment = el.tocAlignment || "left";

  const collectHeadings = (items: EditorElement[] = []): { id: string; text: string; level: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"; levelNum: number }[] => {
    let list: { id: string; text: string; level: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"; levelNum: number }[] = [];
    if (!items || !Array.isArray(items)) return list;
    for (const item of items) {
      if (!item) continue;
      if (item.type === "heading") {
        let level: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" = item.headingLevel || "h2";
        if (!item.headingLevel && item.styles?.fontSize) {
          const size = parseInt(String(item.styles.fontSize), 10);
          if (size >= 36) level = "h1";
          else if (size >= 28) level = "h2";
          else if (size >= 22) level = "h3";
          else if (size >= 18) level = "h4";
          else if (size >= 15) level = "h5";
          else level = "h6";
        }
        const levelNum = parseInt(level.replace("h", ""), 10);
        list.push({
          id: item.id,
          text: item.content || `Heading ${level.toUpperCase()}`,
          level,
          levelNum,
        });
      }
      if (item.children && Array.isArray(item.children) && item.children.length > 0) {
        list = list.concat(collectHeadings(item.children));
      }
    }
    return list;
  };

  const headings = collectHeadings(elements).filter((h) => includedLevels.includes(h.level));

  useEffect(() => {
    if (headings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id.replace("heading-", "");
            setActiveHeadingId(id);
          }
        });
      },
      { rootMargin: "-10% 0px -50% 0px", threshold: 0.1 }
    );

    headings.forEach((h) => {
      const domNode = document.getElementById(`heading-${h.id}`);
      if (domNode) observer.observe(domNode);
    });

    return () => observer.disconnect();
  }, [headings]);

  const handleHeadingClick = (headingId: string) => {
    setActiveHeadingId(headingId);
    const domEl = document.getElementById(`heading-${headingId}`);
    if (domEl) {
      domEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <div
      className="w-full rounded-2xl border p-5 shadow-xs transition-all duration-300 backdrop-blur-xs"
      style={{
        backgroundColor: cardBg,
        borderColor: borderColor,
        fontFamily: mergedStyles.fontFamily,
        marginTop: mergedStyles.marginTop,
        marginBottom: mergedStyles.marginBottom,
        textAlign: alignment,
      }}
    >
      {showTitle && (
        <div
          className="flex items-center justify-between gap-2 border-b pb-3 mb-3 select-none"
          style={{ borderColor: `${borderColor}a0` }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg shadow-xs"
              style={{ backgroundColor: `${hoverColor}15`, color: hoverColor }}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h14" />
              </svg>
            </div>
            <div className="flex flex-col text-left">
              <h3
                className="font-bold text-sm tracking-tight leading-none"
                style={{
                  color: titleColor,
                  fontSize: mergedStyles.fontSize || "15px",
                  fontWeight: mergedStyles.fontWeight || "700",
                }}
              >
                {title}
              </h3>
              {headings.length > 0 && (
                <span className="text-[10px] font-semibold text-slate-400 mt-1">
                  {headings.length} {headings.length === 1 ? "Section" : "Sections"}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
            title={isCollapsed ? "Expand Table of Contents" : "Collapse Table of Contents"}
          >
            <svg
              className={`h-4 w-4 transition-transform duration-200 ${isCollapsed ? "-rotate-90" : "rotate-0"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}

      {!isCollapsed && (
        <>
          {headings.length === 0 ? (
            <div className="py-6 flex flex-col items-center justify-center text-center rounded-xl bg-slate-50/70 border border-dashed border-slate-200 p-4">
              <span className="text-xl mb-1">📖</span>
              <p className="text-xs font-semibold text-slate-600">No Headings Found</p>
              <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs">
                {isPreview
                  ? "Headings will appear here automatically when added."
                  : "Add Heading widgets (H1–H6) on your page to generate automatic outline navigation."}
              </p>
            </div>
          ) : (
            <nav className="flex flex-col relative" style={{ gap: `${itemGap}px` }}>
              {headings.map((heading, index) => {
                const isActive = activeHeadingId === heading.id;
                const indent = (heading.levelNum - 1) * indentPerLevel;
                const isH1 = heading.level === "h1";

                return (
                  <button
                    key={heading.id}
                    type="button"
                    onClick={() => handleHeadingClick(heading.id)}
                    className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs transition-all duration-150 text-left cursor-pointer ${
                      isActive
                        ? "font-bold shadow-2xs"
                        : "font-normal hover:bg-slate-100/70"
                    }`}
                    style={{
                      marginLeft: `${indent}px`,
                      color: isActive ? hoverColor : textColor,
                      backgroundColor: isActive ? `${hoverColor}14` : "transparent",
                      fontSize: mergedStyles.fontSize || (isH1 ? "14px" : "13px"),
                    }}
                  >
                    {/* Active Left Accent Bar */}
                    {isActive && (
                      <span
                        className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full transition-all"
                        style={{ backgroundColor: hoverColor }}
                      />
                    )}

                    {/* Marker Styles */}
                    {markerStyle === "bullet" && (
                      <span
                        className={`h-1.5 w-1.5 rounded-full shrink-0 transition-transform ${
                          isActive ? "scale-125" : "group-hover:scale-110 opacity-60"
                        }`}
                        style={{ backgroundColor: isActive ? hoverColor : textColor }}
                      />
                    )}

                    {markerStyle === "number" && (
                      <span
                        className={`font-mono text-[10px] font-bold shrink-0 px-1 py-0.5 rounded ${
                          isActive ? "bg-blue-600 text-white" : "opacity-60 bg-slate-100"
                        }`}
                      >
                        {index + 1}
                      </span>
                    )}

                    {markerStyle === "line" && (
                      <span
                        className={`h-0.5 shrink-0 transition-all ${
                          isActive ? "w-4" : "w-2.5 opacity-40 group-hover:w-3.5 group-hover:opacity-100"
                        }`}
                        style={{ backgroundColor: hoverColor }}
                      />
                    )}

                    {markerStyle === "badge" && (
                      <span
                        className="font-mono text-[9px] font-bold uppercase tracking-wider shrink-0 px-1.5 py-0.5 rounded border border-slate-200/80 opacity-75"
                        style={{ backgroundColor: `${hoverColor}10`, color: hoverColor }}
                      >
                        {heading.level}
                      </span>
                    )}

                    <span className="truncate flex-1 tracking-tight">{heading.text}</span>
                  </button>
                );
              })}
            </nav>
          )}
        </>
      )}
    </div>
  );
};
