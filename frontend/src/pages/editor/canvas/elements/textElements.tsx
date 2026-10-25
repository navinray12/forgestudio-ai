import React from "react";
import { resolveDynamicTokens } from "../../types";
import type { EditorElement, ElementStyles, PageConfig, WebsiteData } from "../../types";

/** What renderTextElements reads: renderElementTree's per-element values, then the editor values it closed over. */
export interface TextElementsContext {
  el: EditorElement;
  isSelected: boolean;
  mergedStyles: ElementStyles;
  activePageId: string;
  globalSettings: any;
  handleSelectElement: (id: string | null, e?: React.MouseEvent<Element, MouseEvent> | undefined) => void;
  isPreview: boolean;
  pageSettings: { [key: string]: any; title?: string | undefined; description?: string | undefined; path?: string | undefined; backgroundColor?: string | undefined; customHead?: string | undefined; isMaintenanceMode?: boolean | undefined; siteLanguage?: string | undefined; ogTitle?: string | undefined; ogDescription?: string | undefined; ogImage?: string | undefined; canonicalUrl?: string | undefined; noindex?: boolean | undefined; nofollow?: boolean | undefined; };
  pages: PageConfig[];
  updateElementContent: (id: string, newContent: string) => void;
  website: WebsiteData | null;
}

/**
 * Canvas renderers: Heading and text (inline editing, dynamic tokens).
 * Moved verbatim from renderElementTree's leaf wrapper in WebsiteEditor.tsx (the element-renderer
 * slots for heading, text). A plain function, called in one slot of the wrapper during
 * the editor's render: it returns a fragment of the original slot expressions in their original order,
 * of which only the slot for el.type renders.
 */
export function renderTextElements({
  el,
  isSelected,
  mergedStyles,
  activePageId,
  globalSettings,
  handleSelectElement,
  isPreview,
  pageSettings,
  pages,
  updateElementContent,
  website,
}: TextElementsContext) {
  return (
    <>
        {el.type === "heading" && (() => {
          const Tag = (el.headingLevel || "h2") as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
          const displayContent = resolveDynamicTokens(el.content || "", {
            siteName: website?.name || globalSettings?.siteIdentity?.name || "ForgeStudio",
            pageTitle: pages.find((p) => p.id === activePageId)?.name || pageSettings?.title || "Page",
            post: {
              title: "Sample Blog Post Title",
              excerpt: "This is a preview excerpt of your dynamic post content.",
              date: new Date().toLocaleDateString(),
              author: "Editorial Team",
              featuredImage: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800",
            },
            request: { q: "Design Systems", search: "Design Systems", tag: "Tech" },
            query: { q: "Design Systems", search: "Design Systems", tag: "Tech" },
          });

          return (
            <Tag
              id={`heading-${el.id}`}
              contentEditable={!isPreview}
              suppressContentEditableWarning
              onFocus={() => handleSelectElement(el.id)}
              onBlur={(e) => updateElementContent(el.id, e.currentTarget.textContent || "")}
              className="focus:ring-2 focus:ring-blue-400/60 focus:bg-blue-50/20 rounded-sm cursor-text transition-all"
              style={{
                margin: 0,
                padding: 0,
                boxSizing: "border-box",
                outline: "none",
                color: mergedStyles.color || "#0f172a",
                fontSize: mergedStyles.fontSize || (el.headingLevel === "h1" ? "36px" : el.headingLevel === "h3" ? "24px" : el.headingLevel === "h4" ? "20px" : el.headingLevel === "h5" ? "16px" : el.headingLevel === "h6" ? "14px" : "32px"),
                fontWeight: mergedStyles.fontWeight || "700",
                textAlign: mergedStyles.textAlign || "left",
                lineHeight: mergedStyles.lineHeight || "1.2",
                fontFamily: mergedStyles.fontFamily,
                fontStyle: mergedStyles.fontStyle,
                textTransform: mergedStyles.textTransform,
                textDecoration: mergedStyles.textDecoration,
                letterSpacing: mergedStyles.letterSpacing,
                textShadow: mergedStyles.textShadow,
              }}
            >
              {isSelected ? el.content : displayContent}
            </Tag>
          );
        })()}

        {el.type === "text" && (() => {
          const displayContent = resolveDynamicTokens(el.content || "", {
            siteName: website?.name || globalSettings?.siteIdentity?.name || "ForgeStudio",
            pageTitle: pages.find((p) => p.id === activePageId)?.name || pageSettings?.title || "Page",
            post: {
              title: "Sample Blog Post Title",
              excerpt: "This is a preview excerpt of your dynamic post content.",
              date: new Date().toLocaleDateString(),
              author: "Editorial Team",
              featuredImage: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800",
            },
            request: { q: "Design Systems", search: "Design Systems", tag: "Tech" },
            query: { q: "Design Systems", search: "Design Systems", tag: "Tech" },
          });

          return (
            <p
              contentEditable={!isPreview}
              suppressContentEditableWarning
              onFocus={() => handleSelectElement(el.id)}
              onBlur={(e) => updateElementContent(el.id, e.currentTarget.textContent || "")}
              className="focus:ring-2 focus:ring-blue-400/60 focus:bg-blue-50/20 rounded-sm cursor-text transition-all"
              style={{
                margin: 0,
                padding: 0,
                boxSizing: "border-box",
                outline: "none",
                color: mergedStyles.color || "#475569",
                fontSize: mergedStyles.fontSize || "16px",
                fontWeight: mergedStyles.fontWeight || "400",
                textAlign: mergedStyles.textAlign || "left",
                lineHeight: mergedStyles.lineHeight || "1.6",
                fontFamily: mergedStyles.fontFamily,
                fontStyle: mergedStyles.fontStyle,
                textTransform: mergedStyles.textTransform,
                textDecoration: mergedStyles.textDecoration,
                letterSpacing: mergedStyles.letterSpacing,
                textShadow: mergedStyles.textShadow,
              }}
            >
              {isSelected ? el.content : displayContent}
            </p>
          );
        })()}
    </>
  );
}
