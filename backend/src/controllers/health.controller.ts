import type { Request, Response } from "express";
import { pgPool } from "../config/prisma.js";

/** Liveness has no dependency calls and must not restart every task during an
 * optional-provider outage. It is not a production-readiness certificate.
 */
export function livenessCheck(_req: Request, res: Response) {
  return res.status(200).json({ status: "ok", scope: "process", timestamp: new Date().toISOString() });
}

/** Minimal public readiness signal. Detailed topology and database errors are
 * never exposed by an anonymous probe. Query/pool timeouts bound dependency work.
 */
export async function healthCheck(_req: Request, res: Response) {
  try {
    await pgPool.query({ text: "SELECT 1" });
    return res.status(200).json({ status: "ok", scope: "database-connectivity", timestamp: new Date().toISOString() });
  } catch {
    return res.status(503).json({ status: "down", scope: "database-connectivity", timestamp: new Date().toISOString() });
  }
}

/** Restricted, read-only metadata. Migration logs may include sensitive SQL and
 * are deliberately excluded; inspect them with an approved operator procedure.
 */
export async function prismaMigrationStatus(_req: Request, res: Response) {
  try {
    const { rows } = await pgPool.query({
      text: 'SELECT migration_name, finished_at, rolled_back_at, started_at, applied_steps_count FROM _prisma_migrations ORDER BY started_at DESC LIMIT 200',
    });
    return res.status(200).json({ success: true, migrations: rows, boundedLimit: 200, readOnly: true });
  } catch {
    return res.status(503).json({ success: false, error: { code: "MIGRATION_STATUS_UNAVAILABLE", message: "Migration metadata is unavailable" } });
  }
}

export function prismaMigrationRecover(_req: Request, res: Response) {
  return res.status(410).json({ success: false, error: {
    code: "HTTP_MIGRATION_REPAIR_REMOVED",
    message: "Migration recovery requires a reviewed operator procedure; HTTP cannot rewrite migration history",
  } });
}

export function diagnosePorts(_req: Request, res: Response) {
  return res.status(410).json({ success: false, error: {
    code: "HOST_DIAGNOSTICS_REMOVED", message: "Host and container diagnostics require an approved operator channel",
  } });
}

function safeReleaseValue(value: string | undefined): string | null {
  return value && /^[a-zA-Z0-9._:-]{1,128}$/.test(value) ? value : null;
}
export function canaryManifest(_req: Request, res: Response) {
  return res.status(200).json({
    version: safeReleaseValue(process.env.APP_VERSION),
    buildId: safeReleaseValue(process.env.BUILD_ID),
    qualification: "NOT_ASSERTED_BY_ENDPOINT",
  });
}

export function signOffReport(_req: Request, res: Response) {
  return res.status(200).json({ status: "NOT_VERIFIED", productionReady: false,
    message: "A signed release report with commit, configuration, migration and test evidence is required",
  });
}

export function sanitizeDemo(_req: Request, res: Response) {
  return res.status(410).json({ success: false, error: { code: "DEMO_ENDPOINT_REMOVED", message: "Use isolated sanitizer tests" } });
}
