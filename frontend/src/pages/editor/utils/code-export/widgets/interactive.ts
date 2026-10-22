/**
 * Code exporter: interactive. Moved verbatim from codeExporter.ts, which re-exports the public API.
 */
import type { EditorElement } from "../../../types";
import { toPascalCase } from "../styles";

/**
 * Generates standalone Countdown Timer component
 */
export function generateCountdownComponent(el: EditorElement, isTsx = false): string {
  const compName = toPascalCase(el.type || "countdown");
  const targetDate = el.countdownTargetDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const tsInterface = isTsx
    ? `export interface ${compName}Props {
  targetDate?: string;
  className?: string;
  style?: React.CSSProperties;
}\n\n`
    : "";

  return `// ${compName}.${isTsx ? "tsx" : "jsx"} - Countdown Timer
import React, { useState, useEffect } from 'react';

${tsInterface}export default function ${compName}(${isTsx ? `props: ${compName}Props` : "props"}) {
  const {
    targetDate = ${JSON.stringify(targetDate)},
    className = "",
    style = {},
    ...rest
  } = props;

  const calculateTimeLeft = () => {
    const diff = +new Date(targetDate) - +new Date();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / 1000 / 60) % 60),
      seconds: Math.floor((diff / 1000) % 60),
    };
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  return (
    <div
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
        flexWrap: "wrap",
        margin: "24px 0",
        fontFamily: "system-ui, -apple-system, sans-serif",
        ...style,
      }}
      {...rest}
    >
      {[
        { label: "Days", value: timeLeft.days },
        { label: "Hours", value: timeLeft.hours },
        { label: "Minutes", value: timeLeft.minutes },
        { label: "Seconds", value: timeLeft.seconds },
      ].map((u) => (
        <div key={u.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "85px", padding: "16px 12px", borderRadius: "16px", backgroundColor: "#0f172a", color: "#fff", boxShadow: "0 8px 16px rgba(0,0,0,0.15)" }}>
          <span style={{ fontSize: "36px", fontWeight: "800", fontVariantNumeric: "tabular-nums" }}>{String(u.value).padStart(2, "0")}</span>
          <span style={{ fontSize: "11px", fontWeight: "bold", opacity: 0.7, letterSpacing: "0.08em", marginTop: "4px" }}>{u.label}</span>
        </div>
      ))}
    </div>
  );
}
`;
}

/**
 * Generates standalone Contact Form component
 */
export function generateFormComponent(el: EditorElement, isTsx = false): string {
  const compName = toPascalCase(el.type || "form");
  const fields = el.formFields && el.formFields.length > 0 ? el.formFields : [
    { id: "f1", type: "text" as const, label: "Full Name", placeholder: "Jane Doe", required: true },
    { id: "f2", type: "email" as const, label: "Email Address", placeholder: "jane@example.com", required: true },
    { id: "f3", type: "textarea" as const, label: "Message", placeholder: "How can we help?", required: false },
  ];
  const title = el.formTitle || "Contact Us";
  const submitText = el.formSubmitText || "Send Message";

  const tsInterface = isTsx
    ? `export interface FormFieldItem {
  id: string;
  type: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}

export interface ${compName}Props {
  title?: string;
  fields?: FormFieldItem[];
  submitText?: string;
  className?: string;
  style?: React.CSSProperties;
}\n\n`
    : "";

  return `// ${compName}.${isTsx ? "tsx" : "jsx"} - Contact Form
import React, { useState } from 'react';

${tsInterface}export default function ${compName}(${isTsx ? `props: ${compName}Props` : "props"}) {
  const {
    title = ${JSON.stringify(title)},
    fields = ${JSON.stringify(fields, null, 2)},
    submitText = ${JSON.stringify(submitText)},
    className = "",
    style = {},
    ...rest
  } = props;

  const [formData, setFormData] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className={className} style={{ width: "100%", maxWidth: "520px", margin: "0 auto", padding: "32px", borderRadius: "16px", border: "1px solid #e2e8f0", backgroundColor: "#ffffff", boxShadow: "0 10px 25px rgba(0,0,0,0.05)", ...style }} {...rest}>
      <h3 style={{ margin: "0 0 20px 0", fontSize: "22px", fontWeight: "800", color: "#0f172a" }}>{title}</h3>
      {submitted ? (
        <div style={{ padding: "16px", borderRadius: "8px", backgroundColor: "#ecfdf5", color: "#065f46", fontSize: "14px", fontWeight: "600" }}>
          ✓ Thank you! Your message has been sent successfully.
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {fields.map((f) => (
            <div key={f.id} style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
                {f.label}{f.required ? " *" : ""}
              </label>
              {f.type === "textarea" ? (
                <textarea
                  rows={4}
                  required={f.required}
                  placeholder={f.placeholder}
                  value={formData[f.id] || ""}
                  onChange={(e) => setFormData({ ...formData, [f.id]: e.target.value })}
                  style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }}
                />
              ) : (
                <input
                  type={f.type || "text"}
                  required={f.required}
                  placeholder={f.placeholder}
                  value={formData[f.id] || ""}
                  onChange={(e) => setFormData({ ...formData, [f.id]: e.target.value })}
                  style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }}
                />
              )}
            </div>
          ))}
          <button type="submit" style={{ width: "100%", padding: "14px", borderRadius: "8px", backgroundColor: "#2563eb", color: "#ffffff", fontWeight: "700", border: "none", cursor: "pointer", fontSize: "15px", marginTop: "8px" }}>
            {submitText}
          </button>
        </form>
      )}
    </div>
  );
}
`;
}

/**
 * Generates standalone Navigation Menu component
 */
export function generateNavMenuComponent(el: EditorElement, isTsx = false): string {
  const compName = toPascalCase(el.type || "nav-menu");
  const items = el.navMenuItems && el.navMenuItems.length > 0 ? el.navMenuItems : [
    { id: "n1", label: "Home", url: "/" },
    { id: "n2", label: "Features", url: "/features" },
    { id: "n3", label: "Pricing", url: "/pricing" },
    { id: "n4", label: "Contact", url: "/contact" },
  ];

  const tsInterface = isTsx
    ? `export interface NavMenuItem {
  id: string;
  label: string;
  url: string;
}

export interface ${compName}Props {
  items?: NavMenuItem[];
  className?: string;
  style?: React.CSSProperties;
}\n\n`
    : "";

  return `// ${compName}.${isTsx ? "tsx" : "jsx"} - Navigation Menu
import React from 'react';

${tsInterface}export default function ${compName}(${isTsx ? `props: ${compName}Props` : "props"}) {
  const {
    items = ${JSON.stringify(items, null, 2)},
    className = "",
    style = {},
    ...rest
  } = props;

  return (
    <nav className={className} style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap", padding: "16px 0", ...style }} {...rest}>
      {items.map((it) => (
        <a key={it.id} href={it.url || "#"} style={{ fontSize: "15px", fontWeight: "600", color: "#334155", textDecoration: "none", padding: "8px 14px", borderRadius: "8px" }}>
          {it.label}
        </a>
      ))}
    </nav>
  );
}
`;
}
