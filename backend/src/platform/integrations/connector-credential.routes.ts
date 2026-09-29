import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { registerConnectorCredential, revokeConnectorCredential } from "./connector-credentials.js";

const router=Router({mergeParams:true});
router.use(requireAuth);
const org=(req:any)=>String(req.params.organizationId||"");

router.post("/",async(req,res,next)=>{
  try{
    const credential=await registerConnectorCredential({
      organizationId:org(req),workspaceId:req.body?.workspaceId||null,websiteId:req.body?.websiteId||null,
      actorId:res.locals.user.id,provider:req.body?.provider,secretRef:req.body?.secretRef,
      scopes:Array.isArray(req.body?.scopes)?req.body.scopes.map(String):[],endpoint:req.body?.endpoint||null,
    });
    res.status(201).json({success:true,credential});
  }catch(error){next(error);}
});
router.post("/:credentialId/revoke",async(req,res,next)=>{
  try{res.json({success:true,credential:await revokeConnectorCredential({organizationId:org(req),actorId:res.locals.user.id,credentialId:String(req.params.credentialId)})});}
  catch(error){next(error);}
});
export default router;
