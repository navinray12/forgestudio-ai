/**
 * Project controller: Blueprint Point 40: Contract-First APIs, Auth & Unified Authorization.
 * Moved verbatim from project.controller.ts, which re-exports every handler for compatibility.
 */
import { Request, Response, NextFunction } from "express";
import { getForgeProjectById } from "../../services/project/forgeProject.service.js";
import { contractFirstApiGenerator } from "../../services/api/contractFirstApiGenerator.service.js";
import { applicationAuth } from "../../services/auth/applicationAuth.service.js";
import { unifiedExecutionAuthorization } from "../../services/auth/unifiedExecutionAuthorization.service.js";
import { getAuthUser } from "./shared.js";

// ---------------------------------------------------------------------------
// Blueprint Point 40: Contract-First APIs, Auth & Unified Authorization
// ---------------------------------------------------------------------------

export async function generateContractFirstApiHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { applicationSpec } = req.body;
    const artifacts = contractFirstApiGenerator.generateContractFirstArtifacts(applicationSpec);
    res.status(200).json({ success: true, artifacts });
  } catch (err) {
    next(err);
  }
}

export async function bootstrapApplicationAuthHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { email, password, role, apiBaseUrl } = req.body;
    const registered = applicationAuth.registerUser(
      `app_${projectId}`,
      user.tenantId || `tenant_${projectId}`,
      email || "testuser@example.com",
      password || "SuperSecretPassword123!",
      role || "USER"
    );

    const loginResult = applicationAuth.loginUser(
      `app_${projectId}`,
      email || "testuser@example.com",
      password || "SuperSecretPassword123!"
    );

    const sessionCheck = applicationAuth.verifySession(loginResult.token);
    const publicConfig = applicationAuth.buildSanitizedPublicConfig(
      `app_${projectId}`,
      apiBaseUrl || "https://api.app.example.com",
      ["auth", "orders"]
    );

    res.status(200).json({
      success: true,
      user: registered.user,
      token: loginResult.token,
      sessionValid: sessionCheck.valid,
      publicConfig,
    });
  } catch (err) {
    next(err);
  }
}

export async function evaluateUnifiedAuthorizationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { transport, subject, targetTenantId, requestedFields, resourceOwnerTenantId } = req.body;
    const decision = unifiedExecutionAuthorization.evaluateAuthorization({
      transport: transport || "HTTP_ENDPOINT",
      subject: subject || {
        userId: user.id,
        tenantId: user.tenantId || `tenant_${projectId}`,
        applicationId: `app_${projectId}`,
        roles: ["USER"],
        scopes: ["read:data"],
      },
      targetTenantId: targetTenantId || user.tenantId || `tenant_${projectId}`,
      requestedFields: Array.isArray(requestedFields) ? requestedFields : ["id", "name", "passwordHash"],
      resourceOwnerTenantId,
    });

    res.status(decision.allowed ? 200 : 403).json({ success: decision.allowed, decision });
  } catch (err) {
    next(err);
  }
}
