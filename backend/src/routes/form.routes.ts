import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requirePrivilegedMutation } from "../middlewares/privileged-mutation.js";
import { formsDashboard, saveNotifications, formEntries } from "../services/form/form-dashboard.service.js";
import {
  submitFormHandler,
  getWebsiteSubmissionsHandler,
  deleteSubmissionHandler,
  exportSubmissionsHandler,
  downloadSubmissionPdfHandler,
} from "../controllers/form.controller.js";
import {
  listLeadsHandler,
  getLeadHandler,
  transitionLeadHandler,
  addLeadNoteHandler,
  assignLeadHandler,
} from "../controllers/lead.controller.js";

const router = Router();

// Public submission endpoint
router.post("/submit", submitFormHandler);

router.get("/:websiteId/dashboard", requireAuth, async (req,res,next)=>{
  try { res.setHeader("Cache-Control","no-store");res.json({success:true,...await formsDashboard(String(req.params.websiteId),res.locals.user.id)}); }catch(error){next(error);}
});
router.put("/:websiteId/notifications", requireAuth, requirePrivilegedMutation, async(req,res,next)=>{
  try {
    if(req.get("X-Forge-Intent")!=="form-notifications")return res.status(403).json({success:false,message:"Form notification command header is required."});
    if(!req.body)return res.status(400).json({success:false,message:"Settings are required."});
    return res.json({success:true,settings:await saveNotifications(String(req.params.websiteId),res.locals.user.id,req.body)});
  }catch(error){next(error);}
});
router.get("/:websiteId/forms/:formId/submissions", requireAuth, async(req,res,next)=>{
  try {
    const page=Number(req.query.page||1);
    if(!Number.isSafeInteger(page)||page<1||page>100000||String(req.params.formId).length>255)return res.status(400).json({success:false,message:"Invalid form or page."});
    res.setHeader("Cache-Control","no-store");
    return res.json({success:true,...await formEntries(String(req.params.websiteId),res.locals.user.id,String(req.params.formId),page)});
  }catch(error){next(error);}
});

// Protected endpoints for website owners to inspect leads
router.get("/:websiteId/submissions", requireAuth, getWebsiteSubmissionsHandler);
router.get("/:websiteId/submissions/:submissionId/pdf", requireAuth, downloadSubmissionPdfHandler);
router.delete("/:websiteId/submissions/:submissionId", requireAuth, deleteSubmissionHandler);
router.get("/:websiteId/export", requireAuth, exportSubmissionsHandler);

// Durable leads (blueprint §12): membership is derived from the session; other tenants get 404.
router.get("/:websiteId/leads", requireAuth, listLeadsHandler);
router.get("/leads/:leadId", requireAuth, getLeadHandler);
router.post("/leads/:leadId/transition", requireAuth, transitionLeadHandler);
router.post("/leads/:leadId/notes", requireAuth, addLeadNoteHandler);
router.post("/leads/:leadId/assign", requireAuth, assignLeadHandler);

export default router;
