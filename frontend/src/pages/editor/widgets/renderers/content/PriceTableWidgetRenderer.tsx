/**
 * PriceTableWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import type { EditorElement, ElementStyles, PricePlanFeature } from "../../../types";

export const PriceTableWidgetRenderer = ({
  el,
  isPreview,
  mergedStyles,
}: {
  el: EditorElement;
  isPreview: boolean;
  mergedStyles: ElementStyles;
}) => {
  const plans = el.pricingPlans && el.pricingPlans.length > 0
    ? el.pricingPlans
    : [
        {
          id: "1",
          name: "Starter",
          price: "19",
          currency: "$",
          period: "/ month",
          description: "Essential tools for personal projects & freelancers.",
          isPopular: false,
          isRecommended: false,
          showBadge: false,
          buttonText: "Start Free Trial",
          buttonUrl: "#",
          buttonAlignment: "full",
          features: [
            { id: "f1", text: "5 Projects included", included: true },
            { id: "f2", text: "10GB SSD Storage", included: true },
            { id: "f3", text: "Basic Analytics", included: true },
            { id: "f4", text: "Custom Domain", included: false },
            { id: "f5", text: "24/7 Dedicated Support", included: false },
          ],
        },
        {
          id: "2",
          name: "Professional",
          price: "49",
          currency: "$",
          period: "/ month",
          description: "Best for growing teams & expanding SaaS startups.",
          isPopular: true,
          isRecommended: true,
          badgeText: "MOST POPULAR",
          showBadge: true,
          buttonText: "Get Pro Now",
          buttonUrl: "#",
          buttonAlignment: "full",
          features: [
            { id: "f1", text: "Unlimited Projects", included: true },
            { id: "f2", text: "100GB SSD Storage", included: true },
            { id: "f3", text: "Advanced Analytics & Reports", included: true },
            { id: "f4", text: "Custom Domain & SSL", included: true },
            { id: "f5", text: "Priority Support", included: true },
          ],
        },
        {
          id: "3",
          name: "Enterprise",
          price: "99",
          currency: "$",
          period: "/ month",
          description: "Advanced security, custom SLA, and dedicated scale.",
          isPopular: false,
          isRecommended: false,
          showBadge: false,
          buttonText: "Contact Sales",
          buttonUrl: "#",
          buttonAlignment: "full",
          features: [
            { id: "f1", text: "Unlimited Everything", included: true },
            { id: "f2", text: "1TB High Speed Storage", included: true },
            { id: "f3", text: "Custom Analytics & Export", included: true },
            { id: "f4", text: "Multi-Region Cloud Hosting", included: true },
            { id: "f5", text: "24/7 Dedicated Account Manager", included: true },
          ],
        },
      ];

  const cols = el.pricingColumns || 3;
  const gap = el.pricingGap ?? 24;
  const cardBg = el.pricingCardBg || "#ffffff";
  const cardBorder = el.pricingCardBorder || "#e2e8f0";
  const cardRadius = el.pricingCardRadius || "24px";
  const highlightColor = el.pricingHighlightColor || "#2563eb";
  const btnBg = el.pricingBtnBg || "#2563eb";
  const btnColor = el.pricingBtnColor || "#ffffff";
  const btnHoverBg = el.pricingBtnHoverBg || "#1d4ed8";
  const contentAlign = el.pricingAlignment || "center";

  let gridColsClass = "grid-cols-1 md:grid-cols-3";
  if (cols === 1) gridColsClass = "grid-cols-1";
  else if (cols === 2) gridColsClass = "grid-cols-1 md:grid-cols-2";
  else if (cols === 3) gridColsClass = "grid-cols-1 md:grid-cols-3";
  else if (cols === 4) gridColsClass = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";

  const alignClassMap = {
    left: "text-left items-start",
    center: "text-center items-center",
    right: "text-right items-end",
  };

  const currentAlignClass = alignClassMap[contentAlign] || alignClassMap.center;

  return (
    <div
      className={`grid w-full ${gridColsClass}`}
      style={{
        gap: `${gap}px`,
        fontFamily: mergedStyles.fontFamily,
      }}
    >
      {plans.map((plan) => {
        const isHighlight = Boolean(plan.isPopular || plan.isRecommended);
        const effectiveCardBg = plan.cardBg || cardBg;
        const effectiveCardBorder = plan.cardBorder || (isHighlight ? highlightColor : cardBorder);

        const currencySymbol = plan.currency ?? "$";
        const priceStr = String(plan.price || "0");
        const hasSymbolInPrice = /^[$€£₹]/.test(priceStr.trim());
        const displayPrice = hasSymbolInPrice ? priceStr : `${currencySymbol}${priceStr}`;

        const featuresList = Array.isArray(plan.features) ? plan.features : [];

        return (
          <div
            key={plan.id}
            className={`relative flex flex-col justify-between p-6 transition-all duration-300 ${
              isHighlight
                ? "shadow-2xl ring-2 scale-[1.02] z-10"
                : "shadow-md hover:shadow-lg border"
            }`}
            style={{
              backgroundColor: effectiveCardBg,
              borderColor: effectiveCardBorder,
              borderRadius: cardRadius,
            }}
          >
            {/* Optional Popular/Custom Badge */}
            {plan.showBadge !== false && (isHighlight || plan.badgeText) && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-20">
                <span
                  className="inline-block rounded-full px-3.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-md"
                  style={{ backgroundColor: highlightColor }}
                >
                  {plan.badgeText || "MOST POPULAR"}
                </span>
              </div>
            )}

            <div className={`flex flex-col ${currentAlignClass}`}>
              {/* Header */}
              <div className="mb-4 w-full">
                <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                {plan.description && (
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    {plan.description}
                  </p>
                )}
              </div>

              {/* Price Display */}
              <div className={`mb-6 flex items-baseline gap-1 border-b border-slate-100 pb-6 w-full ${contentAlign === "center" ? "justify-center" : contentAlign === "right" ? "justify-end" : "justify-start"}`}>
                <span className="text-4xl font-extrabold text-slate-900 tracking-tight">
                  {displayPrice}
                </span>
                {plan.period && (
                  <span className="text-xs font-medium text-slate-500">{plan.period}</span>
                )}
              </div>

              {/* Feature List */}
              <ul className="mb-8 space-y-3 w-full text-left">
                {featuresList.map((feat: PricePlanFeature) => (
                  <li key={feat.id} className="flex items-center gap-2.5 text-xs">
                    {feat.included ? (
                      <div
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                        style={{
                          backgroundColor: isHighlight ? `${highlightColor}18` : "#ecfdf5",
                          color: isHighlight ? highlightColor : "#059669",
                        }}
                      >
                        ✓
                      </div>
                    ) : (
                      <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-400">
                        ✕
                      </div>
                    )}
                    <span
                      className={
                        feat.included
                          ? "font-medium text-slate-700"
                          : "text-slate-400 line-through"
                      }
                    >
                      {feat.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Call To Action Button */}
            <div className={`w-full flex ${plan.buttonAlignment === "center" ? "justify-center" : plan.buttonAlignment === "right" ? "justify-end" : plan.buttonAlignment === "left" ? "justify-start" : "justify-stretch"}`}>
              <a
                href={plan.buttonUrl || "#"}
                onClick={(e) => {
                  if (!isPreview) e.preventDefault();
                }}
                className={`rounded-xl py-3 px-5 text-center text-xs font-bold transition-all duration-200 cursor-pointer block select-none shadow-sm hover:shadow active:scale-[0.98] ${
                  plan.buttonAlignment === "left" || plan.buttonAlignment === "center" || plan.buttonAlignment === "right"
                    ? "w-auto min-w-[140px]"
                    : "w-full"
                }`}
                style={{
                  backgroundColor: isHighlight ? highlightColor : btnBg,
                  color: btnColor,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = btnHoverBg;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isHighlight ? highlightColor : btnBg;
                }}
              >
                {plan.buttonText || "Get Started"}
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
};
