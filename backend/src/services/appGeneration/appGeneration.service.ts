/**
 * Full-stack application generation runs (blueprint §07, §38; FS21-AT-GEN-01/02/06/11/13/14).
 *
 * A run is durable database state. AI_PROVIDER runs make a real provider request and accept only
 * output that passes validateAppModel (at most two repair requests, §07). APPROVED_TEMPLATE runs
 * use an explicitly selected template and are never labelled as AI output. A run reaches
 * SOURCE_WRITTEN only after every file has been written; nothing is built, migrated, executed or
 * published by this pipeline, and the run never claims otherwise.
 */
import crypto from "node:crypto";
import { pgPool } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import type { AiProvider } from "../../modules/ai/ai-provider.js";
import { siteGenerationProvider } from "../../modules/ai/provider-routing.js";
import { ApplicationSpecService } from "../authoritative/applicationSpec.service.js";
import * as forgeFilesystem from "../project/forgeFilesystem.service.js";
import {
  APP_MODEL_JSON_SCHEMA,
  APP_MODEL_SYSTEM_PROMPT,
  APPROVED_TEMPLATES,
  toApplicationSpec,
  validateAppModel,
  type AppModel,
} from "./appModel.js";
import { emitApplicationSource, validateEmittedSource, GENERATED_MARKER, type EmittedFile } from "./appSourceEmitter.js";

export type AppGenerationMode = "AI_PROVIDER" | "APPROVED_TEMPLATE";
export type AppGenerationStatus =
  | "QUEUED"
  | "PLANNING"
  | "GENERATING_SOURCE"
  | "WRITING_SOURCE"
  | "SOURCE_WRITTEN"
  | "FAILED";

const TERMINAL: AppGenerationStatus[] = ["SOURCE_WRITTEN", "FAILED"];
export const MAX_REPAIR_ATTEMPTS = 2;
const BRIEF_MIN = 10;
const BRIEF_MAX = 4000;

export interface AppGenerationRun {
  id: string;
  projectId: string;
  requestedById: string;
  mode: AppGenerationMode;
  status: AppGenerationStatus;
  brief: string;
  templateId: string | null;
  idempotencyKey: string;
  retryOfRunId: string | null;
  provider: string | null;
  model: string | null;
  providerRequestIds: string[];
  inputTokens: number | null;
  outputTokens: number | null;
  providerCalls: number;
  repairAttempts: number;
  appModel: AppModel | null;
  spec: unknown;
  files: Array<{ path: string; role: string; sha256: string; bytes: number; written: boolean }>;
  diagnostics: Array<{ severity: "info" | "warn" | "error"; message: string }>;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface AppGenerationDeps {
  providerFactory: () => AiProvider;
  filesystem: Pick<typeof forgeFilesystem, "readFile" | "writeFile">;
}

const defaultDeps: AppGenerationDeps = { providerFactory: siteGenerationProvider, filesystem: forgeFilesystem };

const JSON_COLUMNS = ["providerRequestIds", "appModel", "spec", "files", "diagnostics"];

function rowToRun(row: any): AppGenerationRun {
  return { ...row, createdAt: new Date(row.createdAt).toISOString(), updatedAt: new Date(row.updatedAt).toISOString(), completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null };
}

async function updateRun(id: string, fields: Partial<Record<keyof AppGenerationRun, unknown>>): Promise<AppGenerationRun> {
  const keys = Object.keys(fields);
  const sets = keys.map((k, i) => `"${k}" = $${i + 2}${JSON_COLUMNS.includes(k) ? "::jsonb" : ""}`);
  const values = keys.map((k) => (JSON_COLUMNS.includes(k) ? JSON.stringify((fields as any)[k]) : (fields as any)[k]));
  const { rows } = await pgPool.query(
    `UPDATE forge_app_generation_runs SET ${[...sets, `"updatedAt" = now()`].join(", ")} WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return rowToRun(rows[0]);
}

export interface CreateRunInput {
  projectId: string;
  tenantId: string;
  requestedById: string;
  mode: unknown;
  brief?: unknown;
  templateId?: unknown;
  idempotencyKey?: unknown;
  retryOfRunId?: string;
}

function normalizeInput(input: CreateRunInput) {
  if (input.mode !== "AI_PROVIDER" && input.mode !== "APPROVED_TEMPLATE") {
    throw new AppError('mode must be "AI_PROVIDER" or "APPROVED_TEMPLATE"', 400, "INVALID_MODE");
  }
  const mode = input.mode as AppGenerationMode;
  const brief = typeof input.brief === "string" ? input.brief.trim() : "";
  let templateId: string | null = null;
  if (mode === "AI_PROVIDER") {
    if (brief.length < BRIEF_MIN || brief.length > BRIEF_MAX) {
      throw new AppError(`Describe the application in ${BRIEF_MIN}-${BRIEF_MAX} characters`, 400, "INVALID_BRIEF");
    }
  } else {
    templateId = typeof input.templateId === "string" ? input.templateId : "";
    if (!APPROVED_TEMPLATES[templateId]) {
      throw new AppError(`Unknown template. Available: ${Object.keys(APPROVED_TEMPLATES).join(", ")}`, 400, "UNKNOWN_TEMPLATE");
    }
  }
  const idempotencyKey = typeof input.idempotencyKey === "string" && input.idempotencyKey.trim()
    ? input.idempotencyKey.trim().slice(0, 128)
    : crypto.randomUUID();
  return { mode, brief, templateId, idempotencyKey };
}

export class AppGenerationService {
  constructor(private readonly deps: AppGenerationDeps = defaultDeps) {}

  /**
   * Records a run and starts processing it. A repeated idempotency key with the same input returns
   * the original run; the same key with different input is a conflict (§12 idempotency rules).
   */
  async createRun(input: CreateRunInput): Promise<{ run: AppGenerationRun; created: boolean }> {
    const { mode, brief, templateId, idempotencyKey } = normalizeInput(input);

    // Admission must be serialized across server processes, not only within this
    // worker. The transaction-scoped advisory lock is released on commit/rollback.
    const client = await pgPool.connect();
    let run: AppGenerationRun;
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('forge-app-generation'), hashtext($1::text))",
        [input.projectId]
      );

      const existing = await client.query(
        `SELECT * FROM forge_app_generation_runs WHERE "projectId" = $1 AND "idempotencyKey" = $2`,
        [input.projectId, idempotencyKey]
      );
      if (existing.rows[0]) {
        const previous = rowToRun(existing.rows[0]);
        if (previous.mode !== mode || previous.brief !== brief || previous.templateId !== templateId) {
          throw new AppError("This idempotency key was already used for a different request", 409, "IDEMPOTENCY_CONFLICT");
        }
        await client.query("COMMIT");
        return { run: previous, created: false };
      }

      const active = await client.query(
        `SELECT id FROM forge_app_generation_runs WHERE "projectId" = $1 AND status <> ALL($2::text[]) LIMIT 1`,
        [input.projectId, TERMINAL]
      );
      if (active.rows[0]) {
        throw new AppError("A generation is already running for this project", 409, "GENERATION_IN_PROGRESS");
      }

      const inserted = await client.query(
        `INSERT INTO forge_app_generation_runs ("projectId", "requestedById", mode, status, brief, "templateId", "idempotencyKey", "retryOfRunId")
         VALUES ($1, $2, $3, 'QUEUED', $4, $5, $6, $7)
         ON CONFLICT ("projectId", "idempotencyKey") DO NOTHING
         RETURNING *`,
        [input.projectId, input.requestedById, mode, brief, templateId, idempotencyKey, input.retryOfRunId ?? null]
      );
      if (!inserted.rows[0]) {
        // A request bypassing this lock may have inserted this idempotency key.
        // Do not recursively create a run: fail safely and let the caller replay.
        throw new AppError("Generation idempotency key is being processed; retry the request", 409, "IDEMPOTENCY_IN_PROGRESS");
      }
      run = rowToRun(inserted.rows[0]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    // Start only after the transaction commits, otherwise a worker might claim
    // a run before it is visible outside the admission transaction.
    setImmediate(() => {
      this.processRun(run.id, input.tenantId).catch(async () => {
        // Unexpected failures must not strand a project in an active run state.
        // Do not expose internal exception messages, which may contain provider credentials.
        try {
          await failUnexpectedGenerationRun(run.id);
        } catch {
          console.error(`[app-generation] Failed to persist unexpected failure for run ${run.id}`);
        }
      });
    });
    return { run, created: true };
  }

  async getRun(projectId: string, runId: string): Promise<AppGenerationRun> {
    const { rows } = await pgPool.query(
      `SELECT * FROM forge_app_generation_runs WHERE id::text = $1 AND "projectId" = $2`,
      [runId, projectId]
    );
    if (!rows[0]) throw new AppError("Generation run not found", 404, "NOT_FOUND");
    return rowToRun(rows[0]);
  }

  /**
   * Read-only evidence check against the exact persisted generation manifest.
   * This does not build or certify generated code and never changes historical run status.
   * An edited or removed file is reported as drift, not silently overwritten.
   */
  async verifySource(projectId: string, runId: string): Promise<{
    runId: string;
    checkedAt: string;
    allMatch: boolean;
    files: Array<{ path: string; result: "MATCH" | "CHANGED" | "MISSING" | "NOT_WRITTEN" }>;
  }> {
    const run = await this.getRun(projectId, runId);
    if (run.status !== "SOURCE_WRITTEN") {
      throw new AppError("Only completed source generation runs can be verified", 409, "SOURCE_NOT_READY");
    }
    const files: Array<{ path: string; result: "MATCH" | "CHANGED" | "MISSING" | "NOT_WRITTEN" }> = [];
    for (const entry of run.files) {
      if (!entry.written) {
        files.push({ path: entry.path, result: "NOT_WRITTEN" });
        continue;
      }
      try {
        const actual = await this.deps.filesystem.readFile(projectId, entry.path);
        const hash = crypto.createHash("sha256").update(String(actual.content ?? "")).digest("hex");
        files.push({
          path: entry.path,
          result: actual.isGenerated && hash === entry.sha256 ? "MATCH" : "CHANGED",
        });
      } catch (err: any) {
        if (err?.code !== "FILE_NOT_FOUND") throw err;
        files.push({ path: entry.path, result: "MISSING" });
      }
    }
    return {
      runId: run.id,
      checkedAt: new Date().toISOString(),
      allMatch: files.length > 0 && files.every((entry) => entry.result === "MATCH"),
      files,
    };
  }

  async listRuns(projectId: string, limit = 20): Promise<AppGenerationRun[]> {
    const { rows } = await pgPool.query(
      `SELECT * FROM forge_app_generation_runs WHERE "projectId" = $1 ORDER BY "createdAt" DESC LIMIT $2`,
      [projectId, Math.min(Math.max(limit, 1), 100)]
    );
    return rows.map(rowToRun);
  }

  /** Starts a new run with the same request as a failed one. */
  async retryRun(projectId: string, runId: string, tenantId: string, requestedById: string) {
    const previous = await this.getRun(projectId, runId);
    if (previous.status !== "FAILED") {
      throw new AppError("Only failed runs can be retried", 409, "RUN_NOT_FAILED");
    }
    return this.createRun({
      projectId,
      tenantId,
      requestedById,
      mode: previous.mode,
      brief: previous.brief,
      templateId: previous.templateId ?? undefined,
      idempotencyKey: `retry:${previous.id}`,
      retryOfRunId: previous.id,
    });
  }

  /**
   * Processes a queued run. Claiming is fenced on status so a run is processed at most once.
   */
  async processRun(runId: string, tenantId: string): Promise<AppGenerationRun> {
    const claimed = await pgPool.query(
      `UPDATE forge_app_generation_runs SET status = 'PLANNING', "updatedAt" = now()
       WHERE id = $1 AND status = 'QUEUED' RETURNING *`,
      [runId]
    );
    if (!claimed.rows[0]) {
      const { rows } = await pgPool.query(`SELECT * FROM forge_app_generation_runs WHERE id = $1`, [runId]);
      return rowToRun(rows[0]);
    }
    let run = rowToRun(claimed.rows[0]);
    const diagnostics: AppGenerationRun["diagnostics"] = [];

    const fail = (code: string, message: string, extra: Partial<AppGenerationRun> = {}) =>
      updateRun(run.id, {
        status: "FAILED",
        errorCode: code,
        errorMessage: message,
        diagnostics: [...diagnostics, { severity: "error", message }],
        completedAt: new Date().toISOString(),
        ...extra,
      });

    // 1. Plan the application model.
    let model: AppModel;
    if (run.mode === "APPROVED_TEMPLATE") {
      model = APPROVED_TEMPLATES[run.templateId!];
      diagnostics.push({ severity: "info", message: `Used approved template "${run.templateId}"; no AI provider was called.` });
    } else {
      const planned = await this.planWithProvider(run, diagnostics);
      run = planned.run;
      if (!planned.model) return planned.failure!;
      model = planned.model;
    }

    // 2. Convert to the authoritative ApplicationSpec contract and validate it.
    const spec = toApplicationSpec(model, run.projectId, tenantId);
    const specCheck = ApplicationSpecService.validateApplicationSpec(spec);
    for (const w of specCheck.warnings) diagnostics.push({ severity: "warn", message: w });
    if (!specCheck.valid) {
      return fail("SPEC_INVALID", `ApplicationSpec validation failed: ${specCheck.errors.join("; ")}`, { appModel: model });
    }
    run = await updateRun(run.id, { status: "GENERATING_SOURCE", appModel: model, spec, diagnostics });

    // 3. Emit and statically validate source (no execution of generated code).
    const files = emitApplicationSource(model, spec, run.id, run.mode);
    const sourceCheck = validateEmittedSource(files);
    if (!sourceCheck.ok) {
      return fail("SOURCE_VALIDATION_FAILED", `Generated source failed validation: ${sourceCheck.errors.slice(0, 10).join("; ")}`);
    }
    diagnostics.push({ severity: "info", message: `Syntax-checked ${sourceCheck.checkedFiles} files; relative imports resolve and every package import is a declared dependency.` });

    // 4. Refuse to overwrite source that ForgeStudio did not generate.
    const expectedVersions = new Map<string, number>();
    const conflicts: string[] = [];
    for (const file of files) {
      try {
        const existing = await this.deps.filesystem.readFile(run.projectId, file.path);
        if (!existing.isGenerated || !String(existing.content ?? "").includes(GENERATED_MARKER)) conflicts.push(file.path);
        else expectedVersions.set(file.path, existing.version);
      } catch (err: any) {
        if (err?.code !== "FILE_NOT_FOUND") throw err;
      }
    }
    if (conflicts.length > 0) {
      return fail("SOURCE_CONFLICT", `These files exist and were not generated by ForgeStudio, so they were not overwritten: ${conflicts.join(", ")}`);
    }

    // 5. Write files. A partial failure is reported with exactly which files were written.
    run = await updateRun(run.id, { status: "WRITING_SOURCE", diagnostics });
    const manifest: AppGenerationRun["files"] = files.map((f) => ({
      path: f.path,
      role: f.role,
      sha256: crypto.createHash("sha256").update(f.content).digest("hex"),
      bytes: Buffer.byteLength(f.content),
      written: false,
    }));
    for (let i = 0; i < files.length; i++) {
      const file: EmittedFile = files[i];
      try {
        await this.deps.filesystem.writeFile(run.projectId, file.path, {
          content: file.content,
          encoding: "utf-8",
          isGenerated: true,
          expectedVersion: expectedVersions.get(file.path),
          requireAbsent: !expectedVersions.has(file.path),
          authorId: run.requestedById,
          reason: `Application generation run ${run.id}`,
        });
        // A successful write acknowledgement is not proof that the bytes are
        // durably readable. Verify content and provenance before issuing evidence.
        const persisted = await this.deps.filesystem.readFile(run.projectId, file.path);
        if (!persisted.isGenerated ||
            crypto.createHash("sha256").update(String(persisted.content ?? "")).digest("hex") !== manifest[i].sha256) {
          return fail(
            "SOURCE_VERIFICATION_FAILED",
            `The generated file ${file.path} did not match its persisted source manifest; build and deployment are blocked.`,
            { files: manifest }
          );
        }
        manifest[i].written = true;
      } catch (err: any) {
        const written = manifest.filter((m) => m.written).length;
        return fail(
          "WRITE_FAILED",
          `Writing generated file failed; ${written} of ${files.length} files were verified. Review restricted server diagnostics before retrying.`,
          { files: manifest }
        );
      }
    }

    diagnostics.push({
      severity: "warn",
      message: "Generation did not install, build, migrate, execute or deploy the package; those steps run separately (see forge-app/README.md).",
    });
    return updateRun(run.id, { status: "SOURCE_WRITTEN", files: manifest, diagnostics, completedAt: new Date().toISOString() });
  }

  private async planWithProvider(run: AppGenerationRun, diagnostics: AppGenerationRun["diagnostics"]) {
    let provider: AiProvider;
    try {
      provider = this.deps.providerFactory();
    } catch (err: any) {
      const failure = await updateRun(run.id, {
        status: "FAILED", errorCode: "AI_NOT_CONFIGURED", errorMessage: "AI generation provider is unavailable or not configured.",
        completedAt: new Date().toISOString(),
      });
      return { run, model: null, failure };
    }
    run = await updateRun(run.id, { provider: provider.name, model: provider.model });

    let inputTokens: number | null = null;
    let outputTokens: number | null = null;
    const requestIds: string[] = [];
    let lastErrors: string[] = [];
    let previousOutput = "";

    for (let attempt = 0; attempt <= MAX_REPAIR_ATTEMPTS; attempt++) {
      const isRepair = attempt > 0;
      const prompt = isRepair
        ? `Requirements:\n${run.brief}\n\nYour previous output was rejected:\n${lastErrors.join("\n")}\n\nPrevious output:\n${previousOutput.slice(0, 6000)}\n\nReturn a corrected JSON object.`
        : run.brief;
      let result;
      try {
        result = await provider.generate({
          operation: "CODE_GENERATION",
          prompt,
          context: {},
          systemPrompt: APP_MODEL_SYSTEM_PROMPT,
          schema: APP_MODEL_JSON_SCHEMA,
        });
      } catch (err: any) {
        const failure = await updateRun(run.id, {
          status: "FAILED",
          errorCode: "AI_PROVIDER_UNAVAILABLE",
          errorMessage: "AI provider request failed. Check the provider configuration and retry.",
          providerCalls: attempt + 1,
          repairAttempts: attempt,
          inputTokens, outputTokens, providerRequestIds: requestIds,
          diagnostics: [...diagnostics, { severity: "error", message: `Provider request ${attempt + 1} failed; provider error details were withheld from the run record.` }],
          completedAt: new Date().toISOString(),
        });
        return { run, model: null, failure };
      }

      if (result.requestId) requestIds.push(result.requestId);
      if (result.usage) {
        inputTokens = (inputTokens ?? 0) + result.usage.inputTokens;
        outputTokens = (outputTokens ?? 0) + result.usage.outputTokens;
      } else {
        diagnostics.push({ severity: "info", message: `Provider response ${attempt + 1} did not report token usage.` });
      }
      previousOutput = result.text;

      let parsed: unknown;
      try {
        parsed = JSON.parse(result.text);
        lastErrors = [];
      } catch {
        lastErrors = ["Output was not valid JSON"];
      }
      const check = lastErrors.length > 0 ? { valid: false, errors: lastErrors } : validateAppModel(parsed);
      if (check.valid && "model" in check && check.model) {
        diagnostics.push({
          severity: "info",
          message: `Provider ${provider.name} (${result.model}) produced a valid application model${isRepair ? ` after ${attempt} repair request(s)` : ""}.`,
        });
        run = await updateRun(run.id, {
          model: result.model, providerCalls: attempt + 1, repairAttempts: attempt,
          inputTokens, outputTokens, providerRequestIds: requestIds,
        });
        return { run, model: check.model, failure: null };
      }
      lastErrors = check.errors;
      diagnostics.push({ severity: "warn", message: `Provider output ${attempt + 1} rejected: ${check.errors.slice(0, 8).join("; ")}` });
    }

    const failure = await updateRun(run.id, {
      status: "FAILED",
      errorCode: "AI_INVALID_OUTPUT",
      errorMessage: `The provider did not return a valid application model after ${MAX_REPAIR_ATTEMPTS} repair requests.`,
      providerCalls: MAX_REPAIR_ATTEMPTS + 1,
      repairAttempts: MAX_REPAIR_ATTEMPTS,
      inputTokens, outputTokens, providerRequestIds: requestIds,
      diagnostics: [...diagnostics, { severity: "error", message: `Last validation errors: ${lastErrors.slice(0, 8).join("; ")}` }],
      completedAt: new Date().toISOString(),
    });
    return { run, model: null, failure };
  }
}

/**
 * Runs left in a non-terminal state by a process that stopped cannot be resumed safely (the
 * provider call or writes may have partially happened), so they are marked as interrupted.
 */
/**
 * Fail only a still-active generation after an unhandled worker error.
 * This conditional write cannot erase a terminal result from a concurrent worker,
 * and preserves the existing diagnostic history without leaking the thrown error.
 */
export async function failUnexpectedGenerationRun(runId: string): Promise<boolean> {
  const { rowCount } = await pgPool.query(
    `UPDATE forge_app_generation_runs
     SET status = 'FAILED', "errorCode" = 'UNEXPECTED_GENERATION_FAILURE',
         "errorMessage" = 'Application generation stopped unexpectedly. Review diagnostics and retry the failed run.',
         diagnostics = COALESCE(diagnostics, '[]'::jsonb) ||
           $2::jsonb,
         "completedAt" = now(), "updatedAt" = now()
     WHERE id = $1 AND status <> ALL($3::text[])`,
    [runId, JSON.stringify([{ severity: "error", message: "An unexpected generation failure interrupted this run." }]), TERMINAL]
  );
  return (rowCount ?? 0) > 0;
}

export async function reconcileInterruptedRuns(): Promise<number> {
  const { rowCount } = await pgPool.query(
    `UPDATE forge_app_generation_runs
     SET status = 'FAILED', "errorCode" = 'INTERRUPTED',
         "errorMessage" = 'The server stopped while this generation was running. Retry the run.',
         "completedAt" = now(), "updatedAt" = now()
     WHERE status <> ALL($1::text[])`,
    [TERMINAL]
  );
  return rowCount ?? 0;
}

export const appGenerationService = new AppGenerationService();
