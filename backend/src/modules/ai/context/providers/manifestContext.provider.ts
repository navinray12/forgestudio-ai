/**
 * ForgeStudio Module 37: Manifest Context Provider
 */

import crypto from "node:crypto";
import { IContextProvider, ContextRequest, ContextItem } from "../context.types.js";
import { forgeManifestService } from "../../../../services/project/forgeManifest.service.js";
import { forgeFilesystemService } from "../../../../services/project/forgeFilesystem.service.js";
import { estimateTokenCount } from "../tokenBudget.js";

export class ManifestContextProvider implements IContextProvider {
  public name = "manifest" as const;

  public async collect(req: ContextRequest): Promise<ContextItem[]> {
    const items: ContextItem[] = [];
    const projectId = req.projectId;

    try {
      let manifestData: any = null;
      try {
        const m = await forgeManifestService.getProjectManifest(projectId, { id: "system", role: "system" } as any);
        manifestData = m.manifest;
      } catch {
        // Fallback to package.json
        const pkg = await forgeFilesystemService.readFile(projectId, "package.json");
        manifestData = JSON.parse(pkg.content || "{}");
      }

      if (manifestData) {
        const content = JSON.stringify(manifestData, null, 2);
        items.push({
          id: `manifest-${projectId}`,
          source: "manifest",
          sourceId: "project-manifest",
          title: "Project Manifest & Configuration",
          content,
          relevanceScore: 85,
          estimatedTokens: estimateTokenCount(content),
          freshnessTimestamp: new Date().toISOString(),
          hash: crypto.createHash("sha256").update(content).digest("hex").slice(0, 16),
          isCritical: true, // Manifest is critical for framework/dependency awareness
          metadata: { framework: manifestData.framework?.name || manifestData.name },
        });
      }
    } catch (err) {
      console.warn("[ManifestContextProvider] Error reading manifest:", err);
    }

    return items;
  }
}
