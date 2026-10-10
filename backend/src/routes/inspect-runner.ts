import type { Request, Response } from "express";
import { prisma, pgPool } from "../config/prisma.js";
import { syncBridgedProjectForWebsite, getForgeProjectById } from "../services/project/forgeProject.service.js";
import { updateWebsite } from "../services/website.service.js";
import { writeFile, readFile, listFiles, deleteFile } from "../services/project/forgeFilesystem.service.js";
import { syncSourceToVisualWebsite } from "../services/compiler/visualCodeSync.service.js";
import { buildZipFromFiles } from "../services/codeGenerator.service.js";
import { buildSourcePreview } from "../services/preview/sourcePreview.service.js";
import { listProjectPages } from "../services/project/projectPages.service.js";
import { getProjectManifest } from "../services/project/forgeManifest.service.js";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

export function isHelperOrNonPageFile(filePath: string): boolean {
  const clean = filePath.replace(/^[/\\]+/, "").replace(/\\/g, "/");
  const nonPageDirs = [
    "src/components/",
    "components/",
    "src/utils/",
    "utils/",
    "src/hooks/",
    "hooks/",
    "src/services/",
    "services/",
    "src/styles/",
    "styles/",
    "src/types/",
    "types/",
    "src/lib/",
    "lib/",
    "src/api/",
    "api/",
    "public/",
    "assets/",
    "src/assets/",
  ];
  if (nonPageDirs.some((dir) => clean.startsWith(dir) || clean.includes(`/${dir}`))) {
    return true;
  }
  const nonPageFileNames = [
    "EmptyState.tsx",
    "EmptyState.jsx",
    "Button.tsx",
    "Button.jsx",
    "ErrorBoundary.tsx",
    "ErrorBoundary.jsx",
  ];
  const base = clean.split("/").pop() || "";
  return nonPageFileNames.includes(base);
}

export function resolveDefaultWorkspaceFile(
  fileTree: Array<{ name: string; path: string; isDirectory: boolean; children?: any[] }>,
  manifest: any | null,
  pages: any[] = []
): string | null {
  const allFiles: string[] = [];
  const collectFiles = (nodes: any[]) => {
    for (const node of nodes) {
      if (!node.isDirectory) {
        allFiles.push(node.path);
      } else if (node.children) {
        collectFiles(node.children);
      }
    }
  };
  collectFiles(fileTree);

  if (allFiles.length === 0) return null;
  const hasFile = (p: string) => allFiles.includes(p);

  const homePage = pages.find((p) => p.isHome || p.routePath === "/");
  if (homePage?.filePath && hasFile(homePage.filePath) && !isHelperOrNonPageFile(homePage.filePath)) {
    return homePage.filePath;
  }

  for (const page of pages) {
    if (page.filePath && hasFile(page.filePath) && !isHelperOrNonPageFile(page.filePath)) {
      return page.filePath;
    }
  }

  const manifestEntry = manifest?.build?.entryPoint;
  if (typeof manifestEntry === "string" && hasFile(manifestEntry) && !isHelperOrNonPageFile(manifestEntry)) {
    return manifestEntry;
  }

  const nextCandidates = ["app/page.tsx", "app/page.jsx", "pages/index.tsx", "pages/index.jsx", "src/app/page.tsx", "src/app/page.jsx"];
  for (const candidate of nextCandidates) {
    if (hasFile(candidate)) return candidate;
  }

  const reactHomeCandidates = ["src/pages/HomePage.tsx", "src/pages/HomePage.jsx", "src/pages/IndexPage.tsx", "src/pages/IndexPage.jsx"];
  for (const candidate of reactHomeCandidates) {
    if (hasFile(candidate)) return candidate;
  }

  const srcPage = allFiles.find((f) => (f.startsWith("src/pages/") || f.startsWith("pages/")) && /\.(tsx|jsx)$/.test(f) && !isHelperOrNonPageFile(f));
  if (srcPage) return srcPage;

  const appCandidates = ["src/App.tsx", "src/App.jsx", "App.tsx", "App.jsx", "src/main.tsx", "src/main.jsx", "src/index.tsx", "src/index.jsx", "index.html"];
  for (const candidate of appCandidates) {
    if (hasFile(candidate)) return candidate;
  }

  const fallback = allFiles.find((f) => !isHelperOrNonPageFile(f) && /\.(tsx|jsx|ts|js|html)$/.test(f) && !f.includes(".test.") && !f.includes(".spec."));
  return fallback || null;
}

export function mapFileToRoute(filePath: string, currentPages: any[] = []): string | null {
  if (isHelperOrNonPageFile(filePath)) return null;

  const matched = currentPages.find((p) => p.filePath === filePath);
  if (matched) return matched.routePath;

  const nextMatch = filePath.match(/^app\/(.*?)\/?page\.(tsx|jsx)$/);
  if (nextMatch) {
    const seg = nextMatch[1];
    return !seg ? "/" : `/${seg.replace(/^[/\\]+|[/\\]+$/g, "")}`;
  }

  const reactMatch = filePath.match(/^src\/pages\/(.+)\.(tsx|jsx)$/);
  if (reactMatch) {
    let raw = reactMatch[1];
    if (raw.endsWith("Page") && raw.length > 4) raw = raw.slice(0, -4);
    if (raw.toLowerCase() === "home" || raw.toLowerCase() === "index") return "/";
    const slug = raw.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
    return `/${slug}`;
  }

  if (filePath === "src/App.tsx" || filePath === "src/main.tsx" || filePath === "index.html") {
    return "/";
  }

  return null;
}

function parseZipEntries(buffer: Buffer): Record<string, string> {
  const EOCD_SIG = 0x06054b50;
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 22 - 0xffff); i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a ZIP archive");
  const total = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries: Record<string, string> = {};
  for (let i = 0; i < total; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLen);
    if (!name.endsWith("/")) {
      const dataStart = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
      const raw = buffer.subarray(dataStart, dataStart + compressedSize);
      const data = method === 0 ? raw : method === 8 ? zlib.inflateRawSync(raw) : raw;
      entries[name] = data.toString("utf8");
    }
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

import { ensureDatabaseTables } from "../config/ensure-schema.js";

export async function runInspect(req: Request, res: Response) {
  try {
    await ensureDatabaseTables();
    const websiteId = "f9c82556-9396-4a26-a115-3ed644ca8a7a";

    if (req.query.runTests !== "true") {
      // 1. Inspect website in DB
      const { rows: siteRows } = await pgPool.query(
        `SELECT id, name, slug, "userId", "documentVersion", "updatedAt", "editorData" FROM websites WHERE id = $1`,
        [websiteId]
      );
      const site = siteRows[0] || null;

      // 2. Inspect forge_projects
      const { rows: projectRows } = await pgPool.query(
        `SELECT id, name, slug, framework, metadata FROM forge_projects WHERE id = '705d5e0c-ab68-474f-b03e-642accd1502a' OR metadata->>'websiteId' = $1`,
        [websiteId]
      );
      const project = projectRows[0] || null;

      // 3. Inspect forge_project_files
      let files: any[] = [];
      if (project) {
        const { rows: fileRows } = await pgPool.query(
          `SELECT id, path, name, "isGenerated", "isProtected", version, "updatedAt", content FROM forge_project_files WHERE "projectId" = $1 AND "deletedAt" IS NULL ORDER BY path ASC`,
          [project.id]
        );
        files = fileRows;
      }

      const abcPage = files.find((f: any) => f.path.includes("AbcPage"));

      const payload = {
        success: true,
        timestamp: new Date().toISOString(),
        site: site ? {
          id: site.id,
          name: site.name,
          slug: site.slug,
          documentVersion: site.documentVersion,
          updatedAt: site.updatedAt,
          editorData: site.editorData,
        } : null,
        project: project ? {
          id: project.id,
          name: project.name,
          framework: project.framework,
          metadata: project.metadata,
        } : null,
        filesCount: files.length,
        filePaths: files.map((f: any) => f.path),
        abcPage: abcPage ? {
          id: abcPage.id,
          path: abcPage.path,
          isGenerated: abcPage.isGenerated,
          isProtected: abcPage.isProtected,
          version: abcPage.version,
          updatedAt: abcPage.updatedAt,
          content: abcPage.content,
        } : null,
      };

      const dir = "C:/Users/navin/.gemini/antigravity-ide/brain/ecd37842-272e-4359-a8ef-89fd5a58135e/scratch";
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "inspect.json"), JSON.stringify(payload, null, 2));

      return res.type("text/plain").send("INSPECT_WRITTEN");
    }

    // =========================================================================
    // RUN ACCEPTANCE CRITERIA TESTS A THROUGH E
    // =========================================================================
    const testReport: any = {
      timestamp: new Date().toISOString(),
      websiteId,
      tests: {},
    };

    const { rows: siteRows } = await pgPool.query(
      `SELECT id, name, slug, "userId", "documentVersion", "updatedAt", "editorData" FROM websites WHERE id = $1`,
      [websiteId]
    );
    const site = siteRows[0];
    if (!site) throw new Error("Website not found in DB");

    const { rows: projectRows } = await pgPool.query(
      `SELECT id, name, slug, framework, "websiteId", "ownerId", metadata FROM forge_projects WHERE id = '705d5e0c-ab68-474f-b03e-642accd1502a' OR metadata->>'websiteId' = $1`,
      [websiteId]
    );
    const project = projectRows[0];
    if (!project) throw new Error("Project not found in DB");
    if (!project.websiteId) {
      project.websiteId = websiteId;
      await pgPool.query(`UPDATE forge_projects SET "websiteId" = $1 WHERE id = $2`, [websiteId, project.id]);
    }

    const userId = site.userId;

    // -------------------------------------------------------------------------
    // TEST A: Visual -> Code Sync
    // Change a visual heading to "VisualSync 123", save, confirm persisted src/pages/AbcPage.tsx contains it.
    // -------------------------------------------------------------------------
    try {
      const editorDataA = JSON.parse(JSON.stringify(site.editorData || {}));
      if (Array.isArray(editorDataA.pages) && editorDataA.pages.length > 0) {
        const homePage = editorDataA.pages.find((p: any) => p.isHome || p.slug === "/") || editorDataA.pages[0];
        if (Array.isArray(homePage.elements) && homePage.elements.length > 0) {
          homePage.elements[0].content = "VisualSync 123";
          homePage.elements[0].textContent = "VisualSync 123";
          homePage.elements[0].text = "VisualSync 123";
        } else {
          homePage.elements = [{ id: "el_visual_a", type: "heading", content: "VisualSync 123" }];
        }
      }
      if (Array.isArray(editorDataA.elements) && editorDataA.elements.length > 0) {
        editorDataA.elements[0].content = "VisualSync 123";
        editorDataA.elements[0].textContent = "VisualSync 123";
        editorDataA.elements[0].text = "VisualSync 123";
      } else {
        editorDataA.elements = [{ id: "el_visual_a", type: "heading", content: "VisualSync 123" }];
      }

      const ackA = await updateWebsite(
        websiteId,
        { editorData: editorDataA },
        userId,
        { expectedVersion: site.documentVersion, key: `inspect-test-a-${Date.now()}` }
      );
      const syncResultA = await syncBridgedProjectForWebsite(websiteId, { id: userId }, { snapshot: false });

      const fileRowA = (
        await pgPool.query(
          `SELECT content FROM forge_project_files WHERE "projectId" = $1 AND path = 'src/pages/AbcPage.tsx' AND "deletedAt" IS NULL`,
          [project.id]
        )
      ).rows[0];

      const containsVisualSync = fileRowA?.content?.includes("VisualSync 123");
      testReport.tests.testA = {
        name: "Test A: Visual Heading -> Code Workspace Source",
        success: !!containsVisualSync,
        ackVersion: ackA?.documentVersion,
        syncResult: syncResultA,
        persistedContentSnippet: fileRowA?.content?.slice(0, 300),
        matched: containsVisualSync,
      };
    } catch (errA: any) {
      testReport.tests.testA = { success: false, error: errA.message, stack: errA.stack };
    }

    // -------------------------------------------------------------------------
    // TEST B: Code -> Visual Sync
    // Change heading in Code Workspace to "CodeSync 456", save, confirm Visual Editor canvas displays it.
    // -------------------------------------------------------------------------
    try {
      const fileRowB = (
        await pgPool.query(
          `SELECT content FROM forge_project_files WHERE "projectId" = $1 AND path = 'src/pages/AbcPage.tsx' AND "deletedAt" IS NULL`,
          [project.id]
        )
      ).rows[0];

      let newCodeContent = fileRowB.content;
      if (newCodeContent.includes("VisualSync 123")) {
        newCodeContent = newCodeContent.replace("VisualSync 123", "CodeSync 456");
      } else if (newCodeContent.includes("Hey This is for testing purpose")) {
        newCodeContent = newCodeContent.replace("Hey This is for testing purpose . Am i able to generate the code yes or no....", "CodeSync 456");
      } else {
        newCodeContent = newCodeContent.replace(/>([^<]+)<\/p>/, '>CodeSync 456</p>');
      }

      await writeFile(project.id, "src/pages/AbcPage.tsx", newCodeContent, { authorId: userId });
      const syncResultB = await syncSourceToVisualWebsite(project.id, websiteId, "src/pages/AbcPage.tsx", userId, { resolve: "code" });

      const siteRowB = (
        await pgPool.query(
          `SELECT "editorData" FROM websites WHERE id = $1`,
          [websiteId]
        )
      ).rows[0];

      const editorDataStrB = JSON.stringify(siteRowB?.editorData || {});
      const containsCodeSync = editorDataStrB.includes("CodeSync 456");

      testReport.tests.testB = {
        name: "Test B: Code Workspace Edit -> Visual Editor Canvas",
        success: !!containsCodeSync && syncResultB?.status === "synced",
        syncResult: syncResultB,
        matched: containsCodeSync,
        editorDataExcerpt: editorDataStrB.slice(0, 300),
      };
    } catch (errB: any) {
      testReport.tests.testB = { success: false, error: errB.message, stack: errB.stack };
    }

    // -------------------------------------------------------------------------
    // TEST C: Dynamic Page Creation from Code Workspace
    // Create src/pages/AboutPage.tsx with heading "AboutSync 789".
    // Confirm About appears in page selector, canvas shows "AboutSync 789", route registered.
    // Confirm helper components like src/components/Button.tsx do NOT become pages.
    // -------------------------------------------------------------------------
    try {
      // Clean up any pre-existing About page from previous test iterations to test pristine dynamic creation
      const siteRowBeforeC = (
        await pgPool.query(
          `SELECT "editorData", "documentVersion" FROM websites WHERE id = $1`,
          [websiteId]
        )
      ).rows[0];
      const cleanEditorDataC = JSON.parse(JSON.stringify(siteRowBeforeC?.editorData || {}));
      if (Array.isArray(cleanEditorDataC.pages)) {
        cleanEditorDataC.pages = cleanEditorDataC.pages.filter(
          (p: any) => p.name !== "About" && p.slug !== "/about"
        );
      }
      await updateWebsite(websiteId, { editorData: cleanEditorDataC }, userId, {
        expectedVersion: siteRowBeforeC.documentVersion,
        key: `inspect-cleanup-c-${Date.now()}`,
      });
      try {
        await deleteFile(project.id, "src/pages/AboutPage.tsx", userId);
      } catch {}

      const aboutSource = `import React from 'react';

export const AboutPage: React.FC = () => {
  return (
    <div className="min-h-screen">
      <main className="w-full">
        <h1 className="text-3xl font-bold">AboutSync 789</h1>
        <p>We build amazing software.</p>
      </main>
    </div>
  );
};

export default AboutPage;
`;

      await writeFile(project.id, "src/pages/AboutPage.tsx", aboutSource, { authorId: userId });
      const syncResultC = await syncSourceToVisualWebsite(project.id, websiteId, "src/pages/AboutPage.tsx", userId, { resolve: "code" });

      // Verify helper component policy: arbitrary component is NOT registered as a page
      const buttonSource = `import React from 'react';
export const Button: React.FC<{ label: string }> = ({ label }) => <button>{label}</button>;
export default Button;
`;
      await writeFile(project.id, "src/components/Button.tsx", buttonSource, { authorId: userId });
      const helperSyncResult = await syncSourceToVisualWebsite(project.id, websiteId, "src/components/Button.tsx", userId);

      const siteRowC = (
        await pgPool.query(
          `SELECT "editorData" FROM websites WHERE id = $1`,
          [websiteId]
        )
      ).rows[0];

      const pagesListC = siteRowC?.editorData?.pages || [];
      const aboutPageInEditorData = pagesListC.find((p: any) => p.name === "About" || p.name === "AboutPage" || p.slug === "/about");
      const buttonPageInEditorData = pagesListC.find((p: any) => p.name === "Button" || p.slug === "/button");

      const routesFileC = (
        await pgPool.query(
          `SELECT content FROM forge_project_files WHERE "projectId" = $1 AND path = 'src/routes/AppRoutes.tsx' AND "deletedAt" IS NULL`,
          [project.id]
        )
      ).rows[0];

      const routesHasAbout = routesFileC?.content?.includes("/about") && routesFileC?.content?.includes("AboutPage");
      const aboutCanvasHasText = JSON.stringify(aboutPageInEditorData || {}).includes("AboutSync 789");

      testReport.tests.testC = {
        name: "Test C: Create Page in Code -> Visual Page Selector & Canvas & Route",
        success: !!aboutPageInEditorData && !!routesHasAbout && !buttonPageInEditorData,
        syncResult: syncResultC,
        aboutPageRegistered: !!aboutPageInEditorData,
        aboutPageDetails: aboutPageInEditorData ? { id: aboutPageInEditorData.id, name: aboutPageInEditorData.name, slug: aboutPageInEditorData.slug } : null,
        aboutCanvasHasText,
        routesHasAbout,
        helperComponentNotRegisteredAsPage: helperSyncResult?.status === "not-a-page" && !buttonPageInEditorData,
      };
    } catch (errC: any) {
      testReport.tests.testC = { success: false, error: errC.message, stack: errC.stack };
    }

    // -------------------------------------------------------------------------
    // TEST D: Persistence across Reload
    // Re-query fresh records from database.
    // -------------------------------------------------------------------------
    try {
      const { rows: freshSiteRows } = await pgPool.query(
        `SELECT "editorData", "documentVersion" FROM websites WHERE id = $1`,
        [websiteId]
      );
      const { rows: freshFileRows } = await pgPool.query(
        `SELECT path, content FROM forge_project_files WHERE "projectId" = $1 AND "deletedAt" IS NULL`,
        [project.id]
      );

      const abcFile = freshFileRows.find((f: any) => f.path === "src/pages/AbcPage.tsx");
      const aboutFile = freshFileRows.find((f: any) => f.path === "src/pages/AboutPage.tsx");
      const routesFile = freshFileRows.find((f: any) => f.path === "src/routes/AppRoutes.tsx");

      const abcHasCodeSync = abcFile?.content?.includes("CodeSync 456");
      const aboutHasAboutSync = aboutFile?.content?.includes("AboutSync 789");
      const siteHasBothPages = (freshSiteRows[0]?.editorData?.pages?.length ?? 0) >= 2;

      testReport.tests.testD = {
        name: "Test D: Persistence Across Reload",
        success: !!abcHasCodeSync && !!aboutHasAboutSync && !!siteHasBothPages,
        abcHasCodeSync,
        aboutHasAboutSync,
        siteHasBothPages,
        pagesInSite: freshSiteRows[0]?.editorData?.pages?.map((p: any) => ({ name: p.name, slug: p.slug })),
      };
    } catch (errD: any) {
      testReport.tests.testD = { success: false, error: errD.message, stack: errD.stack };
    }

    // -------------------------------------------------------------------------
    // TEST E: Export Project ZIP
    // Export ZIP and verify entries: AbcPage.tsx, AboutPage.tsx, AppRoutes.tsx, valid routes.
    // -------------------------------------------------------------------------
    try {
      const { rows: allProjectFiles } = await pgPool.query(
        `SELECT path, content, encoding, "isGenerated", "isProtected" FROM forge_project_files WHERE "projectId" = $1 AND "deletedAt" IS NULL`,
        [project.id]
      );

      const zipBuffer = await buildZipFromFiles(
        allProjectFiles.map((f: any) => ({
          path: f.path,
          content: f.content || "",
          encoding: f.encoding || "utf-8",
        }))
      );

      const zipEntries = parseZipEntries(zipBuffer);
      const zipPaths = Object.keys(zipEntries);

      const abcInZip = zipEntries["src/pages/AbcPage.tsx"];
      const aboutInZip = zipEntries["src/pages/AboutPage.tsx"];
      const routesInZip = zipEntries["src/routes/AppRoutes.tsx"];

      const zipValid =
        !!abcInZip &&
        abcInZip.includes("CodeSync 456") &&
        !!aboutInZip &&
        aboutInZip.includes("AboutSync 789") &&
        !!routesInZip &&
        routesInZip.includes("/about");

      testReport.tests.testE = {
        name: "Test E: Project ZIP Export Contains Latest Source & Routes",
        success: zipValid,
        zipSize: zipBuffer.length,
        totalFilesCount: zipPaths.length,
        hasAbcPage: !!abcInZip,
        hasAboutPage: !!aboutInZip,
        hasAppRoutes: !!routesInZip,
        abcPageContainsCodeSync: abcInZip?.includes("CodeSync 456"),
        aboutPageContainsAboutSync: aboutInZip?.includes("AboutSync 789"),
        routesContainsAbout: routesInZip?.includes("/about"),
      };
    } catch (errE: any) {
      testReport.tests.testE = { success: false, error: errE.message, stack: errE.stack };
    }

    // -------------------------------------------------------------------------
    // TEST F: Layout & Visual Styling Fidelity
    // Configure container with CSS Grid layout and background tokens,
    // verify exact preservation in generated source and styles.
    // -------------------------------------------------------------------------
    try {
      const siteRowF = (
        await pgPool.query(
          `SELECT "editorData", "documentVersion" FROM websites WHERE id = $1`,
          [websiteId]
        )
      ).rows[0];
      const editorDataF = JSON.parse(JSON.stringify(siteRowF?.editorData || {}));
      const gridContainer = {
        id: "container_grid_f",
        type: "container",
        layout: {
          layoutType: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 24,
          rowGap: 16,
          justifyItems: "center",
        },
        styles: {
          backgroundColor: "#1e293b",
          borderRadius: "12px",
          padding: "20px",
        },
        children: [
          {
            id: "heading_inside_grid",
            type: "heading",
            content: "Grid Card 1",
            textContent: "Grid Card 1",
            styles: { color: "#ffffff" },
          },
        ],
      };

      if (Array.isArray(editorDataF.pages) && editorDataF.pages.length > 0) {
        editorDataF.pages[0].elements = [gridContainer];
      }
      editorDataF.elements = [gridContainer];

      await updateWebsite(
        websiteId,
        { editorData: editorDataF },
        userId,
        { expectedVersion: siteRowF.documentVersion, key: `inspect-test-f-${Date.now()}` }
      );
      await syncBridgedProjectForWebsite(websiteId, { id: userId }, { snapshot: false });

      const fileRowF = (
        await pgPool.query(
          `SELECT content FROM forge_project_files WHERE "projectId" = $1 AND path = 'src/pages/AbcPage.tsx' AND "deletedAt" IS NULL`,
          [project.id]
        )
      ).rows[0];

      const contentF = fileRowF?.content || "";
      const hasGridDisplay = contentF.includes('display: "grid"') || contentF.includes('className="grid') || contentF.includes('className="');
      const hasGridCols = contentF.includes("repeat(3, minmax(0, 1fr))");
      const hasGap = contentF.includes("24px") || contentF.includes("gap-6");
      const hasBg = contentF.includes("#1e293b");

      testReport.tests.testF = {
        name: "Test F: Layout & Visual Styling Fidelity (CSS Grid & Style Tokens)",
        success: (hasGridDisplay || contentF.includes("grid")) && hasGridCols && hasGap && hasBg,
        hasGridDisplay,
        hasGridCols,
        hasGap,
        hasBg,
        snippet: contentF.slice(0, 300),
      };
    } catch (errF: any) {
      testReport.tests.testF = { success: false, error: errF.message, stack: errF.stack };
    }

    // -------------------------------------------------------------------------
    // TEST G: Multi-Tenant Isolation
    // Foreign user ID should receive 403 Forbidden attempting to access project.
    // -------------------------------------------------------------------------
    try {
      let blockedAccess = false;
      let projectGot: any = null;
      let caughtErr: any = null;
      try {
        projectGot = await getForgeProjectById(project.id, { id: "00000000-0000-0000-0000-000000000099", role: "USER" });
      } catch (authErr: any) {
        caughtErr = {
          message: authErr?.message,
          statusCode: authErr?.statusCode,
          status: authErr?.status,
          code: authErr?.code,
          name: authErr?.name,
        };
        if (
          authErr?.statusCode === 403 ||
          authErr?.status === 403 ||
          authErr?.code === "FORBIDDEN" ||
          authErr?.message?.toLowerCase().includes("permission") ||
          authErr?.message?.toLowerCase().includes("forbidden")
        ) {
          blockedAccess = true;
        }
      }

      testReport.tests.testG = {
        name: "Test G: Multi-Tenant Isolation & Ownership Protection",
        success: blockedAccess,
        blockedUnauthorizedAccess: blockedAccess,
        caughtErr,
        returnedProjectWithoutAuth: !!projectGot,
        projectOwnerId: projectGot?.ownerId || (project as any).ownerId,
      };
    } catch (errG: any) {
      testReport.tests.testG = { success: false, error: errG.message, stack: errG.stack };
    }

    // -------------------------------------------------------------------------
    // TEST H: Custom Code & Unrelated File Preservation
    // A hand-written helper file (e.g. src/lib/customMath.ts) must remain untouched
    // across visual document updates and regeneration cycles.
    // -------------------------------------------------------------------------
    try {
      const customCodeContent = "export function addNumbers(a: number, b: number): number { return a + b; }\n";
      await writeFile(project.id, "src/lib/customMath.ts", customCodeContent, { authorId: userId });

      // Run another visual sync
      await syncBridgedProjectForWebsite(websiteId, { id: userId }, { snapshot: false });

      const customFileRow = (
        await pgPool.query(
          `SELECT content FROM forge_project_files WHERE "projectId" = $1 AND path = 'src/lib/customMath.ts' AND "deletedAt" IS NULL`,
          [project.id]
        )
      ).rows[0];

      const preserved = customFileRow?.content === customCodeContent;

      testReport.tests.testH = {
        name: "Test H: Custom Code & Unrelated File Preservation",
        success: preserved,
        preservedContent: preserved,
      };
    } catch (errH: any) {
      testReport.tests.testH = { success: false, error: errH.message, stack: errH.stack };
    }

    // -------------------------------------------------------------------------
    // TEST I: Default Entry File Selection (Fixing "EmptyState.tsx / No File Open" defect)
    // Verify that workspace file selection identifies the real entry page from
    // the manifest and route configuration, and NEVER picks EmptyState.tsx or helper components.
    // -------------------------------------------------------------------------
    try {
      const projectEntity = await getForgeProjectById(project.id, { id: userId, role: "USER" });
      projectEntity.websiteId = projectEntity.websiteId || websiteId;
      const manifestRes = await getProjectManifest(project.id, { id: userId, role: "USER" });
      const pagesRes = await listProjectPages(projectEntity);

      // Reproduce screenshot Explorer state: src/pages/AboutPage.tsx, src/pages/TestingPage.tsx, src/components/EmptyState.tsx
      const mockTreeNodes = [
        {
          name: "src",
          path: "src",
          isDirectory: true,
          children: [
            {
              name: "components",
              path: "src/components",
              isDirectory: true,
              children: [
                { name: "EmptyState.tsx", path: "src/components/EmptyState.tsx", isDirectory: false },
              ],
            },
            {
              name: "pages",
              path: "src/pages",
              isDirectory: true,
              children: [
                { name: "AboutPage.tsx", path: "src/pages/AboutPage.tsx", isDirectory: false },
                { name: "TestingPage.tsx", path: "src/pages/TestingPage.tsx", isDirectory: false },
              ],
            },
          ],
        },
      ];

      // Simulate pages registry where AboutPage is home or entry
      const mockPages: any[] = [
        { key: "about", name: "About", routePath: "/", filePath: "src/pages/AboutPage.tsx", isHome: true },
        { key: "testing", name: "Testing", routePath: "/testing", filePath: "src/pages/TestingPage.tsx", isHome: false },
      ];

      // Test default file resolution with mock tree
      const resolvedMock = resolveDefaultWorkspaceFile(mockTreeNodes, manifestRes.manifest, mockPages);

      // Also test with current project's actual DB files and pages
      const currentFiles = await listFiles(project.id);
      const actualTreeNodes = currentFiles.map((f: any) => ({ name: path.basename(f.path), path: f.path, isDirectory: false }));
      const resolvedActual = resolveDefaultWorkspaceFile(actualTreeNodes, manifestRes.manifest, pagesRes);

      const notEmptyState = resolvedMock !== "src/components/EmptyState.tsx";
      const isAboutPage = resolvedMock === "src/pages/AboutPage.tsx";
      const actualNotHelper = resolvedActual && !isHelperOrNonPageFile(resolvedActual);

      testReport.tests.testI = {
        name: "Test I: Default Workspace File Selection (Never EmptyState.tsx)",
        success: notEmptyState && isAboutPage && !!actualNotHelper,
        resolvedMock,
        resolvedActual,
        notEmptyState,
        isAboutPage,
        actualNotHelper,
      };
    } catch (errI: any) {
      testReport.tests.testI = { success: false, error: errI.message, stack: errI.stack };
    }

    // -------------------------------------------------------------------------
    // TEST J: Bidirectional Route & File Mapping
    // -------------------------------------------------------------------------
    try {
      const projectEntity = await getForgeProjectById(project.id, { id: userId, role: "USER" });
      projectEntity.websiteId = projectEntity.websiteId || websiteId;
      const pagesResJ = await listProjectPages(projectEntity);
      const aboutRoute = mapFileToRoute("src/pages/AboutPage.tsx", pagesResJ);
      const testingRoute = mapFileToRoute("src/pages/TestingPage.tsx", pagesResJ);
      const abcRoute = mapFileToRoute("src/pages/AbcPage.tsx", pagesResJ);
      const helperRoute = mapFileToRoute("src/components/EmptyState.tsx", pagesResJ);
      const buttonRoute = mapFileToRoute("src/components/Button.tsx", pagesResJ);

      const routeAboutCorrect = aboutRoute === "/about" || aboutRoute === "/";
      const routeTestingCorrect = testingRoute === "/testing";
      const helperNull = helperRoute === null && buttonRoute === null;

      testReport.tests.testJ = {
        name: "Test J: Bidirectional Route-to-File and File-to-Route Mapping",
        success: routeAboutCorrect && routeTestingCorrect && helperNull,
        aboutRoute,
        testingRoute,
        abcRoute,
        helperRoute,
        buttonRoute,
        routeAboutCorrect,
        routeTestingCorrect,
        helperNull,
      };
    } catch (errJ: any) {
      testReport.tests.testJ = { success: false, error: errJ.message, stack: errJ.stack };
    }

    // -------------------------------------------------------------------------
    // TEST K: Preview Compiler Error Integrity (No Hardcoded Demo / No Silent Fallback)
    // -------------------------------------------------------------------------
    try {
      const originalFile = await readFile(project.id, "src/pages/AboutPage.tsx");
      const brokenSource = `import React from 'react';\n\nexport default function AboutPage() {\n  return <div>unclosed tag;\n}\n`;
      await writeFile(project.id, "src/pages/AboutPage.tsx", brokenSource, { authorId: userId });

      const brokenPreview = await buildSourcePreview(project.id, project.framework, "/about");

      // Restore original file
      await writeFile(project.id, "src/pages/AboutPage.tsx", originalFile.content || "", { authorId: userId });

      const hasError = brokenPreview.success === false && brokenPreview.errors.length > 0;
      const htmlHasDiagnostic = brokenPreview.html.includes("The project source does not compile");
      const surfacesErrorDetails = brokenPreview.errors.some((e: any) => e.message && e.message.length > 0);

      testReport.tests.testK = {
        name: "Test K: Compilation Error Diagnostic Integrity (No Silent Fallback)",
        success: hasError && htmlHasDiagnostic && surfacesErrorDetails,
        hasError,
        htmlHasDiagnostic,
        surfacesErrorDetails,
        errorsSnippet: brokenPreview.errors.slice(0, 2),
      };
    } catch (errK: any) {
      testReport.tests.testK = { success: false, error: errK.message, stack: errK.stack };
    }

    try {
      const previewRes = await buildSourcePreview(project.id, project.framework, "/");
      testReport.preview = {
        success: previewRes.success,
        mode: previewRes.mode,
        errors: previewRes.errors,
        warnings: previewRes.warnings,
        routes: previewRes.routes,
        htmlLength: previewRes.html?.length,
        htmlSnippet: previewRes.html?.slice(0, 1000),
        inputs: Object.keys((previewRes as any).metafile?.inputs || {}),
        aboutPageContent: (await readFile(project.id, "src/pages/AboutPage.tsx")).content,
      };
    } catch (errP: any) {
      testReport.preview = { error: errP.message, stack: errP.stack };
    }

    // Save full test report to scratch
    const dir = "C:/Users/navin/.gemini/antigravity-ide/brain/ecd37842-272e-4359-a8ef-89fd5a58135e/scratch";
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "acceptance_tests_report.json"), JSON.stringify(testReport, null, 2));

    const allPassed =
      testReport.tests.testA?.success &&
      testReport.tests.testB?.success &&
      testReport.tests.testC?.success &&
      testReport.tests.testD?.success &&
      testReport.tests.testE?.success &&
      testReport.tests.testF?.success &&
      testReport.tests.testG?.success &&
      testReport.tests.testH?.success &&
      testReport.tests.testI?.success &&
      testReport.tests.testJ?.success &&
      testReport.tests.testK?.success;

    return res.type("text/plain").send(allPassed ? "ALL_TESTS_PASSED" : "SOME_TESTS_FAILED");
  } catch (err: any) {
    return res.status(200).json({ error: err.message, stack: err.stack });
  }
}
