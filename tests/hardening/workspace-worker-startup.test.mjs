import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { loadTypeScript } from './load-typescript.mjs';

test('missing general outbox at startup does not crash or stop invitation email dispatch; errors stay sanitized', async () => {
  const errors = [], timers = []; let deliveries = 0;
  const noop = () => {};
  await loadTypeScript('backend/src/workers/main.ts', {
    'dotenv/config': {},
    '../services/jobs/jobRunner.js': { registerJobHandler: noop, startJobWorker: noop, stopJobWorker: async () => {} },
    '../services/files/file.service.js': { scanFileObject: noop },
    '../platform/execution/durable-outbox.js': {
      leaseOutboxBatch: async () => { throw Object.assign(new Error('private SQL token=secret'), { code: '42P01' }); },
      markOutboxDispatched: noop, markOutboxFailed: noop,
    },
    '../services/jobs/durable-job.js': { enqueueDurableJob: noop },
    '../config/prisma.js': { pgPool: {}, prisma: {} },
    '../modules/ai/prompt-cleanup-scheduler.js': { startPromptCleanup: () => ({ stop: async () => {} }) },
    '../modules/ai/design/pipeline.js': { runDesignExecution: noop },
    '../services/workspaces/invitation-delivery.service.js': { dispatchWorkspaceInvitationEmail: async () => { deliveries++; } },
  }, { console: { log: noop, error: (...args) => errors.push(args) },
    process: { env: {}, on: noop }, setInterval: callback => { timers.push(callback); return timers.length; }, clearInterval: noop });
  await setImmediate(); assert.equal(deliveries, 1);
  for (const callback of timers) callback();
  await setImmediate(); assert.equal(deliveries, 2);
  assert.equal(errors.length, 2); assert.ok(errors.every(args => args.length === 1 && args[0] === 'outbox-dispatch-failed'));
});
