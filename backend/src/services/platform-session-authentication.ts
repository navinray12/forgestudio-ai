import crypto from "node:crypto";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";

export const PLATFORM_COOKIE_NAME = process.env.NODE_ENV === "production" ? "__Host-forge_platform" : "forge_platform";
export const PLATFORM_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api/v1/platform",
  maxAge: 8 * 60 * 60 * 1000,
};

function digest(value:string){ return crypto.createHash("sha256").update(value).digest("hex"); }

export async function issuePlatformSession(tenantSession:any) {
  const now=new Date();
  if(!tenantSession?.user || !["PLATFORM_ADMIN","SUPER_ADMIN"].includes(tenantSession.user.role)) {
    throw new AppError("Platform administration permission is required",403,"FORBIDDEN");
  }
  if(tenantSession.authMethod!=="oidc" || tenantSession.assurance!=="phishing-resistant" || !tenantSession.authTime ||
     now.getTime()-new Date(tenantSession.authTime).getTime()>15*60_000) {
    throw new AppError("Recent phishing-resistant authentication is required",403,"STEP_UP_REQUIRED");
  }
  const token=crypto.randomBytes(32).toString("base64url");
  const expiresAt=new Date(now.getTime()+8*60*60_000);
  await prisma.$transaction(async tx=>{
    await tx.session.create({data:{
      userId:tenantSession.user.id,tokenHash:digest(token),expiresAt,authEpoch:tenantSession.user.authEpoch,
      authMethod:"oidc",audience:"PLATFORM",authTime:tenantSession.authTime,assurance:"phishing-resistant",
      mfaVerifiedAt:tenantSession.mfaVerifiedAt || tenantSession.authTime,
    }});
    await tx.auditLog.create({data:{userId:tenantSession.user.id,action:"PLATFORM_SESSION_ISSUED",targetResource:`user:${tenantSession.user.id}`}});
  });
  return {token,expiresAt};
}

export async function authenticatePlatformSession(token:unknown){
  if(typeof token!=="string"||token.length<20||token.length>4096) return null;
  const session=await prisma.session.findUnique({where:{tokenHash:digest(token)},include:{user:true}});
  const now=new Date();
  if(!session||session.revokedAt||session.expiresAt<=now||session.audience!=="PLATFORM"||
     session.authMethod!=="oidc"||session.assurance!=="phishing-resistant"||
     session.user.status!=="ACTIVE"||session.authEpoch!==session.user.authEpoch||
     !["PLATFORM_ADMIN","SUPER_ADMIN"].includes(session.user.role)) return null;
  return session;
}

export function requireRecentPlatformReauth(session:any){
  const now=Date.now();
  const authTime=session?.authTime ? new Date(session.authTime).getTime() : 0;
  if(!authTime||now-authTime>15*60_000) throw new AppError("Re-authentication is required before applying this change",403,"STEP_UP_REQUIRED");
}
