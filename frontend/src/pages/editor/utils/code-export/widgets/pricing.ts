/**
 * Code exporter: pricing. Moved verbatim from codeExporter.ts, which re-exports the public API.
 */
import type { EditorElement } from "../../../types";
import { toPascalCase } from "../styles";

/**
 * Generates standalone Pricing Table component
 */
export function generatePricingTableComponent(el: EditorElement, isTsx = false): string {
  const compName = toPascalCase(el.type || "price-table");
  const plans = el.pricingPlans && el.pricingPlans.length > 0 ? el.pricingPlans : [
    {
      id: "1",
      name: "Starter",
      price: "$19",
      period: "/ month",
      description: "Essential tools for personal projects & freelancers.",
      isPopular: false,
      buttonText: "Get Started",
      buttonUrl: "#",
      features: [
        { id: "f1", text: "5 Projects included", included: true },
        { id: "f2", text: "10GB SSD Storage", included: true },
        { id: "f3", text: "Basic Analytics", included: true },
      ],
    },
    {
      id: "2",
      name: "Professional",
      price: "$49",
      period: "/ month",
      description: "Best for growing teams & expanding SaaS startups.",
      isPopular: true,
      badgeText: "MOST POPULAR",
      buttonText: "Start Free Trial",
      buttonUrl: "#",
      features: [
        { id: "f1", text: "Unlimited Projects", included: true },
        { id: "f2", text: "100GB SSD Storage", included: true },
        { id: "f3", text: "Priority Support", included: true },
      ],
    },
  ];

  const tsInterface = isTsx
    ? `export interface PricingPlan {
  id: string;
  name: string;
  price: string;
  period?: string;
  description?: string;
  isPopular?: boolean;
  badgeText?: string;
  buttonText: string;
  buttonUrl?: string;
  features: { id: string; text: string; included: boolean }[];
}

export interface ${compName}Props {
  plans?: PricingPlan[];
  className?: string;
  style?: React.CSSProperties;
}\n\n`
    : "";

  return `// ${compName}.${isTsx ? "tsx" : "jsx"} - Standalone Pricing Table
import React from 'react';

${tsInterface}export default function ${compName}(${isTsx ? `props: ${compName}Props` : "props"}) {
  const {
    plans = ${JSON.stringify(plans, null, 2)},
    className = "",
    style = {},
    ...rest
  } = props;

  return (
    <div
      className={className}
      style={{
        width: "100%",
        padding: "40px 16px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        ...style,
      }}
      {...rest}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "24px",
          maxWidth: "1000px",
          margin: "0 auto",
        }}
      >
        {plans.map((plan) => (
          <div
            key={plan.id}
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              borderRadius: "20px",
              backgroundColor: "#ffffff",
              border: plan.isPopular ? "2px solid #2563eb" : "1px solid #e2e8f0",
              padding: "32px 24px",
              boxShadow: plan.isPopular ? "0 20px 25px -5px rgba(37,99,235,0.15)" : "0 4px 6px -1px rgba(0,0,0,0.05)",
            }}
          >
            {plan.isPopular && (
              <div style={{ position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)", backgroundColor: "#2563eb", color: "#fff", fontSize: "11px", fontWeight: "bold", padding: "4px 14px", borderRadius: "9999px" }}>
                {plan.badgeText || "POPULAR"}
              </div>
            )}
            <h3 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: "bold", color: "#0f172a" }}>{plan.name}</h3>
            {plan.description && <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#64748b" }}>{plan.description}</p>}
            <div style={{ display: "flex", alignItems: "baseline", margin: "12px 0 20px" }}>
              <span style={{ fontSize: "36px", fontWeight: "800", color: "#0f172a" }}>{plan.price}</span>
              {plan.period && <span style={{ marginLeft: "6px", fontSize: "14px", color: "#64748b" }}>{plan.period}</span>}
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px", flexGrow: 1 }}>
              {plan.features.map((f) => (
                <li key={f.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", fontSize: "14px", color: f.included ? "#334155" : "#94a3b8" }}>
                  <span>{f.included ? "✓" : "✕"}</span>
                  <span>{f.text}</span>
                </li>
              ))}
            </ul>
            <a href={plan.buttonUrl || "#"} style={{ display: "block", textAlign: "center", padding: "12px", borderRadius: "10px", backgroundColor: plan.isPopular ? "#2563eb" : "#0f172a", color: "#fff", fontSize: "14px", fontWeight: "600", textDecoration: "none" }}>
              {plan.buttonText}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
`;
}

/**
 * Generates standalone Price List component
 */
export function generatePriceListComponent(el: EditorElement, isTsx = false): string {
  const compName = toPascalCase(el.type || "price-list");
  const items = el.priceListItems && el.priceListItems.length > 0 ? el.priceListItems : [
    { id: "pl1", name: "Espresso Roast", description: "Rich double shot with velvety crema", price: "$4.50" },
    { id: "pl2", name: "Artisanal Pastry", description: "Freshly baked flaky almond croissant", price: "$5.00" },
  ];

  const tsInterface = isTsx
    ? `export interface PriceListItem {
  id: string;
  name: string;
  description?: string;
  price: string;
}

export interface ${compName}Props {
  items?: PriceListItem[];
  className?: string;
  style?: React.CSSProperties;
}\n\n`
    : "";

  return `// ${compName}.${isTsx ? "tsx" : "jsx"} - Price List
import React from 'react';

${tsInterface}export default function ${compName}(${isTsx ? `props: ${compName}Props` : "props"}) {
  const {
    items = ${JSON.stringify(items, null, 2)},
    className = "",
    style = {},
    ...rest
  } = props;

  return (
    <div className={className} style={{ width: "100%", maxWidth: "600px", margin: "0 auto", padding: "24px 0", ...style }} {...rest}>
      {items.map((item) => (
        <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px dashed #cbd5e1", paddingBottom: "12px", marginBottom: "16px" }}>
          <div>
            <h4 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>{item.name}</h4>
            {item.description && <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>{item.description}</p>}
          </div>
          <span style={{ fontWeight: "700", color: "#2563eb", fontSize: "16px" }}>{item.price}</span>
        </div>
      ))}
    </div>
  );
}
`;
}
