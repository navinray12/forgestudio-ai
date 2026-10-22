/**
 * Project controller: Module 16: Local Version-Control & Git.
 * Moved verbatim from project.controller.ts, which re-exports every handler for compatibility.
 */
import { Request, Response, NextFunction } from "express";
import { getForgeProjectById } from "../../services/project/forgeProject.service.js";
import { getAuthUser } from "./shared.js";

// ---------------------------------------------------------------------------
// Module 16: Local Version-Control & Git Handlers
// ---------------------------------------------------------------------------

export async function initGitHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeGitService } = await import("../../services/git/forgeGit.service.js");
    const result = await forgeGitService.initRepository(projectId, req.body?.initialBranch || "main", user.id);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getGitStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeGitService } = await import("../../services/git/forgeGit.service.js");
    const status = await forgeGitService.getStatus(projectId);
    res.status(200).json({ success: true, status });
  } catch (err) {
    next(err);
  }
}

export async function stageGitFilesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { paths } = req.body;
    const { forgeGitService } = await import("../../services/git/forgeGit.service.js");
    const status = await forgeGitService.stageFiles(projectId, paths || "all", user.id);
    res.status(200).json({ success: true, status });
  } catch (err) {
    next(err);
  }
}

export async function unstageGitFilesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { paths } = req.body;
    const { forgeGitService } = await import("../../services/git/forgeGit.service.js");
    const status = await forgeGitService.unstageFiles(projectId, paths || "all", user.id);
    res.status(200).json({ success: true, status });
  } catch (err) {
    next(err);
  }
}

export async function commitGitHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { message, author } = req.body;
    const { forgeGitService } = await import("../../services/git/forgeGit.service.js");
    const commit = await forgeGitService.commit(projectId, message, author, user.id);
    res.status(201).json({ success: true, commit });
  } catch (err) {
    next(err);
  }
}

export async function listGitBranchesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeGitService } = await import("../../services/git/forgeGit.service.js");
    const branches = await forgeGitService.listBranches(projectId);
    res.status(200).json({ success: true, branches });
  } catch (err) {
    next(err);
  }
}

export async function createGitBranchHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { name, startPoint } = req.body;
    const { forgeGitService } = await import("../../services/git/forgeGit.service.js");
    const branch = await forgeGitService.createBranch(projectId, name, startPoint, user.id);
    res.status(201).json({ success: true, branch });
  } catch (err) {
    next(err);
  }
}

export async function switchGitBranchHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { name, createIfMissing } = req.body;
    const { forgeGitService } = await import("../../services/git/forgeGit.service.js");
    const result = await forgeGitService.switchBranch(projectId, name, !!createIfMissing, user.id);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function deleteGitBranchHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const branchName = String(req.params.branchName);
    const force = req.query.force === "true" || req.body?.force === true;
    const { forgeGitService } = await import("../../services/git/forgeGit.service.js");
    const result = await forgeGitService.deleteBranch(projectId, branchName, force, user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getGitDiffHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const staged = req.query.staged === "true";
    const filePath = req.query.filePath ? String(req.query.filePath) : undefined;
    const { forgeGitService } = await import("../../services/git/forgeGit.service.js");
    const diff = await forgeGitService.getDiff(projectId, { staged, filePath });
    res.status(200).json({ success: true, diff });
  } catch (err) {
    next(err);
  }
}

export async function getGitHistoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const filePath = req.query.filePath ? String(req.query.filePath) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const { forgeGitService } = await import("../../services/git/forgeGit.service.js");
    const history = filePath
      ? await forgeGitService.getFileHistory(projectId, filePath, limit)
      : await forgeGitService.getCommitGraph(projectId, limit);
    res.status(200).json({ success: true, history });
  } catch (err) {
    next(err);
  }
}

export async function mergeGitBranchHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { sourceBranch, noFastForward } = req.body;
    const { forgeGitService } = await import("../../services/git/forgeGit.service.js");
    const result = await forgeGitService.mergeBranch(projectId, sourceBranch, { noFastForward }, user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function resolveGitConflictHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { filePath, resolution, manualContent } = req.body;
    const { forgeGitService } = await import("../../services/git/forgeGit.service.js");
    const result = await forgeGitService.resolveConflict(projectId, filePath, resolution, manualContent, user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function abortGitMergeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeGitService } = await import("../../services/git/forgeGit.service.js");
    const result = await forgeGitService.abortMerge(projectId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function rebaseGitHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { upstreamBranch, force } = req.body;
    const { forgeGitService } = await import("../../services/git/forgeGit.service.js");
    const result = await forgeGitService.rebaseOnto(projectId, upstreamBranch, !!force, user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function listGitStashesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeGitService } = await import("../../services/git/forgeGit.service.js");
    const stashes = await forgeGitService.listStashes(projectId);
    res.status(200).json({ success: true, stashes });
  } catch (err) {
    next(err);
  }
}

export async function createGitStashHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { message } = req.body;
    const { forgeGitService } = await import("../../services/git/forgeGit.service.js");
    const stash = await forgeGitService.createStash(projectId, message, user.id);
    res.status(201).json({ success: true, stash });
  } catch (err) {
    next(err);
  }
}

export async function applyGitStashHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const index = req.params.index ? Number(req.params.index) : 0;
    const drop = req.body?.drop === true;
    const { forgeGitService } = await import("../../services/git/forgeGit.service.js");
    const result = await forgeGitService.applyStash(projectId, index, drop, user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function dropGitStashHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const index = req.params.index ? Number(req.params.index) : 0;
    const { forgeGitService } = await import("../../services/git/forgeGit.service.js");
    const result = await forgeGitService.dropStash(projectId, index);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function cherryPickGitHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { commitHash } = req.body;
    const { forgeGitService } = await import("../../services/git/forgeGit.service.js");
    const commit = await forgeGitService.cherryPick(projectId, commitHash, user.id);
    res.status(200).json({ success: true, commit });
  } catch (err) {
    next(err);
  }
}

export async function listGitTagsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { forgeGitService } = await import("../../services/git/forgeGit.service.js");
    const tags = await forgeGitService.listTags(projectId);
    res.status(200).json({ success: true, tags });
  } catch (err) {
    next(err);
  }
}

export async function createGitTagHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const { name, commitHash, message } = req.body;
    const { forgeGitService } = await import("../../services/git/forgeGit.service.js");
    const tag = await forgeGitService.createTag(projectId, name, commitHash, message, user.id);
    res.status(201).json({ success: true, tag });
  } catch (err) {
    next(err);
  }
}

export async function deleteGitTagHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const name = String(req.params.name);
    const { forgeGitService } = await import("../../services/git/forgeGit.service.js");
    const result = await forgeGitService.deleteTag(projectId, name);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getGitGraphHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const { forgeGitService } = await import("../../services/git/forgeGit.service.js");
    const graph = await forgeGitService.getCommitGraph(projectId, limit);
    res.status(200).json({ success: true, graph });
  } catch (err) {
    next(err);
  }
}
