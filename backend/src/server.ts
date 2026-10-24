import "dotenv/config"; // tsx reload trigger 8
import http from "http";
import app from "./app.js";
import { startScheduler } from "./services/scheduleWorker.js";
import { pgPool, prisma } from "./config/prisma.js";

import { validateIdentityConfiguration } from "./modules/identity/composition.js";
import { ensureDatabaseTables } from "./config/ensure-schema.js";
import { reconcileInterruptedRuns } from "./services/appGeneration/appGeneration.service.js";
validateIdentityConfiguration();

const PORT = process.env.PORT || 5000;

import { attachWebSocketGateways } from "./websocketGateways.js";
import { unifiedMigrationAuthority } from "./services/migration/unifiedMigrationAuthority.service.js";

const server = http.createServer(app);
// Presence, workspace sync (/ws/workspace-sync), data realtime and terminal gateways.
const gateways = attachWebSocketGateways(server);

import { ensureDefaultPlans } from "./services/subscription.service.js";
import { initTemplateTable } from "./services/template.service.js";

void ensureDatabaseTables().then(async () => {
  // Bootstrap dependent template tables in startup order, never during import.
  // A failed schema operation must prevent the HTTP server from accepting traffic.
  await initTemplateTable();
  // Ensure subscription plans exist for onboarding
  await ensureDefaultPlans().catch((err) => {
    console.warn("[subscriptions] could not seed default plans:", err?.message || err);
  });

  const interrupted = await reconcileInterruptedRuns().catch((err) => {
    console.error("[app-generation] could not reconcile interrupted runs:", err?.message || err);
    return 0;
  });
  if (interrupted > 0) console.warn(`[app-generation] marked ${interrupted} interrupted generation run(s) as failed`);
  // A migration left in flight by a process that died is resolved from what its target database
  // holds (never re-run). Anything still held by a live session is left for the next start.
  void unifiedMigrationAuthority.reconcileInterrupted().then((resolved) => {
    if (resolved.length > 0) console.warn(`[migrations] reconciled ${resolved.length} interrupted migration(s): ${resolved.map((r) => `${r.id}=${r.status}`).join(", ")}`);
  }).catch((err) => console.error("[migrations] could not reconcile interrupted migrations:", err?.message || err));
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    startScheduler();
  });
}).catch((err) => {
  console.error("FATAL: Failed to initialize database schema. Refusing to start server with incomplete schema:", err);
  process.exit(1);
});

server.on("error", (error) => {
  console.error(JSON.stringify({ event: "server.error", code: (error as NodeJS.ErrnoException).code ?? "UNKNOWN" }));
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(JSON.stringify({ event: "server.shutdown", signal }));
  await gateways.close().catch(() => undefined);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect().catch(() => undefined);
  await pgPool.end().catch(() => undefined);
}
process.once("SIGTERM", () => { void shutdown("SIGTERM"); });
process.once("SIGINT", () => { void shutdown("SIGINT"); });
// trigger tsx watch reload 2
