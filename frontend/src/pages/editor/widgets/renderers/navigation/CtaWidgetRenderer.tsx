/**
 * CtaWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import type { EditorElement, ElementStyles, PageConfig } from "../../../types";
import { resolveForgeLink } from "../links";

export const CtaWidgetRenderer = ({
  el,
  isPreview,
  mergedStyles,
  pages,
  onNavigatePage,
}: {
  el: EditorElement;
  isPreview: boolean;
  mergedStyles: ElementStyles;
  pages?: PageConfig[];
  onNavigatePage?: (pageIdOrSlug: string) => void;
}) => {
  const heading = el.ctaHeading !== undefined ? el.ctaHeading : "Boost Your Conversions Today";
  const description = el.ctaDescription !== undefined ? el.ctaDescription : "Start your 14-day free trial. No credit card required. Cancel anytime.";
  const buttonText = el.ctaButtonText !== undefined ? el.ctaButtonText : "Claim Your Free Trial →";
  const buttonUrl = el.ctaButtonUrl || "#";
  const buttonBg = el.ctaButtonBg || "linear-gradient(135deg, #e11d48 0%, #be123c 100%)";
  const buttonTextColor = el.ctaButtonTextColor || "#ffffff";
  const buttonBorderRadius = el.ctaButtonBorderRadius || "12px";
  const icon = el.ctaIcon || "⚡";
  const image = el.ctaImage || "";
  const layout = el.ctaLayout || "centered";
  const cardBg = el.ctaCardBg || "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)";
  const cardBorderColor = el.ctaCardBorderColor || "rgba(255, 255, 255, 0.1)";
  const cardBorderRadius = el.ctaCardBorderRadius || "24px";
  const textColor = el.ctaTextColor || "#ffffff";

  const handleBtnClick = (e: React.MouseEvent, url: string) => {
    if (!isPreview) {
      e.preventDefault();
      return;
    }
    const { targetPage } = resolveForgeLink(url, undefined, "url", { pages });
    if (targetPage && onNavigatePage) {
      e.preventDefault();
      onNavigatePage(targetPage.id);
    } else if (url.startsWith("#") && url.length > 1) {
      const targetEl = document.querySelector(url);
      if (targetEl) {
        e.preventDefault();
        targetEl.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  if (layout === "split") {
    return (
      <div
        className="w-full p-6 sm:p-8 md:p-10 shadow-xl transition-all border relative overflow-hidden"
        style={{
          background: cardBg,
          borderColor: cardBorderColor,
          borderRadius: cardBorderRadius,
          color: textColor,
          fontFamily: mergedStyles.fontFamily,
        }}
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div className="space-y-3 max-w-xl">
            <div className="flex items-center gap-3">
              {icon && <span className="text-3xl">{icon}</span>}
              {heading && (
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
                  {heading}
                </h2>
              )}
            </div>

            {description && (
              <p className="text-sm opacity-85 leading-relaxed">
                {description}
              </p>
            )}
          </div>

          {buttonText && (
            <div className="shrink-0">
              <a
                href={buttonUrl}
                onClick={(e) => handleBtnClick(e, buttonUrl)}
                className="inline-flex items-center justify-center px-6 py-3.5 text-sm font-bold shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer text-center"
                style={{
                  background: buttonBg,
                  color: buttonTextColor,
                  borderRadius: buttonBorderRadius,
                }}
              >
                {buttonText}
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (layout === "left-aligned") {
    return (
      <div
        className="w-full p-6 sm:p-8 md:p-10 shadow-xl transition-all border relative overflow-hidden text-left"
        style={{
          background: cardBg,
          borderColor: cardBorderColor,
          borderRadius: cardBorderRadius,
          color: textColor,
          fontFamily: mergedStyles.fontFamily,
        }}
      >
        <div className="space-y-3 max-w-2xl relative z-10">
          {image ? (
            <img src={image} alt="CTA" className="h-14 w-14 object-cover rounded-lg shadow-xs" />
          ) : (
            icon && <div className="text-4xl">{icon}</div>
          )}

          {heading && (
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
              {heading}
            </h2>
          )}

          {description && (
            <p className="text-sm opacity-85 leading-relaxed">
              {description}
            </p>
          )}

          {buttonText && (
            <div className="pt-2">
              <a
                href={buttonUrl}
                onClick={(e) => handleBtnClick(e, buttonUrl)}
                className="inline-flex items-center justify-center px-6 py-3.5 text-sm font-bold shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
                style={{
                  background: buttonBg,
                  color: buttonTextColor,
                  borderRadius: buttonBorderRadius,
                }}
              >
                {buttonText}
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Centered Default Layout
  return (
    <div
      className="w-full p-6 sm:p-8 md:p-10 shadow-xl transition-all border relative overflow-hidden text-center flex flex-col items-center justify-center"
      style={{
        background: cardBg,
        borderColor: cardBorderColor,
        borderRadius: cardBorderRadius,
        color: textColor,
        fontFamily: mergedStyles.fontFamily,
      }}
    >
      <div className="space-y-3 max-w-xl relative z-10 flex flex-col items-center">
        {image ? (
          <img src={image} alt="CTA" className="h-16 w-16 object-cover rounded-full shadow-xs mb-1" />
        ) : (
          icon && <div className="text-4xl mb-1">{icon}</div>
        )}

        {heading && (
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
            {heading}
          </h2>
        )}

        {description && (
          <p className="text-sm opacity-85 leading-relaxed max-w-md">
            {description}
          </p>
        )}

        {buttonText && (
          <div className="pt-3">
            <a
              href={buttonUrl}
              onClick={(e) => handleBtnClick(e, buttonUrl)}
              className="inline-flex items-center justify-center px-7 py-3.5 text-sm font-bold shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
              style={{
                background: buttonBg,
                color: buttonTextColor,
                borderRadius: buttonBorderRadius,
              }}
            >
              {buttonText}
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
