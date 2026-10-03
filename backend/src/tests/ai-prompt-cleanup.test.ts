import test from "node:test";
import assert from "node:assert/strict";
import { promptCleanupInterval, startPromptCleanup } from "../modules/ai/prompt-cleanup-scheduler.js";

test("cleanup interval fails closed outside operational bounds", () => {
  assert.equal(promptCleanupInterval("60000"), 60_000);
  for (const input of ["0", "NaN", "1.5", "999", "3600001"]) assert.throws(() => promptCleanupInterval(input));
});

test("cleanup awaits active batch, never overlaps, and drains on shutdown", async () => {
  let complete!: (count: number) => void;
  let schedules = 0;
  const loop = startPromptCleanup({ intervalMs: 1000, purge: () => new Promise<number>(resolve => { complete = resolve; }),
    schedule: () => { schedules++; return () => {}; } });
  assert.equal(schedules, 0);
  const stopping = loop.stop();
  complete(250);
  await stopping;
  assert.equal(schedules, 0);
});

test("cleanup recovers after failure and immediately sweeps again after restart", async () => {
  let callback!: () => void, calls = 0, failures = 0, cancelled = 0;
  const purge = async () => { if (++calls === 1) throw new Error("Sensitive SQL must not reach callback"); return 1; };
  const loop = startPromptCleanup({ intervalMs: 1000, purge, onFailure: (...args) => { assert.equal(args.length, 0); failures++; },
    schedule: (run, delay) => { callback = run; assert.equal(delay, 1000); return () => { cancelled++; }; } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(failures, 1);
  callback();
  await new Promise(resolve => setImmediate(resolve));
  await loop.stop();
  assert.equal(calls, 2); assert.equal(cancelled, 1);
  const restarted = startPromptCleanup({ intervalMs: 1000, purge });
  await restarted.stop();
  assert.equal(calls, 3);
});
