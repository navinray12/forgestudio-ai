/**
 * StripeButtonWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState } from "react";
import { StripeButtonBoxIcon } from "../../icons";
import type { EditorElement, ElementStyles } from "../../../types";

/* F-201: Stripe Button Renderer */
export const StripeButtonWidgetRenderer = ({
  el,
  isPreview,
  mergedStyles,
}: {
  el: EditorElement;
  isPreview: boolean;
  mergedStyles: ElementStyles;
}) => {
  const text = el.stripeText || "Checkout with Stripe";
  const rawCheckoutUrl = (el.stripeCheckoutUrl || "").trim();
  const amount = el.stripeAmount || "$49.00";
  const alignment = el.stripeAlignment || "left";
  const size = el.stripeButtonSize || "md";
  const bgColor = el.stripeBgColor || "#635BFF";
  const textColor = el.stripeTextColor || "#ffffff";
  const hoverBgColor = el.stripeHoverBgColor || "#4b45e4";

  const [isHovered, setIsHovered] = useState(false);

  const alignClass =
    alignment === "center" ? "justify-center text-center" : alignment === "right" ? "justify-end text-right" : "justify-start text-left";

  const sizeStyles =
    size === "sm"
      ? "px-3.5 py-1.5 text-xs gap-1.5"
      : size === "lg"
      ? "px-7 py-3.5 text-base gap-3 font-bold"
      : "px-5 py-2.5 text-sm gap-2 font-semibold";

  const formattedUrl = rawCheckoutUrl
    ? /^https?:\/\//i.test(rawCheckoutUrl)
      ? rawCheckoutUrl
      : `https://${rawCheckoutUrl}`
    : "";

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isPreview && formattedUrl) {
      window.open(formattedUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      className={`w-full flex ${alignClass} transition-all`}
      style={{
        marginTop: mergedStyles.marginTop,
        marginBottom: mergedStyles.marginBottom,
        paddingTop: mergedStyles.paddingTop,
        paddingRight: mergedStyles.paddingRight,
        paddingBottom: mergedStyles.paddingBottom,
        paddingLeft: mergedStyles.paddingLeft,
      }}
    >
      <button
        type="button"
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`inline-flex items-center rounded-xl font-sans shadow-xs transition-all duration-200 cursor-pointer hover:shadow-md active:scale-95 ${sizeStyles}`}
        style={{
          backgroundColor: isHovered ? hoverBgColor : bgColor,
          color: textColor,
          borderRadius: mergedStyles.borderRadius,
        }}
      >
        <StripeButtonBoxIcon />
        <span>{text}</span>
        {amount && <span className="text-[11px] opacity-85">({amount})</span>}
      </button>
    </div>
  );
};
