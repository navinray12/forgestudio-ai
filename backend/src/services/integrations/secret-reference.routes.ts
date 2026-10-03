import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import {
  listIntegrationSecretReferences,
  revokeIntegrationSecretReference,
  upsertIntegrationSecretReference,
} from "./secret-reference.service.js";

const router=Router();
router.use(requireAuth);

router.get("/:organizationId/integration-secrets",async(req,res,next)=>{
  try{
    const data=await listIntegrationSecretReferences(String(req.params.organizationId),res.locals.user.id);
    res.json({success:true,data});
  }catch(error){next(error);}
});
router.put("/:organizationId/integration-secrets/:connectionKey",async(req,res,next)=>{
  try{
    const data=await upsertIntegrationSecretReference({
      organizationId:String(req.params.organizationId),
      actorId:res.locals.user.id,
      workspaceId:req.body?.workspaceId?String(req.body.workspaceId):undefined,
      provider:req.body?.provider,
      connectionKey:String(req.params.connectionKey),
      secretRef:req.body?.secretRef,
      scopes:req.body?.scopes,
    });
    res.json({success:true,data});
  }catch(error){next(error);}
});
router.delete("/:organizationId/integration-secrets/:id",async(req,res,next)=>{
  try{
    const data=await revokeIntegrationSecretReference(String(req.params.organizationId),res.locals.user.id,String(req.params.id));
    res.json({success:true,data});
  }catch(error){next(error);}
});
export default router;
