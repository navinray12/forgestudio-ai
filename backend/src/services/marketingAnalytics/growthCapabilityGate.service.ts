import { AppError } from "../../utils/app-error.js";

export interface GrowthActionContext {
  actionType: "COLLECTION" | "AUDIENCE_WRITE" | "CONVERSION_DISPATCH" | "CAMPAIGN_SPEND";
  enabledCapabilities: string[];
  operatorPermissions: string[];
  consentGranted: boolean;
  providerConnected: boolean;
  budgetRemainingUnits: number;
  requiredUnits?: number;
}

/**
 * Gates growth functionality against capability manifest, consent, operator permissions, and budget limits.
 */
export function verifyGrowthActionGate(context: GrowthActionContext): {
  allowed: boolean;
  blockReason?: string;
} {
  const {
    actionType,
    enabledCapabilities,
    operatorPermissions,
    consentGranted,
    providerConnected,
    budgetRemainingUnits,
    requiredUnits = 0,
  } = context;

  // 1. Capability check
  if (!enabledCapabilities.includes("CAP-101") && !enabledCapabilities.includes("CAP-105")) {
    return { allowed: false, blockReason: "Requires active Growth & Lead Generation capability (CAP-101/CAP-105)" };
  }

  // 2. Consent check for behavioral collection / conversion dispatch
  if ((actionType === "COLLECTION" || actionType === "CONVERSION_DISPATCH") && !consentGranted) {
    return { allowed: false, blockReason: "Blocked: Visitor has not granted marketing analytics consent" };
  }

  // 3. Permission checks
  if (actionType === "AUDIENCE_WRITE" && !operatorPermissions.includes("perm:campaigns:manage")) {
    return { allowed: false, blockReason: "Operator lacks 'perm:campaigns:manage' permission" };
  }

  if (actionType === "CAMPAIGN_SPEND" && !operatorPermissions.includes("perm:billing:override")) {
    return { allowed: false, blockReason: "Operator lacks 'perm:billing:override' spending permission" };
  }

  // 4. Provider connection check
  if ((actionType === "CONVERSION_DISPATCH" || actionType === "AUDIENCE_WRITE") && !providerConnected) {
    return { allowed: false, blockReason: "Provider gateway is unconfigured or disconnected" };
  }

  // 5. Budget check
  if (actionType === "CAMPAIGN_SPEND" && budgetRemainingUnits < requiredUnits) {
    return { allowed: false, blockReason: `Insufficient budget units: remaining ${budgetRemainingUnits}, required ${requiredUnits}` };
  }

  return { allowed: true };
}
