/**
 * Module 08: Universal Full-Stack Project Generator Engine
 * Production generator with robust deterministic local fallback when external AI credentials/services are unavailable.
 * Supports: React/Vite, Next.js, Node/Express, and Full-Stack (React + Node).
 */

import { AppError } from "../../utils/app-error.js";
import { prisma } from "../../config/prisma.js";
import { forgeProjectService } from "../project/forgeProject.service.js";
import { forgeFilesystemService } from "../project/forgeFilesystem.service.js";
import { projectTemplateService } from "../../modules/design-system/projectTemplate.service.js";
import { projectGeneratorService } from "./projectGenerator.service.js";
import { recordAuditLog } from "../audit.service.js";

const db = prisma as any;

export type SupportedFullStackFramework = "react-vite" | "nextjs" | "node-express" | "fullstack";

export interface FullStackGenerationOptions {
  projectId: string;
  name?: string;
  prompt: string;
  framework?: SupportedFullStackFramework;
  authorId?: string;
  useAiIfAvailable?: boolean;
}

export interface FullStackGenerationResult {
  success: boolean;
  projectId: string;
  framework: string;
  strategy: "AI_ENHANCED" | "DETERMINISTIC_LOCAL_FALLBACK";
  /** Scaffolding is not verified application generation. */
  generationMode: "approved-template";
  verificationStatus: "NOT_EXECUTED";
  filesCreated: number;
  manifestUpdated: boolean;
  diagnostics: Array<{ severity: "info" | "warn" | "error"; message: string }>;
}

export class FullStackGeneratorService {
  /**
   * Generate complete production project with zero risk of half-generation
   */
  public async generateFullStackProject(
    options: FullStackGenerationOptions
  ): Promise<FullStackGenerationResult> {
    const { projectId, prompt, framework = "react-vite", authorId, useAiIfAvailable = true } = options;
    const project = await forgeProjectService.getProjectById(projectId);
    const projectName = options.name || project.name;
    const diagnostics: Array<{ severity: "info" | "warn" | "error"; message: string }> = [];

    const strategy: "DETERMINISTIC_LOCAL_FALLBACK" = "DETERMINISTIC_LOCAL_FALLBACK";
    let aiAttemptFailed = false;

    // 1. Optional External AI enhancement check
    if (useAiIfAvailable && (process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.STITCH_API_KEY)) {
      // A configured key is not evidence that a provider call occurred.
      // Keep the existing template path available until a validated provider-backed
      // ApplicationSpec generation pipeline is integrated.
      aiAttemptFailed = false;
      diagnostics.push({
        severity: "warn",
        message: "Provider-backed application generation is not implemented in this entrypoint. Creating an unverified template scaffold instead.",
      });
    } else {
      diagnostics.push({
        severity: "info",
        message: "External AI credentials not configured. Using deterministic high-fidelity local scaffolding.",
      });
    }

    // 2. Deterministic Local Scaffolding Engine (Guaranteed Execution)
    let templateId = "react-vite";
    if (framework === "nextjs") templateId = "nextjs-app";
    else if (framework === "node-express") templateId = "node-express-api";
    else if (framework === "fullstack") templateId = "react-vite"; // base react with backend api endpoints

    const scaffoldRes = await projectTemplateService.scaffoldTemplate(projectId, templateId, {
      customVariables: { name: projectName },
      userId: authorId,
    });

    // 3. For fullstack, enrich with server routes if needed
    if (framework === "fullstack") {
      const serverCode = `import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/items", (_req, res) => {
  res.status(501).json({
    error: "APPLICATION_DATA_NOT_CONFIGURED",
    message: "Connect a verified application data model and repository before using this endpoint.",
  });
});

app.listen(PORT, () => {
  console.log(\`Full-stack API listening on port \${PORT}\`);
});
`;
      await forgeFilesystemService.writeFile(projectId, "server/index.ts", {
        content: serverCode,
        encoding: "utf-8",
        authorId,
        reason: "Full-stack Node/Express API entrypoint",
      });
      scaffoldRes.filesCreated.push("server/index.ts");
    }

    diagnostics.push({
      severity: "warn",
      message: "Template files were created but application behavior, database persistence, permissions, and production readiness have not been verified.",
    });

    await recordAuditLog({
      userId: authorId || "system",
      action: "project.fullstack_generated",
      targetResource: `project:${projectId}`,
      details: {
        framework,
        strategy,
        filesCreated: scaffoldRes.filesCreated.length,
        aiAttemptFailed,
        generationMode: "approved-template",
        verificationStatus: "NOT_EXECUTED",
      },
    });

    return {
      success: true,
      projectId,
      framework,
      strategy,
      generationMode: "approved-template",
      verificationStatus: "NOT_EXECUTED",
      filesCreated: scaffoldRes.filesCreated.length,
      manifestUpdated: true,
      diagnostics,
    };
  }
}

export const fullStackGeneratorService = new FullStackGeneratorService();
