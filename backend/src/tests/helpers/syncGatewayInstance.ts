/**
 * A separate backend process for multi-instance and browser tests: the application with the
 * production WebSocket wiring, on its own port, against the disposable database only.
 * Prints `READY <port>` once it is listening.
 */
import "dotenv/config";
import http from "node:http";
import type { AddressInfo } from "node:net";

const database = new URL(process.env.DATABASE_URL || "invalid:");
if (
  process.env.FORGE_DISPOSABLE_TEST_DB !== "1" ||
  !["localhost", "127.0.0.1"].includes(database.hostname) ||
  database.pathname !== "/forge_hardening"
) {
  console.error("Refusing to start: the disposable forge_hardening database is required.");
  process.exit(2);
}

const { default: app } = await import("../../app.js");
const { attachWebSocketGateways } = await import("../../websocketGateways.js");

const server = http.createServer(app);
const gateways = attachWebSocketGateways(server);
await gateways.workspaceSync.ready;
server.listen(Number(process.env.INSTANCE_PORT || 0), process.env.INSTANCE_HOST || "127.0.0.1", () => {
  console.log(`READY ${(server.address() as AddressInfo).port}`);
});

const shutdown = async () => {
  await gateways.close().catch(() => undefined);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
