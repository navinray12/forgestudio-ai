import { createHash, randomUUID } from "crypto";
import { writeFileSync, chmodSync } from "fs";
import { prisma, pgPool } from "../../config/prisma.js";
import { createOrganizationCheckout } from "../../services/billing/billing.service.js";

const database=new URL(process.env.DATABASE_URL||"invalid:");
if(process.env.FORGE_DISPOSABLE_TEST_DB!=="1"||!["127.0.0.1","localhost"].includes(database.hostname)||database.pathname!=="/forge_saas_browser"){
  throw new Error("SaaS browser fixture requires disposable forge_saas_browser");
}
const output=process.env.FORGE_SAAS_BROWSER_FIXTURE;
if(!output) throw new Error("FORGE_SAAS_BROWSER_FIXTURE is required");

const owner=await prisma.user.create({data:{email:`browser-owner-${randomUUID()}@example.test`,fullName:"SaaS Browser Owner",status:"ACTIVE",role:"SUPER_ADMIN",emailVerified:true}});
const org=await prisma.organization.create({data:{name:"Browser Organization",slug:"browser-org-"+randomUUID(),ownerId:owner.id}});
await prisma.organizationMember.create({data:{organizationId:org.id,userId:owner.id,role:"OWNER"}});
const workspace=await prisma.workspace.create({data:{name:"Browser Workspace",slug:"browser-workspace-"+randomUUID(),ownerId:owner.id,organizationId:org.id}});
await prisma.workspaceMember.create({data:{workspaceId:workspace.id,userId:owner.id,role:"OWNER"}});
const plan=await prisma.subscriptionPlan.create({data:{name:"Browser Free",slug:"browser-free-"+randomUUID(),price:0,currency:"USD",billingInterval:"monthly",websiteLimit:3,storageLimitMb:500,aiCreditLimit:10,features:{seatLimit:3}}});
await createOrganizationCheckout({organizationId:org.id,actorId:owner.id,planSlug:plan.slug,idempotencyKey:"browser-free-checkout"});

const now=new Date(); const expiresAt=new Date(now.getTime()+30*60_000);
async function session(audience:"TENANT"|"PLATFORM"){
  const token=randomUUID()+randomUUID().replaceAll("-","");
  await prisma.session.create({data:{
    userId:owner.id,tokenHash:createHash("sha256").update(token).digest("hex"),expiresAt,
    authEpoch:owner.authEpoch,audience,authMethod:"oidc",authTime:now,assurance:"phishing-resistant",mfaVerifiedAt:now,
  }});
  return token;
}
const fixture={owner:{id:owner.id,tenantToken:await session("TENANT"),platformToken:await session("PLATFORM")},organization:{id:org.id},workspace:{id:workspace.id,name:workspace.name},plan:{slug:plan.slug,name:plan.name}};
writeFileSync(output,JSON.stringify(fixture));chmodSync(output,0o600);
await prisma.$disconnect();await pgPool.end();
