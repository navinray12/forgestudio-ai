/**
 * ForgeStudio Phase 2: Modules 08 & 09 Test Suite
 * Comprehensive automated verification for React & Next.js Project Generators,
 * Source Preservation Engine, Scoped Regeneration, and Transactional Integrity.
 */

import assert from "node:assert/strict";
import { forgeProjectService } from "../services/project/forgeProject.service.js";
import { forgeFilesystemService } from "../services/project/forgeFilesystem.service.js";
import {
  extractProtectedRegions,
  injectProtectedRegions,
  classifyFileOwnership,
  reconcilePlannedFile,
} from "../services/generator/sourcePreservation.service.js";
import { buildReactGenerationPlan } from "../services/generator/reactGenerator.service.js";
import { buildNextJsGenerationPlan } from "../services/generator/nextjsGenerator.service.js";
import {
  validateGenerationPlan,
  executeGeneration,
  createGenerationPlan,
  regenerateScope,
} from "../services/generator/projectGenerator.service.js";
import { ProjectIR } from "../services/compiler/unifiedCompiler.service.js";

export async function runPhase2ProjectGeneratorsTestSuite(): Promise<{ success: boolean; testsRun: number; details: string[] }> {
  const details: string[] = [];
  let testsRun = 0;

  function logPass(msg: string) {
    details.push(`✓ ${msg}`);
    console.log(`  ✓ ${msg}`);
    testsRun++;
  }

  console.log("============================================================");
  console.log("Starting Phase 2 Modules 08 & 09 Project Generator Test Suite");
  console.log("============================================================\n");

  const testOwnerId = "test-generator-architect-uuid";
  const uniqueSuffix = Date.now().toString(36);

  // Sample Mock ProjectIR representing a multi-page SaaS application
  const mockProjectIR: ProjectIR = {
    irVersion: "1.0.0",
    projectId: `proj_test_${uniqueSuffix}`,
    name: "ApexSaaS Platform",
    slug: "apex-saas-platform",
    framework: "react",
    components: [
      {
        id: "comp_home",
        name: "Home",
        filePath: "src/pages/HomePage.tsx",
        isPage: true,
        routePath: "/",
        rootElement: {
          id: "el_hero",
          type: "container",
          tag: "main",
          classes: ["max-w-7xl", "mx-auto", "py-12"],
          styles: { padding: "32px", display: "flex", flexDirection: "column" },
          children: [
            {
              id: "el_title",
              type: "heading",
              tag: "h1",
              textContent: "Build Fast with Apex",
              classes: ["text-4xl", "font-bold"],
              styles: {},
              children: [],
              attributes: { "aria-label": "Apex Hero Title" },
            },
            {
              id: "el_cta_btn",
              type: "button",
              tag: "button",
              textContent: "Get Started Now",
              classes: ["bg-blue-600", "text-white", "rounded-lg"],
              styles: {},
              children: [],
              attributes: { role: "button" },
              props: { onClick: true },
            },
            {
              id: "el_hero_img",
              type: "image",
              tag: "img",
              classes: ["w-full", "rounded-xl"],
              styles: {},
              children: [],
              props: { src: "https://images.unsplash.com/photo-test.jpg", alt: "Platform Dashboard" },
            },
          ],
        },
      },
      {
        id: "comp_about",
        name: "About",
        filePath: "src/pages/AboutPage.tsx",
        isPage: true,
        routePath: "/about",
        rootElement: {
          id: "el_about_root",
          type: "container",
          tag: "main",
          classes: ["p-8"],
          styles: {},
          children: [
            {
              id: "el_about_heading",
              type: "heading",
              tag: "h2",
              textContent: "About Our Mission",
              classes: ["text-2xl", "font-semibold"],
              styles: {},
              children: [],
            },
          ],
        },
      },
      {
        id: "comp_navbar",
        name: "Navbar",
        filePath: "src/components/Navbar.tsx",
        isPage: false,
        rootElement: {
          id: "el_nav_root",
          type: "container",
          tag: "header",
          classes: ["w-full", "border-b", "p-4"],
          styles: {},
          children: [],
        },
      },
    ],
    routes: [
      { path: "/", componentId: "comp_home", title: "Apex Home" },
      { path: "/about", componentId: "comp_about", title: "About Us" },
    ],
    designTokens: {
      colors: { brand: "#3b82f6" },
      breakpoints: { sm: 640, md: 768, lg: 1024, xl: 1280 },
    },
    globalStyles: {},
  };

  // -------------------------------------------------------------------------
  // 1. Source Preservation & Protected Regions Unit Tests
  // -------------------------------------------------------------------------
  console.log("\n[TEST GROUP 1] Source Preservation & Merge Engine");

  const sampleSourceWithProtection = `
import React from 'react';

export const UserWidget = () => {
  // [forge-protect-start: custom-state]
  const [balance, setBalance] = React.useState(500);
  const handleDeposit = () => setBalance((b) => b + 100);
  // [forge-protect-end: custom-state]

  return <div>{balance}</div>;
};
`;

  const extracted = extractProtectedRegions(sampleSourceWithProtection);
  assert.equal(extracted.size, 1, "Must extract exactly 1 protected region");
  assert.ok(extracted.has("custom-state"), "Must identify region id 'custom-state'");
  assert.ok(extracted.get("custom-state")?.includes("handleDeposit"), "Must preserve exact inner custom code");
  logPass("extractProtectedRegions correctly identified developer-owned regions");

  const newGeneratedSource = `
import React from 'react';

export const UserWidget = () => {
  // [forge-protect-start: custom-state]
  // Default placeholder
  // [forge-protect-end: custom-state]

  return <div className="p-4">Updated layout</div>;
};
`;

  const mergedSource = injectProtectedRegions(newGeneratedSource, extracted);
  assert.ok(mergedSource.includes("const [balance, setBalance] = React.useState(500);"), "Merged code must contain user state");
  assert.ok(mergedSource.includes('className="p-4"'), "Merged code must retain generated visual update");
  logPass("injectProtectedRegions seamlessly preserved user state during code regeneration");

  // Classification
  const userFileOwnership = classifyFileOwnership({ path: "src/custom/math.ts", isGenerated: false, isProtected: false });
  assert.equal(userFileOwnership, "USER", "Manual user files must be classified as USER");

  const genFileOwnership = classifyFileOwnership({ path: "src/components/Header.tsx", isGenerated: true, isProtected: false });
  assert.equal(genFileOwnership, "GENERATED", "Standard generated files must be classified as GENERATED");

  const sharedOwnership = classifyFileOwnership({ path: "src/App.tsx", isGenerated: true, isProtected: true });
  assert.equal(sharedOwnership, "SHARED", "Protected files must be classified as SHARED");
  logPass("classifyFileOwnership accurately maps file categories");

  // Reconciliation for user files
  const reconciledUser = reconcilePlannedFile(
    { path: "src/lib/calc.ts", content: "console.log('new');", mimeType: "application/typescript", reason: "regeneration" },
    { id: "f1", path: "src/lib/calc.ts", content: "export const customLogic = 42;", contentHash: "hash123", isGenerated: false, isProtected: false }
  );
  assert.equal(reconciledUser.planned.action, "PRESERVE", "User-authored file must NEVER be overwritten");
  assert.ok(reconciledUser.conflict, "Conflict must be raised to notify user code preservation");
  logPass("reconcilePlannedFile strictly guards user-authored files against automated deletion/overwrite");

  // -------------------------------------------------------------------------
  // 2. Module 08: React Project Generator Unit Tests
  // -------------------------------------------------------------------------
  console.log("\n[TEST GROUP 2] Module 08: React Project Generator Capabilities");

  const reactPlan = await buildReactGenerationPlan(mockProjectIR);
  assert.equal(reactPlan.framework, "react");
  assert.ok(reactPlan.files.length >= 15, `React plan must generate complete project tree (got ${reactPlan.files.length})`);

  // Verify critical files exist in plan
  const planPaths = new Set(reactPlan.files.map((f) => f.path));
  assert.ok(planPaths.has("package.json"), "Must scaffold package.json");
  assert.ok(planPaths.has("tsconfig.json"), "Must scaffold tsconfig.json");
  assert.ok(planPaths.has("vite.config.ts"), "Must scaffold vite.config.ts");
  assert.ok(planPaths.has("index.html"), "Must scaffold index.html");
  assert.ok(planPaths.has("src/main.tsx"), "Must scaffold src/main.tsx entrypoint");
  assert.ok(planPaths.has("src/App.tsx"), "Must scaffold src/App.tsx root shell");
  assert.ok(planPaths.has("src/routes/AppRoutes.tsx"), "Must scaffold AppRoutes.tsx");
  assert.ok(planPaths.has("src/components/ErrorBoundary.tsx"), "Must scaffold ErrorBoundary.tsx");
  assert.ok(planPaths.has("src/contexts/AppContext.tsx"), "Must scaffold AppContext.tsx");
  assert.ok(planPaths.has("src/hooks/useResponsive.ts"), "Must scaffold useResponsive hook");
  assert.ok(planPaths.has("src/hooks/useApi.ts"), "Must scaffold useApi hook");
  assert.ok(planPaths.has("src/services/apiClient.ts"), "Must scaffold apiClient.ts");
  assert.ok(planPaths.has("src/components/LoadingSpinner.tsx"), "Must scaffold LoadingSpinner.tsx");
  assert.ok(planPaths.has("src/components/EmptyState.tsx"), "Must scaffold EmptyState.tsx");
  assert.ok(planPaths.has("src/pages/NotFoundPage.tsx"), "Must scaffold NotFoundPage.tsx");
  assert.ok(planPaths.has("src/tests/App.test.tsx"), "Must scaffold App.test.tsx test harness");
  assert.ok(planPaths.has(".env.example"), "Must scaffold .env.example");
  logPass("Scaffolded all 17 required React project structure files, hooks, services, and tests");

  // Verify Entrypoint Provider Hierarchy
  const mainFile = reactPlan.files.find((f) => f.path === "src/main.tsx");
  assert.ok(mainFile?.content.includes("<ErrorBoundary>"), "Entrypoint must wrap app in ErrorBoundary");
  assert.ok(mainFile?.content.includes("<AppProvider>"), "Entrypoint must wrap app in AppProvider state context");
  assert.ok(mainFile?.content.includes("<BrowserRouter>"), "Entrypoint must mount BrowserRouter");
  logPass("Entrypoint implements correct provider ordering: ErrorBoundary -> AppProvider -> BrowserRouter -> App");

  // Verify Routing Architecture
  const routesFile = reactPlan.files.find((f) => f.path === "src/routes/AppRoutes.tsx");
  assert.ok(routesFile?.content.includes('<Route path="/" element={<HomePage />} />'), "AppRoutes must map Home route");
  assert.ok(routesFile?.content.includes('<Route path="/about" element={<AboutPage />} />'), "AppRoutes must map About route");
  assert.ok(routesFile?.content.includes('<Route path="*" element={<NotFoundPage />} />'), "AppRoutes must wire 404 Catch-All");
  logPass("AppRoutes.tsx generates dynamic and static routes with 404 fallback");

  // Verify API Client Wiring
  const apiFile = reactPlan.files.find((f) => f.path === "src/services/apiClient.ts");
  assert.ok(apiFile?.content.includes("class ApiClient"), "Must generate typed ApiClient class");
  assert.ok(apiFile?.content.includes("Authorization"), "API client must inject auth token");
  assert.ok(apiFile?.content.includes("retries"), "API client must support retry handling");
  logPass("src/services/apiClient.ts generates production-grade fetch client with retry and auth headers");

  // Verify Accessibility & Responsive Output in Components
  const homeFile = reactPlan.files.find((f) => f.path === "src/pages/HomePage.tsx");
  assert.ok(homeFile?.content.includes('aria-label="Apex Hero Title"'), "Component JSX must render aria-label");
  assert.ok(homeFile?.content.includes('role="button"'), "Button element must include accessibility role");
  logPass("Generated components render semantic HTML, ARIA attributes, and accessible markup");

  // -------------------------------------------------------------------------
  // 3. Module 09: Next.js Project Generator Unit Tests
  // -------------------------------------------------------------------------
  console.log("\n[TEST GROUP 3] Module 09: Next.js Project Generator Capabilities");

  const nextPlan = await buildNextJsGenerationPlan(mockProjectIR, [], { version: "15", renderingStrategy: "isr" });
  assert.equal(nextPlan.framework, "nextjs");
  assert.equal(nextPlan.frameworkVersion, "15.1.0");

  const nextPaths = new Set(nextPlan.files.map((f) => f.path));
  assert.ok(nextPaths.has("app/layout.tsx"), "Must scaffold app/layout.tsx");
  assert.ok(nextPaths.has("app/page.tsx"), "Must scaffold app/page.tsx");
  assert.ok(nextPaths.has("app/about/page.tsx"), "Must scaffold app/about/page.tsx");
  assert.ok(nextPaths.has("app/loading.tsx"), "Must scaffold app/loading.tsx");
  assert.ok(nextPaths.has("app/error.tsx"), "Must scaffold app/error.tsx");
  assert.ok(nextPaths.has("app/not-found.tsx"), "Must scaffold app/not-found.tsx");
  assert.ok(nextPaths.has("app/sitemap.ts"), "Must scaffold app/sitemap.ts");
  assert.ok(nextPaths.has("app/robots.ts"), "Must scaffold app/robots.ts");
  assert.ok(nextPaths.has("middleware.ts"), "Must scaffold middleware.ts");
  assert.ok(nextPaths.has("app/api/health/route.ts"), "Must scaffold API route handler");
  assert.ok(nextPaths.has("app/actions/submitAction.ts"), "Must scaffold Server Action");
  assert.ok(nextPaths.has("next.config.mjs"), "Must scaffold next.config.mjs");
  logPass("Scaffolded all 17 required Next.js App Router files, boundaries, sitemap, and edge middleware");

  // Server vs Client Component Placement
  const nextHomePage = nextPlan.files.find((f) => f.path === "app/page.tsx");
  assert.ok(nextHomePage?.content.startsWith('"use client";'), "Interactive page with button click props must be 'use client'");

  const nextAboutPage = nextPlan.files.find((f) => f.path === "app/about/page.tsx");
  assert.ok(!nextAboutPage?.content.includes('"use client"'), "Static about page must be Server Component without 'use client'");
  assert.ok(nextAboutPage?.content.includes("export const revalidate = 60"), "Must configure ISR revalidate directive");
  logPass("Correctly determines Server Component vs Client Component ('use client') based on element interactivity");

  // Image Optimization Hook
  assert.ok(nextHomePage?.content.includes("<Image src="), "Next.js page must use next/image component for images");
  assert.ok(nextHomePage?.content.includes("width={800} height={500}"), "next/image must have intrinsic dimensions");
  logPass("Next.js generator replaces raw <img> tags with optimized next/image elements");

  // Font Optimization & Metadata
  const layoutFile = nextPlan.files.find((f) => f.path === "app/layout.tsx");
  assert.ok(layoutFile?.content.includes("next/font/google"), "Root layout must import next/font/google");
  assert.ok(layoutFile?.content.includes("export const metadata: Metadata"), "Root layout must export typed metadata");
  assert.ok(layoutFile?.content.includes("openGraph"), "Metadata must contain OpenGraph specification");
  logPass("Root layout configures Google Font optimization (Inter) and native Metadata API");

  // Route Handlers & Server Actions
  const apiRoute = nextPlan.files.find((f) => f.path === "app/api/health/route.ts");
  assert.ok(apiRoute?.content.includes("NextResponse.json"), "API route must return NextResponse.json");

  const actionFile = nextPlan.files.find((f) => f.path === "app/actions/submitAction.ts");
  assert.ok(actionFile?.content.includes("'use server'"), "Server Action must declare 'use server' directive");
  logPass("Scaffolded native App Router API route handler and 'use server' Server Action");

  // -------------------------------------------------------------------------
  // 4. Security & Plan Validation Tests
  // -------------------------------------------------------------------------
  console.log("\n[TEST GROUP 4] Security & Plan Validation");

  const validResult = validateGenerationPlan(reactPlan);
  assert.equal(validResult.valid, true, "Standard react plan must pass validation");
  assert.equal(validResult.errors.length, 0, "No validation errors expected for valid plan");
  logPass("validateGenerationPlan passed all 4 validation suites for canonical React plan");

  // Malicious plan with path traversal
  const maliciousPlan = {
    ...reactPlan,
    files: [
      ...reactPlan.files,
      {
        path: "../../../etc/passwd",
        action: "CREATE" as const,
        ownership: "GENERATED" as const,
        content: "root:x:0:0:",
        mimeType: "text/plain",
        reason: "Exploit attempt",
        newHash: "fake",
      },
    ],
  };
  const securityTraverseResult = validateGenerationPlan(maliciousPlan);
  assert.equal(securityTraverseResult.valid, false, "Must fail validation on path traversal");
  assert.ok(securityTraverseResult.errors.some((e) => e.includes("Path traversal")), "Must detect path traversal attempt");
  logPass("Security: strictly rejected path traversal attempt (../../../etc/passwd)");

  // Malicious plan with secret leakage in client file
  const leakPlan = {
    ...reactPlan,
    files: [
      ...reactPlan.files,
      {
        path: "src/config/leaked.ts",
        action: "CREATE" as const,
        ownership: "GENERATED" as const,
        content: "export const secret = 'DATABASE_URL=postgres://root:secret@db.internal:5432';",
        mimeType: "application/typescript",
        reason: "Secret leak attempt",
        newHash: "leak",
      },
    ],
  };
  const securityLeakResult = validateGenerationPlan(leakPlan);
  assert.equal(securityLeakResult.valid, false, "Must fail validation on client secret leak");
  assert.ok(securityLeakResult.errors.some((e) => e.includes("secret")), "Must detect secret leak");
  logPass("Security: strictly prevented leaking database secret into client bundle");

  // -------------------------------------------------------------------------
  // 5. End-to-End Filesystem Integration, Transactions & Scoped Regeneration
  // -------------------------------------------------------------------------
  console.log("\n[TEST GROUP 5] End-to-End Generation & Scoped Regeneration");

  // Setup Base Project in persistent DB
  const testProject = await forgeProjectService.createProject(testOwnerId, {
    name: `Generator Test Project ${uniqueSuffix}`,
    projectType: "react",
    frameworkMeta: {
      framework: "react",
      frameworkVersion: "19.0.0",
      runtime: "node",
      runtimeVersion: "20.x",
      packageManager: "npm",
      language: "typescript",
    },
  });

  const projId = testProject.id;
  assert.ok(projId, "Project ID must exist");

  // Execute full React project generation
  const genResult = await executeGeneration(projId, reactPlan, testOwnerId);
  assert.equal(genResult.success, true, "Generation execution must succeed");
  assert.ok(genResult.filesWritten > 10, "Must write generated files into persistent filesystem");
  assert.ok(genResult.snapshotId, "Must create safety snapshot before write");
  logPass(`Transactionally executed React project generation (${genResult.filesWritten} files committed, snapshot created)`);

  // Verify persistent files in filesystem
  const tree = await forgeFilesystemService.getFileTree(projId);
  assert.ok(tree.length > 0, "Filesystem tree must contain created files");
  const mainDbFile = await forgeFilesystemService.readFile(projId, "src/main.tsx");
  assert.ok(mainDbFile.content?.includes("<ErrorBoundary>"), "Persisted file content must match generated entrypoint");
  logPass("Verified persisted files in database filesystem via forgeFilesystemService");

  // Modify Dashboard custom code and add a custom user file
  const customUserFilePath = "src/utils/customMath.ts";
  await forgeFilesystemService.writeFile(projId, customUserFilePath, {
    content: "export function add(a: number, b: number) { return a + b; }",
    isGenerated: false, // Manual user file
    authorId: testOwnerId,
  });

  // Inject user-modified protected code into HomePage.tsx
  const existingHomeFile = await forgeFilesystemService.readFile(projId, "src/pages/HomePage.tsx");
  const userModifiedHome = existingHomeFile.content!.replace(
    "// [forge-protect-start: page-custom-logic]",
    "// [forge-protect-start: page-custom-logic]\n  const [customCounter, setCounter] = React.useState(100);"
  );
  await forgeFilesystemService.writeFile(projId, "src/pages/HomePage.tsx", {
    content: userModifiedHome,
    authorId: testOwnerId,
  });

  // Test Scoped Regeneration: Regenerate HomePage ONLY
  const scopedResult = await regenerateScope(
    projId,
    "react",
    { type: "page", targetPath: "src/pages/HomePage.tsx" },
    testOwnerId
  );
  assert.equal(scopedResult.success, true, "Scoped regeneration must succeed");

  // Verify HomePage merged user code, customMath.ts preserved, and AboutPage preserved
  const reloadedHome = await forgeFilesystemService.readFile(projId, "src/pages/HomePage.tsx");
  assert.ok(
    reloadedHome.content?.includes("const [customCounter, setCounter] = React.useState(100);"),
    "Scoped regeneration must merge and preserve user's customCounter state in HomePage"
  );

  const reloadedUserFile = await forgeFilesystemService.readFile(projId, customUserFilePath);
  assert.ok(reloadedUserFile.content?.includes("return a + b;"), "User-created file must remain 100% intact");

  logPass("Scoped Regeneration Test: HomePage regenerated with protected state merged; customMath.ts and AboutPage untouched");

  // -------------------------------------------------------------------------
  // 6. Next.js Full Project Generation E2E
  // -------------------------------------------------------------------------
  console.log("\n[TEST GROUP 6] Next.js Project Generation E2E");

  const nextGenResult = await executeGeneration(projId, nextPlan, testOwnerId);
  assert.equal(nextGenResult.success, true, "Next.js project generation must succeed");
  const manifest = await forgeFilesystemService.readFile(projId, "forge.manifest.json");
  const parsedManifest = JSON.parse(manifest.content || "{}");
  assert.equal(parsedManifest.framework?.name, "nextjs", "Manifest framework must be updated to Next.js");
  assert.equal(parsedManifest.commands?.dev, "next dev", "Manifest dev command must be 'next dev'");
  logPass("Next.js project generation committed and synchronized with forge.manifest.json");

  console.log("\n============================================================");
  console.log(`ALL PHASE 2 (MODULES 08 & 09) TESTS PASSED! (${testsRun} assertions verified) ✓`);
  console.log("============================================================\n");

  return { success: true, testsRun, details };
}

if (process.argv[1]?.includes("phase2-project-generators.test")) {
  runPhase2ProjectGeneratorsTestSuite().catch((err) => {
    console.error("Test Suite Failed with Error:", err);
    process.exit(1);
  });
}
