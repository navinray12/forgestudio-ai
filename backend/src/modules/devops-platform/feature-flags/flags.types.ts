/**
 * ForgeStudio Module 56: Feature Flags & Remote Configuration Types
 */

export type FeatureFlagType = "BOOLEAN" | "STRING" | "NUMBER" | "JSON";
export type ConfigValueType = "STRING" | "NUMBER" | "BOOLEAN" | "JSON";

export interface TargetingRule {
  attribute: string;
  operator: "equals" | "not_equals" | "contains" | "in" | "greater_than" | "less_than";
  value: any;
  serveValue: any;
}

export interface FeatureFlagRecord {
  id: string;
  projectId: string;
  key: string;
  name: string;
  description?: string;
  type: FeatureFlagType;
  defaultValue: any;
  environmentOverrides: Record<string, any>;
  rolloutPercentage: number;
  targetingRules: TargetingRule[];
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RemoteConfigRecord {
  id: string;
  projectId: string;
  key: string;
  value: any;
  valueType: ConfigValueType;
  description?: string;
  environment: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface EvaluationContext {
  userId?: string;
  environment?: string;
  attributes?: Record<string, any>;
}

export interface FlagEvaluationResult {
  key: string;
  value: any;
  isEnabled: boolean;
  reason: "DEFAULT" | "DISABLED" | "ENV_OVERRIDE" | "TARGETING_RULE" | "PERCENTAGE_ROLLOUT";
}
