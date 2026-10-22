import type { DeploymentStatus } from "../../../../pages/editor/types";

/**
 * Response shapes of the publish / validate endpoints.
 * Moved verbatim from publishingService.ts.
 */
export interface PublishApiResponse {
  success: boolean;
  deploymentId: string;
  status: DeploymentStatus;
  version: number;
  environment: string;
  destinationType: string;
  publishedAt: string;
  liveUrl: string;
  sourceRevisionId?: string;
  warnings?: Array<{ field: string; message: string; severity: "ERROR" | "WARNING" }>;
}

export interface ValidationApiResponse {
  success: boolean;
  validation: {
    valid: boolean;
    errors: Array<{ field: string; message: string; severity: "ERROR" | "WARNING" }>;
    warnings: Array<{ field: string; message: string; severity: "ERROR" | "WARNING" }>;
  };
}
