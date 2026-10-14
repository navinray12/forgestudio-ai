/**
 * Live AI provider acceptance (FS21-AT-GEN-01). Makes a real, billable request to the configured
 * AI_SITE_PROVIDER, so it only runs when explicitly opted in:
 *
 *   FORGE_LIVE_AI=1 FORGE_DISPOSABLE_TEST_DB=1 DATABASE_URL=postgresql://…@localhost:5432/forge_hardening \
 *     npx vitest run src/tests/app-generation.live-provider.test.ts
 *
 * The outcome is recorded honestly either way: a provider or validation failure is a FAILED run,
 * not a skipped assertion.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";

const database = new URL(process.env.DATABASE_URL || "invalid:");
const optedIn =
  process.env.FORGE_LIVE_AI === "1" &&
  process.env.FORGE_DISPOSABLE_TEST_DB === "1" &&
  ["localhost", "127.0.0.1"].includes(database.hostname) &&
  database.pathname === "/forge_hardening";

describe.skipIf(!optedIn)("Live AI provider application generation", async () => {
  const { prisma, pgPool } = await import("../config/prisma.js");
  const { ensureDatabaseTables } = await import("../config/ensure-schema.js");
  const { createForgeProject } = await import("../services/project/forgeProject.service.js");
  const { appGenerationService } = await import("../services/appGeneration/appGeneration.service.js");

  const marker = randomUUID().slice(0, 8);
  let ownerId = "";
  let projectId = "";

  beforeAll(async () => {
    await ensureDatabaseTables();
    ownerId = (await prisma.user.create({ data: { fullName: "Live AI", email: `live-ai-${marker}@example.test`, status: "ACTIVE" } })).id;
    projectId = (await createForgeProject({ name: `Live AI ${marker}`, ownerId } as any)).id;
  });

  afterAll(async () => {
    // The run row and generated files are kept as evidence; only the fixture user is detached.
    await prisma.$disconnect();
    await pgPool.end();
  });

  it("generates a validated application model through the real provider", async () => {
    const { run } = await appGenerationService.createRun({
      projectId,
      tenantId: ownerId,
      requestedById: ownerId,
      mode: "AI_PROVIDER",
      brief:
        "Team project tracker: team members view assigned projects, create tasks in a project with a title, " +
        "due date and priority, assign tasks, comment on tasks and mark tasks complete.",
    });
    let current = run;
    for (let i = 0; i < 240 && !["SOURCE_WRITTEN", "FAILED"].includes(current.status); i++) {
      await new Promise((r) => setTimeout(r, 1000));
      current = await appGenerationService.getRun(projectId, run.id);
    }
    console.log(JSON.stringify({
      runId: current.id, status: current.status, provider: current.provider, model: current.model,
      providerRequestIds: current.providerRequestIds, inputTokens: current.inputTokens, outputTokens: current.outputTokens,
      repairAttempts: current.repairAttempts, entities: current.appModel?.entities.map((e) => e.name),
      errorCode: current.errorCode, errorMessage: current.errorMessage,
    }, null, 2));

    expect(current.status).toBe("SOURCE_WRITTEN");
    expect(current.provider).toBe(process.env.AI_SITE_PROVIDER || "openai");
    expect(current.providerRequestIds.length).toBeGreaterThan(0);
    expect(current.appModel?.entities.length).toBeGreaterThan(0);
  }, 300_000);
});
