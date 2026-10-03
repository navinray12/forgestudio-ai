import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pgPool, prisma } from "../config/prisma.js";
import { enqueueJob as enqueue, processNextJob, registerJobHandler, renewJobLease, reconcileExpiredJobs } from "../services/jobs/jobRunner.js";

// Explicitly due fixtures avoid depending on host/container clock synchronization.
const enqueueJob = (type: string, payload: Record<string, unknown>, options: { maxAttempts?: number } = {}) =>
  enqueue(type, payload, { ...options, runAt: new Date(0) });

const database = new URL(process.env.DATABASE_URL || "invalid:");
if (process.env.FORGE_DISPOSABLE_TEST_DB !== "1" || !["localhost", "127.0.0.1"].includes(database.hostname) || database.pathname !== "/forge_hardening") {
  throw new Error("Lease contracts require the explicitly opted-in local forge_hardening database");
}

test("durable worker leases on disposable PostgreSQL", async t => {
  t.after(async () => { await prisma.$disconnect(); await pgPool.end(); });
  const row = (id: string) => prisma.backgroundJob.findUniqueOrThrow({ where: { id } });
  await t.test("targeted claims use bound parameters and concurrent workers execute only once", async () => {
    const type = `FIXTURE_${randomUUID()}`;
    let calls = 0;
    registerJobHandler(type, async () => { calls++; return { completed: true }; });
    const first = await enqueueJob(type, { executionId: randomUUID() }), second = await enqueueJob(type, {});
    const results = await Promise.all([processNextJob({ id: first.id, type }), processNextJob({ id: first.id, type })]);
    assert.equal(results.filter(result => result.processed).length, 1);
    assert.equal(calls, 1); assert.equal((await row(first.id)).status, "COMPLETED");
    assert.equal((await row(second.id)).status, "QUEUED");
    await processNextJob({ id: second.id });
  });
  await t.test("renewal requires current nonexpired token", async () => {
    const job = await enqueueJob(`FIXTURE_${randomUUID()}`, {}), token = randomUUID();
    await prisma.backgroundJob.update({ where: { id: job.id }, data: { status: "RUNNING", lockToken: token, lockedUntil: new Date(Date.now() + 5000) } });
    assert.equal(await renewJobLease(job.id, randomUUID()), false);
    assert.equal(await renewJobLease(job.id, token), true);
    assert.ok((await row(job.id)).lockedUntil!.getTime() > Date.now() + 20_000);
    await prisma.backgroundJob.update({ where: { id: job.id }, data: { lockedUntil: new Date(0) } });
    assert.equal(await renewJobLease(job.id, token), false);
    await reconcileExpiredJobs();
  });
  await t.test("interrupted job goes to durable review exactly once, not a paid retry", async () => {
    const type = `FIXTURE_${randomUUID()}`;
    let calls = 0;
    registerJobHandler(type, async () => { calls++; });
    const job = await enqueueJob(type, { executionId: randomUUID() });
    await prisma.backgroundJob.update({ where: { id: job.id }, data: { status: "RUNNING", lockToken: randomUUID(), lockedUntil: new Date(0) } });
    await reconcileExpiredJobs(); await reconcileExpiredJobs();
    const interrupted = await row(job.id);
    assert.equal(interrupted.status, "FAILED"); assert.equal(interrupted.lastError, "JOB_OUTCOME_UNKNOWN");
    assert.equal((await processNextJob({ id: job.id })).processed, false); assert.equal(calls, 0);
    assert.equal((await pgPool.query('SELECT count(*)::int n FROM job_dead_letters WHERE "jobId"=$1', [job.id])).rows[0].n, 1);
  });
  for (const outcome of ["success", "failure"] as const) {
    await t.test(`stale worker ${outcome} cannot overwrite a replacement lease`, async () => {
      const type = `FIXTURE_${randomUUID()}`, nextToken = randomUUID();
      registerJobHandler(type, async (_payload, job) => {
        await prisma.backgroundJob.update({ where: { id: job.id }, data: { lockToken: nextToken } });
        if (outcome === "failure") throw new Error("SECRET_PROVIDER_BODY");
        return { done: true };
      });
      const job = await enqueueJob(type, {});
      await processNextJob({ id: job.id });
      assert.equal((await row(job.id)).status, "RUNNING"); assert.equal((await row(job.id)).lockToken, nextToken);
      await prisma.backgroundJob.update({ where: { id: job.id }, data: { status: "CANCELLED" } });
    });
  }
  await t.test("cancellation during handler cannot turn into completion", async () => {
    const type = `FIXTURE_${randomUUID()}`;
    registerJobHandler(type, async (_payload, job) => { await prisma.backgroundJob.update({ where: { id: job.id }, data: { status: "CANCELLED" } }); });
    const job = await enqueueJob(type, {});
    await processNextJob({ id: job.id });
    assert.equal((await row(job.id)).status, "CANCELLED");
  });
  await t.test("failed attempts release leases and store safe codes, never error bodies", async () => {
    const type = `FIXTURE_${randomUUID()}`;
    registerJobHandler(type, async () => { throw new Error("SECRET_PROVIDER_BODY"); });
    const job = await enqueueJob(type, { executionId: randomUUID() }, { maxAttempts: 2 });
    await processNextJob({ id: job.id });
    const failed = await row(job.id);
    assert.equal(failed.status, "QUEUED"); assert.equal(failed.lastError, "JOB_EXECUTION_FAILED");
    assert.equal(failed.lockToken, null); assert.equal(failed.lockedUntil, null);
    await prisma.backgroundJob.update({ where: { id: job.id }, data: { runAt: new Date(0) } });
    await processNextJob({ id: job.id });
    assert.equal((await row(job.id)).status, "FAILED");
    const dead = (await pgPool.query('SELECT reason FROM job_dead_letters WHERE "jobId"=$1', [job.id])).rows;
    assert.deepEqual(dead, [{ reason: "JOB_EXECUTION_FAILED" }]);
  });
});
