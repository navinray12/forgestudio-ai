/**
 * Website-to-Code check against the real database layer (Prisma + the forge_* SQL tables).
 *
 * Creates ONE throwaway website for an existing user, runs the real workflow
 * (open workspace -> edit design -> reopen -> generate Next.js -> export ZIP), and
 * removes everything it created, whether the checks pass or not. No existing
 * row is modified.
 *
 * Usage: npx tsx scripts/verify-website-to-code-db.ts
 */
import assert from "node:assert/strict";
import { prisma, pgPool } from "../src/config/prisma.js";
import { ensureDatabaseTables } from "../src/config/ensure-schema.js";
import { getOrCreateProjectForWebsite, getForgeProjectById } from "../src/services/project/forgeProject.service.js";
import { listFiles, readFile, writeFile, getProjectFileTree } from "../src/services/project/forgeFilesystem.service.js";
import { createGenerationPlan, executeGeneration } from "../src/services/generator/projectGenerator.service.js";
import { buildZipFromFiles } from "../src/services/codeGenerator.service.js";
import { buildWebsiteFixture } from "../src/tests/fixtures/website-to-code.fixture.js";
import { readZip } from "../src/tests/helpers/memoryDb.js";

const db = prisma as any;
let websiteId: string | null = null;
let projectId: string | null = null;
let failed = false;

const step = (msg: string) => console.log(`  ✓ ${msg}`);

try {
  await ensureDatabaseTables();

  const users: Array<{ id: string; role: string }> = await db.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, role: true },
    take: 50,
  });
  const owner = users[0];
  const stranger = users.find(
    (u) => u.id !== owner?.id && !["ADMIN", "SUPER_ADMIN", "PLATFORM_ADMIN"].includes(String(u.role))
  );
  if (!owner) throw new Error("No active user exists in this database; cannot run the check");
  const user = { id: owner.id, role: owner.role };

  const site = await db.website.create({
    data: {
      userId: owner.id,
      name: "W2C Verification (temporary)",
      slug: `w2c-verify-${Date.now()}`,
      editorData: buildWebsiteFixture(),
    },
  });
  websiteId = site.id;
  console.log(`Temporary website ${site.id} created for user ${owner.id}`);

  // 1. Open the workspace: project is provisioned and populated from the saved design
  const project: any = await getOrCreateProjectForWebsite(site.id, user);
  projectId = project.id;
  assert.equal(project.websiteId, site.id);
  assert.deepEqual(project.visualSync, { synced: true, stale: false });
  let files = (await listFiles(project.id)).filter((f) => !f.isDirectory);
  assert.ok(files.length >= 20, `expected a full React project, got ${files.length} files`);
  assert.ok(files.every((f) => f.projectId === project.id));
  assert.match((await readFile(project.id, "src/pages/HomePage.tsx")).content || "", /Build faster with Acme/);
  assert.match(JSON.stringify(await getProjectFileTree(project.id, false)), /AboutUsPage\.tsx/);
  step(`workspace bridge created project ${project.id} with ${files.length} persisted files`);

  // 2. Reopen: same project, nothing rewritten
  const versions = Object.fromEntries(files.map((f) => [f.path, f.version]));
  const again: any = await getOrCreateProjectForWebsite(site.id, user);
  assert.equal(again.id, project.id);
  assert.deepEqual(again.visualSync, { synced: false, stale: false });
  files = (await listFiles(project.id)).filter((f) => !f.isDirectory);
  assert.deepEqual(Object.fromEntries(files.map((f) => [f.path, f.version])), versions);
  assert.equal(await db.forgeProject.count({ where: { websiteId: site.id } }), 1);
  step("reopening loads the same persisted files without rewriting them");

  // 3. Custom code, then a design change saved in the editor
  const pagePath = "src/pages/HomePage.tsx";
  const page = (await readFile(project.id, pagePath)).content || "";
  await writeFile(project.id, pagePath, {
    content: page.replace("  // Custom page logic, API hooks, and handlers\n", () => "  const custom = 'kept across regeneration';\n"),
    authorId: owner.id,
  });
  await writeFile(project.id, "src/lib/mine.ts", { content: "export const mine = true;\n", authorId: owner.id });

  const edited = buildWebsiteFixture();
  edited.pages[0].elements[0].children[0].content = "Headline edited in the visual editor";
  await db.website.update({ where: { id: site.id }, data: { editorData: edited } });

  for (const round of [1, 2]) {
    const resynced: any = await getOrCreateProjectForWebsite(site.id, user);
    if (round === 1) assert.deepEqual(resynced.visualSync, { synced: true, stale: false });
    edited.pages[0].elements[0].children[0].content = `Headline edited again (${round})`;
    await db.website.update({ where: { id: site.id }, data: { editorData: edited } });
  }
  const final: any = await getOrCreateProjectForWebsite(site.id, user);
  assert.deepEqual(final.visualSync, { synced: true, stale: false });
  const regenerated = (await readFile(project.id, pagePath)).content || "";
  assert.match(regenerated, /Headline edited again \(2\)/);
  assert.match(regenerated, /const custom = 'kept across regeneration';/);
  assert.equal((await readFile(project.id, "src/lib/mine.ts")).content, "export const mine = true;\n");
  step("saved design changes reach the project on reopen; protected region and user file survive 3 regenerations");

  // 4. Generate Next.js: scaffold switches, stale React files are removed
  const plan = await createGenerationPlan(project.id, "nextjs", { scope: { type: "full" }, authorId: owner.id });
  const result = await executeGeneration(project.id, plan, owner.id);
  assert.equal(result.success, true, JSON.stringify(result.diagnostics));
  const paths = (await listFiles(project.id)).filter((f) => !f.isDirectory).map((f) => f.path);
  for (const expected of ["next.config.mjs", "app/layout.tsx", "app/page.tsx", "app/about/page.tsx", "app/contact-us/page.tsx", "src/lib/mine.ts"]) {
    assert.ok(paths.includes(expected), `missing ${expected}`);
  }
  for (const stale of ["src/main.tsx", "src/routes/AppRoutes.tsx", "vite.config.ts", "index.html"]) {
    assert.ok(!paths.includes(stale), `${stale} should have been removed`);
  }
  assert.equal((await getForgeProjectById(project.id)).framework, "nextjs");
  step(`Next.js generation persisted ${paths.length} files and removed the React scaffold`);

  // 5. Export the persisted project
  const persisted = (await listFiles(project.id)).filter((f) => !f.isDirectory);
  const entries = readZip(await buildZipFromFiles(persisted));
  assert.deepEqual(entries.map((e) => e.name).sort(), persisted.map((f) => f.path).sort());
  for (const f of persisted) assert.equal(entries.find((e) => e.name === f.path)!.data.toString("utf8"), f.content);
  step(`ZIP of the persisted project is valid and matches all ${entries.length} stored files`);

  // 6. Tenant isolation against real rows
  if (stranger) {
    await assert.rejects(getOrCreateProjectForWebsite(site.id, { id: stranger.id, role: stranger.role }), /permission/);
    await assert.rejects(getForgeProjectById(project.id, { id: stranger.id, role: stranger.role }), /permission/);
    step("a different non-admin user is refused both the website bridge and the project");
  } else {
    console.log("  - skipped cross-user check: no second non-admin user in this database");
  }
} catch (err) {
  failed = true;
  console.error("\nFAILED:", err);
} finally {
  // Remove only what this script created
  try {
    if (projectId) {
      await pgPool.query(`DELETE FROM audit_logs WHERE "targetResource" = $1`, [`project:${projectId}`]).catch(() => undefined);
      await pgPool.query(`DELETE FROM forge_projects WHERE id = $1`, [projectId]);
    }
    if (websiteId) await db.website.delete({ where: { id: websiteId } });
    const leftover = websiteId ? await db.website.count({ where: { id: websiteId } }) : 0;
    const leftoverProjects = projectId
      ? (await pgPool.query(`SELECT count(*)::int AS n FROM forge_projects WHERE id = $1`, [projectId])).rows[0].n
      : 0;
    const leftoverFiles = projectId
      ? (await pgPool.query(`SELECT count(*)::int AS n FROM forge_project_files WHERE "projectId" = $1`, [projectId])).rows[0].n
      : 0;
    console.log(`Cleanup: website rows left=${leftover}, project rows left=${leftoverProjects}, file rows left=${leftoverFiles}`);
  } catch (cleanupErr) {
    failed = true;
    console.error(`CLEANUP FAILED (website ${websiteId}, project ${projectId}):`, cleanupErr);
  }
  await prisma.$disconnect().catch(() => undefined);
  await pgPool.end().catch(() => undefined);
}

console.log(failed ? "\nRESULT: FAILED" : "\nRESULT: all real-database checks passed");
process.exit(failed ? 1 : 0);
