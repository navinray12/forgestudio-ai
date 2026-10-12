import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/app-error.js";
import {
  SYSTEM_PERMISSIONS,
  evaluateEffectivePermissions,
  createCustomRole,
  getRoleDefinition,
} from "../services/ownerExperience/dynamicPermissionEngine.service.js";
import {
  authorizeAction,
  type AuthorizationContext,
} from "../services/ownerExperience/authoritativeAuthorization.service.js";
import {
  resolveWorkspaceView,
  type ExperienceLevel,
} from "../services/ownerExperience/progressiveDisclosure.service.js";
import {
  getOrCreateEditorSession,
  transitionEditorState,
  processSaveAttempt,
  resolveEditorConflict,
  type TruthfulEditorState,
} from "../services/ownerExperience/truthfulEditorState.service.js";
import {
  storeLocalRecoveryDraft,
  evaluateDraftRecovery,
  quarantineUserDrafts,
} from "../services/ownerExperience/privacySafeDraftRecovery.service.js";
import { executeAcceptanceJourney } from "../services/ownerExperience/ownerAcceptanceJourneys.service.js";

function getAuthContext(req: Request, res: Response): AuthorizationContext {
  const user = res.locals.user || { id: "test-user-id", role: "OWNER", status: "ACTIVE" };
  const workspaceId =
    (req.query.workspaceId as string) ||
    req.body?.workspaceId ||
    req.params?.workspaceId ||
    "default-workspace-id";
  const websiteId =
    (req.query.websiteId as string) ||
    req.body?.websiteId ||
    req.params?.websiteId ||
    undefined;

  return {
    userId: user.id,
    userRole: user.role || "OWNER",
    userStatus: user.status || "ACTIVE",
    workspaceId,
    websiteId,
    mfaVerified: Boolean(req.headers["x-mfa-verified"] === "true"),
    independentApproverId: (req.headers["x-independent-approver-id"] as string) || undefined,
  };
}

export async function getWorkspaceView(req: Request, res: Response, next: NextFunction) {
  try {
    const context = getAuthContext(req, res);
    const requestedLevel = (req.query.level as ExperienceLevel) || "SIMPLE_OWNER";
    const websiteId = (req.query.websiteId as string) || undefined;

    const manifest = resolveWorkspaceView({
      userRole: context.userRole,
      requestedLevel,
      websiteId,
    });

    res.json({ success: true, manifest });
  } catch (error) {
    next(error);
  }
}

export async function getEffectivePermissions(req: Request, res: Response, next: NextFunction) {
  try {
    const context = getAuthContext(req, res);
    const result = evaluateEffectivePermissions({
      role: context.userRole,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function getPermissionCatalog(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, permissions: SYSTEM_PERMISSIONS });
  } catch (error) {
    next(error);
  }
}

export async function createCustomRoleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const context = getAuthContext(req, res);
    const { name, description, permissions } = req.body;

    const creatorEffective = evaluateEffectivePermissions({ role: context.userRole });
    const role = createCustomRole({
      creatorId: context.userId,
      creatorPermissions: creatorEffective.effectiveList,
      name,
      description: description || "",
      permissions,
    });

    res.status(201).json({ success: true, role });
  } catch (error) {
    next(error);
  }
}

export async function getEditorState(req: Request, res: Response, next: NextFunction) {
  try {
    const { websiteId } = req.params;
    const session = getOrCreateEditorSession(websiteId);
    res.json({ success: true, session });
  } catch (error) {
    next(error);
  }
}

export async function transitionEditorStateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { websiteId } = req.params;
    const { targetState, reason, failureReason, scheduledUtc } = req.body;
    const context = getAuthContext(req, res);

    const session = transitionEditorState({
      websiteId,
      targetState: targetState as TruthfulEditorState,
      actorId: context.userId,
      reason,
      failureReason,
      scheduledUtc,
    });

    res.json({ success: true, session });
  } catch (error) {
    next(error);
  }
}

export async function saveEditorAttemptHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { websiteId } = req.params;
    const { expectedVersion, serverVersion, clientContent, serverContent } = req.body;
    const context = getAuthContext(req, res);

    const result = processSaveAttempt({
      websiteId,
      actorId: context.userId,
      expectedVersion: Number(expectedVersion) || 1,
      serverVersion: Number(serverVersion) || 1,
      clientContent,
      serverContent,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function resolveConflictHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { websiteId } = req.params;
    const { conflictId, strategy, resolvedContent } = req.body;
    const context = getAuthContext(req, res);

    const session = resolveEditorConflict({
      websiteId,
      actorId: context.userId,
      conflictId,
      strategy,
      resolvedContent,
    });

    res.json({ success: true, session });
  } catch (error) {
    next(error);
  }
}

export async function storeLocalDraftHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const context = getAuthContext(req, res);
    const { draftId, clientVersion, content } = req.body;
    const websiteId = req.body.websiteId || context.websiteId || "default-site";

    const draft = storeLocalRecoveryDraft({
      userId: context.userId,
      workspaceId: context.workspaceId,
      websiteId,
      draftId: draftId || "main-editor",
      clientVersion: Number(clientVersion) || 1,
      content,
    });

    res.status(201).json({ success: true, draft });
  } catch (error) {
    next(error);
  }
}

export async function evaluateLocalDraftHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const context = getAuthContext(req, res);
    const { websiteId, draftId } = req.params;
    const serverVersion = Number(req.query.serverVersion) || 1;

    const result = evaluateDraftRecovery({
      userId: context.userId,
      workspaceId: context.workspaceId,
      websiteId,
      draftId,
      serverVersion,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function runJourneyHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { journeyNumber } = req.body;
    const context = getAuthContext(req, res);

    const result = await executeAcceptanceJourney(Number(journeyNumber), {
      userId: context.userId,
      role: context.userRole,
      workspaceId: context.workspaceId,
      websiteId: context.websiteId || "journey-test-site",
      mfaVerified: context.mfaVerified,
      independentApproverId: context.independentApproverId,
    });

    res.json({ success: true, result });
  } catch (error) {
    next(error);
  }
}
