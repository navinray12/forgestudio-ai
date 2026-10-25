import type { StaticElementContext } from "../elementContext.js";
import { escapeHtml } from "../htmlSafety.js";

// Dynamic content: loop grid.
// Each function is one case of renderElementToHtml (staticHtml/renderElement.ts), moved verbatim from
// staticCompiler.ts.

// case "loop-grid"
export function renderLoopGridElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const defaultPosts = [
    { title: "Design Systems in 2026", excerpt: "How to build modular scalable component libraries.", category: "Design", date: "Jan 15, 2026", slug: "design-systems-2026", featuredImage: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80" },
    { title: "Next-Gen CSS Architecture", excerpt: "Mastering subgrid, container queries, and native nesting.", category: "Architecture", date: "Jan 22, 2026", slug: "next-gen-css", featuredImage: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&auto=format&fit=crop&q=80" },
    { title: "Modern Headless WordPress", excerpt: "Decoupled frontends with lightning fast response times.", category: "Development", date: "Feb 02, 2026", slug: "headless-wordpress", featuredImage: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=80" },
  ];
  const posts = Array.isArray(el.posts) && el.posts.length > 0 ? el.posts : defaultPosts;
  const cols = Math.min(Math.max(el.loopColumns || 3, 1), 6);
  const gap = el.loopGap ?? 24;
  const limit = el.queryLimit || 6;
  const displayPosts = posts.slice(0, limit);

  const cardsHtml = displayPosts.map((post: any, idx: number) => {
    const isAlternate = idx % 2 === 1 && !!el.alternateTemplateId;
    const altClass = isAlternate ? " fs-loop-card-alt" : "";
    const title = escapeHtml(post.title || "Untitled");
    const excerpt = escapeHtml(post.excerpt || "");
    const img = post.featuredImage ? `<img src="${escapeHtml(post.featuredImage)}" alt="${title}" class="fs-loop-card-img" loading="lazy" />` : "";
    const category = post.category ? `<span class="fs-loop-card-cat">${escapeHtml(post.category)}</span>` : "";
    const date = post.date ? `<span class="fs-loop-card-date">${escapeHtml(post.date)}</span>` : "";
    const slug = post.slug || "#";
    return `
        <article class="fs-loop-card${altClass}" data-loop-item-index="${idx}" data-modulo="${idx % 2}" data-alternate="${isAlternate ? "true" : "false"}">
          ${img ? `<div class="fs-loop-card-media">${img}${category}</div>` : ""}
          <div class="fs-loop-card-body">
            ${date}
            <h3 class="fs-loop-card-title"><a href="/${escapeHtml(slug)}">${title}</a></h3>
            ${excerpt ? `<p class="fs-loop-card-excerpt">${excerpt}</p>` : ""}
            <a href="/${escapeHtml(slug)}" class="fs-loop-card-link">Read Article →</a>
          </div>
        </article>`;
  }).join("\n");

  const gridStyle = `display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:${gap}px;`;
  return `<div class="fs-loop-grid"${idAttr}${classAttr} style="${gridStyle}${styleAttr ? styleAttr.replace(/^\\s*style="/, "").replace(/"$/, "") : ""}">\n${cardsHtml}\n</div>`;
}
