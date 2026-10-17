/**
 * CodeHighlightWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState } from "react";
import type { EditorElement, ElementStyles } from "../../../types";

/* F-203: Code Highlight Renderer */
export const CodeHighlightWidgetRenderer = ({
  el,
  isPreview: _isPreview,
  mergedStyles,
}: {
  el: EditorElement;
  isPreview: boolean;
  mergedStyles: ElementStyles;
}) => {
  const code = el.codeSnippet || `// Welcome to ForgeStudio Code Highlight\nfunction greet(name: string): string {\n  return \`Hello, \${name}!\`;\n}\n\nconsole.log(greet("Developer"));`;
  const language = el.codeLanguage || "typescript";
  const showLineNumbers = el.codeShowLineNumbers ?? true;
  const theme = el.codeTheme || "dark";
  const fontSize = el.codeFontSize || "0.85rem";
  const alignment = el.codeAlignment || "left";

  const [copied, setCopied] = useState(false);

  const lines = code.split("\n");

  const alignClass =
    alignment === "center" ? "justify-center" : alignment === "right" ? "justify-end" : "justify-start";

  const themeBg = theme === "light" ? "#f8fafc" : theme === "dracula" ? "#282a36" : "#0f172a";
  const themeText = theme === "light" ? "#0f172a" : "#f8fafc";
  const themeBorder = theme === "light" ? "#e2e8f0" : "#334155";

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
        className="w-full max-w-4xl rounded-2xl border shadow-sm overflow-hidden font-mono"
        style={{
          backgroundColor: themeBg,
          color: themeText,
          borderColor: themeBorder,
          borderRadius: mergedStyles.borderRadius,
        }}
      >
        {/* Code Header Bar */}
        <div
          className="flex items-center justify-between px-4 py-2.5 border-b"
          style={{ borderColor: themeBorder, backgroundColor: "rgba(0,0,0,0.15)" }}
        >
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-500/80 inline-block" />
            <span className="h-3 w-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block" />
            <span className="ml-2 text-xs font-bold uppercase tracking-wider opacity-75">{language}</span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-white/10 hover:bg-white/20 transition cursor-pointer"
          >
            <span>{copied ? "✓ Copied!" : "📋 Copy"}</span>
          </button>
        </div>

        {/* Code Display Area */}
        <div className="p-4 overflow-x-auto" style={{ fontSize }}>
          <pre className="font-mono leading-relaxed">
            {lines.map((line, idx) => (
              <div key={idx} className="table-row">
                {showLineNumbers && (
                  <span className="table-cell select-none pr-4 text-right opacity-35 font-mono text-[0.8em]">
                    {idx + 1}
                  </span>
                )}
                <span className="table-cell font-mono whitespace-pre">{line || " "}</span>
              </div>
            ))}
          </pre>
        </div>
      </div>
    </div>
  );
};
