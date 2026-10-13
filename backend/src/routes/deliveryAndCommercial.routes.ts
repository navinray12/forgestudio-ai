import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { userRateLimit } from '../middlewares/userRateLimit.middleware.js';
import { DeliveryAndCommercialController } from '../controllers/deliveryAndCommercial.controller.js';

const router = Router();
router.use(requireAuth, userRateLimit(120));

// Point 24: Delivery Stages & Planning
router.get('/stages', DeliveryAndCommercialController.getDeliveryStages);

// Point 25: Test Program & Evidence
router.get('/source-registers', DeliveryAndCommercialController.getSourceRegisters);

// Point 28: Decision Register
router.get('/decisions', DeliveryAndCommercialController.getDecisions);

// Not exposed (see controller): /validate-scope, /commerce-webhook, /initiate-transfer,
// /complete-transfer, /past-due-status, /capture-snapshot, /verify-snapshot,
// /legacy-retirement-check, /check-launch-risks.

export default router;
