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

const server = http.createServer(app);
// Presence, workspace sync (/ws/workspace-sync), data realtime and terminal gateways.
const gateways = attachWebSocketGateways(server);

void ensureDatabaseTables().then(async () => {
  const interrupted = await reconcileInterruptedRuns().catch((err) => {
    console.error("[app-generation] could not reconcile interrupted runs:", err?.message || err);
    return 0;
  });
  if (interrupted > 0) console.warn(`[app-generation] marked ${interrupted} interrupted generation run(s) as failed`);
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    startScheduler();
  });
}).catch((err) => {
  console.error("Failed to ensure tables, starting server anyway:", err);
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    startScheduler();
  });
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
