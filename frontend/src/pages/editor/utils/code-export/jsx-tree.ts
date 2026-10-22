/**
 * Code exporter: jsx-tree. Moved verbatim from codeExporter.ts, which re-exports the public API.
 */
import type { EditorElement } from "../../types";
import { getMergedStyles, getMergedLayout, formatStylesToJSX, toPascalCase } from "./styles";

/**
 * Context passed down the recursive export pipeline
 */
export interface ExportContext {
  isTsx: boolean;
  indent: string;
}

// =========================================================================
// RECURSIVE NODE EXPORTER ENGINE
// =========================================================================

/**
 * Recursively export an element node into pure JSX markup
 */
export function exportElementNodeToJSX(el: EditorElement, ctx: ExportContext): string {
  const { indent } = ctx;
  const nextIndent = indent + "  ";
  const stylesObj = getMergedStyles(el, "desktop", "normal");
  const layout = el.type === "container" ? getMergedLayout(el, "desktop") : undefined;

  switch (el.type) {
    // -------------------------------------------------------------------
    // CONTAINER (Recursive traversal of arbitrary children)
    // -------------------------------------------------------------------
    case "container": {
      const isGrid = layout?.layoutType === "grid";
      const containerStyles: Record<string, any> = {
        display: isGrid ? "grid" : "flex",
        flexDirection: isGrid ? undefined : (layout?.direction || "column"),
        justifyContent: isGrid ? undefined : (layout?.justifyContent || "flex-start"),
        alignItems: layout?.alignItems || "stretch",
        gridTemplateColumns: isGrid ? (layout?.gridTemplateColumns || "repeat(2, minmax(0, 1fr))") : undefined,
        gridTemplateRows: isGrid ? layout?.gridTemplateRows : undefined,
        gridAutoFlow: isGrid ? layout?.gridAutoFlow : undefined,
        justifyItems: isGrid ? layout?.justifyItems : undefined,
        gap: `${layout?.gap ?? 16}px`,
        rowGap: layout?.rowGap !== undefined ? (typeof layout?.rowGap === "number" ? `${layout?.rowGap}px` : layout?.rowGap) : undefined,
        columnGap: layout?.columnGap !== undefined ? (typeof layout?.columnGap === "number" ? `${layout?.columnGap}px` : layout?.columnGap) : undefined,
        boxSizing: "border-box",
        width: stylesObj.width || "100%",
        padding: stylesObj.padding || "24px",
        marginTop: stylesObj.marginTop || "0px",
        marginBottom: stylesObj.marginBottom || "0px",
        backgroundColor: stylesObj.backgroundColor,
        borderRadius: stylesObj.borderRadius || "12px",
        border: stylesObj.borderStyle && stylesObj.borderColor ? `${stylesObj.borderWidth || "1px"} ${stylesObj.borderStyle} ${stylesObj.borderColor}` : undefined,
      };

      const childrenJSX = (el.children || [])
        .map((child) => exportElementNodeToJSX(child, { ...ctx, indent: nextIndent }))
        .join("\n");

      return `${indent}<div\n${nextIndent}style={${formatStylesToJSX(containerStyles)}}\n${nextIndent}className="${(el.classes || []).join(" ")}"\n${indent}>\n${childrenJSX || `${nextIndent}{/* Empty Container */}`}\n${indent}</div>`;
    }

    // -------------------------------------------------------------------
    // HEADING
    // -------------------------------------------------------------------
    case "heading": {
      const Tag = (el.headingLevel || "h2") as string;
      const headingStyles: Record<string, any> = {
        fontSize: stylesObj.fontSize || (el.headingLevel === "h1" ? "36px" : el.headingLevel === "h3" ? "24px" : "30px"),
        fontWeight: stylesObj.fontWeight || "800",
        color: stylesObj.color || "#0f172a",
        textAlign: stylesObj.textAlign || "left",
        lineHeight: 1.25,
        margin: "0 0 12px 0",
        fontFamily: stylesObj.fontFamily || "system-ui, -apple-system, sans-serif",
      };
      return `${indent}<${Tag} style={${formatStylesToJSX(headingStyles)}}>${el.content || "Heading Title"}</${Tag}>`;
    }

    // -------------------------------------------------------------------
    // TEXT / PARAGRAPH
    // -------------------------------------------------------------------
    case "text":
    case "paragraph": {
      const textStyles: Record<string, any> = {
        fontSize: stylesObj.fontSize || "16px",
        color: stylesObj.color || "#475569",
        textAlign: stylesObj.textAlign || "left",
        lineHeight: 1.6,
        margin: "0 0 16px 0",
        fontFamily: stylesObj.fontFamily || "system-ui, -apple-system, sans-serif",
      };
      return `${indent}<p style={${formatStylesToJSX(textStyles)}}>${el.content || ""}</p>`;
    }

    // -------------------------------------------------------------------
    // BUTTON
    // -------------------------------------------------------------------
    case "button": {
      const buttonStyles: Record<string, any> = {
        display: "inline-block",
        padding: stylesObj.padding || "12px 24px",
        backgroundColor: stylesObj.backgroundColor || "#2563eb",
        color: stylesObj.color || "#ffffff",
        fontSize: stylesObj.fontSize || "15px",
        fontWeight: stylesObj.fontWeight || "600",
        borderRadius: stylesObj.borderRadius || "8px",
        textDecoration: "none",
        border: "none",
        cursor: "pointer",
        textAlign: "center",
      };
      return `${indent}<a href="${el.href || "#"}" style={${formatStylesToJSX(buttonStyles)}}>${el.content || "Click Here"}</a>`;
    }

    // -------------------------------------------------------------------
    // IMAGE
    // -------------------------------------------------------------------
    case "image": {
      const imageStyles: Record<string, any> = {
        width: stylesObj.width || "100%",
        maxWidth: "100%",
        height: stylesObj.height || "auto",
        borderRadius: stylesObj.borderRadius || "8px",
        objectFit: stylesObj.objectFit || "cover",
        display: "block",
      };
      return `${indent}<img src="${el.src || "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80"}" alt="${el.alt || "Image"}" style={${formatStylesToJSX(imageStyles)}} />`;
    }

    // -------------------------------------------------------------------
    // VIDEO
    // -------------------------------------------------------------------
    case "video": {
      const videoSrc = el.src || "";
      if (videoSrc.includes("youtube.com") || videoSrc.includes("youtu.be")) {
        return `${indent}<div style={{ position: "relative", width: "100%", aspectRatio: "16/9", borderRadius: "12px", overflow: "hidden" }}>\n${nextIndent}<iframe src="${videoSrc}" title="Video" allowFullScreen style={{ position: "absolute", width: "100%", height: "100%", border: 0 }} />\n${indent}</div>`;
      }
      return `${indent}<video src="${videoSrc}" poster="${el.videoPoster || ""}" controls autoPlay={${Boolean(el.videoAutoplay)}} loop={${Boolean(el.videoLoop)}} muted={${Boolean(el.videoMuted)}} style={{ width: "100%", borderRadius: "12px" }}>Video not supported</video>`;
    }

    // -------------------------------------------------------------------
    // DIVIDER & SPACER
    // -------------------------------------------------------------------
    case "divider":
      return `${indent}<hr style={{ width: "100%", border: 0, borderTop: "1px solid #e2e8f0", margin: "24px 0" }} />`;
    case "spacer":
      return `${indent}<div style={{ height: "${stylesObj.height || "32px"}", width: "100%" }} />`;

    // -------------------------------------------------------------------
    // RATING
    // -------------------------------------------------------------------
    case "rating":
      return `${indent}<div style={{ display: "inline-flex", alignItems: "center", gap: "8px", color: "#f59e0b", fontSize: "18px" }}><span>★★★★★</span><span style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a" }}>5.0</span></div>`;

    // -------------------------------------------------------------------
    // PROGRESS BAR
    // -------------------------------------------------------------------
    case "progress-bar":
      return `${indent}<div style={{ width: "100%", margin: "16px 0" }}>\n${nextIndent}<div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", fontWeight: "600", marginBottom: "6px" }}><span>Progress</span><span>75%</span></div>\n${nextIndent}<div style={{ width: "100%", height: "10px", backgroundColor: "#e2e8f0", borderRadius: "999px", overflow: "hidden" }}><div style={{ width: "75%", height: "100%", backgroundColor: "#2563eb", borderRadius: "999px" }} /></div>\n${indent}</div>`;

    // -------------------------------------------------------------------
    // SOCIAL ICONS & SHARE BUTTONS
    // -------------------------------------------------------------------
    case "social-icons":
    case "share-buttons":
      return `${indent}<div style={{ display: "flex", gap: "10px", flexWrap: "wrap", margin: "16px 0" }}>\n${nextIndent}<a href="#" style={{ padding: "8px 16px", borderRadius: "8px", backgroundColor: "#1da1f2", color: "#fff", textDecoration: "none", fontSize: "13px", fontWeight: "600" }}>Twitter</a>\n${nextIndent}<a href="#" style={{ padding: "8px 16px", borderRadius: "8px", backgroundColor: "#1877f2", color: "#fff", textDecoration: "none", fontSize: "13px", fontWeight: "600" }}>Facebook</a>\n${nextIndent}<a href="#" style={{ padding: "8px 16px", borderRadius: "8px", backgroundColor: "#0077b5", color: "#fff", textDecoration: "none", fontSize: "13px", fontWeight: "600" }}>LinkedIn</a>\n${indent}</div>`;

    // -------------------------------------------------------------------
    // BLOG POSTS (Data-Driven Cards Rendering from el.posts)
    // -------------------------------------------------------------------
    case "posts": {
      const postsList = el.posts && el.posts.length > 0 ? el.posts : [
        {
          id: "post_1",
          title: "Getting Started with Modern Web Design",
          excerpt: "Discover essential techniques and best practices to craft beautiful, responsive web applications effortlessly.",
          date: "Sep 1, 2026",
          author: "Jane Doe",
          image: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&auto=format&fit=crop&q=80",
          readMoreText: "Read Article →",
          readMoreUrl: "#",
        },
        {
          id: "post_2",
          title: "Mastering Design Systems & Components",
          excerpt: "Learn how to build reusable design tokens and layout grids that scale across team workflows.",
          date: "Aug 28, 2026",
          author: "Alex Smith",
          image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80",
          readMoreText: "Read Article →",
          readMoreUrl: "#",
        },
        {
          id: "post_3",
          title: "Optimizing Web Performance & SEO",
          excerpt: "Boost site load speed and search engine rankings with modern code-splitting and asset management.",
          date: "Aug 24, 2026",
          author: "Chris Lee",
          image: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80",
          readMoreText: "Read Article →",
          readMoreUrl: "#",
        },
      ];

      const columns = el.postsColumns || 3;
      const gap = el.postsGap ?? 20;
      const imageHeight = el.postsImageHeight || "180px";
      const align = el.postsAlignment || "left";
      const showImage = el.postsShowImage !== false;
      const showDate = el.postsShowDate !== false;
      const showExcerpt = el.postsShowExcerpt !== false;
      const showReadMore = el.postsShowReadMore !== false;

      const cardsJSX = postsList.map((post) => `
${nextIndent}<article style={{ display: "flex", flexDirection: "column", borderRadius: "16px", border: "1px solid #e2e8f0", backgroundColor: "#ffffff", overflow: "hidden", boxShadow: "0 4px 10px rgba(0,0,0,0.05)", textAlign: "${align}" }}>
${showImage && post.image ? `${nextIndent}  <div style={{ height: "${imageHeight}", overflow: "hidden", backgroundColor: "#f1f5f9" }}><img src="${post.image}" alt="${post.title}" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>` : ""}
${nextIndent}  <div style={{ padding: "20px", display: "flex", flexDirection: "column", flex: 1 }}>
${showDate && (post.date || post.author) ? `${nextIndent}    <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "8px" }}>${post.date || ""}${post.date && post.author ? " • " : ""}${post.author ? `By ${post.author}` : ""}</div>` : ""}
${nextIndent}    <h3 style={{ margin: "0 0 10px 0", fontSize: "18px", fontWeight: "700", color: "#0f172a", lineHeight: 1.3 }}>${post.title}</h3>
${showExcerpt && post.excerpt ? `${nextIndent}    <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "#475569", lineHeight: 1.5, flex: 1 }}>${post.excerpt}</p>` : ""}
${showReadMore ? `${nextIndent}    <div style={{ marginTop: "auto" }}><a href="${post.readMoreUrl || "#"}" style={{ display: "inline-flex", alignItems: "center", fontSize: "13px", fontWeight: "700", color: "#2563eb", textDecoration: "none" }}>${post.readMoreText || "Read More →"}</a></div>` : ""}
${nextIndent}  </div>
${nextIndent}</article>`).join("");

      return `${indent}<div style={{ width: "100%", padding: "24px 0", boxSizing: "border-box" }}>\n${nextIndent}<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "${gap}px" }}>${cardsJSX}\n${nextIndent}</div>\n${indent}</div>`;
    }

    // -------------------------------------------------------------------
    // PORTFOLIO (Data-Driven Cards Rendering from el.portfolioItems)
    // -------------------------------------------------------------------
    case "portfolio": {
      const items = el.portfolioItems && el.portfolioItems.length > 0 ? el.portfolioItems : [
        { id: "1", title: "Brand Identity System", category: "Branding", image: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&auto=format&fit=crop&q=80", description: "Complete brand guidelines and digital design assets." },
        { id: "2", title: "Mobile SaaS Application", category: "UI/UX Design", image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80", description: "Modern analytics dashboard built for high-throughput teams." },
        { id: "3", title: "E-Commerce Experience", category: "Development", image: "https://images.unsplash.com/photo-1523726491678-bf852e717f6a?w=800&auto=format&fit=crop&q=80", description: "Fast headless commerce storefront with real-time inventory." },
      ];

      const gap = el.portfolioGap ?? 24;
      const imageHeight = el.portfolioImageHeight || "220px";

      const itemsJSX = items.map((item) => `
${nextIndent}<div style={{ borderRadius: "16px", border: "1px solid #e2e8f0", backgroundColor: "#ffffff", overflow: "hidden", boxShadow: "0 4px 10px rgba(0,0,0,0.05)" }}>
${nextIndent}  <div style={{ height: "${imageHeight}", overflow: "hidden" }}><img src="${item.image || ""}" alt="${item.title}" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>
${nextIndent}  <div style={{ padding: "20px" }}>
${nextIndent}    ${item.category ? `<span style={{ fontSize: "11px", fontWeight: "700", color: "#6366f1", textTransform: "uppercase" }}>${item.category}</span>` : ""}
${nextIndent}    <h4 style={{ margin: "6px 0 8px", fontSize: "17px", fontWeight: "700", color: "#0f172a" }}>${item.title}</h4>
${nextIndent}    ${item.description ? `<p style={{ margin: "0 0 16px", fontSize: "13px", color: "#64748b", lineHeight: 1.5 }}>${item.description}</p>` : ""}
${nextIndent}    <a href="${item.link || item.url || "#"}" style={{ fontSize: "13px", fontWeight: "700", color: "#2563eb", textDecoration: "none" }}>View Project →</a>
${nextIndent}  </div>
${nextIndent}</div>`).join("");

      return `${indent}<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "${gap}px", width: "100%", padding: "24px 0" }}>${itemsJSX}\n${indent}</div>`;
    }

    // -------------------------------------------------------------------
    // SLIDES / SLIDESHOW
    // -------------------------------------------------------------------
    case "slides": {
      const slidesList = el.slidesItems && el.slidesItems.length > 0 ? el.slidesItems : [
        { id: "slide_1", title: "Empower Your Digital Growth", description: "Build high-converting modern websites with intuitive drag and drop tools.", bgImage: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1600&auto=format&fit=crop&q=80", buttonText: "Explore Features", buttonUrl: "#" },
        { id: "slide_2", title: "Designed for High Performance", description: "Lightning-fast page load speeds, automatic SEO optimization, and flawless mobile experience.", bgImage: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1600&auto=format&fit=crop&q=80", buttonText: "Start Free Trial", buttonUrl: "#" },
      ];
      const height = el.slidesHeight || "450px";
      const align = el.slidesAlignment || "center";
      const currentSlide = slidesList[0];
      return `${indent}<div style={{ position: "relative", width: "100%", height: "${height}", overflow: "hidden", borderRadius: "16px", backgroundColor: "${currentSlide.bgColor || "#0f172a"}", backgroundImage: ${currentSlide.bgImage ? `\`url(${currentSlide.bgImage})\`` : "undefined"}, backgroundSize: "cover", backgroundPosition: "center", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "${align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start"}", textAlign: "${align}", padding: "48px", boxSizing: "border-box" }}>
${nextIndent}<div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.35))", zIndex: 1 }} />
${nextIndent}<div style={{ position: "relative", zIndex: 2, maxWidth: "700px" }}>
${nextIndent}  <h2 style={{ fontSize: "36px", fontWeight: "800", color: "#ffffff", margin: "0 0 16px 0", lineHeight: 1.2 }}>${currentSlide.title}</h2>
${currentSlide.description ? `${nextIndent}  <p style={{ fontSize: "16px", color: "#e2e8f0", margin: "0 0 24px 0", lineHeight: 1.6 }}>${currentSlide.description}</p>\n` : ""}${currentSlide.buttonText ? `${nextIndent}  <a href="${currentSlide.buttonUrl || "#"}" style={{ display: "inline-block", padding: "12px 28px", backgroundColor: "#ffffff", color: "#0f172a", fontWeight: "700", fontSize: "14px", borderRadius: "10px", textDecoration: "none" }}>${currentSlide.buttonText}</a>\n` : ""}${nextIndent}</div>
${indent}</div>`;
    }

    // -------------------------------------------------------------------
    // GALLERY
    // -------------------------------------------------------------------
    case "gallery":
    case "basic-gallery": {
      const images = el.galleryImages && el.galleryImages.length > 0 ? el.galleryImages : [
        { id: "g1", url: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80", caption: "Abstract Gradient" },
        { id: "g2", url: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&auto=format&fit=crop&q=80", caption: "Digital Innovation" },
        { id: "g3", url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80", caption: "Creative Team" },
      ];
      const cols = el.galleryColumns || 3;
      const gap = el.galleryGap ?? 16;
      const itemsJSX = images.map((img) => `
${nextIndent}<div style={{ borderRadius: "12px", overflow: "hidden", position: "relative", aspectRatio: "4/3", backgroundColor: "#f1f5f9" }}>
${nextIndent}  <img src="${img.url}" alt="${img.caption || img.altText || "Gallery Image"}" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
${img.caption ? `${nextIndent}  <div style={{ position: "absolute", bottom: 0, insetInline: 0, padding: "8px 12px", background: "rgba(0,0,0,0.6)", color: "#ffffff", fontSize: "12px" }}>${img.caption}</div>` : ""}
${nextIndent}</div>`).join("");
      return `${indent}<div style={{ display: "grid", gridTemplateColumns: "repeat(${cols}, minmax(0, 1fr))", gap: "${gap}px", width: "100%", padding: "16px 0" }}>${itemsJSX}\n${indent}</div>`;
    }

    // -------------------------------------------------------------------
    // TESTIMONIAL CAROUSEL
    // -------------------------------------------------------------------
    case "testimonial-carousel": {
      const testimonials = el.testimonialItems && el.testimonialItems.length > 0 ? el.testimonialItems : [
        { id: "t1", name: "Sarah Connor", role: "VP of Engineering", quote: "ForgeStudio allowed our team to accelerate production releases tenfold.", rating: 5 },
        { id: "t2", name: "David Miller", role: "Product Lead", quote: "The bidirectional code and visual canvas sync is a complete game changer.", rating: 5 },
      ];
      const gap = el.testimonialGap ?? 20;
      const itemsJSX = testimonials.map((item) => `
${nextIndent}<div style={{ padding: "24px", borderRadius: "16px", border: "1px solid #e2e8f0", backgroundColor: "#ffffff", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column" }}>
${nextIndent}  <div style={{ color: "#f59e0b", marginBottom: "12px" }}>${"★".repeat(item.rating || 5)}</div>
${nextIndent}  <p style={{ fontSize: "15px", color: "#334155", fontStyle: "italic", lineHeight: 1.6, flex: 1, margin: "0 0 16px 0" }}>"${item.quote}"</p>
${nextIndent}  <div>
${nextIndent}    <div style={{ fontWeight: "700", color: "#0f172a", fontSize: "14px" }}>${item.name}</div>
${nextIndent}    <div style={{ fontSize: "12px", color: "#64748b" }}>${item.role}</div>
${nextIndent}  </div>
${nextIndent}</div>`).join("");
      return `${indent}<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "${gap}px", width: "100%", padding: "16px 0" }}>${itemsJSX}\n${indent}</div>`;
    }

    // -------------------------------------------------------------------
    // MEDIA CAROUSEL
    // -------------------------------------------------------------------
    case "media-carousel":
    case "image-carousel":
    case "basic-media-carousel": {
      const items = (el.mediaCarouselItems && el.mediaCarouselItems.length > 0 ? el.mediaCarouselItems : el.imageCarouselItems) || [
        { id: "m1", imageUrl: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&auto=format&fit=crop&q=80", title: "Media 1" },
        { id: "m2", imageUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80", title: "Media 2" },
        { id: "m3", imageUrl: "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&auto=format&fit=crop&q=80", title: "Media 3" },
      ];
      const gap = el.mediaCarouselGap ?? 16;
      const itemsJSX = items.map((item) => `
${nextIndent}<div style={{ borderRadius: "12px", overflow: "hidden", aspectRatio: "16/9", backgroundColor: "#f1f5f9" }}>
${nextIndent}  <img src="${item.imageUrl || (item as any).url || ""}" alt="${item.title || "Media"}" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
${nextIndent}</div>`).join("");
      return `${indent}<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "${gap}px", width: "100%", padding: "16px 0" }}>${itemsJSX}\n${indent}</div>`;
    }

    // -------------------------------------------------------------------
    // CUSTOMER REVIEWS
    // -------------------------------------------------------------------
    case "reviews": {
      const reviews = el.reviewItems && el.reviewItems.length > 0 ? el.reviewItems : [
        { id: "r1", reviewerName: "Michael Chang", reviewerTitle: "Verified Buyer", reviewText: "Outstanding build quality and responsive design flexibility.", rating: 5 },
        { id: "r2", reviewerName: "Emma Watson", reviewerTitle: "Verified Buyer", reviewText: "Extremely intuitive and saved us hours of custom code work.", rating: 5 },
      ];
      const itemsJSX = reviews.map((item) => `
${nextIndent}<div style={{ padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", backgroundColor: "#ffffff" }}>
${nextIndent}  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
${nextIndent}    <strong style={{ fontSize: "14px", color: "#0f172a" }}>${item.reviewerName}</strong>
${nextIndent}    <span style={{ color: "#f59e0b" }}>${"★".repeat(item.rating || 5)}</span>
${nextIndent}  </div>
${nextIndent}  <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#475569", lineHeight: 1.5 }}>${item.reviewText}</p>
${nextIndent}  ${item.reviewerTitle ? `<span style={{ fontSize: "11px", color: "#10b981", fontWeight: "600" }}>✓ ${item.reviewerTitle}</span>` : ""}
${nextIndent}</div>`).join("");
      return `${indent}<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", width: "100%", padding: "16px 0" }}>${itemsJSX}\n${indent}</div>`;
    }

    // -------------------------------------------------------------------
    // PRICE LIST
    // -------------------------------------------------------------------
    case "price-list": {
      const items = el.priceListItems && el.priceListItems.length > 0 ? el.priceListItems : [
        { id: "pl1", name: "Espresso Roast", description: "Rich double shot with velvety crema", price: "$4.50" },
        { id: "pl2", name: "Artisanal Pastry", description: "Freshly baked flaky almond croissant", price: "$5.00" },
      ];
      const itemsJSX = items.map((item) => `
${nextIndent}<div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px dashed #cbd5e1", paddingBottom: "10px", marginBottom: "14px" }}>
${nextIndent}  <div>
${nextIndent}    <h4 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: "700", color: "#0f172a" }}>${item.name}</h4>
${nextIndent}    ${item.description ? `<p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>${item.description}</p>` : ""}
${nextIndent}  </div>
${nextIndent}  <span style={{ fontWeight: "700", color: "#2563eb", fontSize: "15px" }}>${item.price}</span>
${nextIndent}</div>`).join("");
      return `${indent}<div style={{ width: "100%", maxWidth: "600px", padding: "16px 0" }}>${itemsJSX}\n${indent}</div>`;
    }

    // -------------------------------------------------------------------
    // CONTACT FORM
    // -------------------------------------------------------------------
    case "form": {
      const fields = el.formFields && el.formFields.length > 0 ? el.formFields : [
        { id: "f1", type: "text" as const, label: "Full Name", placeholder: "Jane Doe", required: true },
        { id: "f2", type: "email" as const, label: "Email Address", placeholder: "jane@example.com", required: true },
        { id: "f3", type: "textarea" as const, label: "Message", placeholder: "How can we help?", required: false },
      ];
      const title = el.formTitle || "Contact Us";
      const submitText = el.formSubmitText || "Send Message";
      const fieldsJSX = fields.map((f) => `
${nextIndent}  <div style={{ marginBottom: "14px" }}>
${nextIndent}    <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#334155", marginBottom: "4px" }}>${f.label}${f.required ? " *" : ""}</label>
${nextIndent}    ${f.type === "textarea" ? `<textarea placeholder="${f.placeholder || ""}" rows={4} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }} />` : `<input type="${f.type}" placeholder="${f.placeholder || ""}" style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }} />`}
${nextIndent}  </div>`).join("");
      return `${indent}<div style={{ width: "100%", maxWidth: "520px", padding: "28px", borderRadius: "16px", border: "1px solid #e2e8f0", backgroundColor: "#ffffff", boxShadow: "0 10px 25px rgba(0,0,0,0.05)" }}>
${nextIndent}<h3 style={{ margin: "0 0 18px 0", fontSize: "20px", fontWeight: "800", color: "#0f172a" }}>${title}</h3>
${fieldsJSX}
${nextIndent}<button type="button" style={{ width: "100%", padding: "12px", borderRadius: "8px", backgroundColor: "#2563eb", color: "#ffffff", fontWeight: "700", border: "none", cursor: "pointer", fontSize: "14px" }}>${submitText}</button>
${indent}</div>`;
    }

    // -------------------------------------------------------------------
    // NAVIGATION MENU
    // -------------------------------------------------------------------
    case "nav-menu":
    case "mega-menu": {
      const items = el.navMenuItems && el.navMenuItems.length > 0 ? el.navMenuItems : [
        { id: "n1", label: "Home", url: "/" },
        { id: "n2", label: "Features", url: "/features" },
        { id: "n3", label: "Pricing", url: "/pricing" },
        { id: "n4", label: "Contact", url: "/contact" },
      ];
      const itemsJSX = items.map((it) => `
${nextIndent}<a href="${it.url || "#"}" style={{ fontSize: "14px", fontWeight: "600", color: "#334155", textDecoration: "none", padding: "8px 12px", borderRadius: "6px" }}>${it.label}</a>`).join("");
      return `${indent}<nav style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", padding: "12px 0" }}>${itemsJSX}\n${indent}</nav>`;
    }

    // -------------------------------------------------------------------
    // CALL TO ACTION
    // -------------------------------------------------------------------
    case "call-to-action": {
      const heading = el.ctaHeading || "Ready to Transform Your Workflow?";
      const desc = el.ctaDescription || "Join thousands of teams building modern high-performance web applications.";
      const btnText = el.ctaButtonText || "Get Started Today";
      const btnUrl = el.ctaButtonUrl || "#";
      return `${indent}<div style={{ width: "100%", padding: "48px", borderRadius: "20px", backgroundColor: "#1e1b4b", color: "#ffffff", textAlign: "center", boxSizing: "border-box" }}>
${nextIndent}<h2 style={{ fontSize: "32px", fontWeight: "800", margin: "0 0 12px 0", color: "#ffffff" }}>${heading}</h2>
${nextIndent}<p style={{ fontSize: "16px", color: "#c7d2fe", margin: "0 auto 28px auto", maxWidth: "600px", lineHeight: 1.6 }}>${desc}</p>
${nextIndent}<a href="${btnUrl}" style={{ display: "inline-block", padding: "14px 32px", backgroundColor: "#ffffff", color: "#1e1b4b", borderRadius: "12px", fontWeight: "700", fontSize: "15px", textDecoration: "none" }}>${btnText}</a>
${indent}</div>`;
    }

    // -------------------------------------------------------------------
    // BLOCKQUOTE
    // -------------------------------------------------------------------
    case "blockquote": {
      const quote = el.quoteContent || "Simplicity is the soul of efficiency.";
      const author = el.quoteAuthor || "Austin Freeman";
      const citation = el.quoteCitation || "";
      return `${indent}<blockquote style={{ borderLeft: "4px solid #2563eb", padding: "16px 24px", margin: "20px 0", backgroundColor: "#f8fafc", borderRadius: "0 12px 12px 0" }}>
${nextIndent}<p style={{ margin: "0 0 8px 0", fontSize: "18px", fontStyle: "italic", color: "#1e293b", lineHeight: 1.6 }}>"${quote}"</p>
${nextIndent}<footer style={{ fontSize: "13px", fontWeight: "600", color: "#64748b" }}>— ${author}${citation ? `, ${citation}` : ""}</footer>
${indent}</blockquote>`;
    }

    // -------------------------------------------------------------------
    // DEFAULT GENERIC FALLBACK
    // -------------------------------------------------------------------
    default: {
      if (el.content && el.content.trim() && el.content !== "Slideshow Section") {
        return `${indent}<div style={${formatStylesToJSX(stylesObj)}} className="${(el.classes || []).join(" ")}">\n${nextIndent}${el.content}\n${indent}</div>`;
      }
      return `${indent}<div style={${formatStylesToJSX(stylesObj)}} className="${(el.classes || []).join(" ")}">\n${nextIndent}{/* Component: ${toPascalCase(el.type)} */}\n${indent}</div>`;
    }
  }
}
