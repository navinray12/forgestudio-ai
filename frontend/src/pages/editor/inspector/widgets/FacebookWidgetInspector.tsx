/**
 * FacebookWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement } from "../../types";

// 24. Facebook Widgets Inspector (Page, Button, Embed, Comments Unified)
export function FacebookWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  const mode = el.facebookMode || (
    el.type === "facebook-button" ? "button" :
    el.type === "facebook-embed" ? "embed" :
    el.type === "facebook-comments" ? "comments" : "page"
  );

  return (
    <div className="space-y-4 pt-2 border-t border-slate-100">
      <h3 className="text-xs font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
        <span>📘</span> Facebook Widget Integration
      </h3>

      {/* Mode Selector Tabs */}
      <div>
        <label className="block text-[10px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Facebook Mode</label>
        <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => updateProp("facebookMode", "page")}
            className={`py-1.5 px-2 text-xs font-bold rounded-lg transition ${
              mode === "page" ? "bg-blue-600 text-white shadow" : "text-slate-600 hover:bg-slate-200"
            }`}
          >
            📄 Page Feed
          </button>
          <button
            type="button"
            onClick={() => updateProp("facebookMode", "button")}
            className={`py-1.5 px-2 text-xs font-bold rounded-lg transition ${
              mode === "button" ? "bg-blue-600 text-white shadow" : "text-slate-600 hover:bg-slate-200"
            }`}
          >
            👍 Like / Share
          </button>
          <button
            type="button"
            onClick={() => updateProp("facebookMode", "embed")}
            className={`py-1.5 px-2 text-xs font-bold rounded-lg transition ${
              mode === "embed" ? "bg-blue-600 text-white shadow" : "text-slate-600 hover:bg-slate-200"
            }`}
          >
            📌 Post Embed
          </button>
          <button
            type="button"
            onClick={() => updateProp("facebookMode", "comments")}
            className={`py-1.5 px-2 text-xs font-bold rounded-lg transition ${
              mode === "comments" ? "bg-blue-600 text-white shadow" : "text-slate-600 hover:bg-slate-200"
            }`}
          >
            💬 Comments
          </button>
        </div>
      </div>

      {/* MODE 1: PAGE FEED */}
      {mode === "page" && (
        <div className="space-y-3 pt-1">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Facebook Page URL</label>
            <input
              type="text"
              value={el.facebookPageUrl || el.facebookUrl || "https://facebook.com/facebook"}
              onChange={(e) => {
                updateProp("facebookPageUrl", e.target.value);
                updateProp("facebookUrl", e.target.value);
              }}
              placeholder="https://facebook.com/your-page"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tabs to Display</label>
            <input
              type="text"
              value={el.facebookTabs || "timeline"}
              onChange={(e) => updateProp("facebookTabs", e.target.value)}
              placeholder="e.g. timeline, events, messages"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Width (px)</label>
              <input
                type="number"
                value={el.facebookWidth || 340}
                onChange={(e) => updateProp("facebookWidth", parseInt(e.target.value, 10) || 340)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Height (px)</label>
              <input
                type="number"
                value={el.facebookHeight || 500}
                onChange={(e) => updateProp("facebookHeight", parseInt(e.target.value, 10) || 500)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
              />
            </div>
          </div>

          <div className="space-y-2 pt-1 border-t border-slate-100">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={el.facebookSmallHeader ?? false}
                onChange={(e) => updateProp("facebookSmallHeader", e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Use Small Header
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={el.facebookHideCover ?? false}
                onChange={(e) => updateProp("facebookHideCover", e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Hide Cover Photo
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={el.facebookShowFacepile ?? true}
                onChange={(e) => updateProp("facebookShowFacepile", e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Show Friend's Faces (Facepile)
            </label>
          </div>
        </div>
      )}

      {/* MODE 2: LIKE / SHARE BUTTON */}
      {mode === "button" && (
        <div className="space-y-3 pt-1">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Target URL</label>
            <input
              type="text"
              value={el.fbButtonUrl || el.facebookUrl || "https://facebook.com"}
              onChange={(e) => {
                updateProp("fbButtonUrl", e.target.value);
                updateProp("facebookUrl", e.target.value);
              }}
              placeholder="https://facebook.com/your-page"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Button Action</label>
            <select
              value={el.fbButtonAction || "like"}
              onChange={(e) => updateProp("fbButtonAction", e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
            >
              <option value="like">👍 Like & Share</option>
              <option value="share">🔗 Share Only</option>
              <option value="follow">➕ Follow Page</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Button Label Text</label>
            <input
              type="text"
              value={el.fbButtonLabel || "Like Page"}
              onChange={(e) => updateProp("fbButtonLabel", e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Button Size</label>
              <select
                value={el.fbButtonSize || "md"}
                onChange={(e) => updateProp("fbButtonSize", e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
              >
                <option value="sm">Small</option>
                <option value="md">Medium</option>
                <option value="lg">Large</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Alignment</label>
              <select
                value={el.fbButtonAlignment || "left"}
                onChange={(e) => updateProp("fbButtonAlignment", e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* MODE 3: POST EMBED */}
      {mode === "embed" && (
        <div className="space-y-3 pt-1">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Facebook Post or Video URL</label>
            <input
              type="text"
              value={el.fbEmbedUrl || el.facebookUrl || "https://www.facebook.com/20531316728/posts/10154009968286729/"}
              onChange={(e) => {
                updateProp("fbEmbedUrl", e.target.value);
                updateProp("facebookUrl", e.target.value);
              }}
              placeholder="https://facebook.com/username/posts/123456"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Embed Width</label>
              <input
                type="text"
                value={el.fbEmbedWidth || "100%"}
                onChange={(e) => updateProp("fbEmbedWidth", e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Embed Height</label>
              <input
                type="text"
                value={el.fbEmbedHeight || "450px"}
                onChange={(e) => updateProp("fbEmbedHeight", e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
              />
            </div>
          </div>
        </div>
      )}

      {/* MODE 4: COMMENTS BOX */}
      {mode === "comments" && (
        <div className="space-y-3 pt-1">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Target Page URL for Discussion</label>
            <input
              type="text"
              value={el.fbCommentsUrl || el.facebookUrl || "https://facebook.com"}
              onChange={(e) => {
                updateProp("fbCommentsUrl", e.target.value);
                updateProp("facebookUrl", e.target.value);
              }}
              placeholder="https://yourwebsite.com/page"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Max Comments Shown</label>
              <input
                type="number"
                value={el.fbCommentsNumPosts || 5}
                onChange={(e) => updateProp("fbCommentsNumPosts", parseInt(e.target.value, 10) || 5)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Box Width</label>
              <input
                type="text"
                value={el.fbCommentsWidth || "100%"}
                onChange={(e) => updateProp("fbCommentsWidth", e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
