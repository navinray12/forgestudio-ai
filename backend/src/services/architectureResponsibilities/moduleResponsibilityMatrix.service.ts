/**
 * Point 22 — Module Responsibility Matrix Service
 *
 * Implements the authoritative mapping between current repository paths
 * and target architectural modules, detailing data ownership, caller graphs,
 * extraction necessity, and compatibility adapters.
 */

export interface ModuleResponsibilityEntry {
  targetPath: string;
  category: 'FRONTEND_FEATURE' | 'BACKEND_MODULE' | 'BACKEND_SERVICE' | 'SHARED_PACKAGE' | 'WORKER' | 'INFRA_AND_TESTS';
  currentPath: string;
  authoritativeDataOwner: string;
  activeCallers: string[];
  extractionNecessity: 'IMMEDIATE_JUSTIFIED' | 'INCREMENTAL_ADAPTER' | 'RETAIN_CURRENT_STABLE';
  migrationStatus: 'ALIGNED' | 'ADAPTER_ACTIVE' | 'PLANNED_WP';
  riskAndRollbackStrategy: string;
}

export class ModuleResponsibilityMatrixService {
  private static readonly MATRIX: ModuleResponsibilityEntry[] = [
    // --- Frontend Features ---
    {
      targetPath: 'frontend/src/features/site-brief/',
      category: 'FRONTEND_FEATURE',
      currentPath: 'frontend/src/features/projects/SiteBrief.tsx',
      authoritativeDataOwner: 'Project/SiteSpec (Prisma Website/Project)',
      activeCallers: ['ProjectWizard', 'DashboardLayout'],
      extractionNecessity: 'INCREMENTAL_ADAPTER',
      migrationStatus: 'ADAPTER_ACTIVE',
      riskAndRollbackStrategy: 'Keep re-export in features/projects until all route references update.'
    },
    {
      targetPath: 'frontend/src/features/design-studio/',
      category: 'FRONTEND_FEATURE',
      currentPath: 'frontend/src/features/editor/',
      authoritativeDataOwner: 'Editor Canvas AST & Component Tree',
      activeCallers: ['VisualEditorPage', 'PreviewFrame'],
      extractionNecessity: 'RETAIN_CURRENT_STABLE',
      migrationStatus: 'ALIGNED',
      riskAndRollbackStrategy: 'Stable editor surface; avoid mass refactor without browser regression suite.'
    },
    {
      targetPath: 'frontend/src/features/content-studio/',
      category: 'FRONTEND_FEATURE',
      currentPath: 'frontend/src/features/cms/',
      authoritativeDataOwner: 'Prisma CustomPostType, CustomField, CustomPostEntry',
      activeCallers: ['CmsDashboard', 'CmsEntryEditor'],
      extractionNecessity: 'INCREMENTAL_ADAPTER',
      migrationStatus: 'ALIGNED',
      riskAndRollbackStrategy: 'Preserve API compatibility with ScopedCustomPostTypeService.'
    },
    {
      targetPath: 'frontend/src/features/forms-leads/',
      category: 'FRONTEND_FEATURE',
      currentPath: 'frontend/src/features/leads/',
      authoritativeDataOwner: 'Prisma Lead & FormSubmission',
      activeCallers: ['LeadInboxPage', 'FormBuilder'],
      extractionNecessity: 'RETAIN_CURRENT_STABLE',
      migrationStatus: 'ALIGNED',
      riskAndRollbackStrategy: 'Directly reads point12 durable lead endpoints.'
    },
    {
      targetPath: 'frontend/src/features/release-center/',
      category: 'FRONTEND_FEATURE',
      currentPath: 'frontend/src/features/publishing/',
      authoritativeDataOwner: 'Release Candidate, Deployment Log, Point 17 Ledger',
      activeCallers: ['PublishingModal', 'ReleaseHistory'],
      extractionNecessity: 'INCREMENTAL_ADAPTER',
      migrationStatus: 'ADAPTER_ACTIVE',
      riskAndRollbackStrategy: 'Coordinate with IntegratedPublishingReleaseService.'
    },

    // --- Backend Modules ---
    {
      targetPath: 'backend/src/modules/capabilities/',
      category: 'BACKEND_MODULE',
      currentPath: 'backend/src/services/capabilities/',
      authoritativeDataOwner: 'Capability Registry (Point 05/19)',
      activeCallers: ['CapabilityController', 'ReleasePreflightService'],
      extractionNecessity: 'RETAIN_CURRENT_STABLE',
      migrationStatus: 'ALIGNED',
      riskAndRollbackStrategy: 'In-place facade re-exports.'
    },
    {
      targetPath: 'backend/src/modules/forms-leads/',
      category: 'BACKEND_MODULE',
      currentPath: 'backend/src/services/leads/durableLead.service.ts',
      authoritativeDataOwner: 'Prisma Lead, FormSubmission, LeadAuditLog',
      activeCallers: ['LeadController', 'WebhooksController'],
      extractionNecessity: 'RETAIN_CURRENT_STABLE',
      migrationStatus: 'ALIGNED',
      riskAndRollbackStrategy: 'Authoritative transaction boundary for incoming business leads.'
    },
    {
      targetPath: 'backend/src/modules/release-engine/',
      category: 'BACKEND_MODULE',
      currentPath: 'backend/src/services/publishing/durableReleaseController.service.ts',
      authoritativeDataOwner: 'Release State Machine, Promotion CAS, Verification Digest',
      activeCallers: ['ReleaseController', 'IntegratedPublishingReleaseService'],
      extractionNecessity: 'RETAIN_CURRENT_STABLE',
      migrationStatus: 'ALIGNED',
      riskAndRollbackStrategy: 'Maintains CAS fencing and gate enforcement.'
    },
    {
      targetPath: 'backend/src/modules/measurement/',
      category: 'BACKEND_MODULE',
      currentPath: 'backend/src/services/serviceObjectives/serviceLevelObjectivesRegister.service.ts',
      authoritativeDataOwner: 'SLI Counters, Telemetry Metrics, Latency Samples',
      activeCallers: ['ServiceObjectivesController', 'HealthChecks'],
      extractionNecessity: 'IMMEDIATE_JUSTIFIED',
      migrationStatus: 'ALIGNED',
      riskAndRollbackStrategy: 'Stores metric samples in-memory with periodic outbox persistence.'
    },
    {
      targetPath: 'backend/src/modules/adaptive-infrastructure/',
      category: 'BACKEND_MODULE',
      currentPath: 'backend/src/services/adaptiveInfrastructure/',
      authoritativeDataOwner: 'Infrastructure Profiles, Autoscaler State, Upgrade Plans',
      activeCallers: ['AdaptiveInfrastructureController', 'WorkerPoolManager'],
      extractionNecessity: 'IMMEDIATE_JUSTIFIED',
      migrationStatus: 'ALIGNED',
      riskAndRollbackStrategy: 'Fully additive, backward-compatible profile layer.'
    },

    // --- Shared Packages & Workers ---
    {
      targetPath: 'packages/site-contracts/',
      category: 'SHARED_PACKAGE',
      currentPath: 'backend/src/types/siteSpec.ts',
      authoritativeDataOwner: 'Immutable SiteSpec JSON Schema',
      activeCallers: ['Generator', 'Compiler', 'Editor'],
      extractionNecessity: 'INCREMENTAL_ADAPTER',
      migrationStatus: 'ADAPTER_ACTIVE',
      riskAndRollbackStrategy: 'Types shared via tsconfig paths; monolithic root preserves build speed.'
    },
    {
      targetPath: 'workers/publish/',
      category: 'WORKER',
      currentPath: 'backend/src/services/publishing/durableReleaseController.service.ts',
      authoritativeDataOwner: 'Publication Lease & Execution Logs',
      activeCallers: ['ReleaseEngine', 'QueueConsumer'],
      extractionNecessity: 'RETAIN_CURRENT_STABLE',
      migrationStatus: 'ALIGNED',
      riskAndRollbackStrategy: 'Worker uses transactional leases; safe fallback to synchronous invocation.'
    }
  ];

  public static getMatrix(): ModuleResponsibilityEntry[] {
    return [...this.MATRIX];
  }

  public static getEntry(targetPath: string): ModuleResponsibilityEntry | undefined {
    return this.MATRIX.find(m => m.targetPath === targetPath);
  }

  public static filterByCategory(category: ModuleResponsibilityEntry['category']): ModuleResponsibilityEntry[] {
    return this.MATRIX.filter(m => m.category === category);
  }

  public static summarizeStatus(): { total: number; aligned: number; adapterActive: number; plannedWp: number } {
    const total = this.MATRIX.length;
    const aligned = this.MATRIX.filter(m => m.migrationStatus === 'ALIGNED').length;
    const adapterActive = this.MATRIX.filter(m => m.migrationStatus === 'ADAPTER_ACTIVE').length;
    const plannedWp = this.MATRIX.filter(m => m.migrationStatus === 'PLANNED_WP').length;
    return { total, aligned, adapterActive, plannedWp };
  }
}
