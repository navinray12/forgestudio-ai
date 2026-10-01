import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { prisma, pgPool } from "../config/prisma.js";
const database = new URL(process.env.DATABASE_URL || "invalid:");
if (process.env.FORGE_TEST_RUNNING_WORKER !== "1" || process.env.FORGE_DISPOSABLE_TEST_DB !== "1" || database.pathname !== "/forge_hardening" || !["localhost", "127.0.0.1"].includes(database.hostname)) throw new Error("Requires opted-in disposable database and running qualification worker");
test("running Compose worker claims and completes a real durable job", async t => {
  t.after(async () => { await prisma.$disconnect(); await pgPool.end(); });
  const eventId = randomUUID();
  const row = await prisma.backgroundJob.create({ data: { type: "DOMAIN_EVENT", payload: { id: eventId, eventType: "qualification.health" }, idempotencyKey: `qualification:${eventId}`, runAt: new Date(0), maxAttempts: 1 } });
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const job = await prisma.backgroundJob.findUniqueOrThrow({ where: { id: row.id } });
    if (job.status === "COMPLETED") { assert.ok(job.startedAt); assert.ok(job.completedAt); assert.ok(job.completedAt >= job.startedAt); assert.equal(job.lockToken, null); return; }
    assert.notEqual(job.status, "FAILED"); await setTimeout(250);
  }
  assert.fail("Running worker did not acknowledge the qualification job");
});
