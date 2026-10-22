import type { EditorElement, PostItem, PricingPlan, PriceListItem, SlideItem, GalleryImageItem, TestimonialItem, ReviewItem, NavMenuItem, PortfolioItem, FormFieldItem, MediaCarouselItem, CanonicalWebsiteData } from "../types";
// --- Implementation modules (extracted verbatim; re-exported for compatibility) ---

export {
  toPascalCase,
  formatStylesToCSS,
  formatStylesToJSX,
} from "./code-export/styles";

export {
  exportElementNodeToJSX,
} from "./code-export/jsx-tree";

export type {
  ExportContext,
} from "./code-export/jsx-tree";

export {
  generateJSXCode,
  generateTSXCode,
} from "./code-export/react-components";

export {
  generateJSCode,
  generateTSCode,
} from "./code-export/vanilla";

export {
  exportCode,
} from "./code-export/export-code";

export {
  exportEntireWebsite,
} from "./code-export/site-export";
