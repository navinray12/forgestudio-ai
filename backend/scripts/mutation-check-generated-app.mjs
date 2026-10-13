/**
 * FS21-AT-INT-07 — mutation testing of the generated application's critical gates.
 *
 * Removes one safeguard at a time from the source emitter (tenant permission check, outbox write,
 * database commit) and runs the independent acceptance harness. Every mutation must make the
 * harness fail; a surviving mutation means the harness would not notice that safeguard missing.
 * The emitter is always restored, including on error or interrupt.
 *
 * Run from backend/ with the same variables as the harness:
 *   FORGE_DISPOSABLE_TEST_DB=1 FORGE_GENERATED_APP_E2E=1 \
 *   DATABASE_URL=postgresql://…@localhost:5432/forge_hardening node scripts/mutation-check-generated-app.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const EMITTER = "src/services/appGeneration/appSourceEmitter.ts";
const HARNESS = "src/tests/generated-app.acceptance.test.ts";

const MUTATIONS = [
  {
    name: "permission: read-by-id ignores the tenant",
    find: '\\`SELECT * FROM "\\${TABLE}" WHERE "id" = $1 AND "tenantId" = $2 AND "deletedAt" IS NULL\\`, [req.params.id, tenantId]);',
    replace: '\\`SELECT * FROM "\\${TABLE}" WHERE "id" = $1 AND $2::text IS NOT NULL AND "deletedAt" IS NULL\\`, [req.params.id, tenantId]);',
  },
  {
    name: "durability: create no longer writes its outbox event",
    find: '        await recordEvent(client, tenantId, actor, ENTITY, rows[0].id, "created");',
    replace: "        void recordEvent;",
  },
  {
    name: "persistence: transactions report success but roll back",
    find: '    await client.query("COMMIT");\n    return result;',
    replace: '    await client.query("ROLLBACK");\n    return result;',
  },
];

const original = readFileSync(EMITTER, "utf8");
const restore = () => writeFileSync(EMITTER, original);
process.on("SIGINT", () => { restore(); process.exit(130); });

let survived = 0;
try {
  for (const mutation of MUTATIONS) {
    if (original.split(mutation.find).length !== 2) {
      throw new Error(`Mutation target not found exactly once: ${mutation.name}`);
    }
    writeFileSync(EMITTER, original.replace(mutation.find, mutation.replace));
    const run = spawnSync("npx", ["vitest", "run", HARNESS], { encoding: "utf8", shell: process.platform === "win32", env: process.env });
    restore();
    const output = `${run.stdout}${run.stderr}`.replace(/\x1b\[[0-9;]*m/g, "");
    const skipped = /Tests\s+\d+ skipped/.test(output) && !/passed|failed/.test(output.split("Tests").pop() ?? "");
    if (skipped) throw new Error("The harness was skipped; set FORGE_DISPOSABLE_TEST_DB, FORGE_GENERATED_APP_E2E and DATABASE_URL.");
    const killed = run.status !== 0 && /\d+ failed/.test(output);
    const failedTests = [...output.matchAll(/×[^>]*> ([^\n]+?)\s+\d+ms/g)].map((m) => m[1].split(":")[0]);
    console.log(`${killed ? "KILLED  " : "SURVIVED"} ${mutation.name}${killed ? ` -> failed: ${[...new Set(failedTests)].join(", ")}` : ""}`);
    if (!killed) survived++;
  }
} finally {
  restore();
}

console.log(survived === 0 ? `All ${MUTATIONS.length} mutations were detected.` : `${survived} mutation(s) survived.`);
process.exit(survived === 0 ? 0 : 1);
