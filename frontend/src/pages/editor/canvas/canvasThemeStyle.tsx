import React from "react";

/** What renderCanvasThemeStyle reads: the editor values and callbacks the inline JSX used. */
export interface CanvasThemeStyleDeps {
  globalSettings: any;
}

/**
 * Canvas: the <style> element with the global theme CSS variables.
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 3617-3628 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderCanvasThemeStyle({
  globalSettings,
}: CanvasThemeStyleDeps): React.ReactNode {
  return (
            <style>{`
              :root {
                --forge-primary: ${globalSettings?.globalStyles?.primaryColor || "#3b82f6"};
                --forge-secondary: ${globalSettings?.globalStyles?.secondaryColor || "#64748b"};
                --forge-accent: ${globalSettings?.globalStyles?.accentColor || "#10b981"};
                --forge-text: ${globalSettings?.globalStyles?.textColor || "#1e293b"};
                --forge-bg: ${globalSettings?.globalStyles?.backgroundColor || "#ffffff"};
                --forge-font-heading: ${globalSettings?.globalStyles?.headingFont || "inherit"};
                --forge-font-body: ${globalSettings?.globalStyles?.bodyFont || "inherit"};
                --forge-btn-radius: ${globalSettings?.globalStyles?.buttonBorderRadius || "6px"};
              }
            `}</style>
  );
}
