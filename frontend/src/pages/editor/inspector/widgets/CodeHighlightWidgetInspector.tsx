/**
 * CodeHighlightWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement } from "../../types";

// 13. Code Highlight Inspector
export function CodeHighlightWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  return (
    <div className="space-y-3 pt-2 border-t border-slate-100">
      <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
        <span>💻</span> Syntax Code Highlight
      </h3>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Language</label>
          <select
            value={el.codeLanguage || "typescript"}
            onChange={(e) => updateProp("codeLanguage", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
          >
            <option value="typescript">TypeScript</option>
            <option value="javascript">JavaScript</option>
            <option value="html">HTML</option>
            <option value="css">CSS</option>
            <option value="json">JSON</option>
            <option value="python">Python</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Theme</label>
          <select
            value={el.codeTheme || "dark"}
            onChange={(e) => updateProp("codeTheme", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
          >
            <option value="dark">Dark Theme</option>
            <option value="dracula">Dracula</option>
            <option value="light">Light Theme</option>
            <option value="github">GitHub Theme</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Code Snippet Content</label>
        <textarea
          rows={6}
          value={el.codeSnippet || ""}
          onChange={(e) => updateProp("codeSnippet", e.target.value)}
          className="w-full font-mono text-xs rounded-lg border border-slate-800 bg-[#1e1e1e] text-slate-200 p-3 leading-relaxed outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="// Paste code here..."
        />
      </div>
    </div>
  );
}
