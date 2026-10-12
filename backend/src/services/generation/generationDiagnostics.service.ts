/**
 * Point 07: Generation Diagnostics Service
 * 
 * Provides structured, actionable, and safe diagnostics for generation failures:
 * - Precise machine-readable error codes and categories
 * - References to specific page, component, field, or source file
 * - Actionable remediation guidance
 * - Sensitive information redaction (secrets, API keys, credentials, raw stack traces)
 */

export type DiagnosticSeverity = "BLOCKING" | "WARNING" | "INFO";

export type DiagnosticCategory =
  | "SCHEMA_INTEGRITY"
  | "ROUTING_NAVIGATION"
  | "SOURCE_PROTECTION"
  | "CAPABILITY_DEPENDENCY"
  | "ACTION_DELIVERY"
  | "ACCESSIBILITY"
  | "POLICY_COMPLIANCE"
  | "BUDGET_LIMIT"
  | "SYSTEM_TIMEOUT";

export interface GenerationDiagnostic {
  diagnosticId: string;
  jobId: string;
  candidateId: string;
  category: DiagnosticCategory;
  code: string;
  severity: DiagnosticSeverity;
  userFacingMessage: string;
  technicalDetails?: string;
  requirementRef?: string;
  pageRoute?: string;
  componentId?: string;
  fieldOrBindingId?: string;
  sourceFile?: string;
  sourceLineRange?: [number, number];
  expectedValue?: string;
  actualValue?: string;
  isRepairable: boolean;
  suggestedRemediation: string;
  attemptsUsed: number;
  attemptsRemaining: number;
  createdAt: string;
}

export class GenerationDiagnosticsService {
  private static instance: GenerationDiagnosticsService;
  private diagnostics = new Map<string, GenerationDiagnostic[]>(); // candidateId -> diagnostics[]

  private static readonly SECRET_PATTERNS = [
    /api[-_]?key[=:\s]+["']?([a-zA-Z0-9_\-]{8,})["']?/gi,
    /bearer\s+([a-zA-Z0-9_\-\.]{15,})/gi,
    /sk-[a-zA-Z0-9]{20,}/gi,
    /password[=:\s]+["']?([^"'\s]+)["']?/gi,
    /secret[=:\s]+["']?([^"'\s]+)["']?/gi
  ];

  private constructor() {}

  public static getInstance(): GenerationDiagnosticsService {
    if (!GenerationDiagnosticsService.instance) {
      GenerationDiagnosticsService.instance = new GenerationDiagnosticsService();
    }
    return GenerationDiagnosticsService.instance;
  }

  public reset(): void {
    this.diagnostics.clear();
  }

  /**
   * Redacts sensitive credentials or tokens from diagnostic text.
   */
  public redactSensitiveInfo(text: string): string {
    let sanitized = text;
    for (const pattern of GenerationDiagnosticsService.SECRET_PATTERNS) {
      sanitized = sanitized.replace(pattern, "[REDACTED_SECRET]");
    }
    return sanitized;
  }

  /**
   * Records a structured diagnostic entry with automatic redaction.
   */
  public recordDiagnostic(diagnostic: Omit<GenerationDiagnostic, "createdAt">): GenerationDiagnostic {
    const sanitizedUserMsg = this.redactSensitiveInfo(diagnostic.userFacingMessage);
    const sanitizedTechDetails = diagnostic.technicalDetails 
      ? this.redactSensitiveInfo(diagnostic.technicalDetails)
      : undefined;

    const fullDiagnostic: GenerationDiagnostic = {
      ...diagnostic,
      userFacingMessage: sanitizedUserMsg,
      technicalDetails: sanitizedTechDetails,
      createdAt: new Date().toISOString()
    };

    const existing = this.diagnostics.get(diagnostic.candidateId) || [];
    existing.push(fullDiagnostic);
    this.diagnostics.set(diagnostic.candidateId, existing);

    return fullDiagnostic;
  }

  public getDiagnosticsForCandidate(candidateId: string): GenerationDiagnostic[] {
    return this.diagnostics.get(candidateId) || [];
  }

  public getBlockingDiagnostics(candidateId: string): GenerationDiagnostic[] {
    return (this.diagnostics.get(candidateId) || []).filter(d => d.severity === "BLOCKING");
  }

  /**
   * Helpers to create standard Point 07 diagnostic patterns.
   */
  public createMissingFormDeliveryDiagnostic(params: {
    jobId: string;
    candidateId: string;
    formId: string;
    pageRoute: string;
    attemptsUsed: number;
    attemptsRemaining: number;
  }): GenerationDiagnostic {
    return this.recordDiagnostic({
      diagnosticId: `diag-form-${Date.now()}`,
      jobId: params.jobId,
      candidateId: params.candidateId,
      category: "ACTION_DELIVERY",
      code: "FORM_MISSING_DELIVERY_PATH",
      severity: "BLOCKING",
      userFacingMessage: `The contact form on '${params.pageRoute}' has no verified lead delivery path configured.`,
      requirementRef: "CAP_FORMS_LEAD_CAPTURE",
      pageRoute: params.pageRoute,
      componentId: params.formId,
      expectedValue: "Configured email or CRM webhook target",
      actualValue: "UNBOUND",
      isRepairable: true,
      suggestedRemediation: "Bind the form action to a verified delivery channel or configure a notifications webhook.",
      attemptsUsed: params.attemptsUsed,
      attemptsRemaining: params.attemptsRemaining
    });
  }

  public createProtectedSourceViolationDiagnostic(params: {
    jobId: string;
    candidateId: string;
    filePath: string;
    attemptsUsed: number;
    attemptsRemaining: number;
  }): GenerationDiagnostic {
    return this.recordDiagnostic({
      diagnosticId: `diag-source-${Date.now()}`,
      jobId: params.jobId,
      candidateId: params.candidateId,
      category: "SOURCE_PROTECTION",
      code: "PROTECTED_SOURCE_MODIFIED",
      severity: "BLOCKING",
      userFacingMessage: `The candidate attempted to modify protected source file '${params.filePath}'. The edit was rejected.`,
      sourceFile: params.filePath,
      isRepairable: false, // Protected source cannot be overridden by AI
      suggestedRemediation: "Re-scope generation patch to only target allowed component slots or content schema fields.",
      attemptsUsed: params.attemptsUsed,
      attemptsRemaining: params.attemptsRemaining
    });
  }

  public createAccessibilityFailureDiagnostic(params: {
    jobId: string;
    candidateId: string;
    pageRoute: string;
    componentId: string;
    ruleId: string;
    attemptsUsed: number;
    attemptsRemaining: number;
  }): GenerationDiagnostic {
    return this.recordDiagnostic({
      diagnosticId: `diag-a11y-${Date.now()}`,
      jobId: params.jobId,
      candidateId: params.candidateId,
      category: "ACCESSIBILITY",
      code: "ACCESSIBILITY_FAILED",
      severity: "BLOCKING",
      userFacingMessage: `Publication is blocked because required accessibility check '${params.ruleId}' failed on page '${params.pageRoute}'.`,
      requirementRef: "WCAG_2_1_AA",
      pageRoute: params.pageRoute,
      componentId: params.componentId,
      expectedValue: "Compliant contrast ratio / aria-label",
      actualValue: "Missing or low-contrast token",
      isRepairable: true,
      suggestedRemediation: "Ensure all interactive elements have accessible names and meet WCAG AA contrast standards.",
      attemptsUsed: params.attemptsUsed,
      attemptsRemaining: params.attemptsRemaining
    });
  }
}

export const generationDiagnosticsService = GenerationDiagnosticsService.getInstance();
