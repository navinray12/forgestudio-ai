/**
 * Code exporter: content. Moved verbatim from codeExporter.ts, which re-exports the public API.
 */
import type { EditorElement } from "../../../types";
import { toPascalCase, getMergedStyles } from "../styles";
import { exportElementNodeToJSX } from "../jsx-tree";

// =========================================================================
// STANDALONE COMPONENT WRAPPERS FOR DIRECT TOP-LEVEL DEV-MODE EXPORT
// =========================================================================

/**
 * Generates interactive Animated Headline component
 */
export function generateAnimatedHeadlineComponent(el: EditorElement, isTsx = false): string {
  const compName = toPascalCase(el.type || "animated-headline");
  const prefix = el.headlinePrefix ?? "Build Websites That Are";
  const words = el.headlineAnimatedTexts && el.headlineAnimatedTexts.length > 0
    ? el.headlineAnimatedTexts
    : ["Stunning", "Blazing Fast", "Ultra Flexible", "Powerful"];
  const suffix = el.headlineSuffix ?? "With ForgeStudio";
  const animType = el.headlineAnimationType || "typing";
  const speed = el.headlineAnimationSpeed || 2500;
  const highlightColor = el.headlineHighlightColor || "#2563eb";
  const highlightBg = el.headlineHighlightBg || "rgba(239, 246, 255, 1)";
  const tag = el.headlineTag || "h2";
  const stylesObj = getMergedStyles(el, "desktop", "normal");

  const tsInterface = isTsx
    ? `export interface ${compName}Props {
  prefix?: string;
  words?: string[];
  suffix?: string;
  animationType?: "typing" | "fade" | "slide-up" | "zoom" | "flip" | "highlight";
  speed?: number;
  highlightColor?: string;
  highlightBg?: string;
  tag?: "h1" | "h2" | "h3" | "h4" | "p";
  className?: string;
  style?: React.CSSProperties;
}\n\n`
    : "";

  return `// ${compName}.${isTsx ? "tsx" : "jsx"} - Interactive Animated Headline
import React, { useState, useEffect } from 'react';

${tsInterface}export default function ${compName}(${isTsx ? `props: ${compName}Props` : "props"}) {
  const {
    prefix = ${JSON.stringify(prefix)},
    words = ${JSON.stringify(words)},
    suffix = ${JSON.stringify(suffix)},
    animationType = ${JSON.stringify(animType)},
    speed = ${speed},
    highlightColor = ${JSON.stringify(highlightColor)},
    highlightBg = ${JSON.stringify(highlightBg)},
    tag = ${JSON.stringify(tag)},
    className = "",
    style = {},
    ...rest
  } = props;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [animateState, setAnimateState] = useState(true);

  // Typewriter effect logic
  useEffect(() => {
    if (animationType !== "typing") return;

    const currentFullWord = words[currentIndex % words.length];
    let timer;

    if (!isDeleting && displayText === currentFullWord) {
      timer = setTimeout(() => setIsDeleting(true), speed * 0.6);
    } else if (isDeleting && displayText === "") {
      setIsDeleting(false);
      setCurrentIndex((prev) => (prev + 1) % words.length);
    } else {
      const typeSpeed = isDeleting ? 40 : 80;
      timer = setTimeout(() => {
        setDisplayText((prev) =>
          isDeleting
            ? currentFullWord.substring(0, prev.length - 1)
            : currentFullWord.substring(0, prev.length + 1)
        );
      }, typeSpeed);
    }

    return () => clearTimeout(timer);
  }, [displayText, isDeleting, currentIndex, words, animationType, speed]);

  // Non-typing word switching timer
  useEffect(() => {
    if (animationType === "typing") return;

    const interval = setInterval(() => {
      setAnimateState(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % words.length);
        setAnimateState(true);
      }, 250);
    }, speed);

    return () => clearInterval(interval);
  }, [words, animationType, speed]);

  const currentWord = words[currentIndex % words.length];

  let animStyles = {};
  if (animationType === "fade") {
    animStyles = { opacity: animateState ? 1 : 0, transform: animateState ? "scale(1)" : "scale(0.98)" };
  } else if (animationType === "slide-up") {
    animStyles = { opacity: animateState ? 1 : 0, transform: animateState ? "translateY(0px)" : "translateY(12px)" };
  } else if (animationType === "zoom") {
    animStyles = { opacity: animateState ? 1 : 0, transform: animateState ? "scale(1)" : "scale(0.75)" };
  } else if (animationType === "flip") {
    animStyles = { opacity: animateState ? 1 : 0, transform: animateState ? "rotateX(0deg)" : "rotateX(90deg)", transformOrigin: "center center" };
  } else if (animationType === "highlight") {
    animStyles = { backgroundColor: highlightBg, color: highlightColor, borderRadius: "0.5rem", padding: "0.25rem 0.5rem" };
  }

  const Tag = tag;

  const containerStyle = {
    width: "100%",
    fontSize: ${JSON.stringify(stylesObj.fontSize || "36px")},
    fontWeight: ${JSON.stringify(stylesObj.fontWeight || "800")},
    color: ${JSON.stringify(stylesObj.color || "#0f172a")},
    textAlign: ${JSON.stringify(stylesObj.textAlign || "center")},
    marginTop: "20px",
    marginBottom: "20px",
    padding: "12px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    lineHeight: 1.25,
    wordBreak: "break-word",
    ...style,
  };

  return (
    <Tag className={className} style={containerStyle} {...rest}>
      {prefix && <span style={{ marginRight: "0.5rem" }}>{prefix}</span>}

      {animationType === "typing" ? (
        <span
          style={{
            display: "inline-block",
            borderRadius: "6px",
            padding: "2px 8px",
            color: highlightColor,
            backgroundColor: highlightBg,
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          }}
        >
          {displayText}
          <span style={{ marginLeft: "2px", opacity: 0.8, fontFamily: "monospace" }}>|</span>
        </span>
      ) : (
        <span
          style={{
            display: "inline-block",
            transition: "all 0.3s ease",
            color: animationType !== "highlight" ? highlightColor : undefined,
            ...animStyles,
          }}
        >
          {currentWord}
        </span>
      )}

      {suffix && <span style={{ marginLeft: "0.5rem" }}>{suffix}</span>}
    </Tag>
  );
}
`;
}

/**
 * Generates standalone Blog Posts component
 */
export function generateBlogPostsComponent(el: EditorElement, isTsx = false): string {
  const compName = toPascalCase(el.type || "posts");
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

  const tsInterface = isTsx
    ? `export interface PostItem {
  id: string;
  title: string;
  excerpt: string;
  date?: string;
  author?: string;
  image?: string;
  category?: string;
  link?: string;
  readMoreText?: string;
  readMoreUrl?: string;
}

export interface ${compName}Props {
  posts?: PostItem[];
  columns?: number;
  gap?: number;
  imageHeight?: string;
  showImage?: boolean;
  showDate?: boolean;
  showExcerpt?: boolean;
  showReadMore?: boolean;
  alignment?: "left" | "center" | "right";
  className?: string;
  style?: React.CSSProperties;
}\n\n`
    : "";

  return `// ${compName}.${isTsx ? "tsx" : "jsx"} - Standalone Blog Posts Grid
import React from 'react';

${tsInterface}export default function ${compName}(${isTsx ? `props: ${compName}Props` : "props"}) {
  const {
    posts = ${JSON.stringify(postsList, null, 2)},
    columns = ${columns},
    gap = ${gap},
    imageHeight = "${imageHeight}",
    showImage = ${showImage},
    showDate = ${showDate},
    showExcerpt = ${showExcerpt},
    showReadMore = ${showReadMore},
    alignment = "${align}",
    className = "",
    style = {},
    ...rest
  } = props;

  return (
    <div
      className={className}
      style={{
        width: "100%",
        padding: "24px 0",
        boxSizing: "border-box",
        fontFamily: "system-ui, -apple-system, sans-serif",
        ...style,
      }}
      {...rest}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: \`repeat(auto-fit, minmax(280px, 1fr))\`,
          gap: \`\${gap}px\`,
        }}
      >
        {posts.map((post) => (
          <article
            key={post.id}
            style={{
              display: "flex",
              flexDirection: "column",
              borderRadius: "16px",
              border: "1px solid #e2e8f0",
              backgroundColor: "#ffffff",
              overflow: "hidden",
              boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
              textAlign: alignment,
            }}
          >
            {showImage && post.image && (
              <div style={{ height: imageHeight, overflow: "hidden", backgroundColor: "#f1f5f9" }}>
                <img
                  src={post.image}
                  alt={post.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            )}
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", flex: 1 }}>
              {post.category && (
                <div style={{ marginBottom: "8px" }}>
                  <span style={{ display: "inline-block", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", color: "#2563eb", backgroundColor: "#eff6ff", padding: "3px 8px", borderRadius: "9999px" }}>
                    {post.category}
                  </span>
                </div>
              )}
              {showDate && (post.date || post.author) && (
                <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "8px" }}>
                  {post.date}
                  {post.date && post.author && " • "}
                  {post.author && \`By \${post.author}\`}
                </div>
              )}
              <h3 style={{ margin: "0 0 10px 0", fontSize: "18px", fontWeight: "700", color: "#0f172a", lineHeight: 1.3 }}>
                {post.title}
              </h3>
              {showExcerpt && post.excerpt && (
                <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "#475569", lineHeight: 1.5, flex: 1 }}>
                  {post.excerpt}
                </p>
              )}
              {showReadMore && (
                <div style={{ marginTop: "auto" }}>
                  <a
                    href={post.readMoreUrl || post.link || "#"}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      fontSize: "13px",
                      fontWeight: "700",
                      color: "#2563eb",
                      textDecoration: "none",
                    }}
                  >
                    {post.readMoreText || "Read More →"}
                  </a>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
`;
}

/**
 * Generates standalone Code Highlight component
 */
export function generateCodeHighlightComponent(el: EditorElement, isTsx = false): string {
  const compName = toPascalCase(el.type || "code-highlight");
  const code = el.codeSnippet || `// Welcome to ForgeStudio Code Highlight\nfunction greet(name: string): string {\n  return \`Hello, \${name}!\`;\n}\n\nconsole.log(greet("Developer"));`;
  const language = el.codeLanguage || "typescript";
  const showLineNumbers = el.codeShowLineNumbers ?? true;
  const theme = el.codeTheme || "dark";
  const fontSize = el.codeFontSize || "14px";

  const tsInterface = isTsx
    ? `export interface ${compName}Props {
  code?: string;
  language?: string;
  showLineNumbers?: boolean;
  theme?: "dark" | "light" | "dracula" | "github";
  fontSize?: string;
  className?: string;
  style?: React.CSSProperties;
}\n\n`
    : "";

  return `// ${compName}.${isTsx ? "tsx" : "jsx"} - Code Highlight Box
import React, { useState } from 'react';

${tsInterface}export default function ${compName}(${isTsx ? `props: ${compName}Props` : "props"}) {
  const {
    code = ${JSON.stringify(code)},
    language = ${JSON.stringify(language)},
    showLineNumbers = ${showLineNumbers},
    theme = ${JSON.stringify(theme)},
    fontSize = ${JSON.stringify(fontSize)},
    className = "",
    style = {},
    ...rest
  } = props;

  const [copied, setCopied] = useState(false);
  const lines = code.split("\\n");

  const themeBg = theme === "light" ? "#f8fafc" : theme === "dracula" ? "#282a36" : "#0f172a";
  const themeText = theme === "light" ? "#0f172a" : "#f8fafc";
  const themeBorder = theme === "light" ? "#e2e8f0" : "#334155";

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={className}
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        padding: "16px 0",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        ...style,
      }}
      {...rest}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "800px",
          borderRadius: "16px",
          border: \`1px solid \${themeBorder}\`,
          backgroundColor: themeBg,
          color: themeText,
          overflow: "hidden",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.25)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px",
            borderBottom: \`1px solid \${themeBorder}\`,
            backgroundColor: "rgba(0, 0, 0, 0.2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#ef4444", display: "inline-block" }} />
            <span style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#f59e0b", display: "inline-block" }} />
            <span style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#10b981", display: "inline-block" }} />
            <span style={{ marginLeft: "8px", fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.75 }}>
              {language}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 10px",
              fontSize: "12px",
              fontWeight: 500,
              borderRadius: "6px",
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            {copied ? "✓ Copied!" : "📋 Copy"}
          </button>
        </div>

        <div style={{ padding: "16px", overflowX: "auto", fontSize }}>
          <pre style={{ margin: 0, lineHeight: 1.6, fontFamily: "inherit" }}>
            {lines.map((line, idx) => (
              <div key={idx} style={{ display: "flex" }}>
                {showLineNumbers && (
                  <span
                    style={{
                      userSelect: "none",
                      width: "36px",
                      marginRight: "16px",
                      textAlign: "right",
                      opacity: 0.35,
                      fontSize: "0.85em",
                    }}
                  >
                    {idx + 1}
                  </span>
                )}
                <span style={{ whiteSpace: "pre" }}>{line || " "}</span>
              </div>
            ))}
          </pre>
        </div>
      </div>
    </div>
  );
}
`;
}

/**
 * Generates standalone Call To Action component
 */
export function generateCTAComponent(el: EditorElement, isTsx = false): string {
  const compName = toPascalCase(el.type || "call-to-action");
  const heading = el.ctaHeading || "Ready to Transform Your Workflow?";
  const desc = el.ctaDescription || "Join thousands of teams building modern high-performance web applications.";
  const btnText = el.ctaButtonText || "Get Started Today";
  const btnUrl = el.ctaButtonUrl || "#";

  const tsInterface = isTsx
    ? `export interface ${compName}Props {
  heading?: string;
  description?: string;
  buttonText?: string;
  buttonUrl?: string;
  className?: string;
  style?: React.CSSProperties;
}\n\n`
    : "";

  return `// ${compName}.${isTsx ? "tsx" : "jsx"} - Call To Action
import React from 'react';

${tsInterface}export default function ${compName}(${isTsx ? `props: ${compName}Props` : "props"}) {
  const {
    heading = ${JSON.stringify(heading)},
    description = ${JSON.stringify(desc)},
    buttonText = ${JSON.stringify(btnText)},
    buttonUrl = ${JSON.stringify(btnUrl)},
    className = "",
    style = {},
    ...rest
  } = props;

  return (
    <div className={className} style={{ width: "100%", padding: "56px 32px", borderRadius: "20px", backgroundColor: "#1e1b4b", color: "#ffffff", textAlign: "center", boxSizing: "border-box", ...style }} {...rest}>
      <h2 style={{ fontSize: "36px", fontWeight: "800", margin: "0 0 16px 0", color: "#ffffff" }}>{heading}</h2>
      <p style={{ fontSize: "17px", color: "#c7d2fe", margin: "0 auto 32px auto", maxWidth: "620px", lineHeight: 1.6 }}>{description}</p>
      <a href={buttonUrl} style={{ display: "inline-block", padding: "14px 36px", backgroundColor: "#ffffff", color: "#1e1b4b", borderRadius: "12px", fontWeight: "700", fontSize: "15px", textDecoration: "none" }}>
        {buttonText}
      </a>
    </div>
  );
}
`;
}

/**
 * Generates standalone Blockquote component
 */
export function generateBlockquoteComponent(el: EditorElement, isTsx = false): string {
  const compName = toPascalCase(el.type || "blockquote");
  const quote = el.quoteContent || "Simplicity is the soul of efficiency.";
  const author = el.quoteAuthor || "Austin Freeman";
  const citation = el.quoteCitation || "";

  const tsInterface = isTsx
    ? `export interface ${compName}Props {
  quote?: string;
  author?: string;
  citation?: string;
  className?: string;
  style?: React.CSSProperties;
}\n\n`
    : "";

  return `// ${compName}.${isTsx ? "tsx" : "jsx"} - Blockquote
import React from 'react';

${tsInterface}export default function ${compName}(${isTsx ? `props: ${compName}Props` : "props"}) {
  const {
    quote = ${JSON.stringify(quote)},
    author = ${JSON.stringify(author)},
    citation = ${JSON.stringify(citation)},
    className = "",
    style = {},
    ...rest
  } = props;

  return (
    <blockquote className={className} style={{ borderLeft: "4px solid #2563eb", padding: "20px 28px", margin: "24px 0", backgroundColor: "#f8fafc", borderRadius: "0 14px 14px 0", ...style }} {...rest}>
      <p style={{ margin: "0 0 10px 0", fontSize: "19px", fontStyle: "italic", color: "#1e293b", lineHeight: 1.6 }}>
        "{quote}"
      </p>
      <footer style={{ fontSize: "14px", fontWeight: "600", color: "#64748b" }}>
        — {author}{citation ? \`, \${citation}\` : ""}
      </footer>
    </blockquote>
  );
}
`;
}

/**
 * Master React JSX/TSX Generator for any element
 */
export function generateGenericComponent(el: EditorElement, isTsx = false): string {
  const compName = toPascalCase(el.type);
  const innerJSX = exportElementNodeToJSX(el, { isTsx, indent: "    " });

  const tsInterface = isTsx
    ? `export interface ${compName}Props {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}\n\n`
    : "";

  return `// ${compName}.${isTsx ? "tsx" : "jsx"} - Standalone Component
import React from 'react';

${tsInterface}export default function ${compName}(${isTsx ? `props: ${compName}Props` : "props"}) {
  const { className = "", style = {}, children, ...rest } = props;

  return (
${innerJSX}
  );
}
`;
}
