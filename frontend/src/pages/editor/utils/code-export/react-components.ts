/**
 * Code exporter: react-components. Moved verbatim from codeExporter.ts, which re-exports the public API.
 */
import type { EditorElement } from "../../types";
import { generateSlidesComponent, generateGalleryComponent, generateTestimonialsComponent, generateMediaCarouselComponent, generateReviewsComponent, generateFlipBoxComponent } from "./widgets/media";
import { generatePriceListComponent, generatePricingTableComponent } from "./widgets/pricing";
import { generateFormComponent, generateNavMenuComponent, generateCountdownComponent } from "./widgets/interactive";
import { generateCTAComponent, generateBlockquoteComponent, generateAnimatedHeadlineComponent, generateBlogPostsComponent, generateCodeHighlightComponent, generateGenericComponent } from "./widgets/content";

// =========================================================================
// MAIN PUBLIC API
// =========================================================================

/**
 * 1. Generate Functional React (.jsx)
 */
export function generateJSXCode(el: EditorElement): string {
  if (!el) return "// No element selected";

  switch (el.type) {
    case "slides":
      return generateSlidesComponent(el, false);
    case "gallery":
    case "basic-gallery":
      return generateGalleryComponent(el, false);
    case "testimonial-carousel":
      return generateTestimonialsComponent(el, false);
    case "media-carousel":
    case "image-carousel":
    case "basic-media-carousel":
      return generateMediaCarouselComponent(el, false);
    case "reviews":
      return generateReviewsComponent(el, false);
    case "price-list":
      return generatePriceListComponent(el, false);
    case "form":
      return generateFormComponent(el, false);
    case "nav-menu":
    case "mega-menu":
      return generateNavMenuComponent(el, false);
    case "call-to-action":
      return generateCTAComponent(el, false);
    case "blockquote":
      return generateBlockquoteComponent(el, false);
    case "animated-headline":
      return generateAnimatedHeadlineComponent(el, false);
    case "posts":
      return generateBlogPostsComponent(el, false);
    case "price-table":
      return generatePricingTableComponent(el, false);
    case "code-highlight":
      return generateCodeHighlightComponent(el, false);
    case "countdown":
      return generateCountdownComponent(el, false);
    case "flip-box":
      return generateFlipBoxComponent(el, false);
    default:
      return generateGenericComponent(el, false);
  }
}

/**
 * 2. Generate Fully Typed React + TSX (.tsx)
 */
export function generateTSXCode(el: EditorElement): string {
  if (!el) return "// No element selected";

  switch (el.type) {
    case "slides":
      return generateSlidesComponent(el, true);
    case "gallery":
    case "basic-gallery":
      return generateGalleryComponent(el, true);
    case "testimonial-carousel":
      return generateTestimonialsComponent(el, true);
    case "media-carousel":
    case "image-carousel":
    case "basic-media-carousel":
      return generateMediaCarouselComponent(el, true);
    case "reviews":
      return generateReviewsComponent(el, true);
    case "price-list":
      return generatePriceListComponent(el, true);
    case "form":
      return generateFormComponent(el, true);
    case "nav-menu":
    case "mega-menu":
      return generateNavMenuComponent(el, true);
    case "call-to-action":
      return generateCTAComponent(el, true);
    case "blockquote":
      return generateBlockquoteComponent(el, true);
    case "animated-headline":
      return generateAnimatedHeadlineComponent(el, true);
    case "posts":
      return generateBlogPostsComponent(el, true);
    case "price-table":
      return generatePricingTableComponent(el, true);
    case "code-highlight":
      return generateCodeHighlightComponent(el, true);
    case "countdown":
      return generateCountdownComponent(el, true);
    case "flip-box":
      return generateFlipBoxComponent(el, true);
    default:
      return generateGenericComponent(el, true);
  }
}
