/**
 * BlockquoteWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement } from "../../types";

// 25. Blockquote Inspector
export function BlockquoteWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  return (
    <div className="space-y-3 pt-2 border-t border-slate-100">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
        <span>💬</span> Blockquote Settings
      </h3>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Quote Text</label>
        <textarea
          rows={3}
          value={el.quoteText || el.content || "Creativity is intelligence having fun."}
          onChange={(e) => {
            updateProp("quoteText", e.target.value);
            updateProp("content", e.target.value);
          }}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Author Name</label>
          <input
            type="text"
            value={el.quoteAuthor || "Albert Einstein"}
            onChange={(e) => updateProp("quoteAuthor", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Citation / Source</label>
          <input
            type="text"
            value={el.quoteCitation || "Theoretical Physicist"}
            onChange={(e) => updateProp("quoteCitation", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
          />
        </div>
      </div>
    </div>
  );
}
