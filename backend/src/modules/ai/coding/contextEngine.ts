/**
 * ForgeStudio Module 22: Coding Agent Context Engine
 * Compiles targeted repository context, manifest, diagnostics, and Git state
 * without overloading LLM context limits.
 */

import { forgeFilesystemService } from "../../../services/project/forgeFilesystem.service.js";
import { forgeManifestService } from "../../../services/project/forgeManifest.service.js";
import { forgeGitService } from "../../../services/git/forgeGit.service.js";

export interface ProjectContextSummary {
  projectId: string;
  framework: string;
  packageManager: string;
  dependencies: Record<string, string>;
  fileTree: string[];
  gitBranch: string;
  hasUncommittedChanges: boolean;
  diagnosticsCount: number;
}

export class ContextEngine {
  public static async buildTargetedContext(
    projectId: string,
    focusedFiles: string[] = []
  ): Promise<{
    summary: ProjectContextSummary;
    fileSnippets: Array<{ path: string; content: string }>;
  }> {
    // 1. Manifest
    let framework = "react";
    let packageManager = "npm";
    let dependencies: Record<string, string> = {};

    try {
      const manifestRes = await forgeManifestService.getProjectManifest(projectId, { id: "system", role: "system" } as any);
      framework = manifestRes.manifest?.framework?.name || "react";
      packageManager = manifestRes.manifest?.framework?.packageManager || "npm";
      dependencies = manifestRes.manifest?.dependencies || {};
    } catch {
      // package.json fallback
      try {
        const pkgFile = await forgeFilesystemService.readFile(projectId, "package.json");
        const parsed = JSON.parse(pkgFile.content || "{}");
        dependencies = { ...parsed.dependencies, ...parsed.devDependencies };
      } catch {
        // Default
      }
    }

    // 2. File list
    const allFiles = await forgeFilesystemService.listFiles(projectId);
    const filePaths = (allFiles as any[]).map((f: any) => f.path);

    // 3. Git status
    let gitBranch = "main";
    let hasUncommittedChanges = false;
    try {
      const gitStatus = await forgeGitService.getStatus(projectId);
      gitBranch = (gitStatus as any).currentBranch || (gitStatus as any).branch || "main";
      hasUncommittedChanges = !gitStatus.isClean;
    } catch {
      // Git not yet initialized
    }

    // 4. Load requested focused files
    const fileSnippets: Array<{ path: string; content: string }> = [];
    for (const p of focusedFiles) {
      try {
        const file = await forgeFilesystemService.readFile(projectId, p);
        if (file.content) {
          fileSnippets.push({ path: file.path, content: file.content.slice(0, 8000) });
        }
      } catch {
        // File might be a new file to be created
      }
    }

    // If no focused files provided, include primary entry points (App.tsx or main.tsx)
    if (fileSnippets.length === 0) {
      const entryCandidate = filePaths.find((p: string) => p.includes("App.tsx") || p.includes("index.html") || p.includes("src/main.tsx"));
      if (entryCandidate) {
        try {
          const file = await forgeFilesystemService.readFile(projectId, entryCandidate);
          if (file.content) fileSnippets.push({ path: file.path, content: file.content.slice(0, 8000) });
        } catch {}
      }
    }

    return {
      summary: {
        projectId,
        framework,
        packageManager,
        dependencies,
        fileTree: filePaths.slice(0, 100),
        gitBranch,
        hasUncommittedChanges,
        diagnosticsCount: 0,
      },
      fileSnippets,
    };
  }
}
