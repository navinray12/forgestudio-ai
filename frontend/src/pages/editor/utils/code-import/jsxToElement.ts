import type { EditorElement, FormFieldItem, GalleryImageItem, NavMenuItem, PortfolioItem, PostItem, PriceListItem, PricingPlan, ReviewItem, SlideItem, TestimonialItem } from "../../types";
import { extractJsxAttributes, extractStylesAndLayout, extractTextContentFromChildren } from "./jsxAst";
import { generateId } from "./ids";
import ts from "typescript";

// Recursive JSX node -> EditorElement conversion (data-driven components, standard tags, containers,
// unknown-tag fallback).
// Moved verbatim from codeImporter.ts (now a compatibility entry point that re-exports the public API).

/**
 * Recursively convert a JSX AST node into an EditorElement
 */
export function convertJsxNodeToElement(
  node: ts.JsxElement | ts.JsxSelfClosingElement,
  scope: Map<string, any>,
  existingElement?: EditorElement,
  warnings: string[] = []
): EditorElement {
  const isElement = ts.isJsxElement(node);
  const tagName = isElement
    ? node.openingElement.tagName.getText()
    : node.tagName.getText();

  const attributes = extractJsxAttributes(
    isElement ? node.openingElement.attributes : node.attributes,
    scope
  );

  const { styles, layout } = extractStylesAndLayout(attributes.style);

  // Preserve existing element ID if root matches, otherwise generate a fresh ID
  const elementId = existingElement ? existingElement.id : generateId();

  // Extract classes
  const rawClasses = attributes.className || attributes.class || "";
  const classes = typeof rawClasses === "string" ? rawClasses.split(/\s+/).filter(Boolean) : [];

  // Extract ID
  const customId = attributes.id || (existingElement ? existingElement.customId : undefined);

  // Normalize tag name
  const lowerTag = tagName.toLowerCase();

  // -------------------------------------------------------------------------
  // 1. DATA-DRIVEN COMPONENTS (BlogPosts, PricingTable, PortfolioGrid, etc.)
  // -------------------------------------------------------------------------

  // A. Blog Posts
  if (
    tagName === "BlogPosts" ||
    tagName === "Posts" ||
    lowerTag === "posts" ||
    attributes.posts !== undefined ||
    scope.has("posts")
  ) {
    const rawPosts = attributes.posts || scope.get("posts") || (existingElement?.posts) || [];
    const posts: PostItem[] = Array.isArray(rawPosts)
      ? rawPosts.map((p, idx) => ({
          id: p.id || `post_${idx + 1}`,
          title: p.title || "Untitled Post",
          excerpt: p.excerpt || "",
          date: p.date,
          author: p.author,
          image: p.image,
          category: p.category,
          link: p.link || p.readMoreUrl,
          readMoreText: p.readMoreText,
          readMoreUrl: p.readMoreUrl || p.link,
        }))
      : [];

    return {
      ...(existingElement || {}),
      id: elementId,
      type: "posts",
      content: "Blog Posts",
      posts,
      postsColumns: typeof attributes.columns === "number" ? attributes.columns : (existingElement?.postsColumns || 3),
      postsGap: typeof attributes.gap === "number" ? attributes.gap : (existingElement?.postsGap ?? 20),
      postsImageHeight: attributes.imageHeight || existingElement?.postsImageHeight || "180px",
      postsShowImage: attributes.showImage !== undefined ? Boolean(attributes.showImage) : (existingElement?.postsShowImage !== false),
      postsShowDate: attributes.showDate !== undefined ? Boolean(attributes.showDate) : (existingElement?.postsShowDate !== false),
      postsShowExcerpt: attributes.showExcerpt !== undefined ? Boolean(attributes.showExcerpt) : (existingElement?.postsShowExcerpt !== false),
      postsShowReadMore: attributes.showReadMore !== undefined ? Boolean(attributes.showReadMore) : (existingElement?.postsShowReadMore !== false),
      postsAlignment: attributes.alignment || existingElement?.postsAlignment || "left",
      styles: { ...(existingElement?.styles || {}), ...styles },
      classes,
      customId,
    };
  }

  // B. Pricing Table
  if (
    tagName === "PricingTable" ||
    tagName === "PriceTable" ||
    lowerTag === "price-table" ||
    attributes.pricingPlans !== undefined ||
    attributes.plans !== undefined ||
    scope.has("plans") ||
    scope.has("pricingPlans")
  ) {
    const rawPlans = attributes.pricingPlans || attributes.plans || scope.get("plans") || scope.get("pricingPlans") || (existingElement?.pricingPlans) || [];
    const pricingPlans: PricingPlan[] = Array.isArray(rawPlans)
      ? rawPlans.map((p, idx) => ({
          id: p.id || String(idx + 1),
          name: p.name || "Standard Plan",
          price: p.price || "$0",
          period: p.period || "/ month",
          description: p.description || "",
          isPopular: Boolean(p.isPopular),
          badgeText: p.badgeText,
          buttonText: p.buttonText || "Get Started",
          buttonUrl: p.buttonUrl || p.buttonHref || "#",
          features: Array.isArray(p.features)
            ? p.features.map((f: any, fIdx: number) => ({
                id: f.id || `f_${fIdx + 1}`,
                text: typeof f === "string" ? f : (f.text || ""),
                included: typeof f === "object" && f.included !== undefined ? Boolean(f.included) : true,
              }))
            : [],
        }))
      : [];

    return {
      ...(existingElement || {}),
      id: elementId,
      type: "price-table",
      content: "Price Table",
      pricingPlans,
      pricingColumns: typeof attributes.columns === "number" ? attributes.columns as any : (existingElement?.pricingColumns || 3),
      pricingGap: typeof attributes.gap === "number" ? attributes.gap : (existingElement?.pricingGap ?? 24),
      styles: { ...(existingElement?.styles || {}), ...styles },
      classes,
      customId,
    };
  }

  // C. Animated Headline
  if (
    tagName === "AnimatedHeadline" ||
    lowerTag === "animated-headline" ||
    attributes.headlineAnimatedTexts !== undefined ||
    attributes.words !== undefined ||
    scope.has("words")
  ) {
    const words = attributes.words || attributes.headlineAnimatedTexts || scope.get("words") || existingElement?.headlineAnimatedTexts || [];
    return {
      ...(existingElement || {}),
      id: elementId,
      type: "animated-headline",
      content: "Animated Headline",
      headlinePrefix: attributes.prefix !== undefined ? String(attributes.prefix) : (scope.get("prefix") || existingElement?.headlinePrefix || "Build Websites That Are"),
      headlineAnimatedTexts: Array.isArray(words) ? words.map(String) : ["Stunning", "Blazing Fast", "Ultra Flexible"],
      headlineSuffix: attributes.suffix !== undefined ? String(attributes.suffix) : (scope.get("suffix") || existingElement?.headlineSuffix || "With ForgeStudio"),
      headlineHighlightColor: attributes.highlightColor || scope.get("highlightColor") || existingElement?.headlineHighlightColor || "#2563eb",
      headlineHighlightBg: attributes.highlightBg || scope.get("highlightBg") || existingElement?.headlineHighlightBg || "rgba(239, 246, 255, 1)",
      headlineAnimationType: attributes.animationType || scope.get("animationType") || existingElement?.headlineAnimationType || "typing",
      headlineTag: attributes.tag || scope.get("tag") || existingElement?.headlineTag || "h2",
      styles: { ...(existingElement?.styles || {}), ...styles },
      classes,
      customId,
    };
  }

  // D. Flip Box
  if (
    tagName === "FlipBox" ||
    lowerTag === "flip-box" ||
    attributes.frontTitle !== undefined ||
    attributes.flipFrontTitle !== undefined
  ) {
    return {
      ...(existingElement || {}),
      id: elementId,
      type: "flip-box",
      content: "Flip Box",
      flipCardHeight: attributes.height || existingElement?.flipCardHeight || "320px",
      flipFrontTitle: attributes.frontTitle || attributes.flipFrontTitle || existingElement?.flipFrontTitle || "Interactive Solutions",
      flipFrontDescription: attributes.frontDesc || attributes.flipFrontDescription || existingElement?.flipFrontDescription || "",
      flipFrontIcon: attributes.frontIcon || attributes.flipFrontIcon || existingElement?.flipFrontIcon || "🚀",
      flipBackTitle: attributes.backTitle || attributes.flipBackTitle || existingElement?.flipBackTitle || "Ready to Start?",
      flipBackDescription: attributes.backDesc || attributes.flipBackDescription || existingElement?.flipBackDescription || "",
      flipBackBtnText: attributes.backBtnText || attributes.flipBackBtnText || existingElement?.flipBackBtnText || "Get Started",
      flipBackBtnUrl: attributes.backBtnUrl || attributes.flipBackBtnUrl || existingElement?.flipBackBtnUrl || "#",
      styles: { ...(existingElement?.styles || {}), ...styles },
      classes,
      customId,
    };
  }

  // E. Countdown Timer
  if (
    tagName === "CountdownTimer" ||
    tagName === "Countdown" ||
    lowerTag === "countdown" ||
    attributes.targetDate !== undefined ||
    attributes.countdownTargetDate !== undefined ||
    scope.has("targetDate")
  ) {
    return {
      ...(existingElement || {}),
      id: elementId,
      type: "countdown",
      content: "Countdown",
      countdownTargetDate: attributes.targetDate || attributes.countdownTargetDate || scope.get("targetDate") || existingElement?.countdownTargetDate || "2026-12-31T23:59:59",
      styles: { ...(existingElement?.styles || {}), ...styles },
      classes,
      customId,
    };
  }

  // F. Portfolio Grid
  if (
    tagName === "PortfolioGrid" ||
    tagName === "Portfolio" ||
    lowerTag === "portfolio" ||
    attributes.portfolioItems !== undefined ||
    attributes.items !== undefined ||
    scope.has("portfolioItems")
  ) {
    const rawItems = attributes.portfolioItems || attributes.items || scope.get("portfolioItems") || existingElement?.portfolioItems || [];
    const portfolioItems: PortfolioItem[] = Array.isArray(rawItems)
      ? rawItems.map((item, idx) => ({
          id: item.id || `proj_${idx + 1}`,
          title: item.title || "Project Title",
          category: item.category || "General",
          image: item.image || "",
          link: item.link || item.url || "#",
          url: item.url || item.link || "#",
          description: item.description,
        }))
      : [];

    return {
      ...(existingElement || {}),
      id: elementId,
      type: "portfolio",
      content: "Portfolio Grid",
      portfolioItems,
      portfolioColumns: typeof attributes.columns === "number" ? attributes.columns : (existingElement?.portfolioColumns || 3),
      portfolioGap: typeof attributes.gap === "number" ? attributes.gap : (existingElement?.portfolioGap ?? 24),
      styles: { ...(existingElement?.styles || {}), ...styles },
      classes,
      customId,
    };
  }

  // G. Hero Slides / Slideshow
  if (
    tagName === "HeroSlides" ||
    tagName === "Slides" ||
    tagName === "Slideshow" ||
    lowerTag === "slides" ||
    attributes.slidesItems !== undefined ||
    attributes.slides !== undefined ||
    scope.has("slides") ||
    scope.has("slidesItems")
  ) {
    const rawSlides = attributes.slides || attributes.slidesItems || scope.get("slides") || scope.get("slidesItems") || existingElement?.slidesItems || [];
    const slidesItems: SlideItem[] = Array.isArray(rawSlides)
      ? rawSlides.map((s, idx) => ({
          id: s.id || `slide_${idx + 1}`,
          title: s.title || `Slide ${idx + 1}`,
          description: s.description !== undefined ? String(s.description) : "",
          bgImage: s.bgImage || s.image || s.backgroundImage || "",
          bgColor: s.bgColor || s.backgroundColor || "#0f172a",
          buttonText: s.buttonText || s.btnText || "",
          buttonUrl: s.buttonUrl || s.btnUrl || s.buttonHref || "#",
        }))
      : [];

    return {
      ...(existingElement || {}),
      id: elementId,
      type: "slides",
      content: existingElement?.content || "Slideshow Section",
      slidesItems,
      slidesHeight: attributes.height || attributes.slidesHeight || existingElement?.slidesHeight || "450px",
      slidesAutoplay: attributes.autoplay !== undefined ? Boolean(attributes.autoplay) : (existingElement?.slidesAutoplay !== false),
      slidesAutoplayInterval: typeof attributes.autoplayInterval === "number" ? attributes.autoplayInterval : (existingElement?.slidesAutoplayInterval || 4000),
      slidesTransition: (attributes.transition as any) || existingElement?.slidesTransition || "slide",
      slidesAlignment: (attributes.alignment as any) || existingElement?.slidesAlignment || "center",
      slidesShowArrows: attributes.showArrows !== undefined ? Boolean(attributes.showArrows) : (existingElement?.slidesShowArrows !== false),
      slidesShowDots: attributes.showDots !== undefined ? Boolean(attributes.showDots) : (existingElement?.slidesShowDots !== false),
      styles: { ...(existingElement?.styles || {}), ...styles },
      classes,
      customId,
    };
  }

  // H. Photo Gallery
  if (
    tagName === "PhotoGallery" ||
    tagName === "ImageGallery" ||
    tagName === "Gallery" ||
    lowerTag === "gallery" ||
    lowerTag === "basic-gallery" ||
    attributes.galleryImages !== undefined ||
    attributes.images !== undefined ||
    scope.has("galleryImages") ||
    scope.has("images")
  ) {
    const rawImages = attributes.images || attributes.galleryImages || scope.get("images") || scope.get("galleryImages") || existingElement?.galleryImages || [];
    const galleryImages: GalleryImageItem[] = Array.isArray(rawImages)
      ? rawImages.map((img, idx) => ({
          id: img.id || `g_${idx + 1}`,
          url: typeof img === "string" ? img : (img.url || img.src || ""),
          caption: typeof img === "object" ? img.caption : undefined,
          altText: typeof img === "object" ? img.altText : undefined,
        }))
      : [];

    return {
      ...(existingElement || {}),
      id: elementId,
      type: "gallery",
      content: "Gallery",
      galleryImages,
      galleryColumns: typeof attributes.columns === "number" ? attributes.columns as any : (existingElement?.galleryColumns || 3),
      galleryGap: typeof attributes.gap === "number" ? attributes.gap : (existingElement?.galleryGap ?? 16),
      styles: { ...(existingElement?.styles || {}), ...styles },
      classes,
      customId,
    };
  }

  // I. Testimonials Slider
  if (
    tagName === "TestimonialsSlider" ||
    tagName === "Testimonials" ||
    lowerTag === "testimonial-carousel" ||
    attributes.testimonialItems !== undefined ||
    attributes.testimonials !== undefined ||
    scope.has("testimonials") ||
    scope.has("testimonialItems")
  ) {
    const rawTestimonials = attributes.testimonials || attributes.testimonialItems || scope.get("testimonials") || scope.get("testimonialItems") || existingElement?.testimonialItems || [];
    const testimonialItems: TestimonialItem[] = Array.isArray(rawTestimonials)
      ? rawTestimonials.map((t, idx) => ({
          id: t.id || `t_${idx + 1}`,
          name: t.name || "Customer",
          role: t.role || "",
          quote: t.quote || "",
          rating: typeof t.rating === "number" ? t.rating : 5,
          avatarUrl: t.avatarUrl,
        }))
      : [];

    return {
      ...(existingElement || {}),
      id: elementId,
      type: "testimonial-carousel",
      content: "Testimonial Carousel",
      testimonialItems,
      testimonialGap: typeof attributes.gap === "number" ? attributes.gap : (existingElement?.testimonialGap ?? 24),
      styles: { ...(existingElement?.styles || {}), ...styles },
      classes,
      customId,
    };
  }

  // J. Media Carousel
  if (
    tagName === "MediaCarousel" ||
    lowerTag === "media-carousel" ||
    lowerTag === "image-carousel" ||
    lowerTag === "basic-media-carousel" ||
    attributes.mediaCarouselItems !== undefined ||
    scope.has("mediaCarouselItems")
  ) {
    const rawItems = attributes.items || attributes.mediaCarouselItems || scope.get("items") || scope.get("mediaCarouselItems") || existingElement?.mediaCarouselItems || [];
    return {
      ...(existingElement || {}),
      id: elementId,
      type: "media-carousel",
      content: "Media Carousel",
      mediaCarouselItems: Array.isArray(rawItems) ? rawItems : [],
      mediaCarouselGap: typeof attributes.gap === "number" ? attributes.gap : (existingElement?.mediaCarouselGap ?? 16),
      styles: { ...(existingElement?.styles || {}), ...styles },
      classes,
      customId,
    };
  }

  // K. Customer Reviews
  if (
    tagName === "CustomerReviews" ||
    tagName === "Reviews" ||
    lowerTag === "reviews" ||
    attributes.reviewItems !== undefined ||
    attributes.reviews !== undefined ||
    scope.has("reviews")
  ) {
    const rawReviews = attributes.reviews || attributes.reviewItems || scope.get("reviews") || scope.get("reviewItems") || existingElement?.reviewItems || [];
    const reviewItems: ReviewItem[] = Array.isArray(rawReviews)
      ? rawReviews.map((r, idx) => ({
          id: r.id || `r_${idx + 1}`,
          reviewerName: r.reviewerName || "Reviewer",
          reviewerTitle: r.reviewerTitle,
          reviewText: r.reviewText || "",
          rating: typeof r.rating === "number" ? r.rating : 5,
          avatarUrl: r.avatarUrl,
        }))
      : [];

    return {
      ...(existingElement || {}),
      id: elementId,
      type: "reviews",
      content: "Reviews",
      reviewItems,
      styles: { ...(existingElement?.styles || {}), ...styles },
      classes,
      customId,
    };
  }

  // L. Price List
  if (
    tagName === "PriceList" ||
    lowerTag === "price-list" ||
    attributes.priceListItems !== undefined ||
    scope.has("priceListItems")
  ) {
    const rawItems = attributes.items || attributes.priceListItems || scope.get("items") || scope.get("priceListItems") || existingElement?.priceListItems || [];
    const priceListItems: PriceListItem[] = Array.isArray(rawItems)
      ? rawItems.map((it, idx) => ({
          id: it.id || `pl_${idx + 1}`,
          name: it.name || "Item",
          description: it.description,
          price: it.price || "$0",
        }))
      : [];

    return {
      ...(existingElement || {}),
      id: elementId,
      type: "price-list",
      content: "Price List",
      priceListItems,
      styles: { ...(existingElement?.styles || {}), ...styles },
      classes,
      customId,
    };
  }

  // M. Contact Form
  if (
    tagName === "ContactForm" ||
    lowerTag === "form" ||
    attributes.formFields !== undefined ||
    attributes.fields !== undefined ||
    scope.has("fields") ||
    scope.has("formFields")
  ) {
    const rawFields = attributes.fields || attributes.formFields || scope.get("fields") || scope.get("formFields") || existingElement?.formFields || [];
    const formFields: FormFieldItem[] = Array.isArray(rawFields)
      ? rawFields.map((f, idx) => ({
          id: f.id || `f_${idx + 1}`,
          type: f.type || "text",
          label: f.label || "Field",
          placeholder: f.placeholder,
          required: Boolean(f.required),
        }))
      : [];

    return {
      ...(existingElement || {}),
      id: elementId,
      type: "form",
      content: "Form",
      formTitle: attributes.title || scope.get("title") || existingElement?.formTitle || "Contact Us",
      formSubmitText: attributes.submitText || scope.get("submitText") || existingElement?.formSubmitText || "Send Message",
      formFields,
      styles: { ...(existingElement?.styles || {}), ...styles },
      classes,
      customId,
    };
  }

  // N. Navigation Menu
  if (
    tagName === "NavMenu" ||
    tagName === "MegaMenu" ||
    lowerTag === "nav-menu" ||
    lowerTag === "mega-menu" ||
    attributes.navMenuItems !== undefined ||
    scope.has("navMenuItems")
  ) {
    const rawItems = attributes.items || attributes.navMenuItems || scope.get("items") || scope.get("navMenuItems") || existingElement?.navMenuItems || [];
    const navMenuItems: NavMenuItem[] = Array.isArray(rawItems)
      ? rawItems.map((it, idx) => ({
          id: it.id || `n_${idx + 1}`,
          label: it.label || "Link",
          url: it.url || "#",
        }))
      : [];

    return {
      ...(existingElement || {}),
      id: elementId,
      type: "nav-menu",
      content: "Nav Menu",
      navMenuItems,
      styles: { ...(existingElement?.styles || {}), ...styles },
      classes,
      customId,
    };
  }

  // O. Call To Action
  if (
    tagName === "CallToAction" ||
    lowerTag === "call-to-action" ||
    attributes.ctaHeading !== undefined ||
    attributes.heading !== undefined
  ) {
    return {
      ...(existingElement || {}),
      id: elementId,
      type: "call-to-action",
      content: "Call to Action",
      ctaHeading: attributes.heading || attributes.ctaHeading || scope.get("heading") || existingElement?.ctaHeading || "Ready to Start?",
      ctaDescription: attributes.description || attributes.ctaDescription || scope.get("description") || existingElement?.ctaDescription || "",
      ctaButtonText: attributes.buttonText || attributes.ctaButtonText || scope.get("buttonText") || existingElement?.ctaButtonText || "Get Started",
      ctaButtonUrl: attributes.buttonUrl || attributes.ctaButtonUrl || scope.get("buttonUrl") || existingElement?.ctaButtonUrl || "#",
      styles: { ...(existingElement?.styles || {}), ...styles },
      classes,
      customId,
    };
  }

  // P. Blockquote
  if (
    tagName === "QuoteBlock" ||
    tagName === "Blockquote" ||
    lowerTag === "blockquote" ||
    attributes.quote !== undefined ||
    attributes.quoteContent !== undefined
  ) {
    return {
      ...(existingElement || {}),
      id: elementId,
      type: "blockquote",
      content: "Blockquote",
      quoteContent: attributes.quote || attributes.quoteContent || scope.get("quote") || existingElement?.quoteContent || "Quote copy",
      quoteAuthor: attributes.author || attributes.quoteAuthor || scope.get("author") || existingElement?.quoteAuthor || "Author",
      quoteCitation: attributes.citation || attributes.quoteCitation || scope.get("citation") || existingElement?.quoteCitation || "",
      styles: { ...(existingElement?.styles || {}), ...styles },
      classes,
      customId,
    };
  }

  // -------------------------------------------------------------------------
  // 2. STANDARD HTML / JSX ELEMENTS
  // -------------------------------------------------------------------------

  // Headings: h1, h2, h3, h4, h5, h6, SectionHeading
  if (/^h[1-6]$/i.test(tagName) || tagName === "SectionHeading" || tagName === "Heading") {
    let headingLevel = "h2" as any;
    if (/^h[1-6]$/i.test(tagName)) {
      headingLevel = tagName.toLowerCase() as any;
    } else if (attributes.level) {
      headingLevel = String(attributes.level).toLowerCase() as any;
    }

    const textContent = extractTextContentFromChildren(node);

    return {
      ...(existingElement || {}),
      id: elementId,
      type: "heading",
      headingLevel,
      content: textContent || existingElement?.content || "Heading Title",
      styles: { ...(existingElement?.styles || {}), ...styles },
      classes,
      customId,
    };
  }

  // Paragraph / Text: p, span, TextBlock, ParagraphBlock
  if (lowerTag === "p" || lowerTag === "span" || tagName === "TextBlock" || tagName === "ParagraphBlock") {
    const textContent = extractTextContentFromChildren(node);
    return {
      ...(existingElement || {}),
      id: elementId,
      type: "text",
      content: textContent || existingElement?.content || "",
      styles: { ...(existingElement?.styles || {}), ...styles },
      classes,
      customId,
    };
  }

  // Button / Link: a, button, ActionButton
  if (lowerTag === "button" || lowerTag === "a" || tagName === "ActionButton" || tagName === "Button") {
    const textContent = extractTextContentFromChildren(node);
    const href = attributes.href || attributes.to || existingElement?.href || "#";

    return {
      ...(existingElement || {}),
      id: elementId,
      type: "button",
      content: textContent || existingElement?.content || "Click Here",
      href,
      styles: { ...(existingElement?.styles || {}), ...styles },
      classes,
      customId,
    };
  }

  // Image: img, ResponsiveImage
  if (lowerTag === "img" || tagName === "ResponsiveImage" || tagName === "Image") {
    return {
      ...(existingElement || {}),
      id: elementId,
      type: "image",
      content: "",
      src: attributes.src || existingElement?.src || "",
      alt: attributes.alt || existingElement?.alt || "",
      styles: { ...(existingElement?.styles || {}), ...styles },
      classes,
      customId,
    };
  }

  // Video: video, VideoPlayer
  if (lowerTag === "video" || tagName === "VideoPlayer" || tagName === "Video") {
    return {
      ...(existingElement || {}),
      id: elementId,
      type: "video",
      content: "",
      src: attributes.src || existingElement?.src || "",
      styles: { ...(existingElement?.styles || {}), ...styles },
      classes,
      customId,
    };
  }

  // Divider: hr, ContentDivider
  if (lowerTag === "hr" || tagName === "ContentDivider" || tagName === "Divider") {
    return {
      ...(existingElement || {}),
      id: elementId,
      type: "divider",
      content: "",
      styles: { ...(existingElement?.styles || {}), ...styles },
      classes,
      customId,
    };
  }

  // -------------------------------------------------------------------------
  // 3. CONTAINER / SECTION WITH RECURSIVE CHILDREN
  // -------------------------------------------------------------------------
  // section, div, main, article, header, footer, aside, nav, SectionContainer, Container
  const isStructuralContainer =
    lowerTag === "section" ||
    lowerTag === "div" ||
    lowerTag === "main" ||
    lowerTag === "article" ||
    lowerTag === "header" ||
    lowerTag === "footer" ||
    lowerTag === "aside" ||
    lowerTag === "nav" ||
    tagName === "SectionContainer" ||
    tagName === "Container";

  if (isStructuralContainer) {
    const rawChildren = isElement ? node.children : [];
    const childrenElements: EditorElement[] = [];

    for (const child of rawChildren) {
      if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
        childrenElements.push(convertJsxNodeToElement(child, scope, undefined, warnings));
      }
    }

    // If this container has no child JSX elements but has plain text content, check if it should be text
    if (childrenElements.length === 0) {
      const text = extractTextContentFromChildren(node).trim();
      if (text) {
        return {
          ...(existingElement || {}),
          id: elementId,
          type: "text",
          content: text,
          styles: { ...(existingElement?.styles || {}), ...styles },
          classes,
          customId,
        };
      }
    }

    return {
      ...(existingElement || {}),
      id: elementId,
      type: "container",
      content: "",
      styles: { ...(existingElement?.styles || {}), ...styles },
      layout: layout || existingElement?.layout || { direction: "column", gap: 16 },
      children: childrenElements,
      classes,
      customId,
    };
  }

  // Fallback for unknown tag: preserve as container with warning
  warnings.push(`Element tag <${tagName}> mapped safely to container.`);
  const fallbackChildren: EditorElement[] = [];
  if (isElement) {
    for (const child of node.children) {
      if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
        fallbackChildren.push(convertJsxNodeToElement(child, scope, undefined, warnings));
      }
    }
  }

  return {
    ...(existingElement || {}),
    id: elementId,
    type: "container",
    content: extractTextContentFromChildren(node),
    styles: { ...(existingElement?.styles || {}), ...styles },
    children: fallbackChildren,
    classes,
    customId,
  };
}
