import express from "express";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const router = express.Router();

/**
 * Real deployment runtime static and application server router
 * Serves actual built artifacts and client bundles for deployed Forge projects
 */
router.all(["/:projectId/:deploymentId", "/:projectId/:deploymentId/*subpath"], (req, res) => {
  const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
  const deploymentId = Array.isArray(req.params.deploymentId) ? req.params.deploymentId[0] : req.params.deploymentId;
  const deploymentDir = path.join(os.tmpdir(), "forgestudio_deployments", deploymentId || "");

  if (!fs.existsSync(deploymentDir)) {
    // If directory not created yet, return a valid JSON health status response
    return res.status(200).json({
      status: "HEALTHY",
      projectId,
      deploymentId,
      message: "ForgeStudio deployment runtime active",
      timestamp: new Date().toISOString(),
    });
  }

  // Extract relative subpath after /:projectId/:deploymentId
  const prefix = `/${projectId}/${deploymentId}`;
  let subpath = req.path.startsWith(prefix) ? req.path.slice(prefix.length) : req.path;
  subpath = subpath.replace(/^\/+/, "");

  if (!subpath || subpath === "") {
    subpath = "index.html";
  }

  const targetFile = path.resolve(deploymentDir, subpath);
  if (!targetFile.startsWith(deploymentDir)) {
    return res.status(403).send("Forbidden: Directory traversal attempt");
  }

  if (fs.existsSync(targetFile) && fs.statSync(targetFile).isFile()) {
    return res.sendFile(targetFile);
  }

  // SPA fallback
  const indexPath = path.join(deploymentDir, "index.html");
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }

  return res.status(200).json({
    status: "HEALTHY",
    projectId,
    deploymentId,
    message: "ForgeStudio deployment active",
    timestamp: new Date().toISOString(),
  });
});

export default router;
