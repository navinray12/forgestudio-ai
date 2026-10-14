/**
 * Blueprint v2.1 §33.3: disposable PostgreSQL integration qualification only.
 * NEVER run against a production database.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ApplicationSpecService, type ApplicationSpec } from "../services/authoritative/applicationSpec.service.js";

const dbUrl = new URL(process.env.DATABASE_URL || "invalid:");
const enabled = process.env.FORGE_DISPOSABLE_TEST_DB === "1" &&
  ["localhost", "127.0.0.1"].includes(dbUrl.hostname) &&
  dbUrl.pathname === "/forge_hardening";

describe.skipIf(!enabled)("Durable ApplicationSpec revision history (disposable PostgreSQL)", async () => {
  const { prisma, pgPool } = await import("../config/prisma.js");
  const marker = randomUUID().slice(0, 12);
  const applicationId = `app_durable_${marker}`;
  const tenantId = `tenant_${marker}`;
  let userId = "";
  let projectId = "";

  const spec = (revision: number, parentRevision: number): ApplicationSpec => ({
    schemaVersion: "1.0.0", applicationId, projectId, tenantId,
    revision, parentRevision, frameworkProfile: "react-vite",
    identityStrategy: "SINGLE_TENANT_DEDICATED", requirementIds: [],
    entities: [], relationships: [], operations: [], actors: [], policies: [],
    frontendBindings: [], jobs: [], retentionPolicies: [], acceptanceContracts: [],
    createdAt: "2026-10-14T00:00:00Z", updatedAt: "2026-10-14T00:00:00Z",
  });

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { fullName: "Appspec integration", email: `appspec-${marker}@example.test`, status: "ACTIVE" },
    });
    userId = user.id;
    const result = await pgPool.query(
      `INSERT INTO forge_projects ("ownerId", slug, name) VALUES ($1::uuid, $2, $3) RETURNING id`,
      [userId, `appspec-${marker}`, "Appspec durable test"]
    );
    projectId = result.rows[0].id;
  });

  afterAll(async () => {
    if (projectId) {
      await pgPool.query(`DELETE FROM forge_application_spec_revisions WHERE "projectId" = $1::uuid`, [projectId]);
      await pgPool.query("DELETE FROM forge_projects WHERE id = $1::uuid", [projectId]);
    }
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
    await pgPool.end();
  });

  it("persists immutable revisions and isolates tenant reads", async () => {
    const initial = spec(1, 0);
    const inserted = await ApplicationSpecService.commitRevisionPersisted(initial);
    expect(inserted.revision).toBe(1);
    initial.requirementIds.push("caller-mutated");
    const read = await ApplicationSpecService.getLatestSpecPersisted(applicationId, projectId, tenantId);
    expect(read?.requirementIds).toEqual([]);
    expect(await ApplicationSpecService.getLatestSpecPersisted(applicationId, projectId, "other-tenant")).toBeNull();

    const wrongTenant = { ...spec(2, 1), tenantId: "other-tenant" };
    await expect(ApplicationSpecService.commitRevisionPersisted(wrongTenant))
      .rejects.toThrow(/cannot change its project or tenant/);
    expect((await ApplicationSpecService.getLatestSpecPersisted(applicationId, projectId, tenantId))?.revision).toBe(1);
  });

  it("serializes concurrent commits to prevent duplicate or lost revisions", async () => {
    const competing = await Promise.allSettled([
      ApplicationSpecService.commitRevisionPersisted(spec(2, 1)),
      ApplicationSpecService.commitRevisionPersisted(spec(2, 1)),
    ]);
    expect(competing.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(competing.filter((result) => result.status === "rejected")).toHaveLength(1);
    const rows = await pgPool.query(
      `SELECT "revision" FROM forge_application_spec_revisions WHERE "applicationId" = $1 ORDER BY "revision"`,
      [applicationId]
    );
    expect(rows.rows.map((row: { revision: number }) => row.revision)).toEqual([1, 2]);
    expect((await ApplicationSpecService.getLatestSpecPersisted(applicationId, projectId, tenantId))?.revision).toBe(2);
  });

  it("detects storage tampering instead of returning a corrupt authoritative spec", async () => {
    await pgPool.query(
      `UPDATE forge_application_spec_revisions SET digest = $2
       WHERE "applicationId" = $1 AND "revision" = 2`,
      [applicationId, "0".repeat(64)]
    );
    await expect(ApplicationSpecService.getLatestSpecPersisted(applicationId, projectId, tenantId))
      .rejects.toThrow(/digest mismatch/);
  });
});
