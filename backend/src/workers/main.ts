import "dotenv/config";
import { registerJobHandler, startJobWorker, stopJobWorker } from "../services/jobs/jobRunner.js";
import { scanFileObject } from "../services/files/file.service.js";
import { leaseOutboxBatch, markOutboxDispatched, markOutboxFailed } from "../platform/execution/durable-outbox.js";
import { enqueueDurableJob } from "../services/jobs/durable-job.js";
import { pgPool, prisma } from "../config/prisma.js";
import { startPromptCleanup } from "../modules/ai/prompt-cleanup-scheduler.js";
import { runDesignExecution } from "../modules/ai/design/pipeline.js";
import { dispatchWorkspaceInvitationEmail } from "../services/workspaces/invitation-delivery.service.js";

console.log("[Worker] Forge background worker initializing...");

registerJobHandler("AI_DESIGN_EXECUTION", async (payload, job) => {
  if (typeof payload?.executionId !== "string") throw new Error("AI_EXECUTION_ID_REQUIRED");
  console.log(`[Worker] Claimed AI_DESIGN_EXECUTION job ${job.id} (executionId: ${payload.executionId})`);
  try {
    const result = await runDesignExecution(payload.executionId, job);
    console.log(`[Worker] Completed AI_DESIGN_EXECUTION job ${job.id} with status: ${result.status}`);
    return result;
  } catch (err: any) {
    console.error(`[Worker] Failed AI_DESIGN_EXECUTION job ${job.id}:`, err?.message || err);
    throw err;
  }
});

registerJobHandler("FILE_SCAN", async (payload) => {
  if (!payload?.fileId || !payload?.organizationId) throw new Error("FILE_SCAN requires fileId and organizationId");
  return scanFileObject(String(payload.fileId), String(payload.organizationId));
});

let stopping=false;
let invitationDispatch: Promise<unknown> | null = null;
function dispatchInvitationEmails() {
  if (stopping || invitationDispatch) return;
  invitationDispatch = dispatchWorkspaceInvitationEmail()
    .catch(() => console.error("workspace-invitation-email-dispatch-failed"))
    .finally(() => { invitationDispatch = null; });
}
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
console.log("[Worker] Queue connected and polling for background jobs.");
console.log("[Worker] Worker ready.");
const promptCleanup = startPromptCleanup({ onFailure: () => console.error("ai-prompt-cleanup-failed") });
const reportOutboxFailure = () => console.error("outbox-dispatch-failed");
const outboxTimer=setInterval(()=>{void dispatchOutbox().catch(reportOutboxFailure);},Number(process.env.OUTBOX_INTERVAL_MS||1000));
void dispatchOutbox().catch(reportOutboxFailure);
const invitationTimer = setInterval(dispatchInvitationEmails, 1000);
dispatchInvitationEmails();

async function shutdown(signal:string){
  if(stopping) return; stopping=true; clearInterval(outboxTimer);
  clearInterval(invitationTimer);
  await invitationDispatch;
  await stopJobWorker();
  console.log(`[Worker] Worker shutdown gracefully on signal: ${signal}`);
  await promptCleanup.stop();
  await prisma.$disconnect().catch(()=>undefined); await pgPool.end().catch(()=>undefined);
  process.exit(0);
}
process.on("SIGTERM",()=>void shutdown("SIGTERM"));
process.on("SIGINT",()=>void shutdown("SIGINT"));
