/**
 * AnimatedHeadlineWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState, useEffect } from "react";
import type { EditorElement, ElementStyles } from "../../../types";

export const AnimatedHeadlineWidgetRenderer = ({
  el,
  isPreview: _isPreview,
  mergedStyles,
}: {
  el: EditorElement;
  isPreview: boolean;
  mergedStyles: ElementStyles;
}) => {
  const prefix = el.headlinePrefix ?? "Build Websites That Are";
  const words = el.headlineAnimatedTexts && el.headlineAnimatedTexts.length > 0
    ? el.headlineAnimatedTexts
    : ["Stunning", "Blazing Fast", "Ultra Flexible", "Powerful"];
  const suffix = el.headlineSuffix ?? "With ForgeStudio";
  const animType = el.headlineAnimationType || "typing";
  const speed = el.headlineAnimationSpeed || 2500;
  const highlightColor = el.headlineHighlightColor || "#2563eb";
  const highlightBg = el.headlineHighlightBg || "rgba(239, 246, 255, 1)";
  const Tag = (el.headlineTag || "h2") as "h1" | "h2" | "h3" | "h4" | "p";

  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [animateState, setAnimateState] = useState(true);

  // Typewriter effect logic
  useEffect(() => {
    if (animType !== "typing") return;

    const currentFullWord = words[currentIndex % words.length];
    let timer: ReturnType<typeof setTimeout>;

    if (!isDeleting && displayText === currentFullWord) {
      timer = setTimeout(() => setIsDeleting(true), speed * 0.6);
    } else if (isDeleting && displayText === "") {
      setIsDeleting(false);
      setCurrentIndex((prev) => (prev + 1) % words.length);
    } else {
      const typeSpeed = isDeleting ? 40 : 80;
      timer = setTimeout(() => {
        setDisplayText((prev) =>
          isDeleting
            ? currentFullWord.substring(0, prev.length - 1)
            : currentFullWord.substring(0, prev.length + 1)
        );
      }, typeSpeed);
    }

    return () => clearTimeout(timer);
  }, [displayText, isDeleting, currentIndex, words, animType, speed]);

  // Non-typing word switching timer
  useEffect(() => {
    if (animType === "typing") return;

    const interval = setInterval(() => {
      setAnimateState(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % words.length);
        setAnimateState(true);
      }, 250);
    }, speed);

    return () => clearInterval(interval);
  }, [words, animType, speed]);

  const currentWord = words[currentIndex % words.length];

  // Helper styles for non-typing animations
  let animStyles: React.CSSProperties = {};
  const animClass = "transition-all duration-300 inline-block";

  if (animType === "fade") {
    animStyles = {
      opacity: animateState ? 1 : 0,
      transform: animateState ? "scale(1)" : "scale(0.98)",
    };
  } else if (animType === "slide-up") {
    animStyles = {
      opacity: animateState ? 1 : 0,
      transform: animateState ? "translateY(0px)" : "translateY(12px)",
    };
  } else if (animType === "zoom") {
    animStyles = {
      opacity: animateState ? 1 : 0,
      transform: animateState ? "scale(1)" : "scale(0.75)",
    };
  } else if (animType === "flip") {
    animStyles = {
      opacity: animateState ? 1 : 0,
      transform: animateState ? "rotateX(0deg)" : "rotateX(90deg)",
      transformOrigin: "center center",
    };
  } else if (animType === "highlight") {
    animStyles = {
      backgroundColor: highlightBg,
      color: highlightColor,
      borderRadius: "0.5rem",
      paddingLeft: "0.5rem",
      paddingRight: "0.5rem",
      boxShadow: "0 4px 14px 0 rgba(37, 99, 235, 0.15)",
    };
  }

  return (
    <Tag
      className="w-full break-words tracking-tight leading-tight select-none"
      style={{
        fontFamily: mergedStyles.fontFamily,
        fontSize: mergedStyles.fontSize || "32px",
        fontWeight: mergedStyles.fontWeight || "800",
        color: mergedStyles.color || "#0f172a",
        textAlign: mergedStyles.textAlign || "center",
      }}
    >
      {prefix && <span className="mr-2">{prefix}</span>}

      {animType === "typing" ? (
        <span
          className="inline-block rounded-md px-1.5 py-0.5"
          style={{
            color: highlightColor,
            backgroundColor: highlightBg,
          }}
        >
          {displayText}
          <span className="animate-pulse font-mono ml-0.5">|</span>
        </span>
      ) : (
        <span
          className={animClass}
          style={{
            color: animType !== "highlight" ? highlightColor : undefined,
            ...animStyles,
          }}
        >
          {currentWord}
        </span>
      )}

      {suffix && <span className="ml-2">{suffix}</span>}
    </Tag>
  );
};
