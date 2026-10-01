import "dotenv/config";
import { registerJobHandler, startJobWorker, stopJobWorker } from "../services/jobs/jobRunner.js";
import { scanFileObject } from "../services/files/file.service.js";
import { leaseOutboxBatch, markOutboxDispatched, markOutboxFailed } from "../platform/execution/durable-outbox.js";
import { enqueueDurableJob } from "../services/jobs/durable-job.js";
import { pgPool, prisma } from "../config/prisma.js";
import { startPromptCleanup } from "../modules/ai/prompt-cleanup-scheduler.js";
import { runDesignExecution } from "../modules/ai/design/pipeline.js";

registerJobHandler("AI_DESIGN_EXECUTION", async (payload, job) => {
  if (typeof payload?.executionId !== "string") throw new Error("AI_EXECUTION_ID_REQUIRED");
  return runDesignExecution(payload.executionId, job);
});

registerJobHandler("FILE_SCAN", async (payload) => {
  if (!payload?.fileId || !payload?.organizationId) throw new Error("FILE_SCAN requires fileId and organizationId");
  return scanFileObject(String(payload.fileId), String(payload.organizationId));
});

let stopping=false;
async function dispatchOutbox() {
  if(stopping) return;
  const events=await leaseOutboxBatch(25,30);
  for(const event of events){
    try{
      await enqueueDurableJob({
        organizationId:event.organizationId,
        type:"DOMAIN_EVENT",
        payload:event,
        idempotencyKey:"outbox:"+event.id,
        maxAttempts:5,
      });
      await markOutboxDispatched(event.id);
    }catch(error){await markOutboxFailed(event.id,error);}
  }
}

registerJobHandler("DOMAIN_EVENT", async (payload) => {
  // Durable fan-out handoff. Product-specific consumers may register additional
  // handlers; retaining the envelope here makes replay observable rather than lost.
  return {accepted:true,eventId:payload?.id,eventType:payload?.eventType};
});

startJobWorker(Number(process.env.JOB_WORKER_INTERVAL_MS || 1000));
const promptCleanup = startPromptCleanup({ onFailure: () => console.error("ai-prompt-cleanup-failed") });
const outboxTimer=setInterval(()=>{void dispatchOutbox().catch(error=>console.error("outbox-dispatch-failed",error));},Number(process.env.OUTBOX_INTERVAL_MS||1000));
void dispatchOutbox();

async function shutdown(signal:string){
  if(stopping) return; stopping=true; clearInterval(outboxTimer);
  await stopJobWorker();
  console.log("worker-shutdown",signal);
  await promptCleanup.stop();
  await prisma.$disconnect().catch(()=>undefined); await pgPool.end().catch(()=>undefined);
  process.exit(0);
}
process.on("SIGTERM",()=>void shutdown("SIGTERM"));
process.on("SIGINT",()=>void shutdown("SIGINT"));
