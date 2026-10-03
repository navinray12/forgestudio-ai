import type { NextFunction, Request, Response } from "express";
import { documentWriteContext } from "../services/websites/document-request.js";
import { generateSiteDraft } from "../modules/ai/site-generation.service.js";
import { applyAiChangeset, cancelAiChangeset, getAiChangeset, retryAiChangeset } from "../modules/ai/site-generation.service.js";

export async function generateSiteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const websiteId = String(req.params.id || "");
    const write = documentWriteContext(req, websiteId);
    const result = await generateSiteDraft({ websiteId, actorId: res.locals.user.id, prompt: req.body?.prompt, expectedVersion: write.expectedVersion });
    return res.status(200).json({ success: true, ...result });
  } catch (error) { next(error); }
}
export async function getAiChangesetHandler(req: Request,res: Response,next: NextFunction) { try { res.json({success:true,changeset:await getAiChangeset(String(req.params.changesetId),res.locals.user.id)}); } catch(error){next(error);} }
export async function cancelAiChangesetHandler(req: Request,res: Response,next: NextFunction) { try { res.json({success:true,changeset:await cancelAiChangeset(String(req.params.changesetId),res.locals.user.id)}); } catch(error){next(error);} }
export async function applyAiChangesetHandler(req: Request,res: Response,next: NextFunction) { try { const id=String(req.params.changesetId); const row=await getAiChangeset(id,res.locals.user.id); const website=await applyAiChangeset(id,res.locals.user.id,documentWriteContext(req,row.websiteId)); res.json({success:true,website}); } catch(error){next(error);} }
export async function retryAiChangesetHandler(req: Request,res: Response,next: NextFunction) { try { const row=await getAiChangeset(String(req.params.changesetId),res.locals.user.id); const write=documentWriteContext(req,row.websiteId); res.json({success:true,...await retryAiChangeset(row.id,res.locals.user.id,write.expectedVersion)}); } catch(error){next(error);} }
