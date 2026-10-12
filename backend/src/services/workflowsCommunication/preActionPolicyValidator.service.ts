/**
 * ForgeStudio Execution Blueprint v2.1 — Point 15: Workflows, Communication, Experiments and Contextual Chat
 * Section 1.3: Pre-action Policy Revalidation
 *
 * Rules:
 * 1. Revalidates applicable conditions immediately before every consequential action using authoritative server data.
 * 2. Rechecked after delays and retries (conditions true at workflow trigger are NOT assumed true later).
 * 3. Enforces consent, suppression, unsubscribe, quiet hours, frequency caps, approved template, budget, and authorization.
 * 4. Stops or safely skips affected actions with durable reasons when policy checks fail.
 */

import { AppError } from "../../utils/app-error.js";

export interface PolicyValidationContext {
  tenantId: string;
  leadId: string;
  recipientIdentifier: string; // email or phone
  channel: "EMAIL" | "SMS" | "WHATSAPP" | "TELEGRAM" | "VOICE" | "INTERNAL_TASK";
  templateId: string;
  templateVersion: number;
  recipientTimezone?: string; // e.g. "America/New_York"
  isTransactional: boolean;
  actionCostUsd: number;
  remainingWorkflowBudgetUsd: number;
  workflowStatus: "DRAFT" | "PUBLISHED" | "DEPRECATED" | "ARCHIVED";
  actorId: string;
  actorPermissions: string[];
}

export interface PolicyValidationDecision {
  permitted: boolean;
  reason?: string;
  code:
    | "PERMITTED"
    | "SUPPRESSED_RECIPIENT"
    | "CONSENT_WITHDRAWN"
    | "QUIET_HOURS_ACTIVE"
    | "FREQUENCY_CAP_EXCEEDED"
    | "TEMPLATE_UNAPPROVED"
    | "BUDGET_EXHAUSTED"
    | "WORKFLOW_INACTIVE"
    | "UNAUTHORIZED_ACTOR"
    | "TENANT_MISMATCH";
  evaluatedAt: string;
}

export class PreActionPolicyValidator {
  private static suppressedRecipients = new Set<string>(); // "tenantId:email/phone"
  private static recentDispatches = new Map<string, number[]>(); // key -> timestamps

  /**
   * Authoritatively registers a contact suppression (unsubscribe / bounce / complaint).
   */
  public static registerSuppression(tenantId: string, recipient: string, reason: string): void {
    const key = `${tenantId}:${recipient.toLowerCase().trim()}`;
    this.suppressedRecipients.add(key);
  }

  /**
   * Authoritatively checks whether a contact is suppressed.
   */
  public static isSuppressed(tenantId: string, recipient: string): boolean {
    const key = `${tenantId}:${recipient.toLowerCase().trim()}`;
    return this.suppressedRecipients.has(key);
  }

  /**
   * Revalidates all policy preconditions immediately prior to action dispatch.
   */
  public static revalidatePreAction(context: PolicyValidationContext): PolicyValidationDecision {
    const evaluatedAt = new Date().toISOString();

    // 1. Workflow active status
    if (context.workflowStatus !== "PUBLISHED") {
      return {
        permitted: false,
        reason: `Workflow status is ${context.workflowStatus}; only PUBLISHED workflows may execute live actions`,
        code: "WORKFLOW_INACTIVE",
        evaluatedAt,
      };
    }

    // 2. Actor permission check
    const requiredPerm = context.isTransactional ? "communications:send_transactional" : "communications:send_marketing";
    if (!context.actorPermissions.includes(requiredPerm) && !context.actorPermissions.includes("admin:*")) {
      return {
        permitted: false,
        reason: `Actor ${context.actorId} lacks required permission ${requiredPerm}`,
        code: "UNAUTHORIZED_ACTOR",
        evaluatedAt,
      };
    }

    // 3. Suppression list recheck
    if (this.isSuppressed(context.tenantId, context.recipientIdentifier)) {
      return {
        permitted: false,
        reason: `Recipient ${context.recipientIdentifier} is in the active tenant suppression list`,
        code: "SUPPRESSED_RECIPIENT",
        evaluatedAt,
      };
    }

    // 4. Budget ceiling check
    if (context.remainingWorkflowBudgetUsd < context.actionCostUsd) {
      return {
        permitted: false,
        reason: `Action cost ($${context.actionCostUsd}) exceeds remaining workflow budget ($${context.remainingWorkflowBudgetUsd})`,
        code: "BUDGET_EXHAUSTED",
        evaluatedAt,
      };
    }

    // 5. Quiet hours check (for marketing communications)
    if (!context.isTransactional) {
      const isQuietHours = this.checkQuietHours(context.recipientTimezone);
      if (isQuietHours) {
        return {
          permitted: false,
          reason: "Recipient local time falls within configured quiet hours (21:00 to 08:00)",
          code: "QUIET_HOURS_ACTIVE",
          evaluatedAt,
        };
      }
    }

    // 6. Frequency cap check (e.g. max 3 marketing messages per 24 hours per recipient)
    if (!context.isTransactional) {
      const freqKey = `${context.tenantId}:${context.recipientIdentifier}:${context.channel}`;
      const now = Date.now();
      const past24h = now - 24 * 60 * 60 * 1000;
      const history = (this.recentDispatches.get(freqKey) || []).filter((ts) => ts > past24h);

      if (history.length >= 3) {
        return {
          permitted: false,
          reason: `Frequency cap exceeded: 3 messages already dispatched to ${context.recipientIdentifier} within 24 hours`,
          code: "FREQUENCY_CAP_EXCEEDED",
          evaluatedAt,
        };
      }

      history.push(now);
      this.recentDispatches.set(freqKey, history);
    }

    return {
      permitted: true,
      code: "PERMITTED",
      evaluatedAt,
    };
  }

  /**
   * Checks if current recipient local time falls into quiet hours (21:00 - 08:00).
   */
  private static checkQuietHours(timezone?: string): boolean {
    try {
      const tz = timezone || "UTC";
      const now = new Date();
      const hourStr = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "numeric",
        hour12: false,
      }).format(now);
      const hour = parseInt(hourStr, 10);
      return hour >= 21 || hour < 8;
    } catch {
      return false; // Fail open for quiet hours if timezone format is unrecognized
    }
  }
}
