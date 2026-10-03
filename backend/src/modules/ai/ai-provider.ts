/** Provider boundary: application services never import a vendor SDK directly. */
export type AiOperation = "SITE_GENERATION" | "SECTION_GENERATION" | "COPY_EDIT";

export interface AiGenerationRequest {
  operation: AiOperation;
  prompt: string;
  context: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface AiGenerationResult {
  text: string;
  model: string;
  provider: string;
  requestId?: string;
}

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  generate(request: AiGenerationRequest): Promise<AiGenerationResult>;
}
