import { Router } from "express";
import { requireAuth } from "../../../middlewares/auth.middleware.js";
import { authorizeFileDownload, authorizeFileUpload, completeFileUpload } from "../file.service.js";

const router=Router({mergeParams:true});
router.use(requireAuth);
const org=(req:any)=>String(req.params.organizationId||"");

router.post("/uploads",async(req,res,next)=>{
  try{
    const file=await authorizeFileUpload({organizationId:org(req),workspaceId:req.body?.workspaceId||null,websiteId:req.body?.websiteId||null,actorId:res.locals.user.id,originalName:req.body?.fileName,mimeType:req.body?.mimeType,sizeBytes:Number(req.body?.sizeBytes)});
    res.status(201).json({success:true,file});
  }catch(error){next(error);}
});
router.post("/:fileId/complete",async(req,res,next)=>{
  try{res.json({success:true,file:await completeFileUpload({organizationId:org(req),actorId:res.locals.user.id,fileId:String(req.params.fileId)})});}
  catch(error){next(error);}
});
router.get("/:fileId/download",async(req,res,next)=>{
  try{res.json({success:true,file:await authorizeFileDownload({organizationId:org(req),actorId:res.locals.user.id,fileId:String(req.params.fileId)})});}
  catch(error){next(error);}
});
export default router;
