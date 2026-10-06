/**
 * ForgeStudio Module 37: File Context Provider
 */

import crypto from "node:crypto";
import { IContextProvider, ContextRequest, ContextItem } from "../context.types.js";
import { forgeFilesystemService } from "../../../../services/project/forgeFilesystem.service.js";
import { estimateTokenCount } from "../tokenBudget.js";

export class FileContextProvider implements IContextProvider {
  public name = "file" as const;

  public async collect(req: ContextRequest): Promise<ContextItem[]> {
    const items: ContextItem[] = [];
    const projectId = req.projectId;

    try {
      // 1. If explicit files requested
      if (req.files && req.files.length > 0) {
        for (const filePath of req.files) {
          try {
            const file = await forgeFilesystemService.readFile(projectId, filePath);
            if (file && file.content) {
              items.push({
                id: `file-${filePath}`,
                source: "file",
                sourceId: filePath,
                title: `File: ${filePath}`,
                content: file.content,
                relevanceScore: 90,
                estimatedTokens: estimateTokenCount(file.content),
                freshnessTimestamp: file.updatedAt ? new Date(file.updatedAt).toISOString() : new Date().toISOString(),
                hash: crypto.createHash("sha256").update(file.content).digest("hex").slice(0, 16),
                isCritical: false,
                metadata: { path: filePath, sizeBytes: file.sizeBytes },
              });
            }
          } catch {
            // File might not exist yet
          }
        }
      }

      // 2. Discover key entry points if few or no files requested
      if (items.length === 0) {
        const fileList = await forgeFilesystemService.listFiles(projectId);
        const candidates = fileList
          .map((f: any) => f.path)
          .filter(
            (p: string) =>
              p.includes("src/App.tsx") ||
              p.includes("src/main.tsx") ||
              p.includes("src/index.ts") ||
              p.includes("src/server.ts") ||
              p.includes("package.json")
          )
          .slice(0, 3);

        for (const candidate of candidates) {
          try {
            const f = await forgeFilesystemService.readFile(projectId, candidate);
            if (f && f.content) {
              items.push({
                id: `file-${candidate}`,
                source: "file",
                sourceId: candidate,
                title: `Primary File: ${candidate}`,
                content: f.content.slice(0, 8000),
                relevanceScore: 70,
                estimatedTokens: estimateTokenCount(f.content.slice(0, 8000)),
                freshnessTimestamp: new Date().toISOString(),
                hash: crypto.createHash("sha256").update(f.content).digest("hex").slice(0, 16),
                isCritical: false,
                metadata: { path: candidate },
              });
            }
          } catch {}
        }
      }
    } catch (err) {
      console.warn("[FileContextProvider] Failed to read files:", err);
    }

    return items;
  }
}
