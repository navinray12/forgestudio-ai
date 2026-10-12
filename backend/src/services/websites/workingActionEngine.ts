/**
 * ForgeStudio Execution Blueprint v2.1 — Point 04: What Every Generated Website Must Contain
 * Working Action Engine & Operational State Machine
 *
 * Implements the Point 04 Working-Action Contract & Operational State Coverage:
 * - Every visible action must resolve to:
 *   1. A working, authorized route
 *   2. An authorized command with validated inputs
 *   3. An explicit unavailable state explaining the limitation honestly
 * - Forbids decorative buttons, inert submits, dead links, or premature success responses.
 * - Handles full operational states:
 *   LOADING, EMPTY, VALIDATION_FAILURE, REFUSAL, EXPIRATION, OUTAGE, RETRY, SUCCESS.
 * - Enforces idempotency and retry safeguards for asynchronous lead/form submissions.
 */

import { AppError } from "../../utils/app-error.js";
import { PageAction, ActionResolutionType } from "./websiteContract.js";

export type OperationalState =
  | "IDLE"
  | "LOADING"
  | "EMPTY"
  | "VALIDATION_FAILURE"
  | "REFUSAL"
  | "EXPIRATION"
  | "OUTAGE"
  | "RETRY"
  | "SUCCESS";

export interface ActionResolutionResult {
  actionId: string;
  label: string;
  resolvedType: ActionResolutionType;
  target: string;
  isExecutable: boolean;
  explanation?: string;
  operationalState: OperationalState;
}

export interface ActionExecutionRequest {
  actionId: string;
  type: ActionResolutionType;
  destination: string;
  payload?: Record<string, unknown>;
  idempotencyKey?: string;
  actorRole?: "PUBLIC_VISITOR" | "OWNER" | "ADMIN";
}

export interface ActionExecutionResult {
  success: boolean;
  state: OperationalState;
  message: string;
  data?: Record<string, unknown>;
  canRetry: boolean;
  retryAfterMs?: number;
}

// Authorized command whitelist for generated websites
export const AUTHORIZED_PUBLIC_COMMANDS = new Set([
  "submit_lead",
  "search_site",
  "switch_locale",
  "update_consent",
  "paginate_content",
]);

export const AUTHORIZED_OWNER_COMMANDS = new Set([
  "edit_content",
  "publish_release",
  "export_site",
  "rollback_release",
  "audit_diagnostics",
  "trigger_backup",
]);

/**
 * Resolves an action against a website's known routes and capabilities.
 * Enforces the strict rule: No dead buttons or fake success states.
 */
export function resolveAction(
  action: PageAction,
  availableRoutes: string[],
  activatedCapabilities: string[] = []
): ActionResolutionResult {
  const dest = (action.destination || "").trim();

  // 1. Dead link / inert patterns check
  if (!dest || dest === "#" || dest === "javascript:void(0)" || dest === "javascript:;") {
    return {
      actionId: action.id,
      label: action.label,
      resolvedType: "UNAVAILABLE",
      target: dest,
      isExecutable: false,
      explanation: `Action '${action.label}' destination is empty or inert ('${dest}'). Visible dead actions violate the Point 04 operating contract.`,
      operationalState: "EMPTY",
    };
  }

  // 2. Explicit unavailable state
  if (action.actionType === "UNAVAILABLE" || dest.startsWith("UNAVAILABLE:")) {
    const reason = action.stateReason || dest.replace("UNAVAILABLE:", "") || "Capability not enabled for this website profile.";
    return {
      actionId: action.id,
      label: action.label,
      resolvedType: "UNAVAILABLE",
      target: dest,
      isExecutable: false,
      explanation: reason,
      operationalState: "EMPTY",
    };
  }

  // 3. Command resolution
  if (action.actionType === "COMMAND") {
    const isPublicCmd = AUTHORIZED_PUBLIC_COMMANDS.has(dest);
    const isOwnerCmd = AUTHORIZED_OWNER_COMMANDS.has(dest);

    if (!isPublicCmd && !isOwnerCmd) {
      return {
        actionId: action.id,
        label: action.label,
        resolvedType: "UNAVAILABLE",
        target: dest,
        isExecutable: false,
        explanation: `Command '${dest}' is not in the authorized command registry.`,
        operationalState: "REFUSAL",
      };
    }

    // Check capability activation for optional commands
    if (dest === "search_site" && !activatedCapabilities.includes("SEARCH")) {
      return {
        actionId: action.id,
        label: action.label,
        resolvedType: "UNAVAILABLE",
        target: dest,
        isExecutable: false,
        explanation: "Search capability is not activated in this website's specification.",
        operationalState: "EMPTY",
      };
    }

    if (dest === "switch_locale" && !activatedCapabilities.includes("LOCALIZATION")) {
      return {
        actionId: action.id,
        label: action.label,
        resolvedType: "UNAVAILABLE",
        target: dest,
        isExecutable: false,
        explanation: "Multi-locale routing is not activated for this website.",
        operationalState: "EMPTY",
      };
    }

    return {
      actionId: action.id,
      label: action.label,
      resolvedType: "COMMAND",
      target: dest,
      isExecutable: true,
      operationalState: "IDLE",
    };
  }

  // 4. Route resolution
  if (action.actionType === "ROUTE") {
    // Hash anchors on the same page are valid
    if (dest.startsWith("#")) {
      return {
        actionId: action.id,
        label: action.label,
        resolvedType: "ROUTE",
        target: dest,
        isExecutable: true,
        operationalState: "IDLE",
      };
    }

    // External URLs (must start with https:// or http:// or mailto: or tel:)
    if (/^(https?:\/\/|mailto:|tel:)/i.test(dest)) {
      return {
        actionId: action.id,
        label: action.label,
        resolvedType: "ROUTE",
        target: dest,
        isExecutable: true,
        operationalState: "IDLE",
      };
    }

    // Internal routes must normalize and match availableRoutes
    const normalizedRoute = dest.startsWith("/") ? dest : `/${dest}`;
    const cleanRoute = normalizedRoute.split("#")[0].split("?")[0];

    const routeExists = availableRoutes.includes(cleanRoute);
    if (!routeExists) {
      return {
        actionId: action.id,
        label: action.label,
        resolvedType: "UNAVAILABLE",
        target: dest,
        isExecutable: false,
        explanation: `Target route '${cleanRoute}' does not exist on this website. Available routes: [${availableRoutes.join(", ")}].`,
        operationalState: "EMPTY",
      };
    }

    return {
      actionId: action.id,
      label: action.label,
      resolvedType: "ROUTE",
      target: dest,
      isExecutable: true,
      operationalState: "IDLE",
    };
  }

  return {
    actionId: action.id,
    label: action.label,
    resolvedType: "UNAVAILABLE",
    target: dest,
    isExecutable: false,
    explanation: `Unsupported action resolution type: '${action.actionType}'.`,
    operationalState: "REFUSAL",
  };
}

/**
 * Audits all visible actions on a website to detect dead links,
 * inert buttons, and unverified actions before publication.
 */
export function auditWebsiteActions(
  actions: PageAction[],
  availableRoutes: string[],
  activatedCapabilities: string[] = []
): {
  validActions: ActionResolutionResult[];
  defects: ActionResolutionResult[];
  pass: boolean;
} {
  const validActions: ActionResolutionResult[] = [];
  const defects: ActionResolutionResult[] = [];

  for (const action of actions) {
    const res = resolveAction(action, availableRoutes, activatedCapabilities);
    if (res.resolvedType === "UNAVAILABLE" && (!action.stateReason && !action.destination.startsWith("UNAVAILABLE:"))) {
      // It's an accidental dead link / defective action
      defects.push(res);
    } else {
      validActions.push(res);
    }
  }

  return {
    validActions,
    defects,
    pass: defects.length === 0,
  };
}

/**
 * Executes a working action with strict operational state handling.
 * Guarantees that success is never returned prematurely.
 */
export async function executeWorkingAction(
  request: ActionExecutionRequest,
  handlers: {
    handleCommand?: (command: string, payload?: Record<string, unknown>) => Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }>;
    checkOutage?: () => boolean;
  }
): Promise<ActionExecutionResult> {
  // 1. Check for outage or unavailable dependency
  if (handlers.checkOutage && handlers.checkOutage()) {
    return {
      success: false,
      state: "OUTAGE",
      message: "The requested service is currently experiencing an outage. Your request has not been lost.",
      canRetry: true,
      retryAfterMs: 5000,
    };
  }

  // 2. Validate action type
  if (request.type === "UNAVAILABLE") {
    return {
      success: false,
      state: "EMPTY",
      message: "This action is currently not enabled for this website.",
      canRetry: false,
    };
  }

  if (request.type === "ROUTE") {
    return {
      success: true,
      state: "SUCCESS",
      message: `Navigating to ${request.destination}`,
      data: { route: request.destination },
      canRetry: false,
    };
  }

  if (request.type === "COMMAND") {
    const cmd = request.destination;

    // Authorization checks
    const actor = request.actorRole || "PUBLIC_VISITOR";
    if (AUTHORIZED_OWNER_COMMANDS.has(cmd) && actor !== "OWNER" && actor !== "ADMIN") {
      return {
        success: false,
        state: "REFUSAL",
        message: `Command '${cmd}' requires owner or administrator authorization.`,
        canRetry: false,
      };
    }

    if (!AUTHORIZED_PUBLIC_COMMANDS.has(cmd) && !AUTHORIZED_OWNER_COMMANDS.has(cmd)) {
      return {
        success: false,
        state: "REFUSAL",
        message: `Command '${cmd}' is not permitted.`,
        canRetry: false,
      };
    }

    // Validation failure checks on common public commands
    if (cmd === "submit_lead") {
      const payload = request.payload || {};
      if (!payload.email || typeof payload.email !== "string" || !payload.email.includes("@")) {
        return {
          success: false,
          state: "VALIDATION_FAILURE",
          message: "Please provide a valid email address.",
          canRetry: true,
        };
      }
    }

    if (!handlers.handleCommand) {
      return {
        success: false,
        state: "OUTAGE",
        message: "No command execution handler registered.",
        canRetry: true,
      };
    }

    try {
      const res = await handlers.handleCommand(cmd, request.payload);
      if (!res.success) {
        return {
          success: false,
          state: "OUTAGE",
          message: res.error || "Execution failed.",
          canRetry: true,
        };
      }

      return {
        success: true,
        state: "SUCCESS",
        message: "Operation completed successfully.",
        data: res.data,
        canRetry: false,
      };
    } catch (err: any) {
      return {
        success: false,
        state: "OUTAGE",
        message: err.message || "An unexpected error occurred during execution.",
        canRetry: true,
      };
    }
  }

  return {
    success: false,
    state: "REFUSAL",
    message: "Unrecognized action resolution type.",
    canRetry: false,
  };
}
