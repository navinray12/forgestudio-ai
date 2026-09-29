import type { CustomCodeSnippet } from "../../../services/customCode.service";
import DOMPurify from "dompurify";
import { permitsActiveContent, isolatedScriptDocument } from "../../../features/content-runtime/runtime-policy";

interface Props {
    snippets: CustomCodeSnippet[];
    currentPageId?: string;
    useDraft?: boolean;
}

export function shouldApplyCustomCode(snippet: CustomCodeSnippet, currentPageId: string): boolean {
    if (snippet.status && snippet.status !== 'PUBLISHED') return false;
    if (snippet.status === undefined && !snippet.isActive) return false;
    if (snippet.scope === "PAGE" && snippet.pageId !== currentPageId) return false;
    if (snippet.conditions) {
        let currentPath = '/';
        let currentDevice = 'desktop';
        if (typeof window !== 'undefined') {
            currentPath = window.location.pathname;
            const width = window.innerWidth;
            if (width < 768) currentDevice = 'mobile';
            else if (width < 1024) currentDevice = 'tablet';
        }
        if (snippet.conditions.pages && snippet.conditions.pages.length > 0) {
            if (!snippet.conditions.pages.includes(currentPath) && !snippet.conditions.pages.includes(currentPageId)) return false;
        }
        if (snippet.conditions.devices && snippet.conditions.devices.length > 0) {
            if (!snippet.conditions.devices.includes(currentDevice)) return false;
        }
    }
    return true;
}

export default function CodeInjectionRuntime({ snippets, currentPageId = "home" }: Props) {
    if (!snippets || snippets.length === 0) return null;
    const allowed = typeof window !== "undefined" && permitsActiveContent(
        window.location.origin,
        import.meta.env.VITE_STUDIO_ORIGIN,
        import.meta.env.VITE_CONTENT_RUNTIME_ORIGIN,
    );
    if (!allowed) {
        return <span role="status" data-custom-code-state="blocked-unqualified-origin">Custom code is disabled on this host until isolated hosting is configured.</span>;
    }
    const activeSnippets = snippets.filter(s => shouldApplyCustomCode(s, currentPageId))
        .sort((a, b) => (b.priority || 0) - (a.priority || 0));
    const cssSnippets = activeSnippets.filter(s => s.language === "CSS");
    const htmlSnippets = activeSnippets.filter(s => s.language === "HTML");
    const jsSnippets = activeSnippets.filter(s => s.language === "JS");
    return (
        <>
            {cssSnippets.map((s) => {
                // CSS is permitted only within the separately deployed content origin.
                const safeCss = s.code.replace(/javascript:/gi, "blocked:");
                return <style key={s.id} data-custom-code-id={s.id} dangerouslySetInnerHTML={{ __html: safeCss }} />;
            })}
            {htmlSnippets.map((s) => {
                // Sanitization is defense in depth, not a claim of perfect content safety.
                const cleanHtml = DOMPurify.sanitize(s.code, {
                    FORBID_TAGS: ["iframe", "meta", "link", "style", "form", "base"],
                    ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling", "name", "content", "rel", "href"],
                });
                return <div key={s.id} data-custom-code-id={s.id} data-location={s.placement} dangerouslySetInnerHTML={{ __html: cleanHtml }} />;
            })}
            {/* Opaque origin: no inherited origin, top navigation, forms or popups. */}
            {jsSnippets.map((s) => (
                <iframe key={s.id} data-custom-code-id={s.id} title={`isolated-js-${s.id}`}
                    sandbox="allow-scripts" referrerPolicy="no-referrer"
                    style={{ display: "none", width: 0, height: 0, border: 0 }}
                    srcDoc={isolatedScriptDocument(s.code)} />
            ))}
        </>
    );
}
