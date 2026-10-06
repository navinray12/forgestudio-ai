/**
 * ForgeStudio Module 37: Git Context Provider
 */

import crypto from "node:crypto";
import { IContextProvider, ContextRequest, ContextItem } from "../context.types.js";
import { forgeGitService } from "../../../../services/git/forgeGit.service.js";
import { estimateTokenCount } from "../tokenBudget.js";

export class GitContextProvider implements IContextProvider {
  public name = "git" as const;

  public async collect(req: ContextRequest): Promise<ContextItem[]> {
    const items: ContextItem[] = [];
    const projectId = req.projectId;

    try {
      const status = await forgeGitService.getStatus(projectId);
      if (status) {
        const diffSummary = {
          branch: status.branch,
          headCommit: status.headCommit,
          isClean: status.isClean,
          stagedFiles: status.staged.map((s) => `${s.status}: ${s.path}`),
          unstagedFiles: status.unstaged.map((u) => `${u.status}: ${u.path}`),
          untrackedFiles: status.untracked,
          conflicts: status.conflicts,
        };

        const content = JSON.stringify(diffSummary, null, 2);
        items.push({
          id: `git-status-${projectId}`,
          source: "git",
          sourceId: "git-status",
          title: `Git Status (${status.branch})`,
          content,
          relevanceScore: status.isClean ? 65 : 85,
          estimatedTokens: estimateTokenCount(content),
          freshnessTimestamp: new Date().toISOString(),
          hash: crypto.createHash("sha256").update(content).digest("hex").slice(0, 16),
          isCritical: !status.isClean, // Critical if uncommitted/conflicted
          metadata: { branch: status.branch, isClean: status.isClean },
        });
      }
    } catch {
      // Git repository might not be initialized yet
    }

    return items;
  }
}
