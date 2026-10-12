/**
 * Point 08: Component Support States Service
 * 
 * Enforces explicit support states for each component instance and selected target:
 * - VERIFIED_FOR_TARGET
 * - SOURCE_OWNED_WITH_DECLARED_CONTROLS
 * - CONFIGURATION_REQUIRED
 * - UNSUPPORTED_FOR_TARGET
 * - BLOCKED_BY_POLICY
 * 
 * Release Invariants:
 * - Unsupported or policy-blocked components NEVER silently degrade to empty containers
 * - Blocks release promotion on the affected target
 * - Preserves original component representation and actionable diagnostics
 */

import { componentContractRegistry, type DeploymentTarget } from "./componentContractRegistry.service.js";

export type ComponentSupportState =
  | "VERIFIED_FOR_TARGET"
  | "SOURCE_OWNED_WITH_DECLARED_CONTROLS"
  | "CONFIGURATION_REQUIRED"
  | "UNSUPPORTED_FOR_TARGET"
  | "BLOCKED_BY_POLICY";

export interface ComponentInstanceSupportEvaluation {
  instanceId: string;
  componentId: string;
  contractVersion: string;
  target: DeploymentTarget;
  pageRoute: string;
  state: ComponentSupportState;
  isReleaseBlocked: boolean;
  diagnostics: {
    code: string;
    reason: string;
    remediation: string;
  }[];
}

export class ComponentSupportStateService {
  private static instance: ComponentSupportStateService;

  private constructor() {}

  public static getInstance(): ComponentSupportStateService {
    if (!ComponentSupportStateService.instance) {
      ComponentSupportStateService.instance = new ComponentSupportStateService();
    }
    return ComponentSupportStateService.instance;
  }

  /**
   * Evaluates support state for a component instance against a selected deployment target.
   */
  public evaluateSupportState(params: {
    instanceId: string;
    componentId: string;
    contractVersion?: string;
    pageRoute: string;
    props: Record<string, unknown>;
    target: DeploymentTarget;
    isPolicyApproved?: boolean;
    hasMissingCredentials?: boolean;
    isCustomSource?: boolean;
  }): ComponentInstanceSupportEvaluation {
    const contract = componentContractRegistry.getContract(params.componentId, params.contractVersion);
    const diagnostics: ComponentInstanceSupportEvaluation["diagnostics"] = [];

    // 1. Check Policy Block
    if (params.isPolicyApproved === false) {
      diagnostics.push({
        code: "COMPONENT_BLOCKED_BY_POLICY",
        reason: `Component '${params.componentId}' is restricted by platform or tenant security policy.`,
        remediation: "Request policy approval or replace with an authorized component."
      });

      return {
        instanceId: params.instanceId,
        componentId: params.componentId,
        contractVersion: contract?.contractVersion || "unknown",
        target: params.target,
        pageRoute: params.pageRoute,
        state: "BLOCKED_BY_POLICY",
        isReleaseBlocked: true,
        diagnostics
      };
    }

    // 2. Check if Contract exists and supports Target
    if (!contract || !contract.supportedTargets.includes(params.target)) {
      diagnostics.push({
        code: "UNSUPPORTED_FOR_TARGET",
        reason: `Component '${params.componentId}' cannot be faithfully rendered or exported to target '${params.target}'.`,
        remediation: `Use a target-compatible component or switch deployment target from '${params.target}'.`
      });

      return {
        instanceId: params.instanceId,
        componentId: params.componentId,
        contractVersion: contract?.contractVersion || "unknown",
        target: params.target,
        pageRoute: params.pageRoute,
        state: "UNSUPPORTED_FOR_TARGET",
        isReleaseBlocked: true,
        diagnostics
      };
    }

    // 3. Check for Missing Configuration / Required Props
    const validation = componentContractRegistry.validateInstance(params.componentId, params.props, {
      version: contract.contractVersion,
      target: params.target
    });

    if (!validation.isValid || params.hasMissingCredentials) {
      for (const err of validation.errors) {
        diagnostics.push({
          code: err.code,
          reason: err.message,
          remediation: `Configure property '${err.field}' according to component contract.`
        });
      }

      if (params.hasMissingCredentials) {
        diagnostics.push({
          code: "CREDENTIALS_REQUIRED",
          reason: "Required external integration credential or delivery channel is not bound.",
          remediation: "Configure destination webhook or API integration in website settings."
        });
      }

      return {
        instanceId: params.instanceId,
        componentId: params.componentId,
        contractVersion: contract.contractVersion,
        target: params.target,
        pageRoute: params.pageRoute,
        state: "CONFIGURATION_REQUIRED",
        isReleaseBlocked: true,
        diagnostics
      };
    }

    // 4. Source-Owned Custom Modules with Declared Controls
    if (params.isCustomSource || contract.ownership === "SOURCE_OWNED_CUSTOM") {
      return {
        instanceId: params.instanceId,
        componentId: params.componentId,
        contractVersion: contract.contractVersion,
        target: params.target,
        pageRoute: params.pageRoute,
        state: "SOURCE_OWNED_WITH_DECLARED_CONTROLS",
        isReleaseBlocked: false,
        diagnostics: []
      };
    }

    // 5. Fully Verified for Target
    return {
      instanceId: params.instanceId,
      componentId: params.componentId,
      contractVersion: contract.contractVersion,
      target: params.target,
      pageRoute: params.pageRoute,
      state: "VERIFIED_FOR_TARGET",
      isReleaseBlocked: false,
      diagnostics: []
    };
  }

  /**
   * Release Gate check across all component instances in a candidate.
   * If any component is UNSUPPORTED, BLOCKED, or CONFIGURATION_REQUIRED,
   * release is strictly blocked (never degraded to empty containers).
   */
  public verifyReleaseEligibility(evaluations: ComponentInstanceSupportEvaluation[]): {
    canRelease: boolean;
    blockingEvaluations: ComponentInstanceSupportEvaluation[];
  } {
    const blocking = evaluations.filter(e => e.isReleaseBlocked);
    return {
      canRelease: blocking.length === 0,
      blockingEvaluations: blocking
    };
  }
}

export const componentSupportStateService = ComponentSupportStateService.getInstance();
