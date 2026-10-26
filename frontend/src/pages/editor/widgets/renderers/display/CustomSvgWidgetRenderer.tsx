/**
 * CustomSvgWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { sanitizeSvg } from "../../../../../utils/svgSanitizer";
import type { EditorElement, ElementStyles } from "../../../types";

/* F-221: SVG / Custom Icon Renderer */
export const CustomSvgWidgetRenderer = ({
  el,
  isPreview: _isPreview,
  mergedStyles,
}: {
  el: EditorElement;
  isPreview: boolean;
  mergedStyles: ElementStyles;
}) => {
  const width = el.svgWidth || "64px";
  const height = el.svgHeight || "64px";
  const color = el.svgColor || "#0284c7";
  const alignment = el.svgAlignment || "center";
  const rawSvg = el.svgRawContent || `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`;

  const alignClass = alignment === "left" ? "justify-start" : alignment === "right" ? "justify-end" : "justify-center";

  return (
    <div
      className={`w-full flex ${alignClass} transition-all`}
      style={{
        marginTop: mergedStyles.marginTop,
        marginBottom: mergedStyles.marginBottom,
      }}
    >
      <div
        className="inline-flex items-center justify-center transition-transform hover:scale-105"
        style={{ width, height, color }}
        dangerouslySetInnerHTML={{ __html: sanitizeSvg(rawSvg) }}
      />
    </div>
  );
};
