/**
 * Durable benchmark runs (blueprint §03, forge_benchmark_runs).
 *
 * A run is an operator-submitted measurement report. The report is computed by the benchmark
 * protocol and stored once: resubmitting the same configuration and results returns the stored run.
 */
import { randomBytes } from "node:crypto";
import { pgPool } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { recordAuditLog } from "../audit.service.js";
import { requestHashOf } from "../websiteRecords.service.js";
import {
  computeBenchmarkRunReport,
  validateBenchmarkRunConfig,
  type BenchmarkRunConfig,
  type BenchmarkRunReport,
  type TaskMeasurementResult,
} from "./benchmarkProtocol.js";

export async function recordBenchmarkRun(
  userId: string,
  input: { config: BenchmarkRunConfig; taskResults: TaskMeasurementResult[]; knownLimitations?: string[] }
): Promise<{ report: BenchmarkRunReport; replayed: boolean }> {
  const { config, taskResults, knownLimitations = [] } = input;
  const validation = validateBenchmarkRunConfig(config);
  if (!validation.valid) {
    throw new AppError(`Benchmark run configuration invalid: ${validation.errors.join("; ")}`, 400, "INVALID_INPUT");
  }

  const requestHash = requestHashOf({ config, taskResults, knownLimitations });
  const runId = `run-${Date.now()}-${randomBytes(4).toString("hex")}`;
  const report = computeBenchmarkRunReport(runId, config, taskResults, knownLimitations);

  const { rows } = await pgPool.query(
    `INSERT INTO forge_benchmark_runs ("runId", "requestHash", report, "recordedById")
     VALUES ($1, $2, $3::jsonb, $4::uuid) ON CONFLICT ("requestHash") DO NOTHING RETURNING "runId"`,
    [runId, requestHash, JSON.stringify(report), userId]
  );
  if (!rows[0]) {
    const { rows: existing } = await pgPool.query(`SELECT report FROM forge_benchmark_runs WHERE "requestHash" = $1`, [requestHash]);
    return { report: existing[0].report as BenchmarkRunReport, replayed: true };
  }

  await recordAuditLog({
    userId,
    action: "BENCHMARK_RUN_RECORDED",
    targetResource: `benchmark_run:${runId}`,
    details: {
      productName: config.productName,
      briefId: config.briefId,
      overallOutcome: report.summary.overallOutcome,
      hasCriticalFailure: report.summary.hasCriticalFailure,
      compositeScore: report.summary.provisionalCompositeScore,
    },
  });
  return { report, replayed: false };
}

export async function listBenchmarkRuns() {
  const { rows } = await pgPool.query(`SELECT report FROM forge_benchmark_runs ORDER BY "createdAt" DESC LIMIT 200`);
  return rows.map(({ report: r }: { report: BenchmarkRunReport }) => ({
    runId: r.runId,
    createdAt: r.createdAt,
    productName: r.config.productName,
    productVersion: r.config.productVersion,
    briefId: r.config.briefId,
    overallOutcome: r.summary.overallOutcome,
    hasCriticalFailure: r.summary.hasCriticalFailure,
    compositeScore: r.summary.provisionalCompositeScore,
    tasksPassed: r.summary.tasksPassed,
    totalTasks: r.summary.totalTasks,
  }));
}

export async function getBenchmarkRun(runId: string): Promise<BenchmarkRunReport> {
  const { rows } = await pgPool.query(`SELECT report FROM forge_benchmark_runs WHERE "runId" = $1`, [runId]);
  if (!rows[0]) throw new AppError("Benchmark run not found.", 404, "NOT_FOUND");
  return rows[0].report as BenchmarkRunReport;
}
