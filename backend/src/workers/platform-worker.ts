import crypto from "crypto";
import { dispatchOutboxBatch, leaseJobs, completeJob, failJob, type PlatformJob } from "../platform/reliability/postgres-queue.js";
import { handleFileScanJob } from "../modules/files/file.service.js";

type Handler = (job: PlatformJob) => Promise<void>;
const handlers = new Map<string, Handler>();
handlers.set("file.scan", handleFileScanJob);

export function registerPlatformJobHandler(type: string, handler: Handler) {
  if (!/^[A-Za-z0-9._:-]{1,120}$/.test(type)) throw new Error("Invalid job type");
  if (handlers.has(type)) throw new Error(`Duplicate platform job handler: ${type}`);
  handlers.set(type, handler);
}

let stopping = false;
const workerId = `${process.env.HOSTNAME || "worker"}:${process.pid}:${crypto.randomUUID()}`;

async function cycle() {
  await dispatchOutboxBatch(100);
  const jobs = await leaseJobs(workerId, Number(process.env.PLATFORM_WORKER_CONCURRENCY || "10"));
  await Promise.all(jobs.map(async (job) => {
    const handler = handlers.get(job.jobType);
    if (!handler) {
      await failJob(job, workerId, new Error(`No handler registered for job type ${job.jobType}`));
      return;
    }
    try {
      await handler(job);
      await completeJob(job.id, workerId);
    } catch (error) {
      await failJob(job, workerId, error);
    }
  }));
}

async function main() {
  const delay = Math.max(250, Math.min(10000, Number(process.env.PLATFORM_WORKER_POLL_MS || "1000")));
  while (!stopping) {
    try { await cycle(); }
    catch (error) { console.error("platform-worker cycle failed", error); }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });

if (process.env.NODE_ENV !== "test") {
  void main().catch((error) => {
    console.error("platform-worker fatal error", error);
    process.exitCode = 1;
  });
}
