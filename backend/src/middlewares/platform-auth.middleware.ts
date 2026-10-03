import type { Request, Response, NextFunction } from "express";
import { PLATFORM_AUTH_COOKIE_NAME } from "../config/auth.js";
import { authenticateSession } from "../services/session-authentication.js";
import { AppError } from "../utils/app-error.js";
import { requireRecentMfa } from "../modules/identity/domain/assurance.js";

export async function requirePlatformAuth(req:Request,res:Response,next:NextFunction) {
  try {
    const token=req.cookies?.[PLATFORM_AUTH_COOKIE_NAME];
    const session=await authenticateSession(token,"PLATFORM");
    if(!session) throw new AppError("Platform authentication required",401,"PLATFORM_AUTH_REQUIRED");
    if(!["SUPER_ADMIN","PLATFORM_ADMIN"].includes(session.user.role)) {
      throw new AppError("Platform control access denied",403,"PLATFORM_ACCESS_DENIED");
    }
    requireRecentMfa(session,true,new Date(),"PLATFORM");
    if(session.assurance!=="phishing-resistant") {
      throw new AppError("Phishing-resistant authentication is required",403,"STRONG_MFA_REQUIRED");
    }
    res.locals.platformUser=session.user;
    res.locals.platformSession=session;
    next();
  } catch(error){ next(error); }
}
