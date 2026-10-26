/**
 * QueryBuilderWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import React from "react";
import type { EditorElement } from "../../types";

// Query Builder & Dynamic Content Inspector (F-247 to F-258)
export function QueryBuilderWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  const isLoopGrid = el.type === "loop-grid";
  const [termsInput, setTermsInput] = React.useState<string>(
    Array.isArray(el.queryTerms) ? el.queryTerms.join(", ") : ""
  );

  return (
    <div className="space-y-3 pt-2 border-t border-slate-100">
      <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-600 flex items-center gap-1.5">
        <span>⚙️</span> Query &amp; Dynamic Content Engine
      </h3>

      {/* Query Source selector (F-258) */}
      {isLoopGrid && (
        <div>
          <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Query Source</label>
          <select
            value={el.querySource || "custom"}
            onChange={(e) => updateProp("querySource", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium"
          >
            <option value="custom">Custom Query</option>
            <option value="current_query">Current Page Query</option>
            <option value="related">Related Posts (Auto)</option>
          </select>
          {el.querySource === "related" && (
            <p className="text-[10px] text-blue-500 mt-0.5 leading-tight">
              🔗 Automatically pulls posts sharing same taxonomy as the current post.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Post Type Source</label>
          <select
            value={el.queryPostType || "post"}
            onChange={(e) => updateProp("queryPostType", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium"
          >
            <option value="post">Blog Posts</option>
            <option value="page">Pages</option>
            <option value="portfolio">Portfolio Items</option>
            <option value="product">Products</option>
            <option value="custom">Custom Post Type</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Limit Count</label>
          <input
            type="number"
            min={1}
            max={100}
            value={el.queryLimit ?? 6}
            onChange={(e) => updateProp("queryLimit", Number(e.target.value))}
            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Order By</label>
          <select
            value={el.queryOrderBy || "date"}
            onChange={(e) => updateProp("queryOrderBy", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium"
          >
            <option value="date">Publish Date</option>
            <option value="title">Title (A-Z)</option>
            <option value="rand">Random</option>
            <option value="modified">Last Modified</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Order Direction</label>
          <select
            value={el.queryOrder || "DESC"}
            onChange={(e) => updateProp("queryOrder", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium"
          >
            <option value="DESC">Descending (Newest first)</option>
            <option value="ASC">Ascending (Oldest first)</option>
          </select>
        </div>
      </div>

      {/* Taxonomy Source & Term Selector (F-252, F-253, F-256, F-257) */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Taxonomy Source</label>
          <select
            value={el.queryTaxonomy || ""}
            onChange={(e) => updateProp("queryTaxonomy", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium"
          >
            <option value="">None</option>
            <option value="category">Category</option>
            <option value="post_tag">Post Tag</option>
            <option value="portfolio_category">Portfolio Category</option>
            <option value="product_cat">Product Category</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Offset</label>
          <input
            type="number"
            min={0}
            max={100}
            value={el.queryOffset ?? 0}
            onChange={(e) => updateProp("queryOffset", Number(e.target.value))}
            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono"
          />
        </div>
      </div>

      {/* Term selector – comma-separated input */}
      {el.queryTaxonomy && (
        <div>
          <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
            Filter Terms <span className="text-slate-400 font-normal">(comma-separated slugs)</span>
          </label>
          <input
            type="text"
            value={termsInput}
            placeholder="e.g. architecture, design, wordpress"
            onChange={(e) => {
              setTermsInput(e.target.value);
              const terms = e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              updateProp("queryTerms", terms);
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
          />
        </div>
      )}

      {/* Exclude Current Post toggle */}
      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 border border-slate-100">
        <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer">
          <span>🚫</span> Exclude Current Post
        </label>
        <button
          type="button"
          onClick={() => updateProp("queryExcludeCurrent", !el.queryExcludeCurrent)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            el.queryExcludeCurrent ? "bg-blue-600" : "bg-slate-300"
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
              el.queryExcludeCurrent ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {/* Loop Grid Specific Controls */}
      {isLoopGrid && (
        <>
          {/* Pagination Type (F-251) */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Pagination Type</label>
            <select
              value={el.paginationType || "none"}
              onChange={(e) => updateProp("paginationType", e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium"
            >
              <option value="none">No Pagination</option>
              <option value="numbers">Page Numbers</option>
              <option value="load-more">Load More Button</option>
              <option value="infinite">Infinite Scroll</option>
            </select>
          </div>

          {/* Columns & Gap Layout (F-248) */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                Columns <span className="text-slate-400 font-normal">(1–6)</span>
              </label>
              <input
                type="range"
                min={1}
                max={6}
                step={1}
                value={el.loopColumns ?? 3}
                onChange={(e) => updateProp("loopColumns", Number(e.target.value))}
                className="w-full accent-blue-600"
              />
              <div className="text-center text-[10px] font-bold text-slate-600">{el.loopColumns ?? 3} col{(el.loopColumns ?? 3) !== 1 ? "s" : ""}</div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                Gap <span className="text-slate-400 font-normal">(px)</span>
              </label>
              <input
                type="range"
                min={0}
                max={64}
                step={4}
                value={el.loopGap ?? 24}
                onChange={(e) => updateProp("loopGap", Number(e.target.value))}
                className="w-full accent-blue-600"
              />
              <div className="text-center text-[10px] font-bold text-slate-600">{el.loopGap ?? 24}px</div>
            </div>
          </div>

          {/* Alternate Template Toggle (F-254) */}
          <div className="flex items-center justify-between rounded-lg bg-indigo-50 px-3 py-2 border border-indigo-100">
            <label className="text-[11px] font-semibold text-indigo-700 flex items-center gap-1.5 cursor-pointer">
              <span>🔀</span> Alternate Template (Zebra)
            </label>
            <button
              type="button"
              onClick={() => {
                if (el.alternateTemplateId) {
                  updateProp("alternateTemplateId", "");
                } else {
                  updateProp("alternateTemplateId", "alt_" + Date.now());
                }
              }}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                el.alternateTemplateId ? "bg-indigo-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                  el.alternateTemplateId ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
          {el.alternateTemplateId && (
            <p className="text-[10px] text-indigo-500 -mt-1 leading-tight pl-1">
              Even-indexed cards use primary template, odd-indexed cards use alternate styling.
            </p>
          )}
        </>
      )}
    </div>
  );
}
