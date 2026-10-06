/**
 * ForgeStudio Module 37: Database Context Provider
 */

import crypto from "node:crypto";
import { IContextProvider, ContextRequest, ContextItem } from "../context.types.js";
import { forgeFilesystemService } from "../../../../services/project/forgeFilesystem.service.js";
import { forgeDatabaseService } from "../../../data-platform/database/forgeDatabase.service.js";
import { estimateTokenCount } from "../tokenBudget.js";

export class DatabaseContextProvider implements IContextProvider {
  public name = "database" as const;

  public async collect(req: ContextRequest): Promise<ContextItem[]> {
    const items: ContextItem[] = [];
    const projectId = req.projectId;

    try {
      // 1. Check live managed customer database tables
      const dbEntity = await forgeDatabaseService.getDatabase(projectId, "development");
      if (dbEntity) {
        const fullSchema = await forgeDatabaseService.introspectSchema(dbEntity.id);
        if (fullSchema.tables.length > 0) {
          const schemaSummary = fullSchema.tables
            .map((t) => `Table ${t.name} (${t.columns.map((c) => `${c.name}:${c.type}`).join(", ")})`)
            .join("\n");
          items.push({
            id: `live-db-${dbEntity.id}`,
            source: "database",
            sourceId: dbEntity.schemaName,
            title: `Live Customer Database Schema (${dbEntity.schemaName})`,
            content: schemaSummary,
            relevanceScore: 85,
            estimatedTokens: estimateTokenCount(schemaSummary),
            freshnessTimestamp: new Date().toISOString(),
            hash: crypto.createHash("sha256").update(schemaSummary).digest("hex").slice(0, 16),
            isCritical: true,
            metadata: { tablesCount: fullSchema.tables.length },
          });
        }
      }

      // 2. Look for prisma/schema.prisma or schema files in project
      const candidates = ["prisma/schema.prisma", "src/db/schema.ts", "schema.sql"];
      for (const candidate of candidates) {
        try {
          const file = await forgeFilesystemService.readFile(projectId, candidate);
          if (file && file.content) {
            const content = file.content.slice(0, 10000);
            items.push({
              id: `db-schema-${candidate}`,
              source: "database",
              sourceId: candidate,
              title: `Database Schema File: ${candidate}`,
              content,
              relevanceScore: 75,
              estimatedTokens: estimateTokenCount(content),
              freshnessTimestamp: new Date().toISOString(),
              hash: crypto.createHash("sha256").update(content).digest("hex").slice(0, 16),
              isCritical: false,
              metadata: { path: candidate },
            });
            break;
          }
        } catch {}
      }
    } catch (err) {
      console.warn("[DatabaseContextProvider] Error reading db schema:", err);
    }

    return items;
  }
}
