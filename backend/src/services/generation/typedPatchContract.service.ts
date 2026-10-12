/**
 * Point 07: Typed Patch Contract Service
 * 
 * Enforces that all AI outputs are strictly treated as untrusted proposals.
 * Validates patches against an allowlist of permissible operations and
 * blocks forbidden mutations (direct release promotion, protected source overwrites,
 * test suppression, baseline rewrites, cross-tenant leaks).
 */

export type AllowedPatchOperation =
  | "PROPOSE_CONTENT_DRAFT"
  | "ADD_SITESPEC_COMPONENT"
  | "UPDATE_DESIGN_TOKEN"
  | "BIND_CONTENT_FIELD"
  | "BIND_ACTION_TARGET"
  | "PROPOSE_SCHEMA_TYPE"
  | "REPAIR_VALIDATION_DIAGNOSTIC"
  | "ADD_CANDIDATE_FILE";

export interface TypedPatchProposal {
  patchId: string;
  jobId: string;
  candidateId: string;
  tenantId: string;
  expectedBaseRevision: number;
  operation: AllowedPatchOperation;
  targetRecord: "RECORD1_FACTS" | "RECORD2_SITESPEC" | "RECORD3_SOURCE" | "RECORD4_CONTENT" | "CANDIDATE_BUILD";
  targetObjectId: string;
  affectedScope: {
    pageRoute?: string;
    componentId?: string;
    fieldKey?: string;
    filePath?: string;
  };
  payload: Record<string, unknown>;
  intendedBehavior: string;
  uncertainties?: string[];
  expectedAcceptanceConditions?: string[];
}

export interface PatchValidationResult {
  isValid: boolean;
  rejectedReasons: string[];
  appliedDiff?: {
    patchId: string;
    operation: AllowedPatchOperation;
    targetObjectId: string;
    beforeState?: unknown;
    afterState: unknown;
    timestamp: string;
  };
}

export class TypedPatchContractService {
  private static instance: TypedPatchContractService;

  // Strict list of allowed operations
  private static readonly ALLOWED_OPERATIONS: Set<AllowedPatchOperation> = new Set([
    "PROPOSE_CONTENT_DRAFT",
    "ADD_SITESPEC_COMPONENT",
    "UPDATE_DESIGN_TOKEN",
    "BIND_CONTENT_FIELD",
    "BIND_ACTION_TARGET",
    "PROPOSE_SCHEMA_TYPE",
    "REPAIR_VALIDATION_DIAGNOSTIC",
    "ADD_CANDIDATE_FILE"
  ]);

  // Forbidden operation patterns / keywords
  private static readonly FORBIDDEN_KEYWORDS = [
    "DIRECT_PUBLISH",
    "PROMOTE_RELEASE",
    "SKIP_VALIDATION",
    "SUPPRESS_TEST",
    "REWRITE_BASELINE",
    "DROP_DATABASE",
    "SET_PERMISSIONS",
    "OVERRIDE_AUTH",
    "PURGE_DATA"
  ];

  private constructor() {}

  public static getInstance(): TypedPatchContractService {
    if (!TypedPatchContractService.instance) {
      TypedPatchContractService.instance = new TypedPatchContractService();
    }
    return TypedPatchContractService.instance;
  }

  /**
   * Validates a typed patch proposal before application.
   */
  public validatePatch(
    patch: TypedPatchProposal,
    context: {
      currentBaseRevision: number;
      tenantId: string;
      protectedFilePaths: string[];
    }
  ): PatchValidationResult {
    const rejectedReasons: string[] = [];

    // 1. Validate tenant scope
    if (patch.tenantId !== context.tenantId) {
      rejectedReasons.push(`Tenant isolation violation: patch tenant ${patch.tenantId} does not match context tenant ${context.tenantId}`);
    }

    // 2. Validate operation allowlist
    if (!TypedPatchContractService.ALLOWED_OPERATIONS.has(patch.operation)) {
      rejectedReasons.push(`Disallowed operation: ${patch.operation} is not in the allowlist`);
    }

    // 3. Check for forbidden keywords in payload or intended behavior
    const payloadStr = JSON.stringify(patch.payload);
    for (const kw of TypedPatchContractService.FORBIDDEN_KEYWORDS) {
      if (payloadStr.includes(kw) || patch.intendedBehavior.includes(kw)) {
        rejectedReasons.push(`Security violation: patch contains forbidden operation pattern '${kw}'`);
      }
    }

    // 4. Verify expected base revision (detects stale concurrent mutations)
    if (patch.expectedBaseRevision !== context.currentBaseRevision) {
      rejectedReasons.push(
        `Stale base revision: patch expected revision ${patch.expectedBaseRevision}, but current base revision is ${context.currentBaseRevision}`
      );
    }

    // 5. Source ownership protection: cannot modify protected files directly
    if (patch.affectedScope.filePath) {
      if (context.protectedFilePaths.includes(patch.affectedScope.filePath)) {
        rejectedReasons.push(
          `Protected source violation: target file '${patch.affectedScope.filePath}' is protected and cannot be modified by AI patch`
        );
      }
    }

    // 6. Direct publish rejection: model cannot mutate active release pointer
    if (patch.targetObjectId === "ACTIVE_RELEASE" || patch.targetObjectId === "RELEASE_POINTER") {
      rejectedReasons.push(`Release gate violation: model cannot target active release pointer directly`);
    }

    return {
      isValid: rejectedReasons.length === 0,
      rejectedReasons
    };
  }

  /**
   * Applies an allowlisted patch to an isolated candidate state (never directly to production).
   */
  public applyPatchToCandidate<T extends Record<string, unknown>>(
    candidateState: T,
    patch: TypedPatchProposal,
    context: {
      currentBaseRevision: number;
      tenantId: string;
      protectedFilePaths: string[];
    }
  ): { updatedCandidate: T; diff: PatchValidationResult["appliedDiff"] } {
    const validation = this.validatePatch(patch, context);
    if (!validation.isValid) {
      throw new Error(`Patch rejection:\n - ${validation.rejectedReasons.join("\n - ")}`);
    }

    // Clone candidate state for pure isolation
    const updatedCandidate = JSON.parse(JSON.stringify(candidateState)) as T;

    // Apply specific allowlisted transformation
    switch (patch.operation) {
      case "ADD_SITESPEC_COMPONENT": {
        const pages = (updatedCandidate as any).pages || [];
        const targetPage = pages.find((p: any) => p.route === patch.affectedScope.pageRoute);
        if (targetPage) {
          targetPage.components = targetPage.components || [];
          targetPage.components.push(patch.payload);
        }
        break;
      }
      case "UPDATE_DESIGN_TOKEN": {
        (updatedCandidate as any).designTokens = {
          ...((updatedCandidate as any).designTokens || {}),
          ...patch.payload
        };
        break;
      }
      case "PROPOSE_CONTENT_DRAFT": {
        const entries = (updatedCandidate as any).contentEntries || [];
        entries.push(patch.payload);
        (updatedCandidate as any).contentEntries = entries;
        break;
      }
      case "BIND_CONTENT_FIELD":
      case "BIND_ACTION_TARGET":
      case "REPAIR_VALIDATION_DIAGNOSTIC":
      case "ADD_CANDIDATE_FILE":
      case "PROPOSE_SCHEMA_TYPE": {
        // Generic scoped mutation into candidate patches container
        (updatedCandidate as any).candidatePatches = (updatedCandidate as any).candidatePatches || [];
        (updatedCandidate as any).candidatePatches.push({
          patchId: patch.patchId,
          operation: patch.operation,
          targetObjectId: patch.targetObjectId,
          payload: patch.payload
        });
        break;
      }
    }

    const diff = {
      patchId: patch.patchId,
      operation: patch.operation,
      targetObjectId: patch.targetObjectId,
      beforeState: candidateState,
      afterState: updatedCandidate,
      timestamp: new Date().toISOString()
    };

    return {
      updatedCandidate,
      diff
    };
  }
}

export const typedPatchContractService = TypedPatchContractService.getInstance();
