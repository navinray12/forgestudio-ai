/**
 * Point 23 — Work Packages Register Service
 *
 * Implements the dependency-aware Work Package Register (WP-01 through WP-15)
 * maintaining role-based accountability, prerequisite chains, exit evidence,
 * and truthful implementation status across the platform roadmap.
 */

export type WorkPackageStatus = 
  | 'VERIFIED'
  | 'IMPLEMENTED_PARTIALLY_UNVERIFIED'
  | 'PARTIALLY_IMPLEMENTED'
  | 'BLOCKED'
  | 'NOT_STARTED';

export interface WorkPackageEntry {
  id: string; // 'WP-01' to 'WP-15'
  title: string;
  blueprintPoints: string[];
  accountableRole: string;
  implementingRole: string;
  independentReviewer: string;
  prerequisites: string[]; // List of WP IDs
  exitEvidenceRequired: string;
  currentStatus: WorkPackageStatus;
  statusJustification: string;
}

export class WorkPackagesRegisterService {
  private static readonly PACKAGES: WorkPackageEntry[] = [
    {
      id: 'WP-01',
      title: 'Baseline and Traceability',
      blueprintPoints: ['01', '02', '03', '04', '05'],
      accountableRole: 'Principal Architect',
      implementingRole: 'Core Platform Engineer',
      independentReviewer: 'Lead QA Architect',
      prerequisites: [],
      exitEvidenceRequired: 'Caller/data maps, source registers preserved, profiles and decisions documented.',
      currentStatus: 'IMPLEMENTED_PARTIALLY_UNVERIFIED',
      statusJustification: 'Contracts and registers fully implemented; host subprocess restrictions prevent live shell execution.'
    },
    {
      id: 'WP-02',
      title: 'Identity, Policy and Source Protection',
      blueprintPoints: ['02', '06', '11'],
      accountableRole: 'Security Officer',
      implementingRole: 'Backend Security Engineer',
      independentReviewer: 'Compliance Auditor',
      prerequisites: ['WP-01'],
      exitEvidenceRequired: 'Negative tenant tests, protected deletion controls, durable audit, secret boundaries.',
      currentStatus: 'IMPLEMENTED_PARTIALLY_UNVERIFIED',
      statusJustification: 'Tenant isolation and audit ledger in place; non-superuser RLS and container cgroups remain open risks.'
    },
    {
      id: 'WP-03',
      title: 'Contracts and Release Skeleton',
      blueprintPoints: ['06', '07', '08', '17'],
      accountableRole: 'Platform Lead',
      implementingRole: 'Compiler Engineer',
      independentReviewer: 'Release Manager',
      prerequisites: ['WP-01', 'WP-02'],
      exitEvidenceRequired: 'Typed SiteSpec/manifests, immutable candidates, conditional promotion, digest validation.',
      currentStatus: 'IMPLEMENTED_PARTIALLY_UNVERIFIED',
      statusJustification: 'DurableReleaseController and candidate digest hashing complete; sandbox blocks worker subprocess.'
    },
    {
      id: 'WP-04',
      title: 'Component/Compiler Convergence',
      blueprintPoints: ['08', '21'],
      accountableRole: 'Frontend Systems Architect',
      implementingRole: 'UI/Compiler Engineer',
      independentReviewer: 'Design Systems Lead',
      prerequisites: ['WP-03'],
      exitEvidenceRequired: 'Qualified built-ins, exact styling/actions, source preservation fixtures, truthful fallback.',
      currentStatus: 'IMPLEMENTED_PARTIALLY_UNVERIFIED',
      statusJustification: 'UnifiedCompilerNormalizationService wraps unsupported components safely; golden fixtures defined.'
    },
    {
      id: 'WP-05',
      title: 'Automatic CMS and Blog',
      blueprintPoints: ['09', '10', '21'],
      accountableRole: 'Content Systems Lead',
      implementingRole: 'Full Stack Engineer',
      independentReviewer: 'CMS Product Manager',
      prerequisites: ['WP-02', 'WP-03', 'WP-04'],
      exitEvidenceRequired: 'Blank site to working CMS, article schemas, review, scheduled release, non-destructive saves.',
      currentStatus: 'IMPLEMENTED_PARTIALLY_UNVERIFIED',
      statusJustification: 'ScopedCustomPostTypeService remediates P0 deleteMany defect; schema migration planner verified.'
    },
    {
      id: 'WP-06',
      title: 'Forms and Lead Operations',
      blueprintPoints: ['12', '14'],
      accountableRole: 'Business Applications Lead',
      implementingRole: 'Backend Services Engineer',
      independentReviewer: 'Data Privacy Officer',
      prerequisites: ['WP-02', 'WP-05'],
      exitEvidenceRequired: 'Durable capture, idempotency, assignments, outage-safe CRM outbox, staff completion.',
      currentStatus: 'IMPLEMENTED_PARTIALLY_UNVERIFIED',
      statusJustification: 'Transactional lead persistence and outbox retry complete; live third-party webhook verification blocked.'
    },
    {
      id: 'WP-07',
      title: 'Secure Custom Components',
      blueprintPoints: ['08', '21'],
      accountableRole: 'Security Officer',
      implementingRole: 'Frontend Security Engineer',
      independentReviewer: 'AppSec Reviewer',
      prerequisites: ['WP-03', 'WP-04'],
      exitEvidenceRequired: 'Qualified isolation, dependency ownership, behavior tests, sandbox boundary validation.',
      currentStatus: 'PARTIALLY_IMPLEMENTED',
      statusJustification: 'AST validation and sandbox interfaces active; kernel-level container cgroups pending live Docker cluster.'
    },
    {
      id: 'WP-08',
      title: 'Verified Hosting and Export',
      blueprintPoints: ['16', '17', '21'],
      accountableRole: 'Infrastructure Lead',
      implementingRole: 'DevOps / SRE',
      independentReviewer: 'Platform Architect',
      prerequisites: ['WP-03', 'WP-04', 'WP-05', 'WP-06', 'WP-07'],
      exitEvidenceRequired: 'Stage/probe/promote, domains, portable native/Compose install, controlled recovery.',
      currentStatus: 'IMPLEMENTED_PARTIALLY_UNVERIFIED',
      statusJustification: 'Point 16 Destination Matrix & IntegratedPublishingReleaseService enforce preflights and immutable digests.'
    },
    {
      id: 'WP-09',
      title: 'SEO, Offers and Media Evidence',
      blueprintPoints: ['10', '14'],
      accountableRole: 'Growth Platform Lead',
      implementingRole: 'SEO / Marketing Engineer',
      independentReviewer: 'Digital Marketing Director',
      prerequisites: ['WP-05', 'WP-06'],
      exitEvidenceRequired: 'Route/claim/metadata correctness, XML sitemap generation, structured schema markup.',
      currentStatus: 'IMPLEMENTED_PARTIALLY_UNVERIFIED',
      statusJustification: 'SEO schema validators and sitemap generator implemented in Points 10 & 14.'
    },
    {
      id: 'WP-10',
      title: 'Measurement and Context',
      blueprintPoints: ['13', '20'],
      accountableRole: 'Data Privacy Lead',
      implementingRole: 'Analytics Engineer',
      independentReviewer: 'Compliance Auditor',
      prerequisites: ['WP-02', 'WP-06', 'WP-09'],
      exitEvidenceRequired: 'Consent lifecycle, UTM tracking, egress reconciliation, SLI instrumentation counters.',
      currentStatus: 'IMPLEMENTED_PARTIALLY_UNVERIFIED',
      statusJustification: 'SLI counters in ServiceLevelObjectivesRegisterService implemented; live Meta CAPI credentials pending.'
    },
    {
      id: 'WP-11',
      title: 'Experiments and Growth Operations',
      blueprintPoints: ['13'],
      accountableRole: 'Growth Product Manager',
      implementingRole: 'Backend Engineer',
      independentReviewer: 'Data Science Lead',
      prerequisites: ['WP-06', 'WP-10'],
      exitEvidenceRequired: 'Valid experiments, durable workflows, sender suppression, scoring/segments.',
      currentStatus: 'IMPLEMENTED_PARTIALLY_UNVERIFIED',
      statusJustification: 'A/B testing split-allocation service implemented in Point 13.'
    },
    {
      id: 'WP-12',
      title: 'WordPress Local Profile',
      blueprintPoints: ['16'],
      accountableRole: 'Ecosystem Integrations Lead',
      implementingRole: 'WordPress Plugin Engineer',
      independentReviewer: 'Solutions Architect',
      prerequisites: ['WP-02', 'WP-03', 'WP-04', 'WP-05', 'WP-08'],
      exitEvidenceRequired: 'Cloud-disconnected local edit/publish, native identity preservation, compatibility reports.',
      currentStatus: 'PARTIALLY_IMPLEMENTED',
      statusJustification: 'Local export adapter defined in Point 16 destination matrix; full offline sync plugin in roadmap.'
    },
    {
      id: 'WP-13',
      title: 'Agency, Commercial and Scale Profiles',
      blueprintPoints: ['11', '19'],
      accountableRole: 'Enterprise Product Lead',
      implementingRole: 'Platform Infrastructure Engineer',
      independentReviewer: 'SRE Lead',
      prerequisites: ['WP-08', 'WP-11'],
      exitEvidenceRequired: 'Workspace governance, budgets, qualified optional infra (Redis, RabbitMQ, Kafka), tested transfer.',
      currentStatus: 'IMPLEMENTED_PARTIALLY_UNVERIFIED',
      statusJustification: 'Point 19 infrastructure profiles and upgrade workflows fully coded and contract-tested.'
    },
    {
      id: 'WP-14',
      title: 'Migration, Pilot and Independent Assurance',
      blueprintPoints: ['18', '20', '21'],
      accountableRole: 'Head of Quality Assurance',
      implementingRole: 'Verification & Performance Engineer',
      independentReviewer: 'Third-Party Security Firm',
      prerequisites: ['WP-01', 'WP-02', 'WP-03', 'WP-04', 'WP-05', 'WP-06', 'WP-07', 'WP-08', 'WP-09', 'WP-10', 'WP-11', 'WP-12', 'WP-13'],
      exitEvidenceRequired: 'Shadow migrations, representative pilot users, dual-team restore/export, controlled rollout.',
      currentStatus: 'PARTIALLY_IMPLEMENTED',
      statusJustification: 'Synthetic benchmark fixtures and error-budget freeze logic ready; live staging rollout pending approval.'
    },
    {
      id: 'WP-15',
      title: 'Selected Industry Lifecycles',
      blueprintPoints: ['15'],
      accountableRole: 'Vertical Solutions Lead',
      implementingRole: 'Domain Applications Engineer',
      independentReviewer: 'Industry Advisory Board',
      prerequisites: ['WP-05', 'WP-06', 'WP-08'],
      exitEvidenceRequired: 'Complete customer/admin workflows, appointment booking, catalog ordering, currency/tax precision.',
      currentStatus: 'PARTIALLY_IMPLEMENTED',
      statusJustification: 'E-commerce and appointment booking data schemas implemented in Point 15; field pilot testing scheduled.'
    }
  ];

  public static getAllPackages(): WorkPackageEntry[] {
    return [...this.PACKAGES];
  }

  public static getPackage(id: string): WorkPackageEntry | undefined {
    return this.PACKAGES.find(p => p.id === id);
  }

  public static validatePrerequisites(id: string): { satisfied: boolean; missingPrerequisites: string[] } {
    const pkg = this.getPackage(id);
    if (!pkg) throw new Error(`Work package ${id} not found`);

    const missingPrerequisites: string[] = [];
    for (const prereqId of pkg.prerequisites) {
      const prereq = this.getPackage(prereqId);
      if (!prereq || (prereq.currentStatus !== 'VERIFIED' && prereq.currentStatus !== 'IMPLEMENTED_PARTIALLY_UNVERIFIED')) {
        missingPrerequisites.push(prereqId);
      }
    }

    return {
      satisfied: missingPrerequisites.length === 0,
      missingPrerequisites
    };
  }

  public static getSummary(): Record<WorkPackageStatus, number> {
    const counts: Record<WorkPackageStatus, number> = {
      VERIFIED: 0,
      IMPLEMENTED_PARTIALLY_UNVERIFIED: 0,
      PARTIALLY_IMPLEMENTED: 0,
      BLOCKED: 0,
      NOT_STARTED: 0
    };

    for (const p of this.PACKAGES) {
      counts[p.currentStatus] = (counts[p.currentStatus] || 0) + 1;
    }

    return counts;
  }
}
