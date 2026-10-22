/**
 * Project controller: Module 17: Native GitHub Integration.
 * Moved verbatim from project.controller.ts, which re-exports every handler for compatibility.
 */
import { Request, Response, NextFunction } from "express";
import { getForgeProjectById } from "../../services/project/forgeProject.service.js";
import { getAuthUser } from "./shared.js";

// ---------------------------------------------------------------------------
// Module 17: Native GitHub Integration Handlers
// ---------------------------------------------------------------------------

export async function connectGithubHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeGithubService } = await import("../../services/git/forgeGithub.service.js");
    const connection = await forgeGithubService.connectRepository(projectId, req.body, user.id);
    res.status(200).json({ success: true, connection });
  } catch (err) {
    next(err);
  }
}

export async function importGithubHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const { forgeGithubService } = await import("../../services/git/forgeGithub.service.js");
    const result = await forgeGithubService.importRepository(req.body, user.id);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function createGithubRepoHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeGithubService } = await import("../../services/git/forgeGithub.service.js");
    const connection = await forgeGithubService.createRepository(projectId, req.body, user.id);
    res.status(201).json({ success: true, connection });
  } catch (err) {
    next(err);
  }
}

export async function fetchGithubRemoteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeGithubService } = await import("../../services/git/forgeGithub.service.js");
    const result = await forgeGithubService.fetchRemote(projectId, user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function pullGithubRemoteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { branch } = req.body;
    const { forgeGithubService } = await import("../../services/git/forgeGithub.service.js");
    const result = await forgeGithubService.pullRemote(projectId, branch, user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function pushGithubRemoteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { branch, force } = req.body;
    const { forgeGithubService } = await import("../../services/git/forgeGithub.service.js");
    const result = await forgeGithubService.pushRemote(projectId, { branch, force }, user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function syncGithubBranchHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const branch = req.query.branch ? String(req.query.branch) : undefined;
    const { forgeGithubService } = await import("../../services/git/forgeGithub.service.js");
    const sync = await forgeGithubService.synchronizeBranch(projectId, branch, user.id);
    res.status(200).json({ success: true, sync });
  } catch (err) {
    next(err);
  }
}

export async function createGithubPrHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeGithubService } = await import("../../services/git/forgeGithub.service.js");
    const pullRequest = await forgeGithubService.createPullRequest(projectId, req.body, user.id);
    res.status(201).json({ success: true, pullRequest });
  } catch (err) {
    next(err);
  }
}

export async function listGithubPrsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const status = req.query.status as any;
    const { forgeGithubService } = await import("../../services/git/forgeGithub.service.js");
    const pullRequests = await forgeGithubService.listPullRequests(projectId, status);
    res.status(200).json({ success: true, pullRequests });
  } catch (err) {
    next(err);
  }
}

export async function getGithubPrDetailsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const prNumber = Number(req.params.prNumber);
    const { forgeGithubService } = await import("../../services/git/forgeGithub.service.js");
    const pullRequest = await forgeGithubService.getPullRequestDetails(projectId, prNumber);
    res.status(200).json({ success: true, pullRequest });
  } catch (err) {
    next(err);
  }
}

export async function updateGithubPrHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const prNumber = Number(req.params.prNumber);
    const { forgeGithubService } = await import("../../services/git/forgeGithub.service.js");
    const pullRequest = await forgeGithubService.updatePullRequest(projectId, prNumber, req.body, user.id);
    res.status(200).json({ success: true, pullRequest });
  } catch (err) {
    next(err);
  }
}

export async function getGithubChecksHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const commitHash = String(req.params.commitHash);
    const { forgeGithubService } = await import("../../services/git/forgeGithub.service.js");
    const checks = await forgeGithubService.getCommitChecksAndActions(projectId, commitHash);
    res.status(200).json({ success: true, ...checks });
  } catch (err) {
    next(err);
  }
}

export async function githubWebhookHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { forgeGithubService } = await import("../../services/git/forgeGithub.service.js");
    const result = await forgeGithubService.processWebhook(req.headers as any, req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
