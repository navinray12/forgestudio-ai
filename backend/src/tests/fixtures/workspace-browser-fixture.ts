import { readFile, writeFile } from "node:fs/promises";
import { randomBytes, createHash } from "node:crypto";
import { prisma, pgPool } from "../../config/prisma.js";
import { createTenantWorkspace } from "../../services/workspaces/workspace-api.service.js";

// This is an explicit fixture writer, never imported by an application entry point.
const database = new URL(process.env.DATABASE_URL ?? "invalid:");
if (process.env.FORGE_DISPOSABLE_TEST_DB !== "1" ||
    !["127.0.0.1", "localhost"].includes(database.hostname) || database.pathname !== "/forge_browser") {
  throw new Error("Browser fixtures require the opted-in local forge_browser database");
}
const output = process.env.FORGE_BROWSER_FIXTURE_PATH;
if (!output) throw new Error("An explicit temporary fixture output path is required");

try {
  if (await prisma.user.count() !== 0) throw new Error("Browser fixture database must be empty");
  await pgPool.query('DROP TABLE IF EXISTS workspace_invitations, workspace_outbox, workspace_command_journal; ALTER TABLE workspaces DROP COLUMN "lifecycleStatus", DROP COLUMN version, DROP COLUMN "archivedAt"');
  for (const name of ["20260928090000_workspace_command_journal", "20260928122000_workspace_lifecycle", "20260928140000_document_concurrency"]) {
    await pgPool.query(await readFile(`prisma/migrations/${name}/migration.sql`, "utf8"));
  }
  const plan = await prisma.subscriptionPlan.create({ data: {
    name: "Browser fixture free plan", slug: "free", price: 0, websiteLimit: 20,
    features: [], isActive: true,
  }});
  const identities = [];
  for (const name of ["Workspace owner", "Invited member", "Unrelated actor"]) {
    const user = await prisma.user.create({ data: {
      fullName: name, email: `${randomBytes(8).toString("hex")}@example.test`,
      role: "USER", status: "ACTIVE", emailVerified: true,
    }});
    await prisma.userSubscription.create({ data: {userId: user.id, planId: plan.id, status: "ACTIVE"} });
    const token = randomBytes(32).toString("hex");
    await prisma.session.create({ data: { authEpoch: 1, authMethod: "local", authTime: new Date(), audience: "TENANT",userId: user.id,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 30 * 60_000),
    }});
    identities.push({id: user.id, name, token});
  }
  // Fixture setup uses the same application creation contract as the dashboard.
  const owner = identities[0]!;
  const result = await createTenantWorkspace(owner.id, {name: "Engineering fixture"}, "browser-fixture-workspace");
  const workspace = result.workspace;
  await prisma.organizationMember.create({data: {
    organizationId: workspace.organizationId!, userId: identities[1]!.id, role: "MEMBER",
  }});
  await writeFile(output, JSON.stringify({owner, member: identities[1], outsider: identities[2], workspace}), {mode: 0o600});
  console.log("Disposable workspace browser fixtures created (credentials not logged)");
} finally {
  await prisma.$disconnect();
  await pgPool.end();
}
