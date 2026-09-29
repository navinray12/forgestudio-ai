import "dotenv/config";
import http from "http";
import app from "./app.js";
import { startScheduler } from "./services/scheduleWorker.js";
import { initPresenceWebSocketServer } from "./services/collaboration/presence.service.js";
import { pgPool, prisma } from "./config/prisma.js";

import { validateIdentityConfiguration } from "./modules/identity/composition.js";
validateIdentityConfiguration();

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
initPresenceWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  startScheduler();
});

server.on("error", (error) => {
  console.error(JSON.stringify({ event: "server.error", code: (error as NodeJS.ErrnoException).code ?? "UNKNOWN" }));
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(JSON.stringify({ event: "server.shutdown", signal }));
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect().catch(() => undefined);
  await pgPool.end().catch(() => undefined);
}
process.once("SIGTERM", () => { void shutdown("SIGTERM"); });
process.once("SIGINT", () => { void shutdown("SIGINT"); });
