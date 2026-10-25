/**
 * Runs the canonical-pages cases against an implementation. The golden was recorded from the
 * canonicalPages useMemo body exactly as it was written inside WebsiteEditor (before extraction).
 * Besides the values it records, per output page, whether it is the same object as the input page,
 * and whether a merged page holds the canvas elements and page settings by reference.
 */
import { attempt } from "./editor-golden-encode";
import { CANONICAL_CASES, type CanonicalInput } from "./canonical-pages.fixtures";

export type CanonicalImpl = (input: CanonicalInput) => any[];

export function computeCanonicalPages(impl: CanonicalImpl) {
  const out: Record<string, unknown> = {};
  for (const [label, make] of CANONICAL_CASES) {
    const input = make();
    out[label] = attempt(() => {
      const result = impl(input);
      return {
        pages: result,
        newArray: result !== input.pages,
        identity: result.map((p, i) => ({
          sameAsInput: p === input.pages[i],
          elementsByRef: p.elements === input.elements,
          pageSettingsByRef: p.pageSettings === input.pageSettings,
        })),
      };
    });
  }
  return out;
}
