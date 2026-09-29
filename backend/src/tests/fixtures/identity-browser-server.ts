import { writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { createApplication } from "../../app.js";
import { createLocalIdentityRouter } from "../../modules/identity/http/local.routes.js";
import { createOidcRouter } from "../../modules/identity/http/oidc.routes.js";
import { LocalAuthentication } from "../../modules/identity/application/local-authentication.js";
import { PostgresIdentityStore } from "../../adapters/postgres/identity.store.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { prisma, pgPool } from "../../config/prisma.js";

// Test composition only. No production entry point imports this file. The sink
// receives the actual generated code; there is no universal code or auth shortcut.
const database = new URL(process.env.DATABASE_URL ?? "invalid:");
const output = process.env.FORGE_IDENTITY_MAIL_SINK;
if (process.env.NODE_ENV !== "test" || process.env.FORGE_DISPOSABLE_TEST_DB !== "1" ||
    !["127.0.0.1", "localhost"].includes(database.hostname) ||
    database.pathname !== "/forge_identity_browser" || !output || !path.isAbsolute(output)) {
  throw new Error("Identity browser fixtures require an opted-in local disposable database and private output file.");
}
if (await prisma.user.count() !== 0) throw new Error("Identity browser database must start empty.");
const authentication = new LocalAuthentication(new PostgresIdentityStore(), { hash: hashPassword, verify: verifyPassword }, {
  async sendCode(input) {
    const temporary = `${output}.${randomUUID()}`;
    await writeFile(temporary, JSON.stringify(input), { mode: 0o600 });
    await rename(temporary, output);
  },
});
const app = createApplication(createLocalIdentityRouter(authentication), createOidcRouter(null));
const server = createServer(app);
server.listen(Number(process.env.PORT ?? 5000), "127.0.0.1", () => console.log("Disposable identity browser server ready"));
for (const signal of ["SIGTERM", "SIGINT"] as const) process.once(signal, () => {
  server.close(async () => { await prisma.$disconnect(); await pgPool.end(); process.exit(0); });
  setTimeout(() => process.exit(1), 5000).unref();
});
