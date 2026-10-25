import React from "react";
import { resolveButtonHref } from "../../widgets";
import { IconRenderer } from "../../widgets/icons";
import type { EditorElement, ElementStyles, PageConfig } from "../../types";

/** What renderButtonElement reads: renderElementTree's per-element values, then the editor values it closed over. */
export interface ButtonElementContext {
  customAttrProps: any;
  el: EditorElement;
  mergedStyles: ElementStyles;
  handlePreviewPageNavigate: (targetPage: PageConfig) => void;
  handleSelectElement: (id: string | null, e?: React.MouseEvent<Element, MouseEvent> | undefined) => void;
  isPreview: boolean;
  pages: PageConfig[];
  setActivePopupId: React.Dispatch<React.SetStateAction<string | null>>;
  updateElementContent: (id: string, newContent: string) => void;
}

/**
 * Canvas renderers: Button (links, page navigation, popups).
 * Moved verbatim from renderElementTree's leaf wrapper in WebsiteEditor.tsx (the element-renderer
 * slots for button). A plain function, called in one slot of the wrapper during
 * the editor's render: it returns a fragment of the original slot expressions in their original order,
 * of which only the slot for el.type renders.
 */
export function renderButtonElement({
  customAttrProps,
  el,
  mergedStyles,
  handlePreviewPageNavigate,
  handleSelectElement,
  isPreview,
  pages,
  setActivePopupId,
  updateElementContent,
}: ButtonElementContext) {
  return (
    <>
        {el.type === "button" && (() => {
          const resolvedHref = resolveButtonHref(el, pages);
          const target = el.target || "_self";
          const rel = target === "_blank" ? (el.rel || "noopener noreferrer") : el.rel;
          const isDownload = el.download;

          const iconName = el.iconName || el.icon || "";
          const iconPos = el.iconPosition || "left";
          const gap = el.iconGap ?? el.iconSpacing ?? 8;
          const iconSize = el.iconSize || 18;
          const iconColor = el.iconColor || el.buttonColor || "#ffffff";
          const textLabel = el.content || el.buttonText || "Button";

          const isFlexCol = iconPos === "top" || iconPos === "bottom";
          const isReverse = iconPos === "right" || iconPos === "bottom";

          const renderIcon = iconName ? (
            <IconRenderer
              iconName={iconName}
              size={iconSize}
              color={iconColor}
              rotate={el.iconRotate || 0}
              flipH={Boolean(el.iconFlipH)}
              flipV={Boolean(el.iconFlipV)}
              strokeWidth={el.iconStrokeWidth || 2}
            />
          ) : null;

          return (
            <div style={{ textAlign: mergedStyles.textAlign || "left", width: "100%", boxSizing: "border-box" }}>
              <a
                href={resolvedHref}
                target={target}
                rel={rel}
                download={isDownload ? true : undefined}
                contentEditable={!isPreview}
                suppressContentEditableWarning
                onFocus={() => handleSelectElement(el.id)}
                onBlur={(e) => updateElementContent(el.id, e.currentTarget.textContent || "")}
                onClick={(e) => {
                  if (!isPreview) {
                    e.preventDefault();
                    return;
                  }

                  // Preview Mode navigation handler
                  let targetPage: PageConfig | undefined;

                  if (el.pageId) {
                    targetPage = pages.find((p) => p.id === el.pageId);
                  }
                  if (!targetPage && resolvedHref) {
                    const clean = resolvedHref.replace(/^\//, "");
                    targetPage = pages.find(
                      (p) => p.slug === resolvedHref || p.slug === clean || p.id === clean || (resolvedHref === "/" && (p.isHome || p.id === "home"))
                    );
                  }

                  if (targetPage && target !== "_blank") {
                    e.preventDefault();
                    handlePreviewPageNavigate(targetPage);
                  } else if (resolvedHref.startsWith("popup:open(")) {
                    e.preventDefault();
                    const popupId = resolvedHref.match(/popup:open\(([^)]+)\)/)?.[1];
                    if (popupId) setActivePopupId(popupId);
                  } else if (resolvedHref === "popup:close") {
                    e.preventDefault();
                    setActivePopupId(null);
                  } else if (resolvedHref === "scroll:to(top)") {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  } else if (resolvedHref.startsWith("scroll:to(")) {
                    e.preventDefault();
                    const targetId = resolvedHref.match(/scroll:to\(([^)]+)\)/)?.[1];
                    if (targetId) {
                      const targetEl = document.getElementById(targetId);
                      targetEl?.scrollIntoView({ behavior: "smooth" });
                    }
                  }
                }}
                className="inline-block rounded-lg px-5 py-2 text-sm font-semibold shadow transition-all duration-200"
                style={{
                  backgroundColor: mergedStyles.backgroundColor || el.styles?.backgroundColor || el.buttonBg || "#2563eb",
                  color: mergedStyles.color || el.styles?.color || el.buttonColor || "#ffffff",
                  fontSize: mergedStyles.fontSize,
                  fontFamily: mergedStyles.fontFamily,
                  fontWeight: mergedStyles.fontWeight,
                  borderRadius: mergedStyles.borderRadius || "8px",
                  boxShadow: mergedStyles.boxShadow,
                }}
                {...customAttrProps}
              >
                <span
                  className={`inline-flex items-center justify-center ${isFlexCol ? "flex-col" : "flex-row"
                    } ${isReverse ? "flex-col-reverse" : ""}`}
                  style={{ gap: `${gap}px` }}
                >
                  {!isReverse && renderIcon}
                  <span>{textLabel}</span>
                  {isReverse && renderIcon}
                </span>
              </a>
            </div>
          );
        })()}
    </>
  );
}
