/**
 * Code exporter: media. Moved verbatim from codeExporter.ts, which re-exports the public API.
 */
import type { EditorElement, SlideItem } from "../../../types";
import { toPascalCase } from "../styles";

/**
 * Generates standalone Flip Box component
 */
export function generateFlipBoxComponent(el: EditorElement, isTsx = false): string {
  const compName = toPascalCase(el.type || "flip-box");
  const height = el.flipCardHeight || "320px";
  const frontTitle = el.flipFrontTitle || "Interactive Solutions";
  const frontDesc = el.flipFrontDescription || "Hover or tap to flip card and explore custom features.";
  const frontBg = el.flipFrontBg || "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)";
  const frontIcon = el.flipFrontIcon || "🚀";
  const backTitle = el.flipBackTitle || "Ready to Start?";
  const backDesc = el.flipBackDescription || "Join thousands of creators building high-converting websites.";
  const backBg = el.flipBackBg || "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)";
  const backBtnText = el.flipBackBtnText || "Get Started Now";
  const backBtnUrl = el.flipBackBtnUrl || "";

  const tsInterface = isTsx
    ? `export interface ${compName}Props {
  frontTitle?: string;
  frontDesc?: string;
  frontIcon?: string;
  backTitle?: string;
  backDesc?: string;
  backBtnText?: string;
  backBtnUrl?: string;
  height?: string;
  className?: string;
  style?: React.CSSProperties;
}\n\n`
    : "";

  return `// ${compName}.${isTsx ? "tsx" : "jsx"} - 3D Flip Card
import React, { useState } from 'react';

${tsInterface}export default function ${compName}(${isTsx ? `props: ${compName}Props` : "props"}) {
  const {
    frontTitle = ${JSON.stringify(frontTitle)},
    frontDesc = ${JSON.stringify(frontDesc)},
    frontIcon = ${JSON.stringify(frontIcon)},
    backTitle = ${JSON.stringify(backTitle)},
    backDesc = ${JSON.stringify(backDesc)},
    backBtnText = ${JSON.stringify(backBtnText)},
    backBtnUrl = ${JSON.stringify(backBtnUrl)},
    height = ${JSON.stringify(height)},
    className = "",
    style = {},
    ...rest
  } = props;

  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div
      className={className}
      onMouseEnter={() => setIsFlipped(true)}
      onMouseLeave={() => setIsFlipped(false)}
      onClick={() => setIsFlipped((prev) => !prev)}
      style={{
        perspective: "1000px",
        width: "100%",
        maxWidth: "420px",
        height,
        margin: "20px auto",
        cursor: "pointer",
        fontFamily: "system-ui, -apple-system, sans-serif",
        ...style,
      }}
      {...rest}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          transition: "transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1)",
          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
          borderRadius: "20px",
          boxShadow: "0 15px 35px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ position: "absolute", width: "100%", height: "100%", backfaceVisibility: "hidden", borderRadius: "20px", background: ${JSON.stringify(frontBg)}, color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px", textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>{frontIcon}</div>
          <h3 style={{ margin: "0 0 12px", fontSize: "24px", fontWeight: "bold" }}>{frontTitle}</h3>
          <p style={{ margin: 0, fontSize: "14px", opacity: 0.85, lineHeight: 1.6 }}>{frontDesc}</p>
        </div>
        <div style={{ position: "absolute", width: "100%", height: "100%", backfaceVisibility: "hidden", transform: "rotateY(180deg)", borderRadius: "20px", background: ${JSON.stringify(backBg)}, color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px", textAlign: "center" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: "24px", fontWeight: "bold" }}>{backTitle}</h3>
          <p style={{ margin: "0 0 24px", fontSize: "14px", opacity: 0.9, lineHeight: 1.6 }}>{backDesc}</p>
          {backBtnUrl ? (
            <a href={backBtnUrl} style={{ display: "inline-block", textDecoration: "none", padding: "10px 24px", borderRadius: "8px", border: "none", backgroundColor: "#fff", color: "#4f46e5", fontSize: "14px", fontWeight: "bold", cursor: "pointer" }}>
              {backBtnText}
            </a>
          ) : (
            <button type="button" style={{ padding: "10px 24px", borderRadius: "8px", border: "none", backgroundColor: "#fff", color: "#4f46e5", fontSize: "14px", fontWeight: "bold", cursor: "pointer" }}>
              {backBtnText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
`;
}

/**
 * Generates standalone interactive Slides / Slideshow component
 */
export function generateSlidesComponent(el: EditorElement, isTsx = false): string {
  const compName = toPascalCase(el.type || "slides");
  const slidesList: SlideItem[] = el.slidesItems && el.slidesItems.length > 0 ? el.slidesItems : [
    {
      id: "slide_1",
      title: "Empower Your Digital Growth",
      description: "Build high-converting modern websites with intuitive drag and drop tools and responsive controls.",
      bgImage: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1600&auto=format&fit=crop&q=80",
      bgColor: "#1e1b4b",
      buttonText: "Explore Features",
      buttonUrl: "#",
    },
    {
      id: "slide_2",
      title: "Designed for High Performance",
      description: "Lightning-fast page load speeds, automatic SEO optimization, and flawless mobile experience.",
      bgImage: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1600&auto=format&fit=crop&q=80",
      bgColor: "#0f172a",
      buttonText: "Start Free Trial",
      buttonUrl: "#",
    },
    {
      id: "slide_3",
      title: "Seamless Team Collaboration",
      description: "Work together in real-time, manage brand components, and deploy updates instantly.",
      bgImage: "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1600&auto=format&fit=crop&q=80",
      bgColor: "#111827",
      buttonText: "Contact Sales",
      buttonUrl: "#",
    },
  ];

  const height = el.slidesHeight || "450px";
  const autoplay = el.slidesAutoplay !== false;
  const autoplayInterval = el.slidesAutoplayInterval || 4000;
  const transition = el.slidesTransition || "slide";
  const alignment = el.slidesAlignment || "center";
  const showArrows = el.slidesShowArrows !== false;
  const showDots = el.slidesShowDots !== false;

  const tsInterface = isTsx
    ? `export interface SlideItem {
  id: string;
  title: string;
  description?: string;
  bgImage?: string;
  bgColor?: string;
  buttonText?: string;
  buttonUrl?: string;
}

export interface ${compName}Props {
  slides?: SlideItem[];
  height?: string;
  autoplay?: boolean;
  autoplayInterval?: number;
  transition?: "slide" | "fade";
  alignment?: "left" | "center" | "right";
  showArrows?: boolean;
  showDots?: boolean;
  className?: string;
  style?: React.CSSProperties;
}\n\n`
    : "";

  return `// ${compName}.${isTsx ? "tsx" : "jsx"} - Interactive Hero Slideshow
import React, { useState, useEffect } from 'react';

${tsInterface}export default function ${compName}(${isTsx ? `props: ${compName}Props` : "props"}) {
  const {
    slides = ${JSON.stringify(slidesList, null, 2)},
    height = ${JSON.stringify(height)},
    autoplay = ${autoplay},
    autoplayInterval = ${autoplayInterval},
    transition = ${JSON.stringify(transition)},
    alignment = ${JSON.stringify(alignment)},
    showArrows = ${showArrows},
    showDots = ${showDots},
    className = "",
    style = {},
    ...rest
  } = props;

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!autoplay || slides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, autoplayInterval);
    return () => clearInterval(timer);
  }, [autoplay, slides.length, autoplayInterval]);

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  };

  if (!slides || slides.length === 0) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#0f172a", color: "#94a3b8", borderRadius: "16px", ...style }}>
        <p>No slides configured</p>
      </div>
    );
  }

  const currentSlide = slides[currentIndex] || slides[0];

  const textAlign = alignment === "center" ? "center" : alignment === "right" ? "right" : "left";
  const alignItems = alignment === "center" ? "center" : alignment === "right" ? "flex-end" : "flex-start";

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: height,
        overflow: "hidden",
        borderRadius: "16px",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
        backgroundColor: currentSlide.bgColor || "#0f172a",
        ...style,
      }}
      {...rest}
    >
      {slides.map((slide, idx) => {
        const isActive = idx === currentIndex;
        return (
          <div
            key={slide.id || idx}
            style={{
              position: "absolute",
              inset: 0,
              opacity: isActive ? 1 : 0,
              transform: isActive ? "translateX(0px)" : transition === "fade" ? "none" : "translateX(40px)",
              transition: "all 0.7s cubic-bezier(0.4, 0, 0.2, 1)",
              pointerEvents: isActive ? "auto" : "none",
              backgroundImage: slide.bgImage ? \`url(\${slide.bgImage})\` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundColor: slide.bgColor || "#0f172a",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            {/* Gradient Overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.45) 50%, rgba(0, 0, 0, 0.3) 100%)",
              }}
            />

            {/* Slide Content */}
            <div
              style={{
                position: "relative",
                zIndex: 10,
                display: "flex",
                flexDirection: "column",
                alignItems: alignItems,
                textAlign: textAlign,
                padding: "48px",
                maxWidth: "750px",
                margin: alignment === "center" ? "0 auto" : alignment === "right" ? "0 0 0 auto" : "0",
              }}
            >
              <h2
                style={{
                  fontSize: "36px",
                  fontWeight: "800",
                  color: "#ffffff",
                  lineHeight: 1.2,
                  margin: "0 0 16px 0",
                  textShadow: "0 2px 4px rgba(0,0,0,0.5)",
                }}
              >
                {slide.title}
              </h2>

              {slide.description && (
                <p
                  style={{
                    fontSize: "16px",
                    color: "#e2e8f0",
                    lineHeight: 1.6,
                    margin: "0 0 24px 0",
                    maxWidth: "550px",
                    textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                  }}
                >
                  {slide.description}
                </p>
              )}

              {slide.buttonText && (
                <a
                  href={slide.buttonUrl || "#"}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    backgroundColor: "#ffffff",
                    color: "#0f172a",
                    fontWeight: "700",
                    fontSize: "14px",
                    padding: "12px 28px",
                    borderRadius: "10px",
                    textDecoration: "none",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.2)",
                  }}
                >
                  <span>{slide.buttonText}</span>
                  <span>→</span>
                </a>
              )}
            </div>
          </div>
        );
      })}

      {/* Navigation Arrows */}
      {showArrows && slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={prevSlide}
            aria-label="Previous Slide"
            style={{
              position: "absolute",
              left: "16px",
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 20,
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              color: "#ffffff",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={nextSlide}
            aria-label="Next Slide"
            style={{
              position: "absolute",
              right: "16px",
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 20,
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              color: "#ffffff",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            ›
          </button>
        </>
      )}

      {/* Pagination Dots */}
      {showDots && slides.length > 1 && (
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 20,
            display: "flex",
            gap: "8px",
          }}
        >
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              aria-label={\`Go to slide \${idx + 1}\`}
              style={{
                width: idx === currentIndex ? "28px" : "10px",
                height: "10px",
                borderRadius: "5px",
                backgroundColor: idx === currentIndex ? "#ffffff" : "rgba(255, 255, 255, 0.4)",
                border: "none",
                cursor: "pointer",
                padding: 0,
                transition: "all 0.3s ease",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
`;
}

/**
 * Generates standalone Photo Gallery component
 */
export function generateGalleryComponent(el: EditorElement, isTsx = false): string {
  const compName = toPascalCase(el.type || "gallery");
  const images = el.galleryImages && el.galleryImages.length > 0 ? el.galleryImages : [
    { id: "g1", url: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80", caption: "Vibrant Color Gradients" },
    { id: "g2", url: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&auto=format&fit=crop&q=80", caption: "Digital Innovation Space" },
    { id: "g3", url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80", caption: "High Performance Collaboration" },
  ];
  const columns = el.galleryColumns || 3;
  const gap = el.galleryGap ?? 16;

  const tsInterface = isTsx
    ? `export interface GalleryImageItem {
  id: string;
  url: string;
  caption?: string;
  altText?: string;
}

export interface ${compName}Props {
  images?: GalleryImageItem[];
  columns?: number;
  gap?: number;
  className?: string;
  style?: React.CSSProperties;
}\n\n`
    : "";

  return `// ${compName}.${isTsx ? "tsx" : "jsx"} - Photo Gallery Component
import React, { useState } from 'react';

${tsInterface}export default function ${compName}(${isTsx ? `props: ${compName}Props` : "props"}) {
  const {
    images = ${JSON.stringify(images, null, 2)},
    columns = ${columns},
    gap = ${gap},
    className = "",
    style = {},
    ...rest
  } = props;

  const [activeImage, setActiveImage] = useState<any>(null);

  return (
    <div className={className} style={{ width: "100%", padding: "24px 0", ...style }} {...rest}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: \`repeat(auto-fit, minmax(280px, 1fr))\`,
          gap: \`\${gap}px\`,
        }}
      >
        {images.map((img) => (
          <div
            key={img.id}
            onClick={() => setActiveImage(img)}
            style={{
              position: "relative",
              borderRadius: "12px",
              overflow: "hidden",
              aspectRatio: "4/3",
              backgroundColor: "#f1f5f9",
              cursor: "pointer",
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
            }}
          >
            <img
              src={img.url}
              alt={img.caption || img.altText || "Gallery item"}
              style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.3s ease" }}
            />
            {img.caption && (
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  insetInline: 0,
                  padding: "10px 14px",
                  background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: "600",
                }}
              >
                {img.caption}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      {activeImage && (
        <div
          onClick={() => setActiveImage(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            backgroundColor: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            cursor: "zoom-out",
          }}
        >
          <img
            src={activeImage.url}
            alt={activeImage.caption || "Preview"}
            style={{ maxWidth: "90vw", maxHeight: "85vh", borderRadius: "12px", objectFit: "contain" }}
          />
        </div>
      )}
    </div>
  );
}
`;
}

/**
 * Generates standalone Testimonials Slider component
 */
export function generateTestimonialsComponent(el: EditorElement, isTsx = false): string {
  const compName = toPascalCase(el.type || "testimonial-carousel");
  const testimonials = el.testimonialItems && el.testimonialItems.length > 0 ? el.testimonialItems : [
    { id: "t1", name: "Sarah Connor", role: "VP of Engineering", quote: "ForgeStudio allowed our team to accelerate production releases tenfold.", rating: 5 },
    { id: "t2", name: "David Miller", role: "Product Lead", quote: "The bidirectional code and visual canvas sync is a complete game changer for developers.", rating: 5 },
  ];
  const gap = el.testimonialGap ?? 24;

  const tsInterface = isTsx
    ? `export interface TestimonialItem {
  id: string;
  name: string;
  role: string;
  quote: string;
  rating?: number;
  avatarUrl?: string;
}

export interface ${compName}Props {
  testimonials?: TestimonialItem[];
  gap?: number;
  className?: string;
  style?: React.CSSProperties;
}\n\n`
    : "";

  return `// ${compName}.${isTsx ? "tsx" : "jsx"} - Testimonials Slider
import React from 'react';

${tsInterface}export default function ${compName}(${isTsx ? `props: ${compName}Props` : "props"}) {
  const {
    testimonials = ${JSON.stringify(testimonials, null, 2)},
    gap = ${gap},
    className = "",
    style = {},
    ...rest
  } = props;

  return (
    <div className={className} style={{ width: "100%", padding: "32px 0", ...style }} {...rest}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: \`\${gap}px\`,
        }}
      >
        {testimonials.map((item) => (
          <div
            key={item.id}
            style={{
              padding: "28px",
              borderRadius: "16px",
              border: "1px solid #e2e8f0",
              backgroundColor: "#ffffff",
              boxShadow: "0 4px 15px rgba(0,0,0,0.05)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ color: "#f59e0b", fontSize: "18px", marginBottom: "14px" }}>
              {"★".repeat(item.rating || 5)}
            </div>
            <p style={{ fontSize: "15px", color: "#334155", fontStyle: "italic", lineHeight: 1.6, flex: 1, margin: "0 0 20px 0" }}>
              "{item.quote}"
            </p>
            <div>
              <div style={{ fontWeight: "700", color: "#0f172a", fontSize: "15px" }}>{item.name}</div>
              <div style={{ fontSize: "13px", color: "#64748b" }}>{item.role}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
`;
}

/**
 * Generates standalone Media Carousel component
 */
export function generateMediaCarouselComponent(el: EditorElement, isTsx = false): string {
  const compName = toPascalCase(el.type || "media-carousel");
  const items = (el.mediaCarouselItems && el.mediaCarouselItems.length > 0 ? el.mediaCarouselItems : el.imageCarouselItems) || [
    { id: "m1", imageUrl: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&auto=format&fit=crop&q=80", title: "Media 1" },
    { id: "m2", imageUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80", title: "Media 2" },
    { id: "m3", imageUrl: "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&auto=format&fit=crop&q=80", title: "Media 3" },
  ];
  const gap = el.mediaCarouselGap ?? 16;

  const tsInterface = isTsx
    ? `export interface MediaCarouselProps {
  items?: any[];
  gap?: number;
  className?: string;
  style?: React.CSSProperties;
}\n\n`
    : "";

  return `// ${compName}.${isTsx ? "tsx" : "jsx"} - Media Carousel
import React from 'react';

${tsInterface}export default function ${compName}(${isTsx ? `props: MediaCarouselProps` : "props"}) {
  const {
    items = ${JSON.stringify(items, null, 2)},
    gap = ${gap},
    className = "",
    style = {},
    ...rest
  } = props;

  return (
    <div className={className} style={{ width: "100%", padding: "24px 0", ...style }} {...rest}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: \`\${gap}px\`,
        }}
      >
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              borderRadius: "14px",
              overflow: "hidden",
              aspectRatio: "16/9",
              backgroundColor: "#f1f5f9",
              boxShadow: "0 4px 10px rgba(0,0,0,0.06)",
            }}
          >
            <img
              src={item.imageUrl || item.url || ""}
              alt={item.title || "Media Item"}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
`;
}

/**
 * Generates standalone Customer Reviews component
 */
export function generateReviewsComponent(el: EditorElement, isTsx = false): string {
  const compName = toPascalCase(el.type || "reviews");
  const reviews = el.reviewItems && el.reviewItems.length > 0 ? el.reviewItems : [
    { id: "r1", reviewerName: "Michael Chang", reviewerTitle: "Verified Buyer", reviewText: "Outstanding build quality and responsive design flexibility.", rating: 5 },
    { id: "r2", reviewerName: "Emma Watson", reviewerTitle: "Verified Buyer", reviewText: "Extremely intuitive and saved us hours of custom code work.", rating: 5 },
  ];

  const tsInterface = isTsx
    ? `export interface ReviewItem {
  id: string;
  reviewerName: string;
  reviewerTitle?: string;
  reviewText: string;
  rating: number;
  avatarUrl?: string;
}

export interface ${compName}Props {
  reviews?: ReviewItem[];
  className?: string;
  style?: React.CSSProperties;
}\n\n`
    : "";

  return `// ${compName}.${isTsx ? "tsx" : "jsx"} - Verified Reviews
import React from 'react';

${tsInterface}export default function ${compName}(${isTsx ? `props: ${compName}Props` : "props"}) {
  const {
    reviews = ${JSON.stringify(reviews, null, 2)},
    className = "",
    style = {},
    ...rest
  } = props;

  return (
    <div className={className} style={{ width: "100%", padding: "24px 0", ...style }} {...rest}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
        {reviews.map((item) => (
          <div key={item.id} style={{ padding: "24px", borderRadius: "14px", border: "1px solid #e2e8f0", backgroundColor: "#ffffff", boxShadow: "0 4px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <strong style={{ fontSize: "15px", color: "#0f172a" }}>{item.reviewerName}</strong>
              <span style={{ color: "#f59e0b" }}>{"★".repeat(item.rating || 5)}</span>
            </div>
            <p style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#475569", lineHeight: 1.5 }}>{item.reviewText}</p>
            {item.reviewerTitle && <span style={{ fontSize: "11px", color: "#10b981", fontWeight: "600" }}>✓ {item.reviewerTitle}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
`;
}
