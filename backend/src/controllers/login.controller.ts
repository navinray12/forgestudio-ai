import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/app-error.js";
function retired(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError("Use the browser-bound identity router.", 410, "LEGACY_AUTH_RETIRED"));
}
export const loginController = retired;
export const sendLoginOtpController = retired;
export const verifyLoginOtpController = retired;
export const resendLoginOtpController = retired;
