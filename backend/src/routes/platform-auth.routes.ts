import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { issuePlatformSession, PLATFORM_COOKIE_NAME, PLATFORM_COOKIE_OPTIONS } from "../services/platform-session-authentication.js";

const router=Router();
router.post("/session",requireAuth,async(_req,res,next)=>{
  try{
    const result=await issuePlatformSession(res.locals.session);
    res.cookie(PLATFORM_COOKIE_NAME,result.token,PLATFORM_COOKIE_OPTIONS);
    res.json({success:true,expiresAt:result.expiresAt});
  }catch(error){next(error);}
});
router.post("/logout",(_req,res)=>{
  res.clearCookie(PLATFORM_COOKIE_NAME,PLATFORM_COOKIE_OPTIONS);
  res.json({success:true});
});
export default router;
