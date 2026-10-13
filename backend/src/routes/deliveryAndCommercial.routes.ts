import { Router } from 'express';
import { DeliveryAndCommercialController } from '../controllers/deliveryAndCommercial.controller.js';

const router = Router();

// Point 24: Delivery Stages & Planning
router.get('/stages', DeliveryAndCommercialController.getDeliveryStages);
router.post('/validate-scope', DeliveryAndCommercialController.validateReleaseScope);

// Point 25: Test Program & Evidence
router.get('/source-registers', DeliveryAndCommercialController.getSourceRegisters);

// Point 26: Commercial Operations & Past-Due
router.post('/commerce-webhook', DeliveryAndCommercialController.processCommerceWebhook);
router.post('/initiate-transfer', DeliveryAndCommercialController.initiateOwnershipTransfer);
router.post('/complete-transfer', DeliveryAndCommercialController.completeOwnershipTransfer);
router.get('/past-due-status', DeliveryAndCommercialController.getPastDueLifecycle);

// Point 27: Migration & Existing-Customer Protection
router.post('/capture-snapshot', DeliveryAndCommercialController.captureSourceSnapshot);
router.post('/verify-snapshot', DeliveryAndCommercialController.verifySnapshotRestore);
router.post('/legacy-retirement-check', DeliveryAndCommercialController.evaluateLegacyRetirement);

// Point 28: Decision Register & Launch Risks
router.get('/decisions', DeliveryAndCommercialController.getDecisions);
router.post('/check-launch-risks', DeliveryAndCommercialController.evaluateReleaseBlockingRisks);

export default router;
