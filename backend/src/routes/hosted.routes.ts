import { Router } from "express";

/**
 * Legacy deployment artifact endpoint.
 *
 * Historically this route served files based solely on caller-provided IDs,
 * without verifying that the deployment belonged to the requested project.
 * Keep it unavailable until it can resolve an authorized deployment through
 * the existing hosting control plane and serve only its immutable artifacts.
 */
const router = Router();

router.all(["/:projectId/:deploymentId", "/:projectId/:deploymentId/*subpath"], (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  return res.sendStatus(404);
});

export default router;
