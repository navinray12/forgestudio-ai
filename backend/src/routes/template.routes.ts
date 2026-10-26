import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { z } from "zod";
import { requirePrivilegedMutation } from "../middlewares/privileged-mutation.js";
import { galleryFavorite, listGallery, useGalleryTemplate } from "../services/templates/gallery.service.js";
import {
  createTemplateHandler,
  getUserTemplatesHandler,
  getPublicTemplateHandler,
  toggleShareHandler,
  updateTemplateHandler,
  deleteTemplateHandler,
} from "../controllers/template.controller.js";

const router = Router();

// Public route for viewing shared templates without authentication
router.get("/public/:shareToken", getPublicTemplateHandler);

// Protect all remaining template endpoints with authentication
router.use(requireAuth);

router.get("/catalog", async (_req, res, next) => {
  try { res.setHeader("Cache-Control", "no-store"); res.json({ success: true, templates: await listGallery(res.locals.user.id) }); }
  catch (error) { next(error); }
});
router.put("/catalog/:id/favorite", requirePrivilegedMutation, async (req, res, next) => {
  try {
    const input=z.object({isFavorite:z.boolean()}).strict().safeParse(req.body);
    if(req.get("X-Forge-Intent")!=="template-gallery")return res.status(403).json({success:false,message:"Template command header is required."});
    if(!input.success)return res.status(400).json({success:false,message:"Favorite must be true or false."});
    return res.json({success:true,...await galleryFavorite(res.locals.user.id,String(req.params.id),input.data.isFavorite)});
  }catch(error){next(error);}
});
router.post("/catalog/:id/use", requirePrivilegedMutation, async (req, res, next) => {
  try {
    const input=z.object({name:z.string().trim().min(1).max(100)}).strict().safeParse(req.body);
    if(req.get("X-Forge-Intent")!=="template-gallery")return res.status(403).json({success:false,message:"Template command header is required."});
    if(!input.success)return res.status(400).json({success:false,message:"Enter a site name (up to 100 characters)."});
    return res.status(201).json({success:true,website:await useGalleryTemplate(res.locals.user.id,String(req.params.id),input.data.name)});
  }catch(error){next(error);}
});

router.post("/", createTemplateHandler);
router.get("/", getUserTemplatesHandler);
router.post("/:id/share", toggleShareHandler);
router.patch("/:id", updateTemplateHandler);
router.delete("/:id", deleteTemplateHandler);

export default router;
