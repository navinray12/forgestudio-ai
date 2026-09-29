import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/app-error.js";
function retired(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError("Use the browser-bound identity router.", 410, "LEGACY_AUTH_RETIRED"));
}
export const signupController = retired;
export const verifySignupOtpController = retired;
export const resendSignupOtpController = retired;
