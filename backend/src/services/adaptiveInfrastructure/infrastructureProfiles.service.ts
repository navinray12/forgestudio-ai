/**
 * ForgeStudio Execution Blueprint v2.1 — Point 19: Adaptive Infrastructure and Operating Economics
 * Section 1.2: Versioned Infrastructure Profiles & Migration Planning
 *
 * Rules:
 * 1. Typed, versioned infrastructure profile contract.
 * 2. Supported profiles: NATIVE_DEV, DOCKER_COMPOSE, MANAGED_CONTAINER, KUBERNETES.
 * 3. Migration plan must preflight capabilities, resources, data migration, and cutover/rollback strategy.
 * 4. Production switching requires explicit approval; never automated without readiness checks.
 */

import crypto from "node:crypto";
import { AppError } from "../../utils/app-error.js";

export type InfrastructureProfileType =
  | "NATIVE_DEV"
  | "DOCKER_COMPOSE"
  | "MANAGED_CONTAINER"
  | "KUBERNETES";

export interface InfrastructureProfile {
  profileId: InfrastructureProfileType;
  version: string;
  name: string;
  description: string;
  requiredServices: Array<{ name: string; version: string; optional: boolean }>;
  connectionBudget: {
    maxDbPoolSize: number;
    maxConcurrentWorkers: number;
    maxWebSocketConnections: number;
  };
  resourceBudget: {
    cpuCoresMin: number;
    cpuCoresMax: number;
    memoryMbMin: number;
    memoryMbMax: number;
  };
  networkTrustBoundary: string;
  durabilityGuarantee: string;
  scalingModel: "MANUAL" | "CONTAINER_AUTOSCALE" | "K8S_HPA";
  estimatedMonthlyBaseCostUsd: number;
  qualificationStatus: "QUALIFIED_BASELINE" | "QUALIFIED_PRODUCTION" | "PLANNED_ENTERPRISE";
}

export interface ProfileMigrationPlan {
  planId: string;
  tenantId: string;
  currentProfile: InfrastructureProfileType;
  targetProfile: InfrastructureProfileType;
  compatibilityReport: {
    compatible: boolean;
    breakingDifferences: string[];
    warnings: string[];
  };
  resourceRequirements: Record<string, any>;
  databaseMigrationSteps: string[];
  queueObligationHandling: string;
  cutoverStrategy: "BLUE_GREEN" | "CANARY" | "IN_PLACE_MAINTENANCE";
  rollbackStrategy: string;
  estimatedRecurringCostImpactUsd: number;
  requiredApprovals: string[];
  preflightPassed: boolean;
  createdAt: string;
}

export class InfrastructureProfilesService {
  private static profiles: Record<InfrastructureProfileType, InfrastructureProfile> = {
    NATIVE_DEV: {
      profileId: "NATIVE_DEV",
      version: "1.0.0",
      name: "Native Developer Workstation",
      description: "Direct Node.js execution on host with local SQLite/PostgreSQL.",
      requiredServices: [
        { name: "Node.js", version: ">=20.0.0", optional: false },
        { name: "PostgreSQL or SQLite", version: ">=15.0", optional: false },
      ],
      connectionBudget: { maxDbPoolSize: 10, maxConcurrentWorkers: 2, maxWebSocketConnections: 50 },
      resourceBudget: { cpuCoresMin: 1, cpuCoresMax: 4, memoryMbMin: 512, memoryMbMax: 2048 },
      networkTrustBoundary: "Host Loopback (127.0.0.1)",
      durabilityGuarantee: "Local disk persistence without replication",
      scalingModel: "MANUAL",
      estimatedMonthlyBaseCostUsd: 0,
      qualificationStatus: "QUALIFIED_BASELINE",
    },
    DOCKER_COMPOSE: {
      profileId: "DOCKER_COMPOSE",
      version: "1.0.0",
      name: "Docker Compose Reference Environment",
      description: "Multi-container local deployment with dedicated PostgreSQL, Redis, and MinIO storage.",
      requiredServices: [
        { name: "Docker Engine", version: ">=24.0.0", optional: false },
        { name: "Docker Compose", version: ">=2.20.0", optional: false },
        { name: "PostgreSQL", version: "15-alpine", optional: false },
        { name: "Redis", version: "7-alpine", optional: true },
      ],
      connectionBudget: { maxDbPoolSize: 25, maxConcurrentWorkers: 5, maxWebSocketConnections: 500 },
      resourceBudget: { cpuCoresMin: 2, cpuCoresMax: 8, memoryMbMin: 2048, memoryMbMax: 8192 },
      networkTrustBoundary: "Bridge network with isolated container DNS",
      durabilityGuarantee: "Docker named volumes with host backup scripts",
      scalingModel: "MANUAL",
      estimatedMonthlyBaseCostUsd: 20,
      qualificationStatus: "QUALIFIED_BASELINE",
    },
    MANAGED_CONTAINER: {
      profileId: "MANAGED_CONTAINER",
      version: "1.0.0",
      name: "Managed Container (AWS ECS / GCP Cloud Run)",
      description: "Serverless containerized deployment with managed PostgreSQL (RDS/Cloud SQL) and edge CDN.",
      requiredServices: [
        { name: "Container Runtime", version: "OCI-compliant", optional: false },
        { name: "Managed PostgreSQL", version: "15+", optional: false },
        { name: "Managed Redis", version: "7+", optional: false },
        { name: "Edge CDN", version: "Cloudflare/CloudFront", optional: false },
      ],
      connectionBudget: { maxDbPoolSize: 100, maxConcurrentWorkers: 20, maxWebSocketConnections: 5000 },
      resourceBudget: { cpuCoresMin: 2, cpuCoresMax: 32, memoryMbMin: 4096, memoryMbMax: 65536 },
      networkTrustBoundary: "VPC Private Subnets with restricted security groups & egress NAT",
      durabilityGuarantee: "Multi-AZ synchronous primary-standby database replication",
      scalingModel: "CONTAINER_AUTOSCALE",
      estimatedMonthlyBaseCostUsd: 150,
      qualificationStatus: "QUALIFIED_PRODUCTION",
    },
    KUBERNETES: {
      profileId: "KUBERNETES",
      version: "1.0.0",
      name: "Enterprise Kubernetes Cluster (EKS / GKE)",
      description: "Full orchestrator deployment with Helm charts, HPA autoscaling, ingress controllers, and RabbitMQ/Kafka streaming.",
      requiredServices: [
        { name: "Kubernetes Control Plane", version: ">=1.28", optional: false },
        { name: "High-Availability PostgreSQL Cluster", version: "15+", optional: false },
        { name: "RabbitMQ Cluster Operator", version: ">=3.12", optional: true },
        { name: "Kafka Strimzi Operator", version: ">=0.38", optional: true },
      ],
      connectionBudget: { maxDbPoolSize: 500, maxConcurrentWorkers: 100, maxWebSocketConnections: 50000 },
      resourceBudget: { cpuCoresMin: 8, cpuCoresMax: 256, memoryMbMin: 16384, memoryMbMax: 524288 },
      networkTrustBoundary: "Calico/Cilium network policies, Mutual TLS (mTLS), strict PodSecurity standards",
      durabilityGuarantee: "Multi-Region replication with continuous WAL archiving",
      scalingModel: "K8S_HPA",
      estimatedMonthlyBaseCostUsd: 650,
      qualificationStatus: "PLANNED_ENTERPRISE",
    },
  };

  public static getProfile(type: InfrastructureProfileType): InfrastructureProfile {
    const prof = this.profiles[type];
    if (!prof) throw new AppError(`Unknown infrastructure profile: ${type}`, 400, "INVALID_PROFILE");
    return prof;
  }

  public static getAllProfiles(): InfrastructureProfile[] {
    return Object.values(this.profiles);
  }

  /**
   * Generates a 10-step migration plan between infrastructure profiles.
   */
  public static generateProfileMigrationPlan(
    tenantId: string,
    currentProfile: InfrastructureProfileType,
    targetProfile: InfrastructureProfileType
  ): ProfileMigrationPlan {
    const curr = this.getProfile(currentProfile);
    const target = this.getProfile(targetProfile);

    const breakingDifferences: string[] = [];
    const warnings: string[] = [];

    if (currentProfile === targetProfile) {
      warnings.push("Source and target profiles are identical; no migration required.");
    }

    if (targetProfile === "KUBERNETES" && currentProfile === "NATIVE_DEV") {
      breakingDifferences.push("Direct migration from Native Dev to Kubernetes requires containerization intermediate step.");
    }

    const costDiff = target.estimatedMonthlyBaseCostUsd - curr.estimatedMonthlyBaseCostUsd;

    const plan: ProfileMigrationPlan = {
      planId: `mig_plan_${crypto.randomUUID()}`,
      tenantId,
      currentProfile,
      targetProfile,
      compatibilityReport: {
        compatible: breakingDifferences.length === 0,
        breakingDifferences,
        warnings,
      },
      resourceRequirements: {
        targetCpuRange: `${target.resourceBudget.cpuCoresMin} - ${target.resourceBudget.cpuCoresMax} cores`,
        targetMemoryRange: `${target.resourceBudget.memoryMbMin} - ${target.resourceBudget.memoryMbMax} MB`,
        maxDbPool: target.connectionBudget.maxDbPoolSize,
      },
      databaseMigrationSteps: [
        "1. Create point-in-time snapshot of current PostgreSQL database",
        "2. Run Prisma migration check against target database cluster",
        "3. Verify non-destructive schema compatibility",
        "4. Synchronize WAL replication or export-import dump",
      ],
      queueObligationHandling: "Drain active in-flight worker leases; pause outbox dispatch for 30s during DNS cutover",
      cutoverStrategy: targetProfile === "MANAGED_CONTAINER" || targetProfile === "KUBERNETES" ? "CANARY" : "BLUE_GREEN",
      rollbackStrategy: "Maintain previous infrastructure active in read-only standby for 2 hours post-cutover",
      estimatedRecurringCostImpactUsd: costDiff,
      requiredApprovals: costDiff > 50 ? ["INFRASTRUCTURE_OWNER", "FINANCE_ADMIN"] : ["INFRASTRUCTURE_OWNER"],
      preflightPassed: breakingDifferences.length === 0,
      createdAt: new Date().toISOString(),
    };

    return plan;
  }
}
