import { API_BASE, request } from "./request";
import { downloadAuthenticatedFile } from "../../../../utils/downloadFile";

/**
 * Project generators: React / Next.js generation, ZIP export, generation plans, scope regeneration and
 * runtime detection.
 * Methods moved verbatim from forgeProjectService.ts (forgeProjectService); the facade there exposes them
 * under the same names and in the original order.
 */
export const generatorRequests = {

  // Modules 08 & 09: React & Next.js Project Generators
  async generateReactProject(
    projectId: string,
    options?: any
  ): Promise<{ success: boolean; result: any }> {
    return request<{ success: boolean; result: any }>(`/${projectId}/generate/react`, {
      method: "POST",
      body: JSON.stringify({ options }),
    });
  },

  async generateNextJsProject(
    projectId: string,
    options?: any
  ): Promise<{ success: boolean; result: any }> {
    return request<{ success: boolean; result: any }>(`/${projectId}/generate/next`, {
      method: "POST",
      body: JSON.stringify({ options }),
    });
  },

  /** Download the project's persisted source files (including manual edits) as a ZIP */
  async exportProjectZip(projectId: string, fallbackName: string): Promise<string> {
    return downloadAuthenticatedFile(`${API_BASE}/${projectId}/export/zip`, `${fallbackName}.zip`);
  },

  async getGenerationPlan(
    projectId: string,
    framework: "react" | "nextjs"
  ): Promise<{ success: boolean; plan: any }> {
    return request<{ success: boolean; plan: any }>(`/${projectId}/generate/plan?framework=${framework}`);
  },

  async regenerateScope(
    projectId: string,
    framework: "react" | "nextjs",
    scope: { type: "full" | "page" | "component" | "route"; targetId?: string; targetPath?: string }
  ): Promise<{ success: boolean; result: any }> {
    return request<{ success: boolean; result: any }>(`/${projectId}/generate/scope`, {
      method: "POST",
      body: JSON.stringify({ framework, scope }),
    });
  },

  // Module 29: Source-Based Hosting
  async detectRuntime(projectId: string): Promise<{ success: boolean; runtime: any }> {
    return request<{ success: boolean; runtime: any }>(`/${projectId}/runtime/detect`);
  },
};
