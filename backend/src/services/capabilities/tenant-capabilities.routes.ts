import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { withTenantTransaction, requireOrganizationMemberSql } from "../../platform/tenancy/context.js";

const router=Router();
router.use(requireAuth);
router.get("/:organizationId/capabilities",async(req,res,next)=>{
  try{
    const organizationId=String(req.params.organizationId);
    const actorId=res.locals.user.id;
    const data=await withTenantTransaction({organizationId,actorId},async client=>{
      const membership=await requireOrganizationMemberSql(client,organizationId,actorId);
      const subscription=(await client.query(`SELECT s.status,s."seatLimit",p.slug,p."websiteLimit",p."storageLimitMb",p."aiCreditLimit",p.features
        FROM organization_subscriptions s JOIN subscription_plans p ON p.id=s."planId"
        WHERE s."organizationId"=$1::uuid`,[organizationId])).rows[0]??null;
      const enabled=subscription?.status==="ACTIVE"||subscription?.status==="TRIALING"||subscription?.status==="GRACE";
      return {
        role:membership.role,
        subscriptionStatus:subscription?.status??"UNPROVISIONED",
        plan:subscription?.slug??null,
        actions:{
          workspaceManage:["OWNER","ADMIN"].includes(membership.role),
          billingManage:["OWNER","ADMIN"].includes(membership.role),
          websitesCreate:enabled,
          publish:enabled,
          fileUpload:enabled,
        },
        limits:subscription?{
          websites:Number(subscription.websiteLimit),
          storageMb:Number(subscription.storageLimitMb),
          aiCredits:Number(subscription.aiCreditLimit),
          seats:Number(subscription.seatLimit),
        }:null,
        features:subscription?.features??{},
      };
    });
    res.json({success:true,data});
  }catch(error){next(error);}
});
export default router;
