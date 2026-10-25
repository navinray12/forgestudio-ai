/**
 * FlipBoxWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState } from "react";
import type { EditorElement, ElementStyles } from "../../../types";

export const FlipBoxWidgetRenderer = ({
  el,
  isPreview,
  mergedStyles,
}: {
  el: EditorElement;
  isPreview: boolean;
  mergedStyles: ElementStyles;
}) => {
  const [isFlippedState, setIsFlippedState] = useState(false);

  const direction = el.flipDirection || "flip-right";
  const duration = el.flipDuration || "0.6s";
  const height = el.flipCardHeight || "320px";
  const borderRadius = el.flipBorderRadius || "20px";

  const frontTitle = el.flipFrontTitle !== undefined ? el.flipFrontTitle : "Interactive Solutions";
  const frontDesc = el.flipFrontDescription !== undefined ? el.flipFrontDescription : "Hover or tap to flip card and explore custom features.";
  const frontBg = el.flipFrontBg || "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)";
  const frontTextColor = el.flipFrontTextColor || "#ffffff";
  const frontIcon = el.flipFrontIcon || "🚀";
  const frontImage = el.flipFrontImage || "";

  const backTitle = el.flipBackTitle !== undefined ? el.flipBackTitle : "Ready to Start?";
  const backDesc = el.flipBackDescription !== undefined ? el.flipBackDescription : "Join thousands of creators building high-converting websites.";
  const backBg = el.flipBackBg || "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)";
  const backTextColor = el.flipBackTextColor || "#ffffff";
  const backBtnText = el.flipBackBtnText !== undefined ? el.flipBackBtnText : "Get Started Now";
  const backBtnUrl = el.flipBackBtnUrl || "#";
  const backBtnBg = el.flipBackBtnBg || "#ffffff";
  const backBtnTextColor = el.flipBackBtnTextColor || "#4f46e5";

  const isFlippedManual = el.flipIsFlippedManual;
  const showBack = isFlippedManual || isFlippedState;

  // Compute rotation styles based on flip direction
  const frontRotate = "rotateY(0deg)";
  let backRotate = "rotateY(180deg)";
  let flippedTransform = "rotateY(180deg)";

  if (direction === "flip-left") {
    backRotate = "rotateY(-180deg)";
    flippedTransform = "rotateY(-180deg)";
  } else if (direction === "flip-up") {
    backRotate = "rotateX(-180deg)";
    flippedTransform = "rotateX(-180deg)";
  } else if (direction === "flip-down") {
    backRotate = "rotateX(180deg)";
    flippedTransform = "rotateX(180deg)";
  }

  return (
    <div
      className="group relative w-full cursor-pointer"
      style={{
        height,
        perspective: "1000px",
        fontFamily: mergedStyles.fontFamily,
      }}
      onMouseEnter={() => !isFlippedManual && setIsFlippedState(true)}
      onMouseLeave={() => !isFlippedManual && setIsFlippedState(false)}
    >
      <div
        className="relative h-full w-full shadow-lg transition-transform duration-500"
        style={{
          transformStyle: "preserve-3d",
          transitionDuration: duration,
          transform: showBack ? flippedTransform : "none",
          borderRadius,
        }}
      >
        {/* FRONT CARD */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center shadow-md overflow-hidden"
          style={{
            background: frontBg,
            color: frontTextColor,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: frontRotate,
            borderRadius,
          }}
        >
          {frontImage ? (
            <img src={frontImage} alt={frontTitle} className="h-16 w-16 mb-4 object-cover rounded-full shadow-sm" />
          ) : (
            frontIcon && <div className="text-4xl mb-4 drop-shadow-sm">{frontIcon}</div>
          )}

          {frontTitle && (
            <h3 className="text-xl font-bold tracking-tight mb-2 leading-tight">
              {frontTitle}
            </h3>
          )}

          {frontDesc && (
            <p className="text-xs opacity-90 leading-relaxed max-w-xs">
              {frontDesc}
            </p>
          )}

          <div className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold opacity-75">
            <span>Hover to reveal</span>
            <span>→</span>
          </div>
        </div>

        {/* BACK CARD */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center shadow-md overflow-hidden"
          style={{
            background: backBg,
            color: backTextColor,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: backRotate,
            borderRadius,
          }}
        >
          {backTitle && (
            <h3 className="text-xl font-bold tracking-tight mb-2 leading-tight">
              {backTitle}
            </h3>
          )}

          {backDesc && (
            <p className="text-xs opacity-90 leading-relaxed max-w-xs mb-5">
              {backDesc}
            </p>
          )}

          {backBtnText && (
            <a
              href={backBtnUrl}
              onClick={(e) => {
                if (!isPreview) e.preventDefault();
              }}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-full text-xs font-bold shadow-md transition hover:scale-105 active:scale-95"
              style={{
                backgroundColor: backBtnBg,
                color: backBtnTextColor,
              }}
            >
              {backBtnText}
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
