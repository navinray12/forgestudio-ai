/**
 * Helpers shared by the project controller modules. Moved verbatim from project.controller.ts.
 */
import { Request, Response } from "express";

export function getAuthUser(res: Response, req: Request) {
  const user = res.locals.user || (req as any).user;
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}
