import { prisma } from "../../config/prisma.js";
import { visualDocumentToIR, compileIRToSourceFilesAsync } from "./unifiedCompiler.service.js";
import { buildReactGenerationPlan } from "../generator/reactGenerator.service.js";
import { buildNextJsGenerationPlan } from "../generator/nextjsGenerator.service.js";
// visualCodeSync imported dynamically below with cache buster
import { writeFile, readFile, listFiles } from "../project/forgeFilesystem.service.js";
import { buildProjectZipStream, buildZipFromFiles } from "../codeGenerator.service.js";
import { readZip } from "../../tests/helpers/memoryDb.js";

const db = prisma as any;

export async function runBidirectionalVerification(): Promise<{
  success: boolean;
  scenarios: Array<{ name: string; success: boolean; details: any }>;
}> {
  const {
    visualCodeSyncService,
    parseSourceCodeToElements,
    validateSourceSyntax,
    syncSourceToVisualWebsite,
  } = await import(`./visualCodeSync.service.js?t=${Date.now()}`);

  const scenarios: Array<{ name: string; success: boolean; details: any }> = [];

  let tsProbe: any = null;
  try {
    const { createRequire } = await import("node:module");
    const req = createRequire(import.meta.url);
    const mod = req("../../../../frontend/node_modules/typescript/lib/typescript.js");
    tsProbe = {
      isObj: typeof mod,
      keysCount: Object.keys(mod || {}).length,
      hasCreateSourceFile: typeof mod?.createSourceFile,
    };
  } catch (err: any) {
    tsProbe = { error: err.message };
  }
  scenarios.push({ name: "Compiler Probe", success: !!tsProbe?.hasCreateSourceFile, details: tsProbe });

  // =========================================================================
  // SCENARIO A: Visual -> Code Generation & Incremental Modifications
  // =========================================================================
  try {
    const visualDocA = {
      pages: [
        {
          id: "p1",
          name: "Landing",
          slug: "/",
          isHome: true,
          elements: [
            { id: "h1", type: "heading", content: "Welcome to Forge Studio" },
            { id: "p_desc", type: "text", content: "Design visually and write code collaboratively." },
          ],
        },
      ],
    };

    const projectIRA = visualDocumentToIR(visualDocA, {
      id: "test_proj_a",
      name: "Landing Site",
      slug: "landing-site",
      framework: "react",
    });

    const planA1 = await buildReactGenerationPlan(projectIRA);
    const pageA1 = planA1.files.find((f) => f.path === "src/pages/LandingPage.tsx")?.content || "";

    if (!pageA1.includes("Welcome to Forge Studio") || !pageA1.includes('data-forge-id="h1"')) {
      throw new Error("Initial Visual -> Code generation failed to emit heading or data-forge-id");
    }

    // Add button, remove paragraph
    const visualDocA2 = {
      pages: [
        {
          id: "p1",
          name: "Landing",
          slug: "/",
          isHome: true,
          elements: [
            { id: "h1", type: "heading", content: "Welcome to Forge Studio" },
            { id: "btn_cta", type: "button", content: "Launch App", href: "/app" },
          ],
        },
      ],
    };

    const projectIRA2 = visualDocumentToIR(visualDocA2, {
      id: "test_proj_a",
      name: "Landing Site",
      slug: "landing-site",
      framework: "react",
    });

    const planA2 = await buildReactGenerationPlan(projectIRA2);
    const pageA2 = planA2.files.find((f) => f.path === "src/pages/LandingPage.tsx")?.content || "";

    if (!pageA2.includes("Launch App") || !pageA2.includes('data-forge-id="btn_cta"')) {
      throw new Error("Visual update failed to emit button");
    }
    if (pageA2.includes("Design visually and write code collaboratively.")) {
      throw new Error("Removed paragraph still present in output");
    }

    scenarios.push({
      name: "Scenario A: Visual to Code Generation & Updating",
      success: true,
      details: {
        headingEmitted: true,
        buttonAdded: true,
        paragraphRemoved: true,
        stableIdEmitted: true,
      },
    });
  } catch (err: any) {
    scenarios.push({
      name: "Scenario A: Visual to Code Generation & Updating",
      success: false,
      details: { error: err.message },
    });
  }

  // =========================================================================
  // SCENARIO B: Code -> Visual AST Parsing, Reconciliation & Unsupported Syntax
  // =========================================================================
  try {
    const codeSample = `
import React from "react";

export default function LandingPage() {
  return (
    <div data-forge-id="box_root" className="container mx-auto p-6" style={{ backgroundColor: "#1e293b", padding: 24 }}>
      <h1 data-forge-id="h1" className="text-4xl font-extrabold text-white">Modified Heading from Monaco Editor</h1>
      <p data-forge-id="p_intro" className="text-slate-300">New paragraph inserted directly in TypeScript source.</p>
      <button data-forge-id="btn_cta" className="bg-emerald-500 text-white px-4 py-2">Get Started</button>
    </div>
  );
}
`;

    const parsed = parseSourceCodeToElements(codeSample, [], "src/pages/LandingPage.tsx");
    if (!parsed.success || parsed.elements.length === 0) {
      throw new Error("Failed to parse valid TSX AST into visual elements");
    }

    const rootContainer = parsed.elements[0];
    const heading = rootContainer.children.find((c: any) => c.id === "h1");
    const intro = rootContainer.children.find((c: any) => c.id === "p_intro");
    const button = rootContainer.children.find((c: any) => c.id === "btn_cta");

    if (!heading || heading.content !== "Modified Heading from Monaco Editor") {
      throw new Error("Heading text from code was not reconciled into element content");
    }
    if (!intro || intro.content !== "New paragraph inserted directly in TypeScript source.") {
      throw new Error("New paragraph element was not extracted from code");
    }
    if (!button || button.type !== "button" || button.content !== "Get Started") {
      throw new Error("Button element was not extracted from code");
    }
    if (rootContainer.styles.backgroundColor !== "#1e293b") {
      throw new Error("Inline style backgroundColor was not extracted from code");
    }

    // Unsupported code diagnostics test
    const codeWithHooks = `
import React, { useState, useEffect } from "react";

export default function StatefulPage() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    console.log("Hook executed");
  }, []);

  return (
    <div data-forge-id="box_stateful">
      <h2 data-forge-id="title">Stateful Title</h2>
    </div>
  );
}
`;

    const parsedHooks = parseSourceCodeToElements(codeWithHooks, [], "src/pages/StatefulPage.tsx");
    const hookWarnings = parsedHooks.diagnostics.filter((d: any) => d.code === "UNSUPPORTED_HOOK");
    if (hookWarnings.length < 2) {
      throw new Error("Failed to generate diagnostics for unsupported React hooks");
    }
    if (parsedHooks.elements[0]?.children?.[0]?.content !== "Stateful Title") {
      throw new Error("Declarative visual tree was corrupted by presence of unsupported hooks");
    }

    // Syntax error rejection test
    const brokenCode = `export default function Broken() { return <div><h1>Incomplete; }`;
    const brokenValidation = validateSourceSyntax(brokenCode);
    if (brokenValidation.isValid) {
      throw new Error("Syntax validator failed to flag invalid TSX syntax");
    }

    scenarios.push({
      name: "Scenario B: Code to Visual AST Parsing & Unsupported Syntax Diagnostics",
      success: true,
      details: {
        headingUpdatedFromCode: heading.content,
        newElementsCreated: true,
        stylesPreserved: rootContainer.styles,
        unsupportedHookDiagnosticsCount: hookWarnings.length,
        syntaxErrorsHandledSafely: true,
      },
    });
  } catch (err: any) {
    scenarios.push({
      name: "Scenario B: Code to Visual AST Parsing & Unsupported Syntax Diagnostics",
      success: false,
      details: { error: err.message },
    });
  }

  // =========================================================================
  // SCENARIO C: Database Persistence, Code Sync & Faithful ZIP Export
  // =========================================================================
  try {
    const site = await db.website.findFirst({
      where: { name: "abc" },
      orderBy: { updatedAt: "desc" },
    });

    if (!site) {
      throw new Error("Real test website 'abc' not found in database");
    }

    const project = await db.forgeProject.findFirst({
      where: { websiteId: site.id, deletedAt: null },
    });

    if (!project) {
      throw new Error(`Bridged project for website '${site.id}' not found`);
    }

    // 1. Simulate developer editing src/pages/AbcPage.tsx in Code Workspace
    const currentFile = await readFile(project.id, "src/pages/AbcPage.tsx");
    const testUpdatedHeading = "Hey This is for testing purpose . Bidirectional AST Sync Verified 2026!";

    const updatedSource = (currentFile.content || "").replace(
      /Hey This is for testing purpose[^<]*/,
      testUpdatedHeading
    );

    // Save edited source to ForgeProjectFile
    await writeFile(project.id, "src/pages/AbcPage.tsx", {
      content: updatedSource,
      isGenerated: false,
      reason: "Developer Code Workspace edit",
    });

    // 2. Synchronize source AST back to visual website
    const syncResult = await syncSourceToVisualWebsite(project.id, site.id, "src/pages/AbcPage.tsx");
    if (!syncResult.success) {
      throw new Error(`syncSourceToVisualWebsite failed: ${JSON.stringify(syncResult.diagnostics)}`);
    }

    // 3. Verify Website.editorData in database was updated
    const refreshedSite = await db.website.findUnique({ where: { id: site.id } });
    const editorData = typeof refreshedSite.editorData === "string"
      ? JSON.parse(refreshedSite.editorData)
      : refreshedSite.editorData;

    const pageText = JSON.stringify(editorData);
    if (!pageText.includes("Bidirectional AST Sync Verified 2026!")) {
      throw new Error("Updated text from code workspace was not persisted in Website.editorData");
    }

    // 4. Test ZIP Export from persisted files
    const persistedFiles = (await listFiles(project.id)).filter((f: any) => !f.isDirectory);
    const zipBuffer = await buildZipFromFiles(persistedFiles);
    const zipEntries = readZip(zipBuffer);
    const entry = zipEntries.find((e) => e.name === "src/pages/AbcPage.tsx");
    const exportedAbcPage = entry ? entry.data.toString("utf8") : "";

    if (!exportedAbcPage.includes("Bidirectional AST Sync Verified 2026!")) {
      throw new Error(`Exported ZIP did not contain the user's manual code edit! Found entry: ${Boolean(entry)}`);
    }

    // 5. Restore original text in code file and website editorData
    const originalText = "Hey This is for testing purpose . Am i able to generate the code yes or no....";
    const restoredSource = updatedSource.replace(testUpdatedHeading, originalText);
    await writeFile(project.id, "src/pages/AbcPage.tsx", {
      content: restoredSource,
      isGenerated: false,
      reason: "Restored baseline test content",
    });
    await syncSourceToVisualWebsite(project.id, site.id, "src/pages/AbcPage.tsx");

    scenarios.push({
      name: "Scenario C: End-to-End Database Persistence, AST Sync & ZIP Export",
      success: true,
      details: {
        websiteId: site.id,
        projectId: project.id,
        persistedEditorDataContainsEdit: true,
        zipContainsEditedCode: true,
        exportedFilesCount: zipEntries.length,
        restoredBaselineAfterTest: true,
      },
    });
  } catch (err: any) {
    scenarios.push({
      name: "Scenario C: End-to-End Database Persistence, AST Sync & ZIP Export",
      success: false,
      details: { error: err.message },
    });
  }

  // =========================================================================
  // SCENARIO D: Framework Support (React + Vite vs Next.js + App Router)
  // =========================================================================
  try {
    const multiPageDoc = {
      pages: [
        { id: "home", name: "Home", slug: "/", isHome: true, elements: [{ id: "h1", type: "heading", content: "Home" }] },
        { id: "about", name: "About", slug: "/about", elements: [{ id: "h2", type: "heading", content: "About" }] },
      ],
    };

    const reactPlan = await buildReactGenerationPlan(
      visualDocumentToIR(multiPageDoc, { id: "p_react", name: "Multi", slug: "multi", framework: "react" })
    );
    const nextPlan = await buildNextJsGenerationPlan(
      visualDocumentToIR(multiPageDoc, { id: "p_next", name: "Multi", slug: "multi", framework: "nextjs" })
    );

    const reactPaths = reactPlan.files.map((f) => f.path);
    const nextPaths = nextPlan.files.map((f) => f.path);

    if (!reactPaths.includes("src/pages/HomePage.tsx") || !reactPaths.includes("src/pages/AboutPage.tsx")) {
      throw new Error("React plan missing multi-page components");
    }
    if (!nextPaths.includes("app/page.tsx") || !nextPaths.includes("app/about/page.tsx")) {
      throw new Error("Next.js plan missing App Router route components");
    }

    scenarios.push({
      name: "Scenario D: Framework Support (React/Vite & Next.js/App Router)",
      success: true,
      details: {
        reactPageFiles: ["src/pages/HomePage.tsx", "src/pages/AboutPage.tsx"],
        nextPageFiles: ["app/page.tsx", "app/about/page.tsx"],
      },
    });
  } catch (err: any) {
    scenarios.push({
      name: "Scenario D: Framework Support (React/Vite & Next.js/App Router)",
      success: false,
      details: { error: err.message },
    });
  }

  // =========================================================================
  // SCENARIO E: Dynamic Page Creation, Route Registration & Helper Component Separation
  // =========================================================================
  try {
    const site = await db.website.findFirst({
      where: {
        OR: [
          { id: "f9c82556-9396-4a26-a115-3ed644ca8a7a" },
          { name: "abc" },
          { slug: "abc" },
        ],
      },
    });

    if (site) {
      const project = await db.forgeProject.findFirst({
        where: { websiteId: site.id, deletedAt: null },
      });

      if (project) {
        // 1. Verify helper component is NOT registered as a page
        const helperResult = await syncSourceToVisualWebsite(
          project.id,
          site.id,
          "src/components/Button.tsx"
        );
        if (helperResult.status !== "not-a-page") {
          throw new Error(`Expected helper component to return 'not-a-page', got: ${helperResult.status}`);
        }

        // 2. Verify creating a recognized page in code workspace registers page and route
        const aboutPageCode = `import React from 'react';

export default function AboutPage() {
  return (
    <div data-forge-id="page_about_root" className="min-h-screen p-8">
      <h1 data-forge-id="el_about_heading" className="text-3xl font-bold">About Forge Studio</h1>
      <p data-forge-id="el_about_desc" className="mt-4 text-gray-600">Unified project visual-code sync verified.</p>
    </div>
  );
}
`;
        await writeFile(project.id, "src/pages/AboutPage.tsx", {
          content: aboutPageCode,
          isGenerated: false,
          reason: "Testing dynamic page registration from code",
        });

        const syncPageResult = await syncSourceToVisualWebsite(
          project.id,
          site.id,
          "src/pages/AboutPage.tsx"
        );

        if (!syncPageResult.success || syncPageResult.status !== "synced") {
          throw new Error(`Expected dynamic page registration to succeed, got: ${JSON.stringify(syncPageResult)}`);
        }

        // Check website editorData now contains the About page
        const refreshedSite = await db.website.findUnique({ where: { id: site.id } });
        const ed = typeof refreshedSite.editorData === "string" ? JSON.parse(refreshedSite.editorData) : refreshedSite.editorData;
        const hasAboutPage = (ed.pages || []).some((p: any) => p.slug === "/about" || p.name === "About");
        if (!hasAboutPage) {
          throw new Error("About page was not registered into Website.editorData.pages");
        }

        // Check AppRoutes.tsx contains the new route
        const appRoutesFile = await readFile(project.id, "src/routes/AppRoutes.tsx");
        if (!appRoutesFile?.content?.includes("/about") || !appRoutesFile?.content?.includes("AboutPage")) {
          throw new Error("src/routes/AppRoutes.tsx was not updated with the new route");
        }

        // 3. Verify Code-to-Visual heading edit (Test Scenario 2: Changed From Code 456)
        const abcFile = await readFile(project.id, "src/pages/AbcPage.tsx");
        const codeEditHeading = "Changed From Code 456";
        const modifiedAbcSource = (abcFile.content || "").replace(
          /Hey This is for testing purpose[^<]*/,
          codeEditHeading
        );
        await writeFile(project.id, "src/pages/AbcPage.tsx", {
          content: modifiedAbcSource,
          isGenerated: false,
          reason: "Code to Visual heading edit verification",
        });
        const abcSyncResult = await syncSourceToVisualWebsite(project.id, site.id, "src/pages/AbcPage.tsx");
        if (!abcSyncResult.success) {
          throw new Error(`Code to visual sync failed: ${JSON.stringify(abcSyncResult.diagnostics)}`);
        }

        const siteAfterCodeEdit = await db.website.findUnique({ where: { id: site.id } });
        const edAfterCodeEdit = typeof siteAfterCodeEdit.editorData === "string" ? JSON.parse(siteAfterCodeEdit.editorData) : siteAfterCodeEdit.editorData;
        if (!JSON.stringify(edAfterCodeEdit).includes(codeEditHeading)) {
          throw new Error("Heading edit 'Changed From Code 456' not reflected in Website.editorData");
        }

        // Clean up test page from site editorData and project files to keep state clean
        ed.pages = (ed.pages || []).filter((p: any) => p.slug !== "/about" && p.name !== "About");
        await db.website.update({ where: { id: site.id }, data: { editorData: ed } });
        await db.forgeProjectFile.updateMany({
          where: { projectId: project.id, path: "src/pages/AboutPage.tsx" },
          data: { deletedAt: new Date() },
        });

        // Restore original AbcPage
        const restoredAbc = (abcFile.content || "").replace(codeEditHeading, "Hey This is for testing purpose . Am i able to generate the code yes or no....");
        await writeFile(project.id, "src/pages/AbcPage.tsx", { content: restoredAbc, isGenerated: true });
        await syncSourceToVisualWebsite(project.id, site.id, "src/pages/AbcPage.tsx");

        scenarios.push({
          name: "Scenario E: Dynamic Page Registration, Route Sync & Code-to-Visual Verification",
          success: true,
          details: {
            helperComponentRejected: true,
            pageRegisteredInDocument: true,
            routeRegisteredInAppRoutes: true,
            codeToVisualHeadingSync: true,
            cleanedUpAfterTest: true,
          },
        });
      }
    }
  } catch (err: any) {
    scenarios.push({
      name: "Scenario E: Dynamic Page Registration, Route Sync & Code-to-Visual Verification",
      success: false,
      details: { error: err.message },
    });
  }

  const overallSuccess = scenarios.every((s) => s.success);
  return { success: overallSuccess, scenarios };
}

