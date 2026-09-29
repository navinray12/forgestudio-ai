import "dotenv/config";
import http from "http";
import app from "./app.js";
import { startScheduler } from "./services/scheduleWorker.js";
import { initPresenceWebSocketServer } from "./services/collaboration/presence.service.js";

import { validateIdentityConfiguration } from "./modules/identity/composition.js";
validateIdentityConfiguration();

process.on("unhandledRejection", (reason) => {
  console.error("⚠️ [UNHANDLED REJECTION]", reason);
});

process.on("uncaughtException", (error) => {
  console.error("⚠️ [UNCAUGHT EXCEPTION]", error);
});

import { ensureDatabaseReady } from "./config/db-init.js";

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
initPresenceWebSocketServer(server);

async function start() {
  await ensureDatabaseReady();
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    startScheduler();
  });
}

start();