/**
 * Evaluates every pure renderer helper over the input matrix in renderer-helpers.fixtures.ts. Shared by
 * the one-off golden capture and by renderer-helpers.test.ts; the golden pins the outputs only.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { BUTTON_ELEMENTS, EMBED_CASES, FORGE_LINK_CASES, PAGES, SAFE_URL_CASES, SHARE_ELEMENTS, SHARE_NETWORKS } from "./renderer-helpers.fixtures";

export function computeHelperResults(R: any) {
  const shareItems = SHARE_NETWORKS.map((network) => ({ id: `n-${network}`, network, label: network }));
  return {
    resolveForgeLink: FORGE_LINK_CASES.map(([raw, pageId, dest, opts]) => R.resolveForgeLink(raw, pageId, dest, opts)),
    isSafeShareUrl: SAFE_URL_CASES.map((u) => R.isSafeShareUrl(u)),
    getEmbedVideoUrl: EMBED_CASES.map((u) => R.getEmbedVideoUrl(u)),
    getCurrentResolvedPageUrl: [R.getCurrentResolvedPageUrl(), R.getCurrentResolvedPageUrl(PAGES, "about"), R.getCurrentResolvedPageUrl(PAGES, "home"), R.getCurrentResolvedPageUrl(PAGES, "missing")],
    resolveButtonHref: BUTTON_ELEMENTS.map((el) => [R.resolveButtonHref(el, PAGES), R.resolveButtonHref(el)]),
    getLinkedPageStatus: BUTTON_ELEMENTS.map((el) => [R.getLinkedPageStatus(el, PAGES), R.getLinkedPageStatus(el)]),
    getSocialShareUrl: SHARE_NETWORKS.flatMap((n) => [
      R.getSocialShareUrl(n, "https://example.com/p?a=1&b=2", "Hello & bye", "x,y"),
      R.getSocialShareUrl(n, "https://example.com/p", undefined, undefined, "copy-link"),
      R.getSocialShareUrl(n, "javascript:alert(1)"),
    ]),
    resolveShareDestinationUrl: SHARE_ELEMENTS.flatMap((el) => [R.resolveShareDestinationUrl(el, shareItems[0], PAGES, "about"), R.resolveShareDestinationUrl(el)]),
    resolveShareAction: SHARE_ELEMENTS.flatMap((el) => shareItems.map((item) => R.resolveShareAction(el, item, PAGES, "about"))),
    NETWORK_BRAND_COLORS: R.NETWORK_BRAND_COLORS,
    renderSocialNetworkIcon: SHARE_NETWORKS.map((n) => renderToStaticMarkup(<>{R.renderSocialNetworkIcon(n)}</>)),
    DEFAULT_LOOP_ITEMS: R.DEFAULT_LOOP_ITEMS,
  };
}
