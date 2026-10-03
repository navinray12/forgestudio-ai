/** Provider boundary: application services never import a vendor SDK directly. */
export type AiOperation =
  | "SITE_GENERATION"
  | "SECTION_GENERATION"
  | "CONTAINER_GENERATION"
  | "LAYOUT_GENERATION"
  | "TEXT_GENERATION"
  | "CONTENT_REFINEMENT"
  | "IMAGE_GENERATION"
  | "IMAGE_EDIT"
  | "IMAGE_BACKGROUND_REMOVAL"
  | "IMAGE_VARIATION"
  | "IMAGE_REPLACEMENT"
  | "CODE_GENERATION"
  | "CODE_EXPLANATION"
  | "ANIMATION_GENERATION"
  | "DYNAMIC_PROPERTY"
  | "SEO_GENERATION"
  | "ACCESSIBILITY_ANALYSIS"
  | "PERFORMANCE_ANALYSIS"
  | "DESIGN_ANALYSIS"
  | "UNIFIED_ASSISTANT"
  | "COPY_EDIT";

export interface AiGenerationRequest {
  operation: AiOperation;
  prompt: string;
  context: Record<string, unknown>;
  systemPrompt?: string;
  schema?: Record<string, unknown>;
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
