import { Router } from "express";
import { requirePlatformAuth } from "../../middlewares/auth.middleware.js";
import { capabilityRegistry, validateCapabilityRegistry } from "./capability-registry.js";
import { pgPool } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { requireRecentPlatformReauth } from "../../services/platform-session-authentication.js";
import { applyRuntimeChange, approveRuntimeChange, createRuntimeChange, listChanges } from "./change.service.js";
import { tenantIsolationPreflight } from "../../operations/tenant-isolation-preflight.js";
import { listDeadLetters, listReconciliationCases, replayDeadLetter, resolveReconciliationCase } from "../reliability/postgres-queue.js";

const router = Router();
router.use(requirePlatformAuth);

function requirePlatformRole(res:any){
  if(!["PLATFORM_ADMIN","SUPER_ADMIN"].includes(res.locals.user?.role)) throw new AppError("Platform administration permission is required",403,"FORBIDDEN");
}

router.get("/capabilities", async (_req, res, next) => {
  try {
    requirePlatformRole(res); validateCapabilityRegistry();
    const persisted = await pgPool.query(
      `SELECT id,provider,"desiredState","observedState",version,"updatedAt" FROM platform_capabilities ORDER BY id`,
    ).catch(() => ({ rows: [] as any[] }));
    const live = new Map(persisted.rows.map((row: any) => [row.id, row]));
    res.json({
      success: true,
      capabilities: capabilityRegistry.map((definition) => ({
        ...definition,
        observedState: live.get(definition.id)?.observedState || "UNVERIFIED",
        persistedProvider: live.get(definition.id)?.provider || null,
        version: live.get(definition.id)?.version || null,
        lastObservedAt: live.get(definition.id)?.updatedAt || null,
      })),
    });
  } catch (error) { next(error); }
});

router.get("/overview", async (_req, res, next) => {
  try {
    requirePlatformRole(res); validateCapabilityRegistry();
    const [changes, jobs, conflicts] = await Promise.all([
      pgPool.query(`SELECT count(*)::int AS count FROM platform_change_requests WHERE status NOT IN ('COMPLETED','ROLLED_BACK','REJECTED')`).catch(() => ({ rows: [{count:0}] })),
      pgPool.query(`SELECT status,count(*)::int AS count FROM platform_jobs GROUP BY status`).catch(() => ({ rows: [] })),
      pgPool.query(`SELECT "resourceType",count(*)::int AS count FROM tenant_backfill_conflicts GROUP BY "resourceType"`).catch(() => ({ rows: [] })),
    ]);
    res.json({
      success: true,
      tier: process.env.FORGE_PLATFORM_TIER || "T0",
      referenceTarget: { registeredUsers: 70000, dynamicRps: 10000, qualificationRps: 15000, qualified: false },
      openChanges: changes.rows[0]?.count || 0,
      jobStates: jobs.rows,
      unresolvedTenantBackfill: conflicts.rows,
      note: "Capacity targets are architecture contracts until deployment qualification evidence exists.",
    });
  } catch (error) { next(error); }
});

router.get("/tenant-isolation/preflight",async(_req,res,next)=>{
  try{requirePlatformRole(res);res.json({success:true,preflight:await tenantIsolationPreflight()});}catch(error){next(error);}
});

router.get("/dead-letters",async(_req,res,next)=>{
  try{requirePlatformRole(res);res.json({success:true,deadLetters:await listDeadLetters()});}catch(error){next(error);}
});
router.post("/dead-letters/:id/replay",async(req,res,next)=>{
  try{requirePlatformRole(res);requireRecentPlatformReauth(res.locals.session);res.json({success:true,replay:await replayDeadLetter(String(req.params.id),res.locals.user.id)});}catch(error){next(error);}
});
router.get("/reconciliation",async(_req,res,next)=>{
  try{requirePlatformRole(res);res.json({success:true,cases:await listReconciliationCases()});}catch(error){next(error);}
});
router.post("/reconciliation/:id/resolve",async(req,res,next)=>{
  try{
    requirePlatformRole(res);requireRecentPlatformReauth(res.locals.session);
    const outcome=req.body?.outcome==="ABANDONED"?"ABANDONED":"RESOLVED";
    res.json({success:true,case:await resolveReconciliationCase(String(req.params.id),res.locals.user.id,String(req.body?.note||""),outcome)});
  }catch(error){next(error);}
});

router.get("/changes",async(_req,res,next)=>{
  try{requirePlatformRole(res);res.json({success:true,changes:await listChanges()});}catch(error){next(error);}
});
router.post("/changes",async(req,res,next)=>{
  try{
    requirePlatformRole(res); requireRecentPlatformReauth(res.locals.session);
    const change=await createRuntimeChange({actorId:res.locals.user.id,capabilityId:String(req.body?.capabilityId||""),desiredState:String(req.body?.desiredState||""),reason:String(req.body?.reason||"")});
    res.status(201).json({success:true,change});
  }catch(error){next(error);}
});
router.post("/changes/:id/approve",async(req,res,next)=>{
  try{
    requirePlatformRole(res); requireRecentPlatformReauth(res.locals.session);
    const change=await approveRuntimeChange({actorId:res.locals.user.id,changeId:String(req.params.id),planDigest:String(req.body?.planDigest||"")});
    res.json({success:true,change});
  }catch(error){next(error);}
});
router.post("/changes/:id/apply",async(req,res,next)=>{
  try{
    requirePlatformRole(res); requireRecentPlatformReauth(res.locals.session);
    const change=await applyRuntimeChange({actorId:res.locals.user.id,changeId:String(req.params.id),expectedDigest:String(req.body?.planDigest||"")});
    res.json({success:true,change});
  }catch(error){next(error);}
});

export default router;
