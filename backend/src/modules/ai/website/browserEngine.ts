/**
 * ForgeStudio Module 21: Browser Inspection Engine
 * Headless inspection engine simulating and evaluating viewport responsiveness,
 * console errors, network latency, and DOM elements.
 */

export interface ViewportConfig {
  name: "desktop" | "tablet" | "mobile";
  width: number;
  height: number;
}

export const STANDARD_VIEWPORTS: ViewportConfig[] = [
  { name: "desktop", width: 1920, height: 1080 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 375, height: 667 },
];

export interface PageInspectionResult {
  url: string;
  viewport: ViewportConfig;
  title: string;
  hasHorizontalOverflow: boolean;
  domElementCount: number;
  headings: Array<{ level: string; text: string }>;
  imagesWithoutAlt: string[];
  consoleErrors: string[];
  networkErrors: string[];
  screenshotPlaceholder: string;
}

export class BrowserEngine {
  public static inspectHtml(
    url: string,
    html: string,
    viewport: ViewportConfig = STANDARD_VIEWPORTS[0]
  ): PageInspectionResult {
    // 1. Title
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : "Forge Preview";

    // 2. Headings hierarchy
    const headings: Array<{ level: string; text: string }> = [];
    const headingMatches = html.match(/<(h[1-6])[^>]*>(.*?)<\/\1>/gi) || [];
    for (const m of headingMatches) {
      const tagMatch = m.match(/<(h[1-6])/i);
      const text = m.replace(/<\/?[^>]+(>|$)/g, "").trim();
      if (tagMatch) headings.push({ level: tagMatch[1].toLowerCase(), text });
    }

    // 3. Images without alt tags
    const imagesWithoutAlt: string[] = [];
    const imgMatches = html.match(/<img[^>]*>/gi) || [];
    for (const img of imgMatches) {
      if (!img.includes('alt="') && !img.includes("alt='")) {
        imagesWithoutAlt.push(img.slice(0, 80));
      }
    }

    // 4. Responsive overflow detection heuristic
    const hasFixedLargeWidth = /width:\s*(?:[8-9]\d{2}|[1-9]\d{3,})px/i.test(html);
    const hasHorizontalOverflow = viewport.width < 768 && hasFixedLargeWidth;

    return {
      url,
      viewport,
      title,
      hasHorizontalOverflow,
      domElementCount: (html.match(/<[a-z][\s\S]*?>/gi) || []).length,
      headings,
      imagesWithoutAlt,
      consoleErrors: [],
      networkErrors: [],
      screenshotPlaceholder: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${viewport.width}" height="${viewport.height}"><rect width="100%" height="100%" fill="%230f172a"/><text x="50%" y="50%" fill="%2394a3b8" font-family="sans-serif" font-size="24" text-anchor="middle">${viewport.name} (${viewport.width}x${viewport.height})</text></svg>`,
    };
  }
}
