/**
 * PriceListWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import type { EditorElement, ElementStyles } from "../../../types";

export const PriceListWidgetRenderer = ({
  el,
  isPreview: _isPreview,
  mergedStyles,
}: {
  el: EditorElement;
  isPreview: boolean;
  mergedStyles: ElementStyles;
}) => {
  const items = el.priceListItems && el.priceListItems.length > 0
    ? el.priceListItems
    : [
        {
          id: "1",
          name: "Signature Espresso Blend",
          price: "$4.50",
          description: "Freshly roasted double shot arabica blend with velvety microfoam.",
          imageUrl: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=150&auto=format&fit=crop&q=80",
          icon: "☕",
        },
        {
          id: "2",
          name: "Haircut & Precision Styling",
          price: "$35.00",
          description: "Precision scissor cut, wash, scalp massage, and hot towel finish.",
          imageUrl: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=150&auto=format&fit=crop&q=80",
          icon: "✂️",
        },
        {
          id: "3",
          name: "Web Design & UX Sprint",
          price: "$499.00",
          description: "Custom responsive website design with SEO optimization & CMS integration.",
          imageUrl: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=150&auto=format&fit=crop&q=80",
          icon: "💻",
        },
        {
          id: "4",
          name: "Organic Facial Treatment",
          price: "$85.00",
          description: "Deep cleansing facial treatment with organic botanicals & anti-aging serum.",
          imageUrl: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=150&auto=format&fit=crop&q=80",
          icon: "🌿",
        },
      ];

  const gap = el.priceListGap ?? 20;
  const showImages = el.priceListShowImages !== false;
  const imgSize = el.priceListImageSize || 48;
  const separatorStyle = el.priceListSeparatorStyle || "dotted";
  const titleColor = el.priceListTitleColor || "#0f172a";
  const priceColor = el.priceListPriceColor || "#2563eb";
  const priceBg = el.priceListPriceBg || "#eff6ff";
  const align = el.priceListAlignment || "left";

  let textAlignClass = "text-left";
  if (align === "center") textAlignClass = "text-center";
  else if (align === "right") textAlignClass = "text-right";

  return (
    <div
      className={`w-full flex flex-col ${textAlignClass}`}
      style={{
        gap: `${gap}px`,
        fontFamily: mergedStyles.fontFamily,
      }}
    >
      {items.map((item) => {
        const hasImg = Boolean(item.imageUrl);
        const hasIcon = Boolean(item.icon);
        const isRightImg = item.imagePos === "right";

        const mediaNode = showImages && (hasImg || hasIcon) && (
          <div
            className="relative shrink-0 overflow-hidden rounded-xl bg-slate-100 border border-slate-200/80 shadow-xs flex items-center justify-center"
            style={{ width: `${imgSize}px`, height: `${imgSize}px` }}
          >
            {hasImg ? (
              <img
                src={item.imageUrl}
                alt={item.name}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : hasIcon ? (
              <span className="text-xl">{item.icon}</span>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-400 bg-slate-100">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </div>
            )}
          </div>
        );

        return (
          <div key={item.id} className="flex items-start gap-3.5 group">
            {!isRightImg && mediaNode}

            {/* Details & Price Header */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className="font-bold text-sm sm:text-base tracking-tight shrink-0 flex items-center gap-1.5"
                  style={{ color: titleColor }}
                >
                  {hasIcon && !hasImg && <span className="text-sm">{item.icon}</span>}
                  {item.name}
                </span>

                {/* Separator / Leader Line */}
                {separatorStyle !== "none" && (
                  <div
                    className="flex-1 mx-1.5 self-center"
                    style={{
                      borderBottomWidth: "1px",
                      borderBottomStyle: separatorStyle,
                      borderColor: "#cbd5e1",
                    }}
                  />
                )}

                {/* Price Pill */}
                <span
                  className="inline-block shrink-0 font-extrabold text-xs sm:text-sm px-2.5 py-0.5 rounded-full tracking-tight shadow-2xs"
                  style={{
                    color: priceColor,
                    backgroundColor: priceBg,
                  }}
                >
                  {item.price}
                </span>
              </div>

              {/* Description */}
              {item.description && (
                <p className="mt-1 text-xs text-slate-500 leading-relaxed line-clamp-2">
                  {item.description}
                </p>
              )}
            </div>

            {isRightImg && mediaNode}
          </div>
        );
      })}
    </div>
  );
};
