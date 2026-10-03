import { useState } from "react";
import { RenderNode } from "../../pages/published/PublishedSite";
import type { EditorElement } from "../../pages/editor/types";

export interface ProposedPage { id: string; name: string; slug: string; elements: EditorElement[]; customCss?: string; }
export interface ProposedDocument { pages: ProposedPage[]; homePageId?: string; }
export default function DesignProposalPreview({ document, apiUrl, websiteId }: { document: ProposedDocument; apiUrl: string; websiteId: string }) {
  const [pageId, setPageId] = useState(document.homePageId || document.pages[0]?.id);
  const [device, setDevice] = useState("desktop");
  const page = document.pages.find(item => item.id === pageId) || document.pages[0];
  const width = device === "mobile" ? 390 : device === "tablet" ? 768 : 1440;
  return <section aria-label="Native website proposal preview">
    <div className="mb-3 flex flex-wrap gap-2">
      <select aria-label="Preview page" value={page?.id} onChange={event => setPageId(event.target.value)}>{document.pages.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <select aria-label="Preview viewport" value={device} onChange={event => setDevice(event.target.value)}><option value="desktop">Desktop · 1440px</option><option value="tablet">Tablet · 768px</option><option value="mobile">Mobile · 390px</option></select>
    </div>
    <div className="max-h-[65vh] overflow-auto rounded border bg-slate-100">
      <div style={{ width, minHeight: 500, background: "white", color: "#172033", fontFamily: "system-ui, sans-serif" }}>
        {page?.elements.map(element => <RenderNode key={element.id} el={element} isCritical activeBreakpointId={device} breakpoints={[]} globalSettings={{}} elementClassMap={new Map()} apiUrl={apiUrl} websiteId={websiteId} allElements={page.elements} pages={document.pages.map(item => ({ ...item, customCss: item.customCss || "" }))} onSwitchPage={item => setPageId(item.id)} />)}
      </div>
    </div>
  </section>;
}
