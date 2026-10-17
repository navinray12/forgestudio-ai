/* global describe, it, expect -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Regression guard: public export surface of src/pages/editor/widgets/renderers.tsx, captured from the
 * unmodified module: 89 exports (83 consts, 1 function, 5 interfaces) in source order. Consumers:
 * WebsiteEditor.tsx and PublishedSite.tsx (via widgets/index.ts `export *`) and the Button / Share
 * inspectors. When renderers are split into modules, this file must keep exposing exactly these names
 * (directly or by explicit relative re-export).
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import ts from "typescript";

const RENDERERS_FILE = resolve("src/pages/editor/widgets/renderers.tsx");

const EXPECTED_SURFACE: Array<[string, string]> = [
  ["const", "SlidesWidgetRenderer"],
  ["const", "FormWidgetRenderer"],
  ["const", "LoginWidgetRenderer"],
  ["interface", "ResolveForgeLinkOptions"],
  ["interface", "ResolvedForgeLink"],
  ["function", "resolveForgeLink"],
  ["const", "NavMenuWidgetRenderer"],
  ["const", "AnimatedHeadlineWidgetRenderer"],
  ["const", "PriceTableWidgetRenderer"],
  ["const", "PriceListWidgetRenderer"],
  ["const", "GalleryWidgetRenderer"],
  ["const", "FlipBoxWidgetRenderer"],
  ["const", "CtaWidgetRenderer"],
  ["const", "getEmbedVideoUrl"],
  ["const", "MediaCarouselWidgetRenderer"],
  ["const", "TestimonialCarouselWidgetRenderer"],
  ["const", "NestedCarouselWidgetRenderer"],
  ["const", "LoopCarouselWidgetRenderer"],
  ["const", "TocWidgetRenderer"],
  ["const", "CountdownWidgetRenderer"],
  ["const", "FacebookPageWidgetRenderer"],
  ["const", "BlockquoteWidgetRenderer"],
  ["const", "TemplateWidgetRenderer"],
  ["const", "ReviewsWidgetRenderer"],
  ["const", "FacebookEmbedWidgetRenderer"],
  ["const", "FacebookCommentsWidgetRenderer"],
  ["const", "PayPalButtonWidgetRenderer"],
  ["const", "StripeButtonWidgetRenderer"],
  ["const", "ImageCarouselWidgetRenderer"],
  ["const", "LottieWidgetRenderer"],
  ["const", "CodeHighlightWidgetRenderer"],
  ["const", "MegaMenuWidgetRenderer"],
  ["const", "OffCanvasWidgetRenderer"],
  ["const", "BasicMediaCarouselWidgetRenderer"],
  ["const", "BasicGalleryWidgetRenderer"],
  ["const", "AudioPlaylistWidgetRenderer"],
  ["const", "DynamicLightboxWidgetRenderer"],
  ["const", "CustomSvgWidgetRenderer"],
  ["const", "IconLibraryWidgetRenderer"],
  ["const", "NETWORK_BRAND_COLORS"],
  ["const", "renderSocialNetworkIcon"],
  ["const", "isSafeShareUrl"],
  ["const", "getCurrentResolvedPageUrl"],
  ["interface", "LinkedPageStatus"],
  ["const", "resolveButtonHref"],
  ["const", "getLinkedPageStatus"],
  ["interface", "ShareActionResult"],
  ["const", "resolveShareDestinationUrl"],
  ["const", "getSocialShareUrl"],
  ["const", "resolveShareAction"],
  ["const", "ShareButtonsWidgetRenderer"],
  ["const", "WcProductTitleWidgetRenderer"],
  ["const", "WcProductPriceWidgetRenderer"],
  ["const", "WcProductImagesWidgetRenderer"],
  ["const", "WcAddToCartWidgetRenderer"],
  ["const", "WcProductRatingWidgetRenderer"],
  ["const", "WcBuilderWidgetRenderer"],
  ["const", "WcProductWidgetRenderer"],
  ["const", "WcProductStockWidgetRenderer"],
  ["const", "WcProductMetaWidgetRenderer"],
  ["const", "WcProductContentWidgetRenderer"],
  ["const", "WcShortDescriptionWidgetRenderer"],
  ["const", "WcProductDataTabsWidgetRenderer"],
  ["const", "WcAdditionalInfoWidgetRenderer"],
  ["const", "WcRelatedProductsWidgetRenderer"],
  ["const", "WcUpsellsWidgetRenderer"],
  ["const", "WcProductsWidgetRenderer"],
  ["const", "WcCustomAddToCartWidgetRenderer"],
  ["const", "WcProductCategoriesWidgetRenderer"],
  ["const", "WcMenuCartWidgetRenderer"],
  ["const", "WcCartWidgetRenderer"],
  ["const", "WcCheckoutWidgetRenderer"],
  ["const", "WcMyAccountWidgetRenderer"],
  ["const", "WcPurchaseSummaryWidgetRenderer"],
  ["const", "WcNoticesWidgetRenderer"],
  ["const", "WcShopLayoutsWidgetRenderer"],
  ["const", "WcProductArchiveWidgetRenderer"],
  ["const", "WcProductPageTemplatesWidgetRenderer"],
  ["const", "WcProductArchiveTemplatesWidgetRenderer"],
  ["const", "WcProductAddOnsWidgetRenderer"],
  ["const", "SearchBarWidgetRenderer"],
  ["const", "ImportAssetWidgetRenderer"],
  ["const", "ReusableComponentWidgetRenderer"],
  ["const", "FavoriteWidgetsWidgetRenderer"],
  ["const", "NestedTabsWidgetRenderer"],
  ["const", "NestedAccordionWidgetRenderer"],
  ["const", "DEFAULT_LOOP_ITEMS"],
  ["interface", "LoopGridWidgetRendererProps"],
  ["const", "LoopGridWidgetRenderer"],
];

function resolveModule(from: string, spec: string): string {
  const base = resolve(dirname(from), spec.replace(/\.js$/, ""));
  for (const ext of [".tsx", ".ts", "/index.tsx", "/index.ts"]) {
    try { readFileSync(base + ext); return base + ext; } catch { /* try next */ }
  }
  return base;
}

/** Exported declarations, following explicit relative re-exports into the declaring module. */
function exportSurface(file: string, depth = 0): Array<[string, string]> {
  const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: Array<[string, string]> = [];
  for (const s of sf.statements) {
    if (ts.isExportDeclaration(s)) {
      if (!s.moduleSpecifier || !ts.isStringLiteral(s.moduleSpecifier) || !s.exportClause || !ts.isNamedExports(s.exportClause) || depth > 3 || !s.moduleSpecifier.text.startsWith(".")) {
        out.push(["unsupported-export", s.getText(sf).slice(0, 60)]);
        continue;
      }
      const declared = new Map(exportSurface(resolveModule(file, s.moduleSpecifier.text), depth + 1).map(([k, n]) => [n, k]));
      for (const el of s.exportClause.elements) out.push([declared.get((el.propertyName ?? el.name).text) ?? "unresolved", el.name.text]);
      continue;
    }
    if (!ts.getModifiers(s as ts.HasModifiers)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    if (ts.isFunctionDeclaration(s)) out.push(["function", s.name!.text]);
    else if (ts.isVariableStatement(s)) for (const d of s.declarationList.declarations) out.push(["const", (d.name as ts.Identifier).text]);
    else if (ts.isInterfaceDeclaration(s)) out.push(["interface", s.name.text]);
    else if (ts.isTypeAliasDeclaration(s)) out.push(["type", s.name.text]);
    else out.push([ts.SyntaxKind[s.kind], "?"]);
  }
  return out;
}

describe("renderers.tsx export surface", () => {
  const actual = exportSurface(RENDERERS_FILE);

  it("golden list is 89 unique names", () => {
    expect(EXPECTED_SURFACE).toHaveLength(89);
    expect(new Set(EXPECTED_SURFACE.map(([, n]) => n)).size).toBe(89);
  });

  it("exports exactly the golden names with the same kinds (none missing, none added)", () => {
    const key = ([k, n]: [string, string]) => `${k} ${n}`;
    const actualSet = new Set(actual.map(key));
    const expectedSet = new Set(EXPECTED_SURFACE.map(key));
    expect(EXPECTED_SURFACE.map(key).filter((x) => !actualSet.has(x)), "missing or changed exports").toEqual([]);
    expect(actual.map(key).filter((x) => !expectedSet.has(x)), "unexpected exports").toEqual([]);
    expect(actual).toHaveLength(89);
  });

  it("widgets/index.ts still re-exports the renderers wholesale", () => {
    expect(readFileSync(resolve("src/pages/editor/widgets/index.ts"), "utf8").replace(/\r\n/g, "\n")).toContain('export * from "./renderers";');
  });
});
