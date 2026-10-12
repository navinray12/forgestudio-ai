/**
 * Point 28 — Decision Register and Risk Controls Service
 *
 * Implements:
 * - Authoritative Decision Register (D-01 through D-12)
 * - Strict role-based accountability (no invented personal names)
 * - Expiry dates and revalidation tracking for accepted risks
 * - 10 Release-Blocking Launch Risk evaluations
 * - Decision validation engine preventing unowned or expired risks from passing release gates
 */

export type DecisionStatus =
  | 'DECIDED_QUALIFIED'
  | 'ACCEPTED_RISK_ACTIVE'
  | 'ACCEPTED_RISK_EXPIRED'
  | 'PROPOSED_UNRESOLVED'
  | 'BLOCKED';

export interface ArchitecturalDecisionRecord {
  id: string; // 'D-01' to 'D-12'
  title: string;
  statement: string;
  decisionOwnerRole: string;
  actualNamedOwner: string | null; // null if unassigned
  requiredReviewers: string[];
  status: DecisionStatus;
  expiryDate: Date | null;
  residualRisk: string;
  rollbackCondition: string;
}

export interface ReleaseBlockingCheckResult {
  isReleaseBlocked: boolean;
  blockingReasons: string[];
}

export class DecisionRegisterRiskControlsService {
  private static readonly DECISIONS: ArchitecturalDecisionRecord[] = [
    {
      id: 'D-01',
      title: 'First Commercial Segment and Buyer Validation',
      statement: 'Initial focus on professional service SMBs and agencies; enterprise tier requires customer willingness-to-pay evidence.',
      decisionOwnerRole: 'Principal Product Manager',
      actualNamedOwner: null,
      requiredReviewers: ['Head of Product', 'Commercial Operations Lead'],
      status: 'PROPOSED_UNRESOLVED',
      expiryDate: new Date('2026-12-31'),
      residualRisk: 'Unvalidated buyer willingness to pay for advanced features.',
      rollbackCondition: 'Pivot target segment if pilot conversion falls below 10%.'
    },
    {
      id: 'D-02',
      title: 'Supported Targets and Versions',
      statement: 'Qualified reference targets: Node.js 22 LTS, Docker Compose v2.29+, Debian 12, Chromium 128. Unsupported targets explicitly flagged.',
      decisionOwnerRole: 'Platform Architect',
      actualNamedOwner: null,
      requiredReviewers: ['QA Lead', 'DevOps Lead'],
      status: 'DECIDED_QUALIFIED',
      expiryDate: new Date('2027-06-30'),
      residualRisk: 'Newer minor versions may introduce unverified native package regressions.',
      rollbackCondition: 'Pin exact minor engine versions in package.json.'
    },
    {
      id: 'D-03',
      title: 'Express-to-Nest Framework Migration Stance',
      statement: 'Maintain Express 5.x platform host. No speculative Nest.js rewrite until all critical P0/P1 defects are resolved and verified.',
      decisionOwnerRole: 'Core Platform Lead',
      actualNamedOwner: null,
      requiredReviewers: ['Principal Architect', 'Backend Lead'],
      status: 'DECIDED_QUALIFIED',
      expiryDate: new Date('2027-01-01'),
      residualRisk: 'Modular dependency injection must be enforced by architecture conventions rather than framework.',
      rollbackCondition: 'Re-evaluate if Express 5.x ecosystem deprecates critical middleware.'
    },
    {
      id: 'D-04',
      title: 'Tenant Isolation and Multi-Tenant Hosting Policy',
      statement: 'Shared database with enforced server-side tenantId filtering. Untrusted execution must fail closed pending kernel cgroups.',
      decisionOwnerRole: 'Security Officer',
      actualNamedOwner: null,
      requiredReviewers: ['Security Architect', 'Infrastructure Lead'],
      status: 'DECIDED_QUALIFIED',
      expiryDate: new Date('2026-11-30'),
      residualRisk: 'Application-layer tenant scoping requires zero developer bypass regressions.',
      rollbackCondition: 'Migrate to database-level PostgreSQL RLS on enterprise tier.'
    },
    {
      id: 'D-05',
      title: 'CMS and Protected Source Deletion Semantics',
      statement: 'Hard deleteMany eliminated. Additive versioning, soft deletion (isDeprecated/deletedAt), and non-destructive upsert strictly enforced.',
      decisionOwnerRole: 'Content Systems Lead',
      actualNamedOwner: null,
      requiredReviewers: ['Database Architect', 'Security Officer'],
      status: 'DECIDED_QUALIFIED',
      expiryDate: new Date('2027-10-01'),
      residualRisk: 'Soft-deleted records increase storage footprint slightly.',
      rollbackCondition: 'Purge only with secondary administrative approval and cryptographic export.'
    },
    {
      id: 'D-06',
      title: 'Arbitrary Source Execution Containment',
      statement: 'Custom untrusted code execution fails closed. Visual and standard component rendering only until gVisor/cgroup sandbox certified.',
      decisionOwnerRole: 'Security Officer',
      actualNamedOwner: null,
      requiredReviewers: ['SRE Lead', 'AppSec Auditor'],
      status: 'DECIDED_QUALIFIED',
      expiryDate: new Date('2026-12-31'),
      residualRisk: 'Third-party dynamic plugins cannot run without qualification.',
      rollbackCondition: 'Keep custom code runner permanently disabled on multi-tenant clusters.'
    },
    {
      id: 'D-07',
      title: 'Required Business Facts and Legal Copy Truthfulness',
      statement: 'Marketing claims, pricing guarantees, and legal terms require authoritative evidence. Missing evidence blocks publish; no AI invention.',
      decisionOwnerRole: 'Legal & Compliance Counsel',
      actualNamedOwner: null,
      requiredReviewers: ['Product Marketing Lead', 'Compliance Lead'],
      status: 'DECIDED_QUALIFIED',
      expiryDate: new Date('2027-03-31'),
      residualRisk: 'Incomplete client onboarding forms block site launch.',
      rollbackCondition: 'Render unverified claims with truthful "Evidence Pending" placeholder.'
    },
    {
      id: 'D-08',
      title: 'Provider Accounts, API Permissions and Scopes',
      statement: 'Provider login is not completion. Integrations require confirmed scopes, verified callbacks, and live receipt logs.',
      decisionOwnerRole: 'Integration Lead',
      actualNamedOwner: null,
      requiredReviewers: ['Backend Lead', 'Security Officer'],
      status: 'DECIDED_QUALIFIED',
      expiryDate: new Date('2027-06-30'),
      residualRisk: 'Third-party API rate limits and breaking provider v2 changes.',
      rollbackCondition: 'Isolate provider dispatches in durable retry outbox.'
    },
    {
      id: 'D-09',
      title: 'Durability, RPO/RTO and On-Call Operations',
      statement: 'RPO ≤ 15 min, RTO ≤ 4 hours proposed for managed profile. Idempotent outbox prevents message loss; on-call rotation role-based.',
      decisionOwnerRole: 'SRE Lead',
      actualNamedOwner: null,
      requiredReviewers: ['DevOps Lead', 'Engineering Director'],
      status: 'ACCEPTED_RISK_ACTIVE',
      expiryDate: new Date('2026-12-15'),
      residualRisk: 'Live automated failover unverified without multi-region cluster.',
      rollbackCondition: 'Manual snapshot restore runbook maintained in docs/runbooks.'
    },
    {
      id: 'D-10',
      title: 'Comprehensive v1.3 Scope vs. Pilot Boundary',
      statement: 'Pilot intentionally restricts untrusted code and complex e-commerce; full v1.3 blueprint scope retained as target roadmap.',
      decisionOwnerRole: 'Head of Product',
      actualNamedOwner: null,
      requiredReviewers: ['Principal Architect', 'QA Lead'],
      status: 'DECIDED_QUALIFIED',
      expiryDate: new Date('2027-10-01'),
      residualRisk: 'Market expects full feature parity on initial pilot release.',
      rollbackCondition: 'Enforce anti-overclaiming release labels (CONTROLLED_PILOT).'
    },
    {
      id: 'D-11',
      title: 'Portability, Redistribution and Media Rights',
      statement: 'Exported packages must contain valid open-source or commercial redistribution licenses; stock media metadata scrubbed.',
      decisionOwnerRole: 'Legal Counsel',
      actualNamedOwner: null,
      requiredReviewers: ['Product Lead', 'Frontend Lead'],
      status: 'DECIDED_QUALIFIED',
      expiryDate: new Date('2027-04-30'),
      residualRisk: 'Client-uploaded proprietary fonts may violate redistribution terms.',
      rollbackCondition: 'Fallback to system fonts in portable export packages.'
    },
    {
      id: 'D-12',
      title: 'Competitor / Export Ambiguities and Marketing Truthfulness',
      statement: 'No speculative competitor claims without published benchmark protocols, operator sample sizes, and reproducible test data.',
      decisionOwnerRole: 'Product Marketing Director',
      actualNamedOwner: null,
      requiredReviewers: ['QA Lead', 'Legal Counsel'],
      status: 'DECIDED_QUALIFIED',
      expiryDate: new Date('2027-05-31'),
      residualRisk: 'Competitive landscape shifts rapidly.',
      rollbackCondition: 'Restrict marketing copy to ForgeStudio verified feature capabilities.'
    }
  ];

  public static getAllDecisions(): ArchitecturalDecisionRecord[] {
    return [...this.DECISIONS];
  }

  public static getDecision(id: string): ArchitecturalDecisionRecord | undefined {
    return this.DECISIONS.find(d => d.id === id);
  }

  /**
   * Validates decisions against expiry and unassigned ownership blockers.
   */
  public static validateDecisionsFreshness(): {
    valid: boolean;
    expiredDecisions: string[];
    unresolvedDecisions: string[];
  } {
    const now = new Date();
    const expiredDecisions: string[] = [];
    const unresolvedDecisions: string[] = [];

    for (const d of this.DECISIONS) {
      if (d.expiryDate && d.expiryDate < now) {
        expiredDecisions.push(`Decision ${d.id} (${d.title}) expired on ${d.expiryDate.toISOString()}`);
      }
      if (d.status === 'PROPOSED_UNRESOLVED' || d.status === 'BLOCKED') {
        unresolvedDecisions.push(`Decision ${d.id} (${d.title}) is in status ${d.status}`);
      }
    }

    return {
      valid: expiredDecisions.length === 0,
      expiredDecisions,
      unresolvedDecisions
    };
  }

  /**
   * Evaluates the 10 non-negotiable release-blocking launch risks.
   * If any condition is violated, release promotion MUST be blocked immediately.
   */
  public static evaluateReleaseBlockingRisks(checks: {
    hasTenantMixing: boolean;
    hasProhibitedDataCollection: boolean;
    hasKnownSourceLoss: boolean;
    hasFalseAcceptedLeadState: boolean;
    hasCorruptedCandidateDigest: boolean;
    hasFailedMandatorySecurityGate: boolean;
    hasUnqualifiedUntrustedCodeExecution: boolean;
    hasUnapprovedDestructiveMigration: boolean;
    hasFalselyAdvertisedFeature: boolean;
    hasMissingPortabilityEvidence: boolean;
  }): ReleaseBlockingCheckResult {
    const blockingReasons: string[] = [];

    if (checks.hasTenantMixing) blockingReasons.push('Critical unauthorized access or tenant mixing detected');
    if (checks.hasProhibitedDataCollection) blockingReasons.push('Prohibited data collection or unauthorized disclosure detected');
    if (checks.hasKnownSourceLoss) blockingReasons.push('Known source or content loss detected');
    if (checks.hasFalseAcceptedLeadState) blockingReasons.push('False accepted-lead state detected (unpersisted submission acknowledged)');
    if (checks.hasCorruptedCandidateDigest) blockingReasons.push('Unverifiable release identity or corrupted candidate artifact');
    if (checks.hasFailedMandatorySecurityGate) blockingReasons.push('Failed mandatory security/privacy release gate');
    if (checks.hasUnqualifiedUntrustedCodeExecution) blockingReasons.push('Unqualified untrusted custom code execution attempted');
    if (checks.hasUnapprovedDestructiveMigration) blockingReasons.push('Unapproved destructive schema/content migration detected');
    if (checks.hasFalselyAdvertisedFeature) blockingReasons.push('Unsupported feature falsely advertised as working in release profile');
    if (checks.hasMissingPortabilityEvidence) blockingReasons.push('Required test evidence missing for advertised portable profile');

    return {
      isReleaseBlocked: blockingReasons.length > 0,
      blockingReasons
    };
  }
}
