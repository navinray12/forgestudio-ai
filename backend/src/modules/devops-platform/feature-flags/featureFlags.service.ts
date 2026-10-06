/**
 * ForgeStudio Module 56: Feature Flags & Remote Configuration Service
 * Multivariate feature toggles, deterministic percentage rollouts,
 * attribute targeting rules, environment overrides, and dynamic remote config.
 */

import crypto from "crypto";
import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";
import { forgeProjectService } from "../../../services/project/forgeProject.service.js";
import {
  FeatureFlagRecord,
  RemoteConfigRecord,
  EvaluationContext,
  FlagEvaluationResult,
  FeatureFlagType,
  ConfigValueType,
  TargetingRule,
} from "./flags.types.js";

const db = prisma as any;

export class FeatureFlagsService {
  /**
   * Helper: Deterministic hash of key + identity for percentage rollouts (0-99)
   */
  private hashBucket(key: string, identifier: string): number {
    const hash = crypto.createHash("md5").update(`${key}:${identifier}`).digest("hex");
    const intVal = parseInt(hash.slice(0, 8), 16);
    return intVal % 100;
  }

  // ------------------------------------------------------------
  // Feature Flags Management
  // ------------------------------------------------------------

  async listFlags(projectId: string): Promise<FeatureFlagRecord[]> {
    await forgeProjectService.getProjectById(projectId);

    return await db.forgeFeatureFlag.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
  }

  async getFlag(projectId: string, key: string): Promise<FeatureFlagRecord> {
    await forgeProjectService.getProjectById(projectId);

    const flag = await db.forgeFeatureFlag.findFirst({
      where: { projectId, key },
    });

    if (!flag) {
      throw new AppError(`Feature flag '${key}' not found`, 404, "NOT_FOUND");
    }

    return flag;
  }

  async createFlag(
    projectId: string,
    input: {
      key: string;
      name: string;
      description?: string;
      type?: FeatureFlagType;
      defaultValue?: any;
      environmentOverrides?: Record<string, any>;
      rolloutPercentage?: number;
      targetingRules?: TargetingRule[];
      isEnabled?: boolean;
    }
  ): Promise<FeatureFlagRecord> {
    await forgeProjectService.getProjectById(projectId);

    const key = input.key.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const existing = await db.forgeFeatureFlag.findFirst({
      where: { projectId, key },
    });

    if (existing) {
      throw new AppError(`Feature flag '${key}' already exists`, 409, "ALREADY_EXISTS");
    }

    const record = await db.forgeFeatureFlag.create({
      data: {
        projectId,
        key,
        name: input.name,
        description: input.description || null,
        type: input.type || "BOOLEAN",
        defaultValue: input.defaultValue !== undefined ? input.defaultValue : false,
        environmentOverrides: input.environmentOverrides || {},
        rolloutPercentage: input.rolloutPercentage !== undefined ? input.rolloutPercentage : 100,
        targetingRules: input.targetingRules || [],
        isEnabled: input.isEnabled !== undefined ? input.isEnabled : true,
      },
    });

    return record;
  }

  async updateFlag(
    projectId: string,
    key: string,
    input: Partial<{
      name: string;
      description: string;
      defaultValue: any;
      environmentOverrides: Record<string, any>;
      rolloutPercentage: number;
      targetingRules: TargetingRule[];
      isEnabled: boolean;
    }>
  ): Promise<FeatureFlagRecord> {
    const existing = await this.getFlag(projectId, key);

    const updated = await db.forgeFeatureFlag.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.defaultValue !== undefined && { defaultValue: input.defaultValue }),
        ...(input.environmentOverrides !== undefined && { environmentOverrides: input.environmentOverrides }),
        ...(input.rolloutPercentage !== undefined && { rolloutPercentage: input.rolloutPercentage }),
        ...(input.targetingRules !== undefined && { targetingRules: input.targetingRules }),
        ...(input.isEnabled !== undefined && { isEnabled: input.isEnabled }),
        updatedAt: new Date(),
      },
    });

    return updated;
  }

  async toggleFlag(
    projectId: string,
    key: string,
    isEnabled: boolean
  ): Promise<FeatureFlagRecord> {
    return await this.updateFlag(projectId, key, { isEnabled });
  }

  async deleteFlag(projectId: string, key: string): Promise<{ success: boolean; key: string }> {
    const existing = await this.getFlag(projectId, key);

    await db.forgeFeatureFlag.delete({
      where: { id: existing.id },
    });

    return { success: true, key };
  }

  // ------------------------------------------------------------
  // Evaluation Engine
  // ------------------------------------------------------------

  evaluateFlag(
    flag: FeatureFlagRecord,
    context: EvaluationContext = {}
  ): FlagEvaluationResult {
    // 1. If disabled, always return defaultValue
    if (!flag.isEnabled) {
      return {
        key: flag.key,
        value: flag.defaultValue,
        isEnabled: false,
        reason: "DISABLED",
      };
    }

    // 2. Check environment overrides
    const env = context.environment || "development";
    if (flag.environmentOverrides && flag.environmentOverrides[env] !== undefined) {
      const overrideVal = flag.environmentOverrides[env];
      return {
        key: flag.key,
        value: overrideVal,
        isEnabled: Boolean(overrideVal),
        reason: "ENV_OVERRIDE",
      };
    }

    // 3. Evaluate targeting rules
    if (flag.targetingRules && flag.targetingRules.length > 0) {
      const attributes = {
        userId: context.userId,
        ...(context.attributes || {}),
      };

      for (const rule of flag.targetingRules) {
        const userVal = attributes[rule.attribute];
        let matches = false;

        switch (rule.operator) {
          case "equals":
            matches = String(userVal) === String(rule.value);
            break;
          case "not_equals":
            matches = String(userVal) !== String(rule.value);
            break;
          case "contains":
            matches = String(userVal || "").includes(String(rule.value));
            break;
          case "in":
            matches = Array.isArray(rule.value)
              ? rule.value.includes(userVal)
              : String(rule.value).split(",").map((s) => s.trim()).includes(String(userVal));
            break;
          case "greater_than":
            matches = Number(userVal) > Number(rule.value);
            break;
          case "less_than":
            matches = Number(userVal) < Number(rule.value);
            break;
        }

        if (matches) {
          return {
            key: flag.key,
            value: rule.serveValue,
            isEnabled: Boolean(rule.serveValue),
            reason: "TARGETING_RULE",
          };
        }
      }
    }

    // 4. Percentage Rollout
    if (flag.rolloutPercentage < 100) {
      const identifier = context.userId || "anonymous";
      const bucket = this.hashBucket(flag.key, identifier);

      if (bucket < flag.rolloutPercentage) {
        return {
          key: flag.key,
          value: flag.defaultValue !== undefined ? flag.defaultValue : true,
          isEnabled: true,
          reason: "PERCENTAGE_ROLLOUT",
        };
      } else {
        return {
          key: flag.key,
          value: flag.type === "BOOLEAN" ? false : flag.defaultValue,
          isEnabled: false,
          reason: "PERCENTAGE_ROLLOUT",
        };
      }
    }

    // 5. Default enabled value
    return {
      key: flag.key,
      value: flag.defaultValue,
      isEnabled: true,
      reason: "DEFAULT",
    };
  }

  async evaluateAllFlags(
    projectId: string,
    context: EvaluationContext = {}
  ): Promise<Record<string, FlagEvaluationResult>> {
    const flags = await this.listFlags(projectId);
    const results: Record<string, FlagEvaluationResult> = {};

    for (const flag of flags) {
      results[flag.key] = this.evaluateFlag(flag, context);
    }

    return results;
  }

  // ------------------------------------------------------------
  // Remote Configuration Management
  // ------------------------------------------------------------

  async listConfigs(
    projectId: string,
    environment?: string
  ): Promise<RemoteConfigRecord[]> {
    await forgeProjectService.getProjectById(projectId);

    const where: any = { projectId };
    if (environment) {
      where.OR = [{ environment }, { environment: "all" }];
    }

    return await db.forgeRemoteConfig.findMany({
      where,
      orderBy: { key: "asc" },
    });
  }

  async getConfig(
    projectId: string,
    key: string,
    environment: string = "all"
  ): Promise<RemoteConfigRecord> {
    await forgeProjectService.getProjectById(projectId);

    const config = await db.forgeRemoteConfig.findFirst({
      where: {
        projectId,
        key,
        OR: [{ environment }, { environment: "all" }],
      },
      orderBy: { environment: "desc" },
    });

    if (!config) {
      throw new AppError(`Remote config key '${key}' not found`, 404, "NOT_FOUND");
    }

    return config;
  }

  async setConfig(
    projectId: string,
    input: {
      key: string;
      value: any;
      valueType?: ConfigValueType;
      description?: string;
      environment?: string;
    }
  ): Promise<RemoteConfigRecord> {
    await forgeProjectService.getProjectById(projectId);

    const key = input.key.trim();
    const env = input.environment || "all";

    const existing = await db.forgeRemoteConfig.findFirst({
      where: { projectId, key, environment: env },
    });

    if (existing) {
      return await db.forgeRemoteConfig.update({
        where: { id: existing.id },
        data: {
          value: input.value,
          valueType: input.valueType || existing.valueType,
          description: input.description ?? existing.description,
          version: existing.version + 1,
          updatedAt: new Date(),
        },
      });
    }

    return await db.forgeRemoteConfig.create({
      data: {
        projectId,
        key,
        value: input.value,
        valueType: input.valueType || "JSON",
        description: input.description || null,
        environment: env,
        version: 1,
      },
    });
  }

  async deleteConfig(
    projectId: string,
    key: string,
    environment: string = "all"
  ): Promise<{ success: boolean; key: string }> {
    const existing = await this.getConfig(projectId, key, environment);

    await db.forgeRemoteConfig.delete({
      where: { id: existing.id },
    });

    return { success: true, key };
  }
}

export const featureFlagsService = new FeatureFlagsService();
