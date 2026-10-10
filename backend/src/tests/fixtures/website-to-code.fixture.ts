/**
 * Representative Visual Editor document for Website-to-Code tests.
 * Shapes mirror what the editor really saves (frontend createDefaultElement):
 * `content` labels on containers/images, longhand styles, the container `layout`
 * model, desktop/tablet/mobile responsive overrides, page-linked buttons,
 * nav-menu items and shared header/footer site parts.
 */

export const TRICKY_TEXT = `She said "it's <b>{great}</b>" & left — naïve café ✓ 日本語`;

export function buildWebsiteFixture(): any {
  return {
    version: 1,
    homePageId: "page-home",
    breakpoints: [
      { id: "desktop", name: "Desktop", minWidth: 1025 },
      { id: "tablet", name: "Tablet", minWidth: 768, maxWidth: 1024 },
      { id: "mobile", name: "Mobile", maxWidth: 767 },
    ],
    designTokens: {
      colors: { primary: "#2563eb", surface: "#ffffff" },
      spacing: { md: "16px" },
      radius: { card: "12px" },
    },
    pageCss: ".hero-title { letter-spacing: -0.02em; }",
    siteParts: {
      header: {
        enabled: true,
        elements: [
          {
            id: "site-nav",
            type: "nav-menu",
            content: "Navigation Menu",
            navLayout: "horizontal",
            navGap: 24,
            navItemColor: "#334155",
            navFontSize: "14px",
            navFontWeight: "600",
            navMenuItems: [
              { id: "1", label: "Home", url: "/" },
              { id: "2", label: "About", url: "/about", linkType: "page", pageId: "page-about" },
              { id: "3", label: "Contact", url: "/contact" },
              { id: "4", label: "Docs", url: "https://docs.example.com/guide?a=1&b=2", target: "_blank" },
            ],
          },
        ],
      },
      footer: {
        enabled: true,
        elements: [{ id: "site-footer-text", type: "text", content: "© 2026 Acme Inc. All rights reserved." }],
      },
    },
    pages: [
      {
        id: "page-home",
        name: "Home",
        slug: "home",
        isHome: true,
        elements: [
          {
            id: "hero",
            type: "container",
            content: "Container",
            layout: { direction: "column", justifyContent: "center", alignItems: "stretch", gap: 10 },
            styles: {
              width: "100%",
              backgroundColor: "#ffffff",
              paddingTop: "48px",
              paddingBottom: "48px",
              borderRadius: "12px",
              backgroundType: "classic",
            },
            responsiveStyles: {
              tablet: { paddingTop: "32px" },
              mobile: { paddingTop: "16px", paddingBottom: "16px" },
            },
            children: [
              {
                id: "hero-title",
                type: "heading",
                headingLevel: "h1",
                content: "Build faster with Acme",
                classes: ["hero-title"],
                styles: { color: "#0f172a", fontSize: "32px", fontWeight: "700", lineHeight: "1.2" },
              },
              {
                id: "hero-copy",
                type: "text",
                content: TRICKY_TEXT,
                styles: { color: "#475569", fontSize: "16px", marginTop: "12px" },
              },
              {
                id: "hero-row",
                type: "container",
                content: "Container",
                layout: { direction: "row", gap: 12 },
                // The editor also stores nested nodes under `elements`
                elements: [
                  {
                    id: "hero-cta",
                    type: "button",
                    content: "Click Me",
                    buttonText: "Read our story",
                    href: "/",
                    linkType: "page",
                    pageId: "page-about",
                    styles: { color: "#ffffff", backgroundColor: "#2563eb", padding: "10px 22px", borderRadius: "8px" },
                  },
                  {
                    id: "hero-plain-button",
                    type: "button",
                    content: "Subscribe",
                    buttonText: "Subscribe",
                    href: "",
                  },
                ],
              },
              {
                id: "hero-image",
                type: "image",
                content: "Image",
                src: "https://images.unsplash.com/photo-1551434678-e076c223a692",
                alt: 'Team "at work" <2026>',
                styles: { width: "100%", height: "auto", borderRadius: "8px", objectFit: "cover", opacity: 1 },
              },
            ],
          },
        ],
      },
      {
        id: "page-about",
        name: "About Us",
        slug: "about",
        pageSettings: { metaDescription: "Who we are and what we're building" },
        elements: [
          {
            id: "about-wrap",
            type: "container",
            content: "Container",
            children: [
              { id: "about-title", type: "heading", headingLevel: "h2", content: "Our Story & Vision" },
              {
                id: "about-inner",
                type: "div-block",
                content: "Div",
                children: [
                  {
                    id: "about-deep",
                    type: "container",
                    content: "Container",
                    children: [{ id: "about-deep-text", type: "paragraph", content: "Three levels deep and still here." }],
                  },
                ],
              },
              { id: "about-divider", type: "divider", content: "Divider" },
              { id: "about-no-src", type: "image", content: "Image", src: "", alt: "Missing" },
              { id: "about-slides", type: "slides", content: "Slides", slidesItems: [{ id: "s1", title: "Slide" }] },
            ],
          },
        ],
      },
      {
        id: "page-contact",
        name: "Contact",
        path: "/Contact Us/",
        elements: [
          { id: "contact-title", type: "heading", headingLevel: "h2", content: "Send Us a Message" },
          { id: "contact-mail", type: "button", content: "Email", buttonText: "Email us", href: "mailto:hello@example.com" },
          { id: "contact-evil", type: "button", content: "X", buttonText: "Do not click", href: "javascript:alert(document.cookie)" },
        ],
      },
    ],
  };
}

/** Recursively collect the visible text of every text-bearing leaf in the fixture's pages */
export const EXPECTED_PAGE_TEXT: Record<string, string[]> = {
  home: ["Build faster with Acme", "Read our story", "Subscribe"],
  about: ["Our Story &amp; Vision", "Three levels deep and still here."],
  contact: ["Send Us a Message", "Email us", "Do not click"],
};
