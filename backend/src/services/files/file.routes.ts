import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import {
  authorizeFileDownload,
  authorizeFileUpload,
  completeFileUpload,
} from "./file.service.js";

const router=Router();
router.use(requireAuth);

router.post("/authorize-upload",async(req,res,next)=>{
  try{
    const result=await authorizeFileUpload({
      organizationId:String(req.body?.organizationId??""),
      workspaceId:req.body?.workspaceId?String(req.body.workspaceId):undefined,
      websiteId:req.body?.websiteId?String(req.body.websiteId):undefined,
      actorId:res.locals.user.id,
      originalName:req.body?.originalName,
      contentType:req.body?.contentType,
      sizeBytes:req.body?.sizeBytes,
      sha256:req.body?.sha256,
    });
    res.status(201).json({success:true,data:result});
  }catch(error){next(error);}
});

router.post("/:fileId/complete",async(req,res,next)=>{
  try{
    const result=await completeFileUpload({
      organizationId:String(req.body?.organizationId??""),
      actorId:res.locals.user.id,
      fileId:String(req.params.fileId),
    });
    res.json({success:true,data:result});
  }catch(error){next(error);}
});

router.post("/:fileId/download",async(req,res,next)=>{
  try{
    const result=await authorizeFileDownload({
      organizationId:String(req.body?.organizationId??""),
      actorId:res.locals.user.id,
      fileId:String(req.params.fileId),
    });
    res.json({success:true,data:result});
  }catch(error){next(error);}
});

export default router;
