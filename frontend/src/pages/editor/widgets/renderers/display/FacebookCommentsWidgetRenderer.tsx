/**
 * FacebookCommentsWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { FacebookCommentsBoxIcon } from "../../icons";
import type { EditorElement, ElementStyles } from "../../../types";

/* F-199: Facebook Comments Renderer */
export const FacebookCommentsWidgetRenderer = ({
  el,
  isPreview: _isPreview,
  mergedStyles,
}: {
  el: EditorElement;
  isPreview: boolean;
  mergedStyles: ElementStyles;
}) => {
  const rawUrl = (el.fbCommentsUrl || "").trim();
  const numPosts = el.fbCommentsNumPosts || 5;
  const width = el.fbCommentsWidth || "100%";
  const alignment = el.fbCommentsAlignment || "center";

  const alignClass =
    alignment === "left" ? "justify-start" : alignment === "right" ? "justify-end" : "justify-center";

  const formattedUrl = rawUrl
    ? /^https?:\/\//i.test(rawUrl)
      ? rawUrl
      : `https://${rawUrl}`
    : "https://facebook.com";

  const commentsSrc = `https://www.facebook.com/plugins/comments.php?href=${encodeURIComponent(
    formattedUrl
  )}&numposts=${numPosts}&width=100%25`;

  return (
    <div
      className={`w-full flex ${alignClass} transition-all`}
      style={{
        marginTop: mergedStyles.marginTop,
        marginBottom: mergedStyles.marginBottom,
        paddingTop: mergedStyles.paddingTop,
        paddingRight: mergedStyles.paddingRight,
        paddingBottom: mergedStyles.paddingBottom,
        paddingLeft: mergedStyles.paddingLeft,
      }}
    >
      <div
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs overflow-hidden max-w-full"
        style={{ width }}
      >
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-3">
          <FacebookCommentsBoxIcon />
          <h4 className="text-xs font-bold text-slate-800">Facebook Discussion & Comments</h4>
        </div>
        <iframe
          title="Facebook Comments Plugin"
          src={commentsSrc}
          width="100%"
          height="320"
          style={{ border: "none", overflow: "hidden" }}
          scrolling="no"
          frameBorder="0"
        />
      </div>
    </div>
  );
};
