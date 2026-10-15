/**
 * Full-stack application generation on real PostgreSQL (blueprint §07, §38;
 * FS21-AT-GEN-02, GEN-03 (static part), GEN-06, GEN-11, GEN-13, GEN-14).
 *
 * The provider is a scripted AiProvider so these tests can exercise validation, repair, failure and
 * persistence deterministically. They do not prove a live provider call; that is
 * app-generation.live-provider.test.ts, which is opt-in.
 *
 * Run with: FORGE_DISPOSABLE_TEST_DB=1 DATABASE_URL=postgresql://…@localhost:5432/forge_hardening npx vitest run src/tests/app-generation.integration.test.ts
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { transformSync } from "esbuild";

const database = new URL(process.env.DATABASE_URL || "invalid:");
const optedIn =
  process.env.FORGE_DISPOSABLE_TEST_DB === "1" &&
  ["localhost", "127.0.0.1"].includes(database.hostname) &&
  database.pathname === "/forge_hardening";

describe.skipIf(!optedIn)("Application generation runs (disposable PostgreSQL)", async () => {
  const { prisma, pgPool } = await import("../config/prisma.js");
  const { ensureDatabaseTables } = await import("../config/ensure-schema.js");
  const { createForgeProject } = await import("../services/project/forgeProject.service.js");
  const fs = await import("../services/project/forgeFilesystem.service.js");
  const { AppGenerationService, reconcileInterruptedRuns, failUnexpectedGenerationRun, MAX_REPAIR_ATTEMPTS } = await import("../services/appGeneration/appGeneration.service.js");
  const controller = await import("../controllers/appGeneration.controller.js");
  const { AppError } = await import("../utils/app-error.js");

  const marker = randomUUID().slice(0, 8);
  const users: Record<"owner" | "outsider", { id: string }> = {} as any;
  const projectIds: string[] = [];

  const VALID_MODEL = {
    applicationName: "Clinic Scheduler",
    entities: [
      {
        name: "Appointment",
        description: "A booked visit",
        fields: [
          { name: "patientName", type: "string", required: true, description: "Patient" },
          { name: "startsAt", type: "datetime", required: true, description: "Start" },
          { name: "durationMinutes", type: "integer", required: true, description: "Length" },
          { name: "notes", type: "text", required: false, description: "Notes" },
        ],
      },
    ],
  };

  /** Scripted provider: returns the queued responses in order and records every request. */
  function scriptedProvider(responses: Array<{ text?: string; usage?: { inputTokens: number; outputTokens: number }; error?: Error }>) {
    const calls: any[] = [];
    const provider = {
      name: "scripted",
      model: "scripted-model",
      async generate(request: any) {
        calls.push(request);
        const next = responses.shift();
        if (!next) throw new Error("No scripted response left");
        if (next.error) throw next.error;
        return { text: next.text!, model: "scripted-model-v1", provider: "scripted", requestId: `req_${calls.length}`, usage: next.usage };
      },
    };
    return { provider, calls };
  }

  async function newProject() {
    const project = await createForgeProject({ name: `Gen ${marker} ${projectIds.length}`, ownerId: users.owner.id } as any);
    projectIds.push(project.id);
    return project;
  }

  async function runToCompletion(service: InstanceType<typeof AppGenerationService>, input: any) {
    const { run } = await service.createRun(input);
    for (let i = 0; i < 200; i++) {
      const current = await service.getRun(input.projectId, run.id);
      if (current.status === "SOURCE_WRITTEN" || current.status === "FAILED") return current;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error("run did not finish");
  }

  beforeAll(async () => {
    await ensureDatabaseTables();
    for (const role of ["owner", "outsider"] as const) {
      users[role] = await prisma.user.create({
        data: { fullName: `Gen ${role}`, email: `gen-${role}-${marker}@example.test`, status: "ACTIVE" },
      });
    }
  });

  afterAll(async () => {
    if (projectIds.length) await pgPool.query(`DELETE FROM forge_projects WHERE id = ANY($1::uuid[])`, [projectIds]);
    await prisma.user.deleteMany({ where: { email: { endsWith: `-${marker}@example.test` } } });
    await prisma.$disconnect();
    await pgPool.end();
  });

  it("writes an approved template's source and labels it as a template, not AI output", async () => {
    const project = await newProject();
    const service = new AppGenerationService({ providerFactory: () => { throw new Error("must not be called"); }, filesystem: fs });
    const run = await runToCompletion(service, {
      projectId: project.id, tenantId: users.owner.id, requestedById: users.owner.id, mode: "APPROVED_TEMPLATE", templateId: "task-tracker",
    });
    expect(run.status).toBe("SOURCE_WRITTEN");
    expect(run.provider).toBeNull();
    expect(run.inputTokens).toBeNull();
    expect(run.files.every((f) => f.written)).toBe(true);
    expect(run.diagnostics.some((d) => /no AI provider was called/.test(d.message))).toBe(true);

    const stored = await fs.readFile(project.id, "forge-app/server/task.routes.ts");
    expect(stored.isGenerated).toBe(true);
    expect(stored.content).toContain("tenantOf(req, res)");
    expect(stored.content).not.toContain("...req.body");
  });

  it("calls the provider, validates its output and records only reported usage", async () => {
    const project = await newProject();
    const { provider, calls } = scriptedProvider([{ text: JSON.stringify(VALID_MODEL), usage: { inputTokens: 310, outputTokens: 220 } }]);
    const service = new AppGenerationService({ providerFactory: () => provider, filesystem: fs });
    const run = await runToCompletion(service, {
      projectId: project.id, tenantId: users.owner.id, requestedById: users.owner.id, mode: "AI_PROVIDER",
      brief: "A clinic needs to book patient appointments with duration and notes.",
    });
    expect(run.status).toBe("SOURCE_WRITTEN");
    expect(calls).toHaveLength(1);
    expect(calls[0].schema).toBeDefined();
    expect(calls[0].prompt).toContain("clinic");
    expect(run).toMatchObject({ provider: "scripted", model: "scripted-model-v1", inputTokens: 310, outputTokens: 220, providerCalls: 1, repairAttempts: 0 });
    expect(run.providerRequestIds).toEqual(["req_1"]);
    expect((run.spec as any).entities[0].name).toBe("Appointment");
    expect((await fs.readFile(project.id, "forge-app/migrations/0001_initial.sql")).content).toContain('CREATE TABLE "appointments"');
  });

  it("GEN-09: sends the provider only the brief, the model contract and the instructions", async () => {
    const project = await newProject();
    const { provider, calls } = scriptedProvider([{ text: JSON.stringify(VALID_MODEL) }]);
    const service = new AppGenerationService({ providerFactory: () => provider, filesystem: fs });
    const brief = "A clinic books patient appointments.";
    await runToCompletion(service, {
      projectId: project.id, tenantId: users.owner.id, requestedById: users.owner.id, mode: "AI_PROVIDER", brief,
    });
    expect(calls).toHaveLength(1);
    expect(Object.keys(calls[0]).sort()).toEqual(["context", "operation", "prompt", "schema", "systemPrompt"]);
    expect(calls[0].context).toEqual({});
    expect(calls[0].prompt).toBe(brief);
    const sent = JSON.stringify(calls[0]);
    const forbidden = [project.id, users.owner.id, `gen-owner-${marker}@example.test`, process.env.DATABASE_URL,
      process.env.ANTHROPIC_API_KEY, process.env.GEMINI_API_KEY, process.env.OPENAI_API_KEY, process.env.JWT_SECRET]
      .filter((v): v is string => typeof v === "string" && v.length > 0);
    for (const value of forbidden) expect(sent.includes(value)).toBe(false);
  });

  it("repairs invalid output at most twice, then fails without writing files", async () => {
    const project = await newProject();
    const invalid = JSON.stringify({ applicationName: "X", entities: [{ name: "user", description: "", fields: [{ name: "tenantId", type: "uuid", required: true, description: "" }] }] });
    const { provider, calls } = scriptedProvider([{ text: "not json" }, { text: invalid }, { text: invalid }]);
    const service = new AppGenerationService({ providerFactory: () => provider, filesystem: fs });
    const run = await runToCompletion(service, {
      projectId: project.id, tenantId: users.owner.id, requestedById: users.owner.id, mode: "AI_PROVIDER", brief: "Some application requirements",
    });
    expect(run.status).toBe("FAILED");
    expect(run.errorCode).toBe("AI_INVALID_OUTPUT");
    expect(calls).toHaveLength(MAX_REPAIR_ATTEMPTS + 1);
    expect(calls[1].prompt).toContain("Output was not valid JSON");
    expect(run.inputTokens).toBeNull();
    expect(run.files).toEqual([]);
    expect(await fs.listFiles(project.id)).toHaveLength(0);
  });

  it("succeeds after one repair and counts both calls", async () => {
    const project = await newProject();
    const { provider } = scriptedProvider([
      { text: "{}", usage: { inputTokens: 100, outputTokens: 10 } },
      { text: JSON.stringify(VALID_MODEL), usage: { inputTokens: 150, outputTokens: 200 } },
    ]);
    const service = new AppGenerationService({ providerFactory: () => provider, filesystem: fs });
    const run = await runToCompletion(service, {
      projectId: project.id, tenantId: users.owner.id, requestedById: users.owner.id, mode: "AI_PROVIDER", brief: "Clinic appointments booking",
    });
    expect(run).toMatchObject({ status: "SOURCE_WRITTEN", providerCalls: 2, repairAttempts: 1, inputTokens: 250, outputTokens: 210 });
  });

  it("persists unexpected worker failures and permits a clean retry without overwriting terminal state", async () => {
    const project = await newProject();
    const failingFs = {
      readFile: async () => { throw new Error("unexpected fixture filesystem failure"); },
      writeFile: fs.writeFile,
    };
    const broken = new AppGenerationService({
      providerFactory: () => { throw new Error("template generation must not request AI"); },
      filesystem: failingFs,
    });
    const failed = await runToCompletion(broken, {
      projectId: project.id, tenantId: users.owner.id, requestedById: users.owner.id,
      mode: "APPROVED_TEMPLATE", templateId: "task-tracker",
    });
    expect(failed.status).toBe("FAILED");
    expect(failed.errorCode).toBe("UNEXPECTED_GENERATION_FAILURE");
    expect(failed.errorMessage).not.toContain("fixture filesystem failure");
    expect(failed.diagnostics.some((d) => /unexpected generation failure/i.test(d.message))).toBe(true);
    expect(await failUnexpectedGenerationRun(failed.id)).toBe(false);

    const fixed = new AppGenerationService({
      providerFactory: () => { throw new Error("template generation must not request AI"); },
      filesystem: fs,
    });
    const { run: retry } = await fixed.retryRun(project.id, failed.id, users.owner.id, users.owner.id);
    const retried = await fixed.getRun(project.id, retry.id);
    expect(retried.retryOfRunId).toBe(failed.id);
    for (let i = 0; i < 200; i++) {
      const current = await fixed.getRun(project.id, retry.id);
      if (current.status === "SOURCE_WRITTEN" || current.status === "FAILED") {
        expect(current.status).toBe("SOURCE_WRITTEN");
        expect(await failUnexpectedGenerationRun(current.id)).toBe(false);
        expect((await fixed.getRun(project.id, current.id)).status).toBe("SOURCE_WRITTEN");
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error("retry never reached terminal state");
  });

  it("reports provider failures truthfully", async () => {
    const project = await newProject();
    const { provider } = scriptedProvider([{ error: new AppError("AI provider request timed out or failed", 503, "AI_PROVIDER_UNAVAILABLE") }]);
    const service = new AppGenerationService({ providerFactory: () => provider, filesystem: fs });
    const run = await runToCompletion(service, {
      projectId: project.id, tenantId: users.owner.id, requestedById: users.owner.id, mode: "AI_PROVIDER", brief: "Clinic appointments booking",
    });
    expect(run).toMatchObject({ status: "FAILED", errorCode: "AI_PROVIDER_UNAVAILABLE", inputTokens: null });
    expect(run.appModel).toBeNull();

    const missing = new AppGenerationService({ providerFactory: () => { throw new AppError("AI generation is not configured", 503, "AI_NOT_CONFIGURED"); }, filesystem: fs });
    const unconfigured = await runToCompletion(missing, {
      projectId: project.id, tenantId: users.owner.id, requestedById: users.owner.id, mode: "AI_PROVIDER", brief: "Clinic appointments booking", idempotencyKey: "unconfigured",
    });
    expect(unconfigured).toMatchObject({ status: "FAILED", errorCode: "AI_NOT_CONFIGURED" });
  });

  it("does not record usage the provider did not report", async () => {
    const project = await newProject();
    const { provider } = scriptedProvider([{ text: JSON.stringify(VALID_MODEL) }]);
    const service = new AppGenerationService({ providerFactory: () => provider, filesystem: fs });
    const run = await runToCompletion(service, {
      projectId: project.id, tenantId: users.owner.id, requestedById: users.owner.id, mode: "AI_PROVIDER", brief: "Clinic appointments booking",
    });
    expect(run.status).toBe("SOURCE_WRITTEN");
    expect(run.inputTokens).toBeNull();
    expect(run.outputTokens).toBeNull();
  });

  it("is idempotent per key and refuses a second concurrent run", async () => {
    const project = await newProject();
    const { provider } = scriptedProvider([]);
    const slow = { ...provider, generate: () => new Promise<never>(() => undefined) };
    const service = new AppGenerationService({ providerFactory: () => slow as any, filesystem: fs });
    const input = { projectId: project.id, tenantId: users.owner.id, requestedById: users.owner.id, mode: "AI_PROVIDER", brief: "Clinic appointments booking", idempotencyKey: "same-key" };

    const first = await service.createRun(input);
    const replay = await service.createRun(input);
    expect(replay.created).toBe(false);
    expect(replay.run.id).toBe(first.run.id);
    await expect(service.createRun({ ...input, brief: "A different brief entirely" })).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    await expect(service.createRun({ ...input, idempotencyKey: "other-key" })).rejects.toMatchObject({ code: "GENERATION_IN_PROGRESS" });

    // Simulated restart: the stuck run is reconciled as interrupted, then a retry is allowed.
    await reconcileInterruptedRuns();
    const reconciled = await service.getRun(project.id, first.run.id);
    expect(reconciled).toMatchObject({ status: "FAILED", errorCode: "INTERRUPTED" });
    const retry = await new AppGenerationService({ providerFactory: () => scriptedProvider([{ text: JSON.stringify(VALID_MODEL) }]).provider, filesystem: fs })
      .retryRun(project.id, first.run.id, users.owner.id, users.owner.id);
    expect(retry.run.retryOfRunId).toBe(first.run.id);
  });

  it("serializes simultaneous admission for one project across distinct idempotency keys", async () => {
    const project = await newProject();
    const { provider } = scriptedProvider([]);
    const slow = { ...provider, generate: () => new Promise<never>(() => undefined) };
    const service = new AppGenerationService({ providerFactory: () => slow as any, filesystem: fs });
    const base = {
      projectId: project.id, tenantId: users.owner.id, requestedById: users.owner.id,
      mode: "AI_PROVIDER", brief: "Clinic appointments booking",
    };
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) => service.createRun({ ...base, idempotencyKey: `concurrent-${i}` }))
    );
    const accepted = results.filter((result): result is PromiseFulfilledResult<any> => result.status === "fulfilled");
    const rejected = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(7);
    expect(rejected.every((result) => result.reason?.code === "GENERATION_IN_PROGRESS")).toBe(true);
    const { rows } = await pgPool.query(
      `SELECT count(*)::int AS count FROM forge_app_generation_runs WHERE "projectId" = $1 AND status <> ALL($2::text[])`,
      [project.id, ["FAILED", "SOURCE_WRITTEN"]]
    );
    expect(rows[0].count).toBe(1);
    await reconcileInterruptedRuns();
  });

  it("does not claim SOURCE_WRITTEN when storage acknowledges but corrupts generated bytes", async () => {
    const project = await newProject();
    const dishonestFilesystem = {
      readFile: fs.readFile,
      writeFile: async (projectId: string, filePath: string, opts: Parameters<typeof fs.writeFile>[2]) =>
        fs.writeFile(projectId, filePath, { ...opts, content: `${opts.content}\n// corrupted after generation\n` }),
    };
    const service = new AppGenerationService({
      providerFactory: () => { throw new Error("template mode must not request AI"); },
      filesystem: dishonestFilesystem,
    });
    const run = await runToCompletion(service, {
      projectId: project.id, tenantId: users.owner.id, requestedById: users.owner.id,
      mode: "APPROVED_TEMPLATE", templateId: "task-tracker",
    });
    expect(run.status).toBe("FAILED");
    expect(run.errorCode).toBe("SOURCE_VERIFICATION_FAILED");
    expect(run.files.length).toBeGreaterThan(0);
    expect(run.files[0].written).toBe(false);
    expect(run.files.some((item) => item.written)).toBe(false);
  });

  it("never overwrites source that ForgeStudio did not generate", async () => {
    const project = await newProject();
    await fs.writeFile(project.id, "forge-app/server/app.ts", { content: "// hand-written\nexport const mine = 1;\n", authorId: users.owner.id });
    const service = new AppGenerationService({ providerFactory: () => { throw new Error("unused"); }, filesystem: fs });
    const run = await runToCompletion(service, {
      projectId: project.id, tenantId: users.owner.id, requestedById: users.owner.id, mode: "APPROVED_TEMPLATE", templateId: "lead-inbox",
    });
    expect(run).toMatchObject({ status: "FAILED", errorCode: "SOURCE_CONFLICT" });
    expect((await fs.readFile(project.id, "forge-app/server/app.ts")).content).toContain("hand-written");
    expect(await fs.listFiles(project.id)).toHaveLength(1);
  });

  it("produces validators that actually reject platform-owned and malformed input", async () => {
    const project = await newProject();
    const { provider } = scriptedProvider([{ text: JSON.stringify(VALID_MODEL) }]);
    const service = new AppGenerationService({ providerFactory: () => provider, filesystem: fs });
    await runToCompletion(service, {
      projectId: project.id, tenantId: users.owner.id, requestedById: users.owner.id, mode: "AI_PROVIDER", brief: "Clinic appointments booking",
    });
    const source = (await fs.readFile(project.id, "forge-app/server/appointment.validation.ts")).content;
    const dir = mkdtempSync(path.join(tmpdir(), "forge-gen-"));
    try {
      const file = path.join(dir, "validation.mjs");
      writeFileSync(file, transformSync(source, { loader: "ts", format: "esm" }).code);
      const mod = await import(pathToFileURL(file).href);
      const ok = mod.parseAppointmentCreate({ patientName: "A", startsAt: "2026-05-01T10:00:00Z", durationMinutes: 30 });
      expect(ok.ok).toBe(true);
      expect(mod.parseAppointmentCreate({ patientName: "A", startsAt: "2026-05-01T10:00:00Z", durationMinutes: 30, tenantId: "x" }).ok).toBe(false);
      expect(mod.parseAppointmentCreate({ patientName: "A", startsAt: "nope", durationMinutes: 1.5 }).errors).toEqual(
        expect.arrayContaining(["startsAt must be an ISO date-time", "durationMinutes must be an integer"])
      );
      expect(mod.parseAppointmentUpdate({}).ok).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses another user's project over the HTTP handlers", async () => {
    const project = await newProject();
    async function call(handler: any, userId: string | null, params: any, body: any = {}) {
      let status = 0; let error: any;
      const res: any = { locals: { user: userId ? { id: userId, role: "USER" } : undefined }, status(c: number) { status = c; return res; }, json() { return res; } };
      await handler({ params, body, query: {}, get: () => undefined }, res, (e: any) => { error = e; });
      return error ? error.statusCode : status;
    }
    expect(await call(controller.createAppGenerationHandler, null, { id: project.id }, { mode: "APPROVED_TEMPLATE", templateId: "lead-inbox" })).toBe(401);
    expect(await call(controller.createAppGenerationHandler, users.outsider.id, { id: project.id }, { mode: "APPROVED_TEMPLATE", templateId: "lead-inbox" })).toBe(403);
    expect(await call(controller.listAppGenerationsHandler, users.outsider.id, { id: project.id })).toBe(403);
    expect(await call(controller.createAppGenerationHandler, users.owner.id, { id: project.id }, { mode: "AI_PROVIDER", brief: "short" })).toBe(400);
    const { rows } = await pgPool.query(`SELECT count(*)::int AS n FROM forge_app_generation_runs WHERE "projectId" = $1`, [project.id]);
    expect(rows[0].n).toBe(0);
  });
});
