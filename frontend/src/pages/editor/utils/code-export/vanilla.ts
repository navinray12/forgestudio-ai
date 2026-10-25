/**
 * Code exporter: vanilla. Moved verbatim from codeExporter.ts, which re-exports the public API.
 */
import type { EditorElement } from "../../types";
import { toPascalCase, getMergedStyles, formatStylesToCSS } from "./styles";

/**
 * 3. Generate Vanilla JavaScript (.js)
 * Must be pure DOM JavaScript, NO JSX syntax!
 */
export function generateJSCode(el: EditorElement): string {
  if (!el) return "// No element selected";
  const compName = toPascalCase(el.type);

  if (el.type === "slides") {
    const slidesList = el.slidesItems && el.slidesItems.length > 0 ? el.slidesItems : [
      { id: "slide_1", title: "Empower Your Digital Growth", description: "Build high-converting modern websites with intuitive drag and drop tools.", bgImage: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1600&auto=format&fit=crop&q=80", buttonText: "Explore Features", buttonUrl: "#" },
      { id: "slide_2", title: "Designed for High Performance", description: "Lightning-fast page load speeds, automatic SEO optimization, and flawless mobile experience.", bgImage: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1600&auto=format&fit=crop&q=80", buttonText: "Start Free Trial", buttonUrl: "#" },
    ];
    const height = el.slidesHeight || "450px";

    return `// ${compName}.js - Vanilla JavaScript DOM Slideshow
export function render${compName}(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const wrap = document.createElement("div");
  wrap.style.cssText = "position: relative; width: 100%; height: ${height}; overflow: hidden; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); font-family: system-ui, sans-serif;";

  const slides = ${JSON.stringify(slidesList, null, 2)};
  let currentIdx = 0;
  const slideEls = [];

  slides.forEach((slide, idx) => {
    const s = document.createElement("div");
    s.style.cssText = "position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; padding: 48px; box-sizing: border-box; transition: all 0.7s cubic-bezier(0.4, 0, 0.2, 1); background-size: cover; background-position: center; " + (idx === 0 ? "opacity: 1; pointer-events: auto;" : "opacity: 0; pointer-events: none;");
    if (slide.bgImage) s.style.backgroundImage = "url(" + slide.bgImage + ")";
    if (slide.bgColor) s.style.backgroundColor = slide.bgColor;

    const overlay = document.createElement("div");
    overlay.style.cssText = "position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.35)); z-index: 1;";
    s.appendChild(overlay);

    const content = document.createElement("div");
    content.style.cssText = "position: relative; z-index: 2; max-width: 700px;";

    const h2 = document.createElement("h2");
    h2.textContent = slide.title;
    h2.style.cssText = "font-size: 36px; font-weight: 800; color: #fff; margin: 0 0 16px 0; line-height: 1.2;";
    content.appendChild(h2);

    if (slide.description) {
      const p = document.createElement("p");
      p.textContent = slide.description;
      p.style.cssText = "font-size: 16px; color: #e2e8f0; margin: 0 0 24px 0; line-height: 1.6;";
      content.appendChild(p);
    }

    if (slide.buttonText) {
      const btn = document.createElement("a");
      btn.textContent = slide.buttonText + " →";
      btn.href = slide.buttonUrl || "#";
      btn.style.cssText = "display: inline-block; padding: 12px 28px; background-color: #fff; color: #0f172a; border-radius: 10px; font-weight: 700; text-decoration: none;";
      content.appendChild(btn);
    }

    s.appendChild(content);
    wrap.appendChild(s);
    slideEls.push(s);
  });

  container.appendChild(wrap);

  if (slides.length > 1) {
    setInterval(() => {
      slideEls[currentIdx].style.opacity = "0";
      slideEls[currentIdx].style.pointerEvents = "none";
      currentIdx = (currentIdx + 1) % slides.length;
      slideEls[currentIdx].style.opacity = "1";
      slideEls[currentIdx].style.pointerEvents = "auto";
    }, 4000);
  }
}
`;
  }

  if (el.type === "posts") {
    const postsList = el.posts && el.posts.length > 0 ? el.posts : [
      {
        id: "post_1",
        title: "Getting Started with Modern Web Design",
        excerpt: "Discover essential techniques and best practices to craft beautiful, responsive web applications effortlessly.",
        date: "Sep 1, 2026",
        author: "Jane Doe",
        image: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&auto=format&fit=crop&q=80",
      },
      {
        id: "post_2",
        title: "Mastering Design Systems & Components",
        excerpt: "Learn how to build reusable design tokens and layout grids that scale across team workflows.",
        date: "Aug 28, 2026",
        author: "Alex Smith",
        image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80",
      }
    ];

    return `// ${compName}.js - Vanilla JavaScript DOM Component
export function render${compName}(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const grid = document.createElement("div");
  grid.style.cssText = "display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; width: 100%; box-sizing: border-box; font-family: system-ui, sans-serif;";

  const posts = ${JSON.stringify(postsList, null, 2)};

  posts.forEach((post) => {
    const card = document.createElement("article");
    card.style.cssText = "display: flex; flex-direction: column; border-radius: 16px; border: 1px solid #e2e8f0; background: #fff; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);";

    if (post.image) {
      const imgWrap = document.createElement("div");
      imgWrap.style.cssText = "height: 180px; overflow: hidden;";
      const img = document.createElement("img");
      img.src = post.image;
      img.alt = post.title;
      img.style.cssText = "width: 100%; height: 100%; object-fit: cover;";
      imgWrap.appendChild(img);
      card.appendChild(imgWrap);
    }

    const body = document.createElement("div");
    body.style.cssText = "padding: 20px; display: flex; flex-direction: column; flex: 1;";

    const title = document.createElement("h3");
    title.textContent = post.title;
    title.style.cssText = "margin: 0 0 10px 0; font-size: 18px; font-weight: 700; color: #0f172a;";
    body.appendChild(title);

    if (post.excerpt) {
      const p = document.createElement("p");
      p.textContent = post.excerpt;
      p.style.cssText = "margin: 0 0 16px 0; font-size: 14px; color: #475569; line-height: 1.5; flex: 1;";
      body.appendChild(p);
    }

    card.appendChild(body);
    grid.appendChild(card);
  });

  container.appendChild(grid);
}
`;
  }

  if (el.type === "animated-headline") {
    const prefix = el.headlinePrefix ?? "Build Websites That Are";
    const words = el.headlineAnimatedTexts && el.headlineAnimatedTexts.length > 0
      ? el.headlineAnimatedTexts
      : ["Stunning", "Blazing Fast", "Ultra Flexible", "Powerful"];
    const suffix = el.headlineSuffix ?? "With ForgeStudio";
    const highlightColor = el.headlineHighlightColor || "#2563eb";
    const highlightBg = el.headlineHighlightBg || "rgba(239, 246, 255, 1)";

    return `// ${compName}.js - Vanilla JavaScript Animated Headline
export function render${compName}(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const wrap = document.createElement("div");
  wrap.style.cssText = "width: 100%; text-align: center; font-size: 32px; font-weight: 800; color: #0f172a; margin: 20px 0; font-family: system-ui, sans-serif;";

  const prefixSpan = document.createElement("span");
  prefixSpan.textContent = ${JSON.stringify(prefix + " ")};

  const badge = document.createElement("span");
  badge.style.cssText = "display: inline-block; border-radius: 6px; padding: 2px 8px; color: ${highlightColor}; background-color: ${highlightBg};";

  const suffixSpan = document.createElement("span");
  suffixSpan.textContent = ${JSON.stringify(" " + suffix)};

  wrap.appendChild(prefixSpan);
  wrap.appendChild(badge);
  wrap.appendChild(suffixSpan);
  container.appendChild(wrap);

  const words = ${JSON.stringify(words)};
  let wordIdx = 0;
  let charIdx = 0;
  let isDeleting = false;

  function type() {
    const currentWord = words[wordIdx % words.length];
    if (isDeleting) {
      badge.textContent = currentWord.substring(0, charIdx - 1) + "|";
      charIdx--;
      if (charIdx === 0) {
        isDeleting = false;
        wordIdx++;
        setTimeout(type, 300);
        return;
      }
    } else {
      badge.textContent = currentWord.substring(0, charIdx + 1) + "|";
      charIdx++;
      if (charIdx === currentWord.length) {
        isDeleting = true;
        setTimeout(type, 1800);
        return;
      }
    }
    setTimeout(type, isDeleting ? 40 : 80);
  }
  type();
}
`;
  }

  // Generic Vanilla JS DOM renderer
  const tag = el.type === "button" ? "button" : el.type === "heading" ? (el.headingLevel || "h2") : el.type === "image" ? "img" : "div";
  const stylesObj = getMergedStyles(el, "desktop", "normal");

  return `// ${compName}.js - Vanilla JavaScript DOM Component
export function render${compName}(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const element = document.createElement("${tag}");
  ${el.customId ? `element.id = "${el.customId}";` : ""}
  ${el.classes && el.classes.length > 0 ? `element.className = "${el.classes.join(" ")}";` : ""}
  element.style.cssText = "${formatStylesToCSS(stylesObj)}";

  ${el.content ? `element.textContent = ${JSON.stringify(el.content)};` : ""}
  ${el.src ? `element.setAttribute("src", ${JSON.stringify(el.src)});` : ""}
  ${el.href ? `element.setAttribute("href", ${JSON.stringify(el.href)});` : ""}

  container.appendChild(element);
}
`;
}

/**
 * 4. Generate Type-Safe TypeScript (.ts)
 * Must be pure TypeScript DOM class, NO JSX syntax!
 */
export function generateTSCode(el: EditorElement): string {
  if (!el) return "// No element selected";
  const compName = toPascalCase(el.type);
  const stylesObj = getMergedStyles(el, "desktop", "normal");
  const tag = el.type === "button" ? "button" : el.type === "heading" ? (el.headingLevel || "h2") : el.type === "image" ? "img" : "div";

  return `// ${compName}.ts - Type-Safe DOM Component Generator
export interface ${compName}Props {
  id?: string;
  className?: string;
  content?: string;
  src?: string;
  href?: string;
  styles?: Partial<CSSStyleDeclaration>;
}

export class ${compName}Component {
  private props: ${compName}Props;

  constructor(props: ${compName}Props = {}) {
    this.props = {
      id: ${JSON.stringify(el.customId || "")},
      className: ${JSON.stringify((el.classes || []).join(" "))},
      content: ${JSON.stringify(el.content || "")},
      src: ${JSON.stringify(el.src || "")},
      href: ${JSON.stringify(el.href || "")},
      ...props
    };
  }

  public render(target: HTMLElement): HTMLElement {
    const el = document.createElement("${tag}");
    if (this.props.id) el.id = this.props.id;
    if (this.props.className) el.className = this.props.className;
    el.style.cssText = "${formatStylesToCSS(stylesObj)}";

    if (this.props.content) el.textContent = this.props.content;
    if (this.props.src) el.setAttribute("src", this.props.src);
    if (this.props.href) el.setAttribute("href", this.props.href);

    target.appendChild(el);
    return el;
  }
}
`;
}
