/* global describe, it, expect -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Regression guard: public export surface of src/pages/editor/inspector/DynamicWidgetInspectors.tsx.
 *
 * Captured from the unmodified module: 61 exports (52 *Inspector components, 4 shared helpers,
 * 4 constants, 1 interface), in source order. Read with the TypeScript compiler API so type-only exports
 * (DisplayConditionItem) are covered too. When inspectors are moved into their own modules, this file
 * must keep exposing exactly these names (directly or by explicit re-export).
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import ts from "typescript";

const INSPECTORS_FILE = resolve("src/pages/editor/inspector/DynamicWidgetInspectors.tsx");

/** [kind, name] in source order. */
const EXPECTED_SURFACE: Array<[string, string]> = [
  ["const", "triggerImagePicker"],
  ["const", "handleImageFileUpload"],
  ["const", "PRESET_SAMPLE_IMAGES"],
  ["function", "ImagePickerControl"],
  ["function", "UniversalItemManager"],
  ["function", "ImageWidgetInspector"],
  ["function", "BackgroundImageInspector"],
  ["function", "VideoWidgetInspector"],
  ["function", "GalleryWidgetInspector"],
  ["function", "SlidesWidgetInspector"],
  ["function", "ShareButtonsInspector"],
  ["function", "FormWidgetInspector"],
  ["function", "ReviewsWidgetInspector"],
  ["function", "VideoPlaylistInspector"],
  ["function", "NavMenuWidgetInspector"],
  ["function", "CountdownWidgetInspector"],
  ["function", "LottieWidgetInspector"],
  ["function", "CodeHighlightWidgetInspector"],
  ["function", "UniversalIconControls"],
  ["function", "IconLibraryWidgetInspector"],
  ["function", "ButtonWidgetInspector"],
  ["function", "PortfolioWidgetInspector"],
  ["function", "LoginWidgetInspector"],
  ["function", "AnimatedTextWidgetInspector"],
  ["function", "PriceTableWidgetInspector"],
  ["function", "PriceListWidgetInspector"],
  ["function", "FlipBoxWidgetInspector"],
  ["function", "CTAWidgetInspector"],
  ["function", "MediaCarouselWidgetInspector"],
  ["function", "TestimonialCarouselWidgetInspector"],
  ["function", "NestedCarouselWidgetInspector"],
  ["function", "LoopCarouselWidgetInspector"],
  ["function", "TOCWidgetInspector"],
  ["function", "FacebookWidgetInspector"],
  ["function", "BlockquoteWidgetInspector"],
  ["function", "PaymentWidgetInspector"],
  ["function", "WooCommerceWidgetInspector"],
  ["function", "AudioPlaylistInspector"],
  ["function", "PayPalWidgetInspector"],
  ["function", "LinkInBioWidgetInspector"],
  ["function", "ImageBoxWidgetInspector"],
  ["function", "IconBoxWidgetInspector"],
  ["function", "IconListWidgetInspector"],
  ["function", "CounterWidgetInspector"],
  ["function", "ProgressBarWidgetInspector"],
  ["function", "RatingWidgetInspector"],
  ["function", "AlertWidgetInspector"],
  ["function", "GoogleMapsWidgetInspector"],
  ["function", "DividerWidgetInspector"],
  ["function", "SpacerWidgetInspector"],
  ["function", "CustomSVGWidgetInspector"],
  ["function", "QueryBuilderWidgetInspector"],
  ["const", "FS_DISPLAY_CONDITIONS_CLIPBOARD_KEY"],
  ["interface", "DisplayConditionItem"],
  ["function", "validateDisplayConditionsData"],
  ["function", "DisplayConditionsWidgetInspector"],
  ["function", "NestedTabsWidgetInspector"],
  ["function", "NestedAccordionWidgetInspector"],
  ["function", "ScrollSnapInspector"],
  ["function", "MasonryLayoutInspector"],
  ["function", "WpLegacyWidgetInspector"],
];

/** Exported declarations, following explicit relative re-exports into the module that declares them. */
function exportSurface(file: string, depth = 0): Array<[string, string]> {
  const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: Array<[string, string]> = [];
  for (const s of sf.statements) {
    if (ts.isExportDeclaration(s)) {
      if (!s.moduleSpecifier || !ts.isStringLiteral(s.moduleSpecifier) || !s.exportClause || !ts.isNamedExports(s.exportClause)) {
        out.push(["unsupported-export", s.getText(sf).slice(0, 60)]);
        continue;
      }
      if (depth > 3 || !s.moduleSpecifier.text.startsWith(".")) { out.push(["unresolved-reexport", s.moduleSpecifier.text]); continue; }
      const target = ts.sys.resolvePath(resolve(dirname(file), s.moduleSpecifier.text.replace(/\.js$/, "") + ".tsx"));
      const targetFile = ts.sys.fileExists(target) ? target : target.replace(/\.tsx$/, ".ts");
      const declared = new Map(exportSurface(targetFile, depth + 1).map(([k, n]) => [n, k]));
      for (const el of s.exportClause.elements) {
        const local = (el.propertyName ?? el.name).text;
        out.push([declared.get(local) ?? "unresolved", el.name.text]);
      }
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

describe("DynamicWidgetInspectors export surface", () => {
  const actual = exportSurface(INSPECTORS_FILE);

  it("golden list is 61 unique names", () => {
    expect(EXPECTED_SURFACE).toHaveLength(61);
    expect(new Set(EXPECTED_SURFACE.map(([, n]) => n)).size).toBe(61);
  });

  it("exports exactly the golden names with the same kinds (none missing, none added)", () => {
    const key = ([k, n]: [string, string]) => `${k} ${n}`;
    const actualSet = new Set(actual.map(key));
    const expectedSet = new Set(EXPECTED_SURFACE.map(key));
    expect(EXPECTED_SURFACE.map(key).filter((x) => !actualSet.has(x)), "missing or changed exports").toEqual([]);
    expect(actual.map(key).filter((x) => !expectedSet.has(x)), "unexpected exports").toEqual([]);
    expect(actual).toHaveLength(61);
  });

  it("all 52 inspector components are exported functions", () => {
    const inspectors = actual.filter(([, n]) => n.endsWith("Inspector"));
    expect(inspectors).toHaveLength(52);
    expect(inspectors.filter(([k]) => k !== "function")).toEqual([]);
  });
});
