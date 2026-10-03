import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/app-error.js";
export function createOAuthPasswordController(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError("Credentials are managed by the configured identity provider.", 410, "LEGACY_PASSWORD_SETUP_RETIRED"));
}
export const googleOAuthCallback = createOAuthPasswordController;
export const githubOAuthCallback = createOAuthPasswordController;
