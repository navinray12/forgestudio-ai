/**
 * loopGrid. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState, useEffect } from "react";
import { type EditorElement, type ElementStyles, type DeviceMode, type PageConfig, resolveDynamicTokens } from "../../types";
import { resolveImageUrl } from "../../utils";

// ==========================================================
// F-248, F-250, F-254: Loop Grid & Query Engine Widget Renderer
// ==========================================================

export const DEFAULT_LOOP_ITEMS = [
  {
    id: "post-1",
    title: "The Future of Headless Architecture & Design Systems",
    slug: "future-of-headless-architecture",
    excerpt: "Explore how composable frontend architectures and modern design systems empower agile product teams to ship faster.",
    date: "Sep 24, 2026",
    author: "Elena Rostova",
    featuredImage: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&auto=format&fit=crop&q=80",
    category: "Architecture",
    categorySlug: "architecture",
    tags: ["tech", "cloud", "headless"],
    postType: "post",
  },
  {
    id: "post-2",
    title: "Mastering Atomic Loops & Composable Query Engines",
    slug: "mastering-atomic-loops-query-engines",
    excerpt: "A deep dive into declarative dynamic token bindings, responsive grid compilation, and client-side taxonomy filtering.",
    date: "Sep 20, 2026",
    author: "Marcus Vance",
    featuredImage: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80",
    category: "Development",
    categorySlug: "development",
    tags: ["design-systems", "tech", "react"],
    postType: "post",
  },
  {
    id: "post-3",
    title: "Scaling Multi-Tenant Headless WordPress Deployments",
    slug: "scaling-multitenant-wordpress",
    excerpt: "Best practices for enterprise ACF fields synchronization, high-concurrency multisite REST endpoints, and edge caching.",
    date: "Sep 15, 2026",
    author: "Sophia Chen",
    featuredImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80",
    category: "WordPress",
    categorySlug: "wordpress",
    tags: ["wordpress", "cms", "multisite"],
    postType: "post",
  },
  {
    id: "post-4",
    title: "Design Tokens in Production: Bridging Figma and Code",
    slug: "design-tokens-in-production",
    excerpt: "How automated pipeline syncing transforms color, typography, and spacing variables directly into reusable CSS primitives.",
    date: "Sep 10, 2026",
    author: "David Miller",
    featuredImage: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80",
    category: "Design",
    categorySlug: "design",
    tags: ["design-systems", "figma", "css"],
    postType: "post",
  },
  {
    id: "post-5",
    title: "Micro-Frontends & Isomorphic Routing at Scale",
    slug: "micro-frontends-isomorphic-routing",
    excerpt: "Deconstruct monolithic single-page applications into isolated, independently deployable feature blocks with zero downtime.",
    date: "Sep 5, 2026",
    author: "Elena Rostova",
    featuredImage: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80",
    category: "Architecture",
    categorySlug: "architecture",
    tags: ["tech", "frontend", "scale"],
    postType: "post",
  },
  {
    id: "post-6",
    title: "Accessibility-First Component Architecture in 2026",
    slug: "accessibility-first-component-architecture",
    excerpt: "Implementing strict WCAG 2.2 AAA keyboard navigation, focus traps, and screen-reader announcements seamlessly.",
    date: "Aug 29, 2026",
    author: "Alex Morgan",
    featuredImage: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=80",
    category: "Development",
    categorySlug: "development",
    tags: ["a11y", "react", "ui"],
    postType: "post",
  },
];

export interface LoopGridWidgetRendererProps {
  el: EditorElement;
  isPreview?: boolean;
  mergedStyles?: ElementStyles | any;
  activeDevice?: DeviceMode;
  pages?: PageConfig[];
  onSwitchPage?: (page: PageConfig) => void;
  apiUrl?: string;
}

export const LoopGridWidgetRenderer: React.FC<LoopGridWidgetRendererProps> = ({
  el,
  isPreview = false,
  mergedStyles = {},
  activeDevice = "desktop",
  pages,
  onSwitchPage,
  apiUrl = "",
}) => {
  const [activeFilterSlug, setActiveFilterSlug] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [visibleCount, setVisibleCount] = useState<number>(() => el.queryLimit || 6);

  // URL route term seeding (F-256) & live taxonomy filter listener (F-252, F-257)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const match = window.location.pathname.match(/\/(category|tag)\/([^/?#]+)/i);
      if (match && match[2]) {
        setActiveFilterSlug(match[2].toLowerCase());
      }
    }

    const handleTaxFilter = (e: any) => {
      const { targetGridId, slug } = e.detail || {};
      if (!targetGridId || targetGridId === el.id) {
        setActiveFilterSlug(slug || "all");
        setCurrentPage(1);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("fs-taxonomy-filter", handleTaxFilter);
      return () => window.removeEventListener("fs-taxonomy-filter", handleTaxFilter);
    }
  }, [el.id]);

  // Query Engine Evaluation (F-247, F-258)
  const baseItems = Array.isArray(el.posts) && el.posts.length > 0 ? el.posts : DEFAULT_LOOP_ITEMS;

  let filteredItems = baseItems.filter((item: any) => {
    // Taxonomy Slug Filter
    if (activeFilterSlug && activeFilterSlug !== "all") {
      const itemCat = (item.categorySlug || item.category || "").toLowerCase();
      const itemTags = Array.isArray(item.tags)
        ? item.tags.map((t: string) => t.toLowerCase())
        : [];
      if (itemCat !== activeFilterSlug && !itemTags.includes(activeFilterSlug)) {
        return false;
      }
    }

    // Term config filter from Query Inspector (F-247)
    if (Array.isArray(el.queryTerms) && el.queryTerms.length > 0) {
      const terms = el.queryTerms.map((t: string) => t.toLowerCase().trim());
      const itemCat = (item.categorySlug || item.category || "").toLowerCase();
      const itemTags = Array.isArray(item.tags)
        ? item.tags.map((t: string) => t.toLowerCase())
        : [];
      const matches = terms.some((term) => term === itemCat || itemTags.includes(term));
      if (!matches) return false;
    }

    // Related Posts Preset mode (F-258)
    if (el.querySource === "related") {
      // In preview/canvas, match items with architecture or development
      const itemCat = (item.categorySlug || item.category || "").toLowerCase();
      if (!["architecture", "development", "wordpress"].includes(itemCat)) {
        return false;
      }
    }

    return true;
  });

  // Exclude current item if requested
  if (el.queryExcludeCurrent && filteredItems.length > 1) {
    filteredItems = filteredItems.slice(1);
  }

  // Ordering
  const orderDir = (el.queryOrder || "desc").toLowerCase();
  filteredItems.sort((a: any, b: any) => {
    if (el.queryOrderBy === "title") {
      const res = (a.title || "").localeCompare(b.title || "");
      return orderDir === "asc" ? res : -res;
    }
    // Default date
    const dateA = new Date(a.date || 0).getTime();
    const dateB = new Date(b.date || 0).getTime();
    return orderDir === "asc" ? dateA - dateB : dateB - dateA;
  });

  // Offset
  if (el.queryOffset && el.queryOffset > 0) {
    filteredItems = filteredItems.slice(el.queryOffset);
  }

  // Limit
  const maxLimit = el.queryLimit || 6;
  filteredItems = filteredItems.slice(0, maxLimit);

  // Pagination (F-251)
  const paginationType = el.paginationType || "none";
  let displayItems = filteredItems;
  const itemsPerPage = Math.max(1, Math.min(3, Math.ceil(maxLimit / 2)));
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  if (paginationType === "numbers") {
    const startIdx = (currentPage - 1) * itemsPerPage;
    displayItems = filteredItems.slice(startIdx, startIdx + itemsPerPage);
  } else if (paginationType === "load-more") {
    displayItems = filteredItems.slice(0, visibleCount);
  }

  // Columns & Gap calculation
  const desktopCols = Math.min(Math.max(el.loopColumns || 3, 1), 6);
  let activeCols = desktopCols;
  if (activeDevice === "mobile") {
    activeCols = 1;
  } else if (activeDevice === "tablet") {
    activeCols = Math.min(desktopCols, 2);
  }
  const gapPx = el.loopGap ?? 24;

  // Resolve template elements: primary and alternate (modulo 2)
  const childTemplates = el.children && el.children.length > 0 ? el.children : [];
  const primaryTemplate = childTemplates[0] || null;
  const alternateTemplate =
    el.alternateTemplateId && childTemplates.length > 1
      ? childTemplates.find((c) => c.id === el.alternateTemplateId) || childTemplates[1]
      : (el.alternateTemplateId ? childTemplates[0] : null);

  // Recursive element tree renderer with dynamic token binding
  const renderTemplateElement = (templateEl: EditorElement, post: any, isAlternate: boolean): React.ReactNode => {
    const ctx = { post };
    const content = resolveDynamicTokens(templateEl.content || "", ctx);
    const src = resolveDynamicTokens(templateEl.src || "", ctx);
    const href = resolveDynamicTokens(templateEl.href || templateEl.linkUrl || "#", ctx);

    const baseStyles: React.CSSProperties = {
      ...(templateEl.styles as any),
      ...(isAlternate && templateEl.type === "container"
        ? {
            borderColor: "#3b82f6",
            borderWidth: "1.5px",
            backgroundColor: "#fafbfc",
          }
        : {}),
    };

    switch (templateEl.type) {
      case "heading":
        return (
          <h3 key={templateEl.id} style={baseStyles} className="transition group-hover:text-blue-600">
            {content || post.title}
          </h3>
        );
      case "text":
        return (
          <p key={templateEl.id} style={baseStyles}>
            {content || post.excerpt}
          </p>
        );
      case "image":
        return (
          <div key={templateEl.id} className="relative overflow-hidden w-full bg-slate-100 rounded-xl" style={{ height: baseStyles.height || "200px" }}>
            <img
              src={resolveImageUrl(src || post.featuredImage, apiUrl)}
              alt={post.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        );
      case "button":
        return (
          <a
            key={templateEl.id}
            href={href || `/post/${post.slug}`}
            onClick={(e) => {
              if (!isPreview && onSwitchPage && pages) {
                e.preventDefault();
                const target = pages.find((p) => p.slug === post.slug);
                if (target) onSwitchPage(target);
              }
            }}
            style={baseStyles}
            className="inline-flex items-center justify-center font-semibold transition active:scale-95 hover:opacity-90"
          >
            {content || "Read Article →"}
          </a>
        );
      case "container":
      default: {
        const children = templateEl.children || [];
        return (
          <div
            key={templateEl.id}
            style={{
              ...baseStyles,
              display: "flex",
              flexDirection: (templateEl.layout?.direction as any) || "column",
              gap: `${templateEl.layout?.gap ?? 12}px`,
            }}
            className="w-full group"
          >
            {children.map((child) => renderTemplateElement(child, post, isAlternate))}
          </div>
        );
      }
    }
  };

  return (
    <div
      id={el.id}
      data-widget-type="loop-grid"
      className="w-full select-none"
      style={{
        marginTop: mergedStyles.marginTop || "16px",
        marginBottom: mergedStyles.marginBottom || "16px",
        paddingTop: mergedStyles.paddingTop,
        paddingBottom: mergedStyles.paddingBottom,
        paddingLeft: mergedStyles.paddingLeft,
        paddingRight: mergedStyles.paddingRight,
        backgroundColor: mergedStyles.backgroundColor || "transparent",
      }}
    >
      {/* Active filter badge indicator */}
      {activeFilterSlug !== "all" && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 border border-blue-100">
          <span className="flex items-center gap-1.5">
            <span>🏷️</span> Filtering by: <strong className="uppercase">{activeFilterSlug}</strong> ({filteredItems.length} items)
          </span>
          <button
            type="button"
            onClick={() => setActiveFilterSlug("all")}
            className="text-blue-500 hover:text-blue-800 underline text-[11px]"
          >
            Reset Filter
          </button>
        </div>
      )}

      {/* Empty State */}
      {displayItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center bg-slate-50/60">
          <span className="text-3xl mb-2">🔍</span>
          <p className="text-sm font-bold text-slate-700">No Query Items Found</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            Try adjusting your taxonomy filters, query limit, or post type settings in the Query Builder inspector.
          </p>
        </div>
      ) : (
        /* Dynamic Grid Layout (F-248) */
        <div
          className={`fs-loop-grid fs-cols-${activeCols} grid`}
          style={{
            gridTemplateColumns: `repeat(${activeCols}, minmax(0, 1fr))`,
            gap: `${gapPx}px`,
          }}
        >
          {displayItems.map((item: any, idx: number) => {
            // Alternating modulo 2 template check (F-254)
            const isAlternate = idx % 2 === 1 && !!el.alternateTemplateId;
            const chosenTemplate = isAlternate ? (alternateTemplate || primaryTemplate) : primaryTemplate;

            return (
              <article
                key={item.id || idx}
                data-loop-item-index={idx}
                data-modulo={idx % 2}
                className="group flex flex-col h-full"
              >
                {chosenTemplate ? (
                  renderTemplateElement(chosenTemplate, item, isAlternate)
                ) : (
                  // Default Premium Card Template
                  <div
                    className={`flex flex-col flex-1 overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                      isAlternate
                        ? "border-blue-200 bg-slate-50/80 shadow-xs"
                        : "border-slate-200 bg-white shadow-xs"
                    }`}
                  >
                    {/* Featured Image */}
                    <div className="relative h-48 w-full overflow-hidden bg-slate-100">
                      <img
                        src={resolveImageUrl(item.featuredImage, apiUrl)}
                        alt={item.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      {item.category && (
                        <span className="absolute top-3 left-3 rounded-full bg-slate-900/80 backdrop-blur-xs px-2.5 py-1 text-[10px] font-bold tracking-wider text-white uppercase shadow-sm">
                          {item.category}
                        </span>
                      )}
                    </div>

                    {/* Content Body */}
                    <div className="flex flex-1 flex-col p-5">
                      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-slate-400">
                        <span>{item.date}</span>
                        <span>•</span>
                        <span>By {item.author}</span>
                      </div>

                      <h3 className="text-base font-bold text-slate-900 leading-snug group-hover:text-blue-600 transition mb-2">
                        {item.title}
                      </h3>

                      <p className="text-xs text-slate-500 leading-relaxed flex-1 line-clamp-3 mb-4">
                        {item.excerpt}
                      </p>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-auto">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                          Read Article <span>→</span>
                        </span>
                        {isAlternate && (
                          <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded">
                            Featured
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Interactive Pagination Controls (F-251) */}
      {paginationType === "numbers" && totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-1.5 select-none">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="flex h-8 items-center justify-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition disabled:opacity-30 hover:bg-slate-100"
          >
            ‹ Prev
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
            <button
              key={pageNum}
              type="button"
              onClick={() => setCurrentPage(pageNum)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition ${
                currentPage === pageNum
                  ? "bg-blue-600 text-white shadow-sm"
                  : "border border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {pageNum}
            </button>
          ))}

          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="flex h-8 items-center justify-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition disabled:opacity-30 hover:bg-slate-100"
          >
            Next ›
          </button>
        </div>
      )}

      {paginationType === "load-more" && visibleCount < filteredItems.length && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => prev + itemsPerPage)}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-95"
          >
            <span>Load More Posts</span>
            <span className="text-[10px] opacity-75">({filteredItems.length - visibleCount} remaining)</span>
          </button>
        </div>
      )}

      {paginationType === "infinite" && (
        <div className="mt-6 flex items-center justify-center gap-2 text-xs font-medium text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
          <span>Infinite Loop Streaming Active</span>
        </div>
      )}
    </div>
  );
};
