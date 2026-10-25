/**
 * Runs the editor state matrix through a save payload builder and a publish draft snapshot builder.
 * The golden was produced from the payload code exactly as it was written inside WebsiteEditor's
 * handleSave / handlePublishWebsite (before extraction).
 */
import { attempt } from "./editor-golden-encode";
import { STATES } from "./editor-payloads.fixtures";

export interface PayloadImpl {
  buildSavePayload: (state: any) => { payload: unknown; canonicalPageElements: unknown };
  buildPublishDraftSnapshot: (state: any) => unknown;
}

export function computePayloads(impl: PayloadImpl) {
  const out: Record<string, unknown> = {};
  for (const [label, make] of STATES) {
    out[`save ${label}`] = attempt(() => {
      const state = make();
      const { payload, canonicalPageElements } = impl.buildSavePayload(state);
      const page = state.canvasMode === "page" ? state.elements : undefined;
      return { payload, canonicalPageElements, canonicalIsCanvas: canonicalPageElements === page };
    });
    out[`publish ${label}`] = attempt(() => impl.buildPublishDraftSnapshot(make()));
  }
  return out;
}
