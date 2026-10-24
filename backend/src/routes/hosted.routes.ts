import express from "express";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const router = express.Router();
const deploymentRoot = path.resolve(os.tmpdir(), "forgestudio_deployments");
const safeId = /^[a-zA-Z0-9_-]+$/;

/**
 * Legacy artifact serving route. Never claim an absent deployment is healthy.
 * The deployment and project identifiers must be verified by the hosting
 * control-plane before this route can be exposed publicly.
 */
router.all(["/:projectId/:deploymentId", "/:projectId/:deploymentId/*subpath"], (req, res) => {
  const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
  const deploymentId = Array.isArray(req.params.deploymentId) ? req.params.deploymentId[0] : req.params.deploymentId;

  if (!projectId || !deploymentId || !safeId.test(projectId) || !safeId.test(deploymentId)) {
    return res.sendStatus(404);
  }

  // Fail closed until the control plane binds the deployment to its project.
  // Serving by a user-supplied deployment ID alone is not an authorization check.
  return res.sendStatus(404);
});

export default router;
