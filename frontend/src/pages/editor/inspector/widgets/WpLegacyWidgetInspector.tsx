/**
 * WpLegacyWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement } from "../../types";

// X-787 Legacy WordPress Widget Inspector
export function WpLegacyWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  const widgetType = el.wpWidgetType || "calendar";
  const widgetTitle = el.wpWidgetTitle || "WordPress Widget";

  return (
    <div className="space-y-3 pt-2 border-t border-slate-100" id="wp-legacy-widget-inspector">
      <h3 className="text-xs font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
        <span>🔌</span> Legacy WordPress Widget (X-787)
      </h3>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Widget Title</label>
        <input
          type="text"
          value={widgetTitle}
          onChange={(e) => updateProp("wpWidgetTitle", e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Select Legacy WP Widget</label>
        <select
          value={widgetType}
          onChange={(e) => updateProp("wpWidgetType", e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
        >
          <option value="calendar">Calendar (WP_Widget_Calendar)</option>
          <option value="search">Search Form (WP_Widget_Search)</option>
          <option value="categories">Categories List (WP_Widget_Categories)</option>
          <option value="recent_posts">Recent Posts (WP_Widget_Recent_Posts)</option>
          <option value="tag_cloud">Tag Cloud (WP_Widget_Tag_Cloud)</option>
          <option value="custom_html">Custom HTML Block (WP_Widget_Custom_HTML)</option>
          <option value="nav_menu">Navigation Menu (WP_Widget_Nav_Menu)</option>
          <option value="archives">Archives List (WP_Widget_Archives)</option>
          <option value="meta">Site Meta Links (WP_Widget_Meta)</option>
          <option value="rss">RSS Feed Reader (WP_Widget_RSS)</option>
        </select>
      </div>

      {widgetType === "custom_html" && (
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Widget Custom HTML / Shortcode</label>
          <textarea
            value={el.wpWidgetContent || ""}
            onChange={(e) => updateProp("wpWidgetContent", e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono text-slate-800 outline-none focus:border-blue-500"
          />
        </div>
      )}

      <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-2">
        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={el.wpWidgetShowCount !== false}
            onChange={(e) => updateProp("wpWidgetShowCount", e.target.checked)}
            className="rounded border-slate-300 text-blue-600"
          />
          <span>Show Post/Category Counts</span>
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={el.wpWidgetDropdown || false}
            onChange={(e) => updateProp("wpWidgetDropdown", e.target.checked)}
            className="rounded border-slate-300 text-blue-600"
          />
          <span>Display as Dropdown Select</span>
        </label>
      </div>
    </div>
  );
}
