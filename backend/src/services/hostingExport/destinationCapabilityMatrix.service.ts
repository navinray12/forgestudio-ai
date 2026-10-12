/**
 * ForgeStudio Execution Blueprint v2.1 — Point 16: Hosting, Export and WordPress Compatibility
 * Section 2.1: Hosting Profile and Destination Capability Contract
 *
 * Rules:
 * 1. Separates customer hosting decisions from internal infrastructure complexity.
 * 2. Versioned destination capability matrix explicitly declares support for:
 *    PLANNING, PREFLIGHT, STAGING, VERIFICATION, PROMOTION, ROLLBACK.
 * 3. Returns precise limitation reports rather than pretending unsupported features succeeded.
 * 4. Discloses required credentials, external services, costs, limits, nonportable dependencies, and rollback options.
 */

import { AppError } from "../../utils/app-error.js";

export type DestinationStage = "PLANNING" | "PREFLIGHT" | "STAGING" | "VERIFICATION" | "PROMOTION" | "ROLLBACK";

export type HostingDestinationType =
  | "MANAGED_DECLARATIVE"
  | "MANAGED_CUSTOM_RUNTIME"
  | "PORTABLE_FULL_STACK"
  | "STATIC_SNAPSHOT"
  | "WORDPRESS_LOCAL"
  | "LIMITED_SFTP";

export interface DestinationCapability {
  destinationType: HostingDestinationType;
  supportedStages: DestinationStage[];
  supportsServerSideExecution: boolean;
  supportsDatabaseMigrations: boolean;
  supportsAtomicSwitching: boolean;
  supportsHealthProbes: boolean;
  supportsInstantRollback: boolean;
  supportsDynamicFormsCms: boolean;
  requiredCustomerCredentials: string[];
  requiredExternalServices: string[];
  estimatedCostTier: "FREE" | "LOW" | "STANDARD" | "HIGH";
  nonportableDependencies: string[];
  operationalResponsibilities: string[];
}

export class DestinationCapabilityMatrixService {
  private static matrix: Record<HostingDestinationType, DestinationCapability> = {
    MANAGED_DECLARATIVE: {
      destinationType: "MANAGED_DECLARATIVE",
      supportedStages: ["PLANNING", "PREFLIGHT", "STAGING", "VERIFICATION", "PROMOTION", "ROLLBACK"],
      supportsServerSideExecution: false,
      supportsDatabaseMigrations: true,
      supportsAtomicSwitching: true,
      supportsHealthProbes: true,
      supportsInstantRollback: true,
      supportsDynamicFormsCms: true,
      requiredCustomerCredentials: ["FORGE_PLATFORM_AUTH"],
      requiredExternalServices: ["FORGE_EDGE_CDN"],
      estimatedCostTier: "LOW",
      nonportableDependencies: [],
      operationalResponsibilities: ["Domain DNS pointing to Edge CDN"],
    },
    MANAGED_CUSTOM_RUNTIME: {
      destinationType: "MANAGED_CUSTOM_RUNTIME",
      supportedStages: ["PLANNING", "PREFLIGHT", "STAGING", "VERIFICATION", "PROMOTION", "ROLLBACK"],
      supportsServerSideExecution: true,
      supportsDatabaseMigrations: true,
      supportsAtomicSwitching: true,
      supportsHealthProbes: true,
      supportsInstantRollback: true,
      supportsDynamicFormsCms: true,
      requiredCustomerCredentials: ["FORGE_PLATFORM_AUTH", "ISOLATED_CONTAINER_KEY"],
      requiredExternalServices: ["CONTAINER_REGISTRY", "POSTGRESQL"],
      estimatedCostTier: "STANDARD",
      nonportableDependencies: ["Linux gVisor/cgroups runtime container"],
      operationalResponsibilities: ["Container resource allocation", "DB connection limits"],
    },
    PORTABLE_FULL_STACK: {
      destinationType: "PORTABLE_FULL_STACK",
      supportedStages: ["PLANNING", "PREFLIGHT", "STAGING", "VERIFICATION", "PROMOTION", "ROLLBACK"],
      supportsServerSideExecution: true,
      supportsDatabaseMigrations: true,
      supportsAtomicSwitching: true,
      supportsHealthProbes: true,
      supportsInstantRollback: true,
      supportsDynamicFormsCms: true,
      requiredCustomerCredentials: ["DOCKER_HOST_OR_VPS_SSH", "POSTGRES_USER"],
      requiredExternalServices: ["DOCKER_ENGINE", "NODE_20", "POSTGRESQL_15"],
      estimatedCostTier: "STANDARD",
      nonportableDependencies: ["Docker Engine / Node.js 20+ host"],
      operationalResponsibilities: ["Self-managed database backups", "Server OS patching", "SSL renewal"],
    },
    STATIC_SNAPSHOT: {
      destinationType: "STATIC_SNAPSHOT",
      supportedStages: ["PLANNING", "PREFLIGHT", "VERIFICATION", "PROMOTION"], // No staging or automated rollback on basic static bucket
      supportsServerSideExecution: false,
      supportsDatabaseMigrations: false,
      supportsAtomicSwitching: false,
      supportsHealthProbes: true,
      supportsInstantRollback: false,
      supportsDynamicFormsCms: false, // Disclosed clearly!
      requiredCustomerCredentials: ["S3_BUCKET_KEY_OR_FTP"],
      requiredExternalServices: ["ANY_STATIC_WEB_SERVER"],
      estimatedCostTier: "FREE",
      nonportableDependencies: ["Static HTML/CSS/JS only; dynamic lead capture requires external webhook"],
      operationalResponsibilities: ["Web server configuration", "Custom forms endpoints"],
    },
    WORDPRESS_LOCAL: {
      destinationType: "WORDPRESS_LOCAL",
      supportedStages: ["PLANNING", "PREFLIGHT", "STAGING", "VERIFICATION", "PROMOTION", "ROLLBACK"],
      supportsServerSideExecution: true,
      supportsDatabaseMigrations: true,
      supportsAtomicSwitching: true,
      supportsHealthProbes: true,
      supportsInstantRollback: true,
      supportsDynamicFormsCms: true,
      requiredCustomerCredentials: ["WORDPRESS_APP_PASSWORD_OR_TOKEN"],
      requiredExternalServices: ["PHP_8_1", "MYSQL_OR_MARIADB", "WORDPRESS_CORE"],
      estimatedCostTier: "LOW",
      nonportableDependencies: ["WordPress PHP runtime & companion plugin"],
      operationalResponsibilities: ["WordPress updates", "Plugin compatibility", "MySQL backups"],
    },
    LIMITED_SFTP: {
      destinationType: "LIMITED_SFTP",
      supportedStages: ["PLANNING", "PREFLIGHT", "VERIFICATION", "PROMOTION"], // No automated atomic rollback
      supportsServerSideExecution: false,
      supportsDatabaseMigrations: false,
      supportsAtomicSwitching: false,
      supportsHealthProbes: true,
      supportsInstantRollback: false,
      supportsDynamicFormsCms: false,
      requiredCustomerCredentials: ["SFTP_HOST", "SFTP_USER", "SFTP_PASSWORD_OR_KEY"],
      requiredExternalServices: ["SFTP_SERVER"],
      estimatedCostTier: "LOW",
      nonportableDependencies: ["Plain file transfer; no native container or DB migration runner"],
      operationalResponsibilities: ["Manual backup before upload", "File permission management"],
    },
  };

  /**
   * Retrieves capabilities for a selected destination.
   */
  public static getDestinationCapability(type: HostingDestinationType): DestinationCapability {
    const cap = this.matrix[type];
    if (!cap) throw new AppError(`Unknown hosting destination type: ${type}`, 400, "INVALID_DESTINATION");
    return cap;
  }

  /**
   * Generates a comprehensive wizard report explaining credentials, costs, and limitations.
   */
  public static generateHostingWizardReport(type: HostingDestinationType): {
    destination: DestinationCapability;
    compatibilityNotice: string;
    unsupportedFeatures: string[];
  } {
    const cap = this.getDestinationCapability(type);
    const unsupportedFeatures: string[] = [];

    if (!cap.supportsServerSideExecution) unsupportedFeatures.push("Custom server-side runtime scripts");
    if (!cap.supportsDatabaseMigrations) unsupportedFeatures.push("Automated Postgres database migrations");
    if (!cap.supportsAtomicSwitching) unsupportedFeatures.push("Zero-downtime atomic deployment switching");
    if (!cap.supportsInstantRollback) unsupportedFeatures.push("One-click instantaneous rollback");
    if (!cap.supportsDynamicFormsCms) unsupportedFeatures.push("Native dynamic CMS forms backend");

    let notice = `Hosting Profile [${type}] configured.`;
    if (unsupportedFeatures.length > 0) {
      notice += ` Warning: ${unsupportedFeatures.length} features are not supported natively by this destination.`;
    }

    return {
      destination: cap,
      compatibilityNotice: notice,
      unsupportedFeatures,
    };
  }
}
