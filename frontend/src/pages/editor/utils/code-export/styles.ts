/**
 * Code exporter: styles. Moved verbatim from codeExporter.ts, which re-exports the public API.
 */
import type { EditorElement } from "../../types";

export function getMergedStyles(el: EditorElement, _device?: string, _state?: string): Record<string, any> {
  return el.styles || {};
}

export function getMergedLayout(el: EditorElement, _device?: string): Record<string, any> {
  return el.layout || {};
}

/**
 * Convert string to PascalCase for component and function names
 */
export function toPascalCase(str?: string): string {
  if (!str) return "Component";
  // Special friendly names for common editor types
  const friendlyMap: Record<string, string> = {
    posts: "BlogPosts",
    portfolio: "PortfolioGrid",
    "animated-headline": "AnimatedHeadline",
    "price-table": "PricingTable",
    "price-list": "PriceList",
    "call-to-action": "CallToAction",
    "flip-box": "FlipBox",
    "nav-menu": "NavMenu",
    "mega-menu": "MegaMenu",
    "code-highlight": "CodeHighlight",
    "countdown": "CountdownTimer",
    "testimonial-carousel": "TestimonialsSlider",
    "basic-gallery": "ImageGallery",
    gallery: "PhotoGallery",
    "media-carousel": "MediaCarousel",
    slides: "HeroSlides",
    "share-buttons": "ShareButtons",
    "social-icons": "SocialIcons",
    "progress-bar": "ProgressBar",
    rating: "RatingStars",
    alert: "AlertBanner",
    counter: "AnimatedCounter",
    blockquote: "QuoteBlock",
    "video-playlist": "VideoPlaylist",
    "audio-playlist": "AudioPlaylist",
    "table-of-contents": "TableOfContents",
    "paypal-button": "PayPalCheckout",
    "stripe-button": "StripeCheckout",
    container: "SectionContainer",
    button: "ActionButton",
    heading: "SectionHeading",
    text: "TextBlock",
    paragraph: "ParagraphBlock",
    image: "ResponsiveImage",
    video: "VideoPlayer",
    divider: "ContentDivider",
    spacer: "LayoutSpacer",
  };

  if (friendlyMap[str.toLowerCase()]) {
    return friendlyMap[str.toLowerCase()];
  }

  let result = str
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");

  if (/^[0-9]/.test(result)) {
    result = "Comp" + result;
  }
  return result || "Component";
}

/**
 * Format CSS styles object into standard inline CSS string
 */
export function formatStylesToCSS(styles: Record<string, any> = {}): string {
  if (!styles || Object.keys(styles).length === 0) return "";
  return Object.entries(styles)
    .filter(([_, val]) => val !== undefined && val !== null && val !== "")
    .map(([key, val]) => {
      const kebabKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
      return `${kebabKey}: ${val};`;
    })
    .join(" ");
}

/**
 * Format CSS styles object into JSX style object
 */
export function formatStylesToJSX(styles: Record<string, any> = {}): string {
  if (!styles || Object.keys(styles).length === 0) return "{}";
  const cleanStyles: Record<string, any> = {};
  for (const [k, v] of Object.entries(styles)) {
    if (v !== undefined && v !== null && v !== "") {
      cleanStyles[k] = v;
    }
  }
  return JSON.stringify(cleanStyles, null, 2);
}
