import { describe, it, expect } from "vitest";
import { RoundTripContractService } from "../services/compiler/roundTripContract.service.js";

describe("Point 35: Supported Round-Trip and Source Ownership Contract", () => {
  describe("3.1 8-Category Construct Compatibility Matrix", () => {
    it("classifies Native JSX correctly as visually editable", () => {
      const code = `<div className="hero"><h1 data-forge-id="h1">Hello World</h1></div>`;
      const result = RoundTripContractService.classifyConstruct(code, "src/pages/Home.tsx");

      expect(result.category).toBe("NATIVE_JSX");
      expect(result.isVisuallyEditable).toBe(true);
      expect(result.isSourceOwned).toBe(false);
      expect(result.preservationStrategy).toBe("TWO_WAY_SYNC");
    });

    it("classifies Registered and Custom components as editable with props", () => {
      const code = `<HeroSection title="Welcome" subtitle="Builder" />`;
      const result = RoundTripContractService.classifyConstruct(code, "src/components/Home.tsx");

      expect(result.category).toBe("REGISTERED_COMPONENTS");
      expect(result.isVisuallyEditable).toBe(true);
      expect(result.preservationStrategy).toBe("TWO_WAY_SYNC");
    });

    it("classifies React Hooks and complex logic as Opaque Source-Owned with isolated preview", () => {
      const code = `
        const [count, setCount] = useState(0);
        useEffect(() => { console.log(count); }, [count]);
      `;
      const result = RoundTripContractService.classifyConstruct(code, "src/pages/Counter.tsx");

      expect(result.category).toBe("OPAQUE_SOURCE_OWNED");
      expect(result.isVisuallyEditable).toBe(false);
      expect(result.isSourceOwned).toBe(true);
      expect(result.preservationStrategy).toBe("ISOLATED_PREVIEW");
      expect(result.diagnostics.length).toBeGreaterThan(0);
    });

    it("classifies Backend, Prisma and API route source as BACKEND_SCHEMA_SOURCE without canvas nodes", () => {
      const code = `
        export async function GET(req: Request) {
          const users = await prisma.user.findMany();
          return Response.json(users);
        }
      `;
      const result = RoundTripContractService.classifyConstruct(code, "src/app/api/users/route.ts");

      expect(result.category).toBe("BACKEND_SCHEMA_SOURCE");
      expect(result.isVisuallyEditable).toBe(false);
      expect(result.isSourceOwned).toBe(true);
      expect(result.preservationStrategy).toBe("PRESERVE_UNTOUCHED");
    });

    it("classifies Syntax errors as PARSE_FAILURES_UNRESOLVED_IMPORTS preserving exact draft", () => {
      const code = `const a = <div Unclosed tag without closing`;
      const result = RoundTripContractService.classifyConstruct(code, "src/pages/Broken.tsx");

      expect(result.category).toBe("PARSE_FAILURES_UNRESOLVED_IMPORTS");
      expect(result.isVisuallyEditable).toBe(false);
      expect(result.isSourceOwned).toBe(true);
      expect(result.preservationStrategy).toBe("PRESERVE_UNTOUCHED");
    });
  });

  describe("3.2 Stable Mappings and Component Identity", () => {
    it("registers and validates stable mapping offsets against matching hash and revision", () => {
      const mapping = {
        pageId: "page_10",
        fileId: "file_10",
        componentDefId: "cmp_10",
        exportIdentity: "HomePage",
        nodeId: "node_h1",
        sourceLocationMapping: {
          startLine: 5,
          startCol: 4,
          endLine: 5,
          endCol: 30,
          startOffset: 120,
          endOffset: 150,
        },
        sourceHash: "hash_v1_abc",
        sourceRevision: 1,
        isSharedDefinition: false,
      };

      RoundTripContractService.registerMapping(mapping);

      // Valid check when hash and revision match
      const checkValid = RoundTripContractService.validateMappingOffsets(
        "page_10",
        "node_h1",
        "hash_v1_abc",
        1
      );
      expect(checkValid.isValid).toBe(true);

      // Stale check when revision changed
      const checkStale = RoundTripContractService.validateMappingOffsets(
        "page_10",
        "node_h1",
        "hash_v2_changed",
        2
      );
      expect(checkStale.isValid).toBe(false);
    });

    it("detects and repairs duplicate data-forge-id markers", () => {
      const codeWithDups = `
        <div data-forge-id="dup_1">First</div>
        <span data-forge-id="dup_1">Second</span>
      `;

      const repairResult = RoundTripContractService.detectAndRepairDuplicateIds(codeWithDups);
      expect(repairResult.hasDuplicates).toBe(true);
      expect(repairResult.duplicateIds).toContain("dup_1");
      // The second instance should be re-tagged with distinct ID suffix
      expect(repairResult.repairedCode).not.toEqual(codeWithDups);
    });

    it("preserves CMS and query bindings by preventing overwrite with static text", () => {
      RoundTripContractService.registerMapping({
        pageId: "page_cms",
        fileId: "file_cms",
        componentDefId: "cmp_cms",
        exportIdentity: "BlogPage",
        nodeId: "bound_node_1",
        sourceLocationMapping: {
          startLine: 1,
          startCol: 1,
          endLine: 1,
          endCol: 1,
          startOffset: 0,
          endOffset: 10,
        },
        sourceHash: "h1",
        sourceRevision: 1,
        isSharedDefinition: false,
        boundQueryExpression: "cms.post.title",
      });

      // Attempting to overwrite query binding with static text is prevented!
      const staticAttempt = RoundTripContractService.preserveQueryBindings(
        "bound_node_1",
        "Static Plain Title",
        "page_cms"
      );
      expect(staticAttempt.isAllowed).toBe(false);
      expect(staticAttempt.preservedExpression).toBe("cms.post.title");

      // Preserving expression or passing new expression is allowed
      const dynamicAttempt = RoundTripContractService.preserveQueryBindings(
        "bound_node_1",
        "{cms.post.title}",
        "page_cms"
      );
      expect(dynamicAttempt.isAllowed).toBe(true);
    });
  });

  describe("3.3 Round-Trip Laws", () => {
    it("Law 1: No-op parse/emit produces zero semantic changes", () => {
      const code = `<section><h1 data-forge-id="h1">Header</h1></section>`;
      const law1 = RoundTripContractService.verifyNoOpParseEmit(code);
      expect(law1.passed).toBe(true);
      expect(law1.differencesCount).toBe(0);
    });

    it("Law 2: Visual -> Source -> Visual preserves supported visual model", () => {
      const element = { id: "el_visual_test", text: "Test text" };
      const source = `<div><p data-forge-id="el_visual_test">Test text</p></div>`;
      const law2 = RoundTripContractService.verifyVisualToSourceToVisual(element, source);
      expect(law2.passed).toBe(true);
    });

    it("Law 3: Source -> Visual -> Source preserves unowned source and comments", () => {
      const protectedComments = ["/* FORGE:PROTECTED_LOGIC */", "// Hand-crafted analytics"];
      const source = `
        /* FORGE:PROTECTED_LOGIC */
        // Hand-crafted analytics
        export function Page() { return <div>Analytics</div>; }
      `;
      const law3 = RoundTripContractService.verifySourceToVisualToSource(source, protectedComments);
      expect(law3.passed).toBe(true);
      expect(law3.differencesCount).toBe(0);
    });

    it("publishes versioned compatibility matrix for React and Next.js", () => {
      const matrix = RoundTripContractService.publishCompatibilityMatrix("nextjs");
      expect(matrix.framework).toBe("nextjs");
      expect(matrix.categories.NATIVE_JSX.supported).toBe(true);
      expect(matrix.categories.OPAQUE_SOURCE_OWNED.editable).toBe(false);
      expect(matrix.categories.BACKEND_SCHEMA_SOURCE.losslessRoundTrip).toBe(true);
    });
  });
});
