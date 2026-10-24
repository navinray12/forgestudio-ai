import type { Request, Response, NextFunction } from "express";
import { getUserUsageSummary } from "../services/usage.service.js";
import { getDashboardUsage, type UsageRange } from "../services/dashboard-usage.service.js";
import { AppError } from "../utils/app-error.js";

export async function getDashboardUsageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!res.locals.user?.id) throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    const range = req.query.range ?? "cycle";
    if (typeof range !== "string" || !["cycle", "30d", "90d"].includes(range)) throw new AppError("Invalid usage range", 400, "INVALID_USAGE_RANGE");
    res.setHeader("Cache-Control", "private, no-store");
    return res.json(await getDashboardUsage(res.locals.user.id, range as UsageRange));
  } catch (error) { next(error); }
}

/**
 * GET /api/v1/users/me/usage (Features F-450, F-452)
 * Centralized telemetry and quota usage breakdown
 */
export async function getMyUsageHandler(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = res.locals.user;
    if (!user?.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const usage = await getUserUsageSummary(user.id);

    return res.status(200).json(usage);
  } catch (error) {
    next(error);
  }
}
