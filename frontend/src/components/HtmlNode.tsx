import React from "react";
import { sanitizeHtml } from "../utils/sanitizeHtml";

interface HtmlNodeProps {
    el: { id?: React.Key; type: string; content?: string };
    mergedProps: React.HTMLAttributes<HTMLDivElement>;
    optInnerClass?: string;
    finalInnerStyles?: React.CSSProperties;
    isEditorMode?: boolean; // if true, injects the placeholder snippet
}

export default function HtmlNode({ el, mergedProps, optInnerClass = "", finalInnerStyles = {}, isEditorMode = false }: HtmlNodeProps) {
    if (el.type !== "html") return null;

    let markup = el.content || "";
    if (isEditorMode && !markup) {
        markup = "<div class='text-center text-slate-400 p-4 border-2 border-dashed border-slate-200'>Add custom HTML markup in the sidebar.</div>";
    }

    const safeHtml = sanitizeHtml(markup);

    return (
        <React.Fragment key={el.id}>
            <div
                {...mergedProps}
                className={`${mergedProps.className || ""} ${optInnerClass}`}
                style={{ ...mergedProps.style, ...finalInnerStyles }}
                dangerouslySetInnerHTML={{ __html: safeHtml }}
            />
        </React.Fragment>
    );
}
