import type { Request, RequestHandler, Response } from "express";
import { rateLimit } from "express-rate-limit";

/**
 * Per-user request budget for authenticated routers. Must run after requireAuth: the key is the
 * session user, never a client-supplied identifier. Counters are per process, like the other
 * limiters in this service.
 */
export function userRateLimit(max: number, windowMs = 60_000): RequestHandler {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (_req: Request, res: Response) => `user:${res.locals.user?.id ?? "anonymous"}`,
    message: {
      success: false,
      error: { code: "RATE_LIMITED", message: "Too many requests, please try again later." },
    },
  });
}
