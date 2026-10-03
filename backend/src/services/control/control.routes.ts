import { Router } from "express";
import { requirePlatformAuth } from "../../middlewares/platform-auth.middleware.js";
import { AppError } from "../../utils/app-error.js";
import {
  approvePlatformChange,
  applyPlatformChange,
  controlOverview,
  createPlatformChange,
} from "./control.service.js";

const router=Router();
router.use(requirePlatformAuth);

router.get("/overview",async(_req,res,next)=>{
  try{res.json({success:true,data:await controlOverview()});}catch(error){next(error);}
});
router.get("/capabilities",async(_req,res,next)=>{
  try{const data=await controlOverview();res.json({success:true,data:data.capabilities});}catch(error){next(error);}
});
router.get("/changes",async(_req,res,next)=>{
  try{const data=await controlOverview();res.json({success:true,data:data.recentChanges});}catch(error){next(error);}
});
router.post("/changes",async(req,res,next)=>{
  try{
    const result=await createPlatformChange({
      actorId:res.locals.platformUser.id,
      capabilityId:String(req.body?.capabilityId??""),
      desiredState:req.body?.desiredState,
      reason:req.body?.reason,
    });
    res.status(201).json({success:true,data:result});
  }catch(error){next(error);}
});
router.post("/changes/:id/approve",async(req,res,next)=>{
  try{
    if(typeof req.body?.planDigest!=="string") throw new AppError("planDigest is required",400,"PLAN_DIGEST_REQUIRED");
    const result=await approvePlatformChange({actorId:res.locals.platformUser.id,changeId:String(req.params.id),planDigest:req.body.planDigest});
    res.json({success:true,data:result});
  }catch(error){next(error);}
});
router.post("/changes/:id/apply",async(req,res,next)=>{
  try{
    if(typeof req.body?.planDigest!=="string") throw new AppError("planDigest is required",400,"PLAN_DIGEST_REQUIRED");
    const result=await applyPlatformChange({actorId:res.locals.platformUser.id,changeId:String(req.params.id),planDigest:req.body.planDigest});
    res.json({success:true,data:result});
  }catch(error){next(error);}
});
export default router;
