/**
 * BlockquoteWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import type { EditorElement, ElementStyles } from "../../../types";

export const BlockquoteWidgetRenderer = ({
  el,
  mergedStyles,
}: {
  el: EditorElement;
  isPreview: boolean;
  mergedStyles: ElementStyles;
}) => {
  const quoteText = el.content || el.quoteContent || "The only way to do great work is to love what you do.";
  const author = el.quoteAuthor || "Steve Jobs";
  const citation = el.quoteCitation || "Co-founder, Apple Inc.";
  const alignment = el.quoteAlignment || "left";
  const styleVariant = el.quoteStyle || "accent-left";
  const showIcon = el.quoteShowIcon !== false;
  const iconColor = el.quoteIconColor || "#6366f1";
  const textColor = el.quoteTextColor || "#1e293b";
  const textSize = el.quoteTextSize || "1.125rem";
  const textStyle = el.quoteTextStyle || "italic";
  const authorColor = el.quoteAuthorColor || "#475569";
  const authorSize = el.quoteAuthorSize || "0.875rem";
  const cardBg = el.quoteCardBg || (styleVariant === "boxed" || styleVariant === "top-border" ? "#f8fafc" : "transparent");
  const borderColor = el.quoteBorderColor || "#6366f1";

  const textAlignClass =
    alignment === "center" ? "text-center" : alignment === "right" ? "text-right" : "text-left";
  const flexAlignClass =
    alignment === "center" ? "items-center" : alignment === "right" ? "items-end" : "items-start";

  let variantClasses = "";
  const customStyle: React.CSSProperties = {
    marginTop: mergedStyles.marginTop,
    marginBottom: mergedStyles.marginBottom,
    fontFamily: mergedStyles.fontFamily,
    backgroundColor: mergedStyles.backgroundColor !== "transparent" ? mergedStyles.backgroundColor : cardBg,
  };

  if (styleVariant === "accent-left") {
    variantClasses = "border-l-4 pl-5 py-2";
    customStyle.borderLeftColor = borderColor;
  } else if (styleVariant === "boxed") {
    variantClasses = "border rounded-2xl p-6 shadow-xs";
    customStyle.borderColor = mergedStyles.borderColor || borderColor;
    customStyle.borderRadius = mergedStyles.borderRadius || "16px";
  } else if (styleVariant === "top-border") {
    variantClasses = "border-t-4 pt-5 pb-2 px-4 rounded-b-xl shadow-2xs";
    customStyle.borderTopColor = borderColor;
  } else if (styleVariant === "centered-clean") {
    variantClasses = "py-4 px-6 text-center";
  }

  return (
    <figure
      className={`w-full transition-all ${textAlignClass} ${variantClasses}`}
      style={customStyle}
    >
      {showIcon && (
        <div className={`mb-3 flex ${alignment === "center" ? "justify-center" : alignment === "right" ? "justify-end" : "justify-start"}`}>
          <svg className="h-8 w-8 opacity-80" fill="currentColor" viewBox="0 0 24 24" style={{ color: iconColor }}>
            <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
          </svg>
        </div>
      )}

      <blockquote
        className={`leading-relaxed font-medium ${textStyle === "italic" ? "italic" : "not-italic"}`}
        style={{
          color: mergedStyles.color && mergedStyles.color !== "inherit" ? mergedStyles.color : textColor,
          fontSize: mergedStyles.fontSize || textSize,
        }}
      >
        "{quoteText}"
      </blockquote>

      {(author || citation) && (
        <figcaption className={`mt-3 flex flex-col ${flexAlignClass}`}>
          {author && (
            <span className="font-semibold tracking-wide" style={{ color: authorColor, fontSize: authorSize }}>
              — {author}
            </span>
          )}
          {citation && (
            <span className="text-xs text-slate-400 font-normal mt-0.5">
              {citation}
            </span>
          )}
        </figcaption>
      )}
    </figure>
  );
};
