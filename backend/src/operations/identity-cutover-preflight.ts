import { pgPool, prisma } from "../config/prisma.js";
import { loadOidcConfiguration } from "../adapters/identity/oidc.config.js";

/** Read-only release preflight. It deliberately does not bind accounts by email,
 * seed administrators, rewrite migration history or relax authentication. */
async function main() {
  const configured = loadOidcConfiguration();
  const tables = await pgPool.query<{ ready: boolean }>(`SELECT
    to_regclass('public.oidc_identities') IS NOT NULL
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='authEpoch')
    AS ready`);
  if (!tables.rows[0]?.ready) {
    console.log(JSON.stringify({ ready: false, reason: "IDENTITY_MIGRATION_REQUIRED" }));
    process.exitCode = 1; return;
  }
  const result = await pgPool.query<{ active: number; unbound: number; unboundPrivileged: number }>(`
    SELECT count(*)::int AS active,
      count(*) FILTER (WHERE NOT EXISTS (
        SELECT 1 FROM oidc_identities i WHERE i."userId"=u.id AND i.issuer=$1
      ))::int AS unbound,
      count(*) FILTER (WHERE u.role::text <> 'USER' AND NOT EXISTS (
        SELECT 1 FROM oidc_identities i WHERE i."userId"=u.id AND i.issuer=$1
      ))::int AS "unboundPrivileged"
    FROM users u WHERE u.status='ACTIVE'`, [configured?.issuer ?? ""]);
  const counts = result.rows[0]!;
  const configurationReady = !!configured?.mfaAcrs.length && !!configured.phishingResistantAcrs.length;
  const ready = configurationReady && counts.unbound === 0;
  console.log(JSON.stringify({
    ready, scope: "read-only configuration and binding-coverage preflight",
    configurationReady, ...counts,
    providerNetworkVerified: false,
    reason: ready ? "REQUIRES_LIVE_PROVIDER_AND_RELEASE_QUALIFICATION" : "CUTOVER_BLOCKED",
  }));
  if (!ready) process.exitCode = 1;
}
main().catch(() => { console.error("Identity cutover preflight failed; inspect the controlled operator environment."); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); await pgPool.end(); });
