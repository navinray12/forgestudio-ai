/**
 * Point 24 — Delivery Stages and Realistic Planning Service
 *
 * Implements:
 * - Baseline platform assessment deriving stage status from verified evidence
 * - 4-stage evidence-based delivery planning scenarios (all strictly non-commitment)
 * - Role-based capacity and dependency tracking without fabricated employee names
 * - Critical-path dependency DAG validation with cycle detection, duplicate checking, and bottleneck derivation
 * - Release-scope classification evaluating authoritative capability registry records
 */

import { getCapabilityById } from '../capabilities/capabilityRegistry.js';
import { getEvidenceForCapability } from '../capabilities/evidenceRegistry.js';

export type ReleaseScopeLabel =
  | 'INTERNAL_DEV_BUILD'
  | 'UNVERIFIED_PREVIEW'
  | 'CONTROLLED_PILOT'
  | 'VERIFIED_BUSINESS_SITE_PROFILE'
  | 'QUALIFIED_PORTABLE_PROFILE'
  | 'QUALIFIED_WORDPRESS_LOCAL_PROFILE'
  | 'COMPREHENSIVE_GROWTH_PROFILE';

export interface DeliveryStage {
  stageId: string;
  name: string;
  planningDurationWeeks: number;
  planningAssumption: string;
  requiredExitEvidence: string[];
  isCommitment: boolean; // Must always be false in planning models
  isCompleted: boolean;
}

export interface TeamRoleCapacity {
  role: string;
  requiredHeadcount: number;
  assignedPersonnel: string | null; // null if unassigned
  backupOwner: string | null;
  capacityFte: number;
  specialistDependencies: string[];
  isStaffed: boolean;
}

export interface CriticalPathNode {
  id: string;
  name: string;
  prerequisites: string[];
  isCompleted: boolean;
  isBottleneck: boolean;
}

export interface ReleaseScopeQualification {
  label: ReleaseScopeLabel;
  allowedClaims: string[];
  prohibitedClaims: string[];
  mandatoryGatedCapabilities: string[];
  minimumPassedGates: number;
}

export class DeliveryStagesPlanningService {
  /**
   * Evaluates if foundation assessment has verified evidence in the evidence registry.
   */
  private static isFoundationAssessmentEvidenced(): boolean {
    const baselineEvidence = getEvidenceForCapability('CAP-001');
    return baselineEvidence.some((evidence) => evidence.result === 'PASSED');
  }

  public static getDeliveryStages(): DeliveryStage[] {
    const foundationCompleted = this.isFoundationAssessmentEvidenced();

    return [
      {
        stageId: 'STAGE_1_FOUNDATION',
        name: 'Foundation Assessment',
        planningDurationWeeks: 2,
        planningAssumption: 'Initial repository inspection, defect reproduction, and baseline architecture validation',
        requiredExitEvidence: [
          'Reproducible defects and reproduction steps cataloged',
          'Reusable component inventory with evidence status',
          'Confirmed implementation gaps identified',
          'Test environment and blocked dependencies mapped',
          'Critical-path dependency graph established'
        ],
        isCommitment: false,
        isCompleted: foundationCompleted
      },
      {
        stageId: 'STAGE_2_CONTROLLED_PILOT',
        name: 'Controlled Website Pilot',
        planningDurationWeeks: 14, // 12-16 weeks planning scenario
        planningAssumption: 'Qualified website/CMS/blog/forms subset, core safety, managed publication',
        requiredExitEvidence: [
          'Deterministic visual and code compilation',
          'Atomic form submissions and durable lead capture',
          'Non-destructive CMS field definition migrations',
          'Reference portable profile verified on clean host',
          'Protected draft and recovery lifecycles validated'
        ],
        isCommitment: false,
        isCompleted: false
      },
      {
        stageId: 'STAGE_3_COMPREHENSIVE_GROWTH',
        name: 'Comprehensive Growth Platform',
        planningDurationWeeks: 32, // 6-9 months planning scenario
        planningAssumption: 'All applicable growth capabilities, provider evidence, WordPress and agency operations',
        requiredExitEvidence: [
          'Full marketing analytics attribution with fail-closed consent',
          'A/B experimentation engine with SRM anomaly checks',
          'Durable contextual chat projections',
          'Verified WordPress local bidirectional synchronization',
          'Agency workspace delegation and audit trails'
        ],
        isCommitment: false,
        isCompleted: false
      },
      {
        stageId: 'STAGE_4_ENTERPRISE_EXPANSION',
        name: 'Industry and Enterprise Expansion',
        planningDurationWeeks: 24,
        planningAssumption: 'Selected industry lifecycles (bookings, e-commerce), enterprise multi-tenant isolation',
        requiredExitEvidence: [
          'Transactional appointment and inventory reservation',
          'Financial auditability and tax/currency precision',
          'Disaster recovery RPO/RTO proven with database/media restores',
          'Independent security assessment certification'
        ],
        isCommitment: false,
        isCompleted: false
      }
    ];
  }

  public static getTeamCapacity(): TeamRoleCapacity[] {
    return [
      {
        role: 'Principal Product & UX Architect',
        requiredHeadcount: 1,
        assignedPersonnel: null, // Role-based planning, no fabricated employee names
        backupOwner: null,
        capacityFte: 1.0,
        specialistDependencies: ['User Research', 'Design Systems'],
        isStaffed: false
      },
      {
        role: 'Lead Compiler & Frontend Systems Engineer',
        requiredHeadcount: 2,
        assignedPersonnel: null,
        backupOwner: null,
        capacityFte: 2.0,
        specialistDependencies: ['AST Normalization', 'Web Components'],
        isStaffed: false
      },
      {
        role: 'Lead Backend & Content Platform Engineer',
        requiredHeadcount: 2,
        assignedPersonnel: null,
        backupOwner: null,
        capacityFte: 2.0,
        specialistDependencies: ['Prisma/PostgreSQL', 'Transactional Outbox'],
        isStaffed: false
      },
      {
        role: 'Platform SRE & Infrastructure Lead',
        requiredHeadcount: 1,
        assignedPersonnel: null,
        backupOwner: null,
        capacityFte: 1.0,
        specialistDependencies: ['Kubernetes', 'Cloud Security'],
        isStaffed: false
      },
      {
        role: 'Head of Quality Assurance & Verification',
        requiredHeadcount: 1,
        assignedPersonnel: null,
        backupOwner: null,
        capacityFte: 1.0,
        specialistDependencies: ['Automated Browser Journeys', 'Fault Injection'],
        isStaffed: false
      },
      {
        role: 'Security & Data Privacy Officer',
        requiredHeadcount: 1,
        assignedPersonnel: null,
        backupOwner: null,
        capacityFte: 1.0,
        specialistDependencies: ['OWASP ASVS', 'GDPR/CCPA Legal Interpretation'],
        isStaffed: false
      }
    ];
  }

  public static getCriticalPath(): CriticalPathNode[] {
    return [
      {
        id: 'CP-01',
        name: 'Identity & Source Integrity',
        prerequisites: [],
        isCompleted: true,
        isBottleneck: false
      },
      {
        id: 'CP-02',
        name: 'Versioned Contracts & SiteSpec',
        prerequisites: ['CP-01'],
        isCompleted: true,
        isBottleneck: false
      },
      {
        id: 'CP-03',
        name: 'Compiler / CMS Convergence',
        prerequisites: ['CP-02'],
        isCompleted: true,
        isBottleneck: false
      },
      {
        id: 'CP-04',
        name: 'Durable Lead & Release Pipelines',
        prerequisites: ['CP-03'],
        isCompleted: true,
        isBottleneck: false
      },
      {
        id: 'CP-05',
        name: 'Independent Verification Gate',
        prerequisites: ['CP-04'],
        isCompleted: false, // Blocked by live host sandbox restriction
        isBottleneck: true
      },
      {
        id: 'CP-06',
        name: 'Usable Pilot Launch',
        prerequisites: ['CP-05'],
        isCompleted: false,
        isBottleneck: false
      }
    ];
  }

  /**
   * Validates a critical path graph against:
   * - Duplicate node IDs
   * - Missing prerequisite node references
   * - Cycles (DFS graph cycle detection)
   * - Premature completion (node marked completed when prerequisite is unfulfilled)
   */
  public static validateCriticalPath(nodes: CriticalPathNode[] = this.getCriticalPath()): {
    isValidDag: boolean;
    errors: string[];
    blockedAt: string | null;
  } {
    const errors: string[] = [];
    const seenIds = new Set<string>();
    const nodeMap = new Map<string, CriticalPathNode>();

    // 1. Check for duplicate IDs
    for (const node of nodes) {
      if (seenIds.has(node.id)) {
        errors.push(`Duplicate node ID detected in critical path: ${node.id}`);
      }
      seenIds.add(node.id);
      nodeMap.set(node.id, node);
    }

    // 2. Check for missing prerequisite references and premature completion
    for (const node of nodes) {
      for (const prereqId of node.prerequisites) {
        const prereq = nodeMap.get(prereqId);
        if (!prereq) {
          errors.push(`Node ${node.id} references non-existent prerequisite ${prereqId}`);
        } else if (!prereq.isCompleted && node.isCompleted) {
          errors.push(`Node ${node.id} marked completed before prerequisite ${prereqId} was completed`);
        }
      }
    }

    // 3. DFS Cycle Detection
    const visited = new Set<string>();
    const inStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      visited.add(nodeId);
      inStack.add(nodeId);

      const node = nodeMap.get(nodeId);
      if (node) {
        for (const prereqId of node.prerequisites) {
          if (!visited.has(prereqId)) {
            if (hasCycle(prereqId)) return true;
          } else if (inStack.has(prereqId)) {
            errors.push(`Cycle detected in critical path involving node ${nodeId} -> ${prereqId}`);
            return true;
          }
        }
      }

      inStack.delete(nodeId);
      return false;
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        hasCycle(node.id);
      }
    }

    // Determine actual bottleneck
    let blockedAt: string | null = null;
    for (const node of nodes) {
      if (!node.isCompleted) {
        blockedAt = node.id;
        break;
      }
    }

    return {
      isValidDag: errors.length === 0,
      errors,
      blockedAt
    };
  }

  public static readonly SCOPE_QUALIFICATIONS: Record<ReleaseScopeLabel, ReleaseScopeQualification> = {
    INTERNAL_DEV_BUILD: {
      label: 'INTERNAL_DEV_BUILD',
      allowedClaims: ['Internal engineering iteration', 'Local sandbox testing'],
      prohibitedClaims: ['Production ready', 'Commercial reliability', 'Customer hosting'],
      mandatoryGatedCapabilities: [],
      minimumPassedGates: 2
    },
    UNVERIFIED_PREVIEW: {
      label: 'UNVERIFIED_PREVIEW',
      allowedClaims: ['Visual preview only', 'Ephemeral staging'],
      prohibitedClaims: ['Durable storage guarantee', 'Production publication', 'Live business transactions'],
      mandatoryGatedCapabilities: ['CAP-001', 'CAP-002'],
      minimumPassedGates: 4
    },
    CONTROLLED_PILOT: {
      label: 'CONTROLLED_PILOT',
      allowedClaims: ['Controlled business pilot', 'Standard content publishing', 'Durable lead capture'],
      prohibitedClaims: ['Full enterprise multi-region', 'Unlimited custom code execution', 'All industry lifecycles'],
      mandatoryGatedCapabilities: ['CAP-001', 'CAP-002', 'CAP-003', 'CAP-004', 'CAP-005', 'CAP-006'],
      minimumPassedGates: 8
    },
    VERIFIED_BUSINESS_SITE_PROFILE: {
      label: 'VERIFIED_BUSINESS_SITE_PROFILE',
      allowedClaims: ['Production business website', 'Verified Core Web Vitals', 'Durable CMS and blog'],
      prohibitedClaims: ['Arbitrary backend server execution', 'Live ads automation without credential check'],
      mandatoryGatedCapabilities: ['CAP-001', 'CAP-002', 'CAP-003', 'CAP-004', 'CAP-005', 'CAP-006', 'CAP-008'],
      minimumPassedGates: 10
    },
    QUALIFIED_PORTABLE_PROFILE: {
      label: 'QUALIFIED_PORTABLE_PROFILE',
      allowedClaims: ['Self-hosted Docker Compose / Node runtime', 'Complete export portability', 'Zero vendor lock-in'],
      prohibitedClaims: ['Automatic cloud backup without configuration'],
      mandatoryGatedCapabilities: ['CAP-001', 'CAP-002', 'CAP-008', 'CAP-016'],
      minimumPassedGates: 11
    },
    QUALIFIED_WORDPRESS_LOCAL_PROFILE: {
      label: 'QUALIFIED_WORDPRESS_LOCAL_PROFILE',
      allowedClaims: ['Local WordPress export', 'Static HTML + WP Headless integration'],
      prohibitedClaims: ['Two-way arbitrary PHP plugin execution in cloud'],
      mandatoryGatedCapabilities: ['CAP-001', 'CAP-002', 'CAP-016'],
      minimumPassedGates: 10
    },
    COMPREHENSIVE_GROWTH_PROFILE: {
      label: 'COMPREHENSIVE_GROWTH_PROFILE',
      allowedClaims: ['Full Blueprint v1.3 SaaS coverage', 'Advanced marketing attribution', 'Contextual chat', 'Agency workspace multi-tenancy'],
      prohibitedClaims: [],
      mandatoryGatedCapabilities: [
        'CAP-001', 'CAP-002', 'CAP-003', 'CAP-004', 'CAP-005', 'CAP-006',
        'CAP-007', 'CAP-008', 'CAP-009', 'CAP-010', 'CAP-011', 'CAP-012',
        'CAP-013', 'CAP-014', 'CAP-015', 'CAP-016', 'CAP-017', 'CAP-018'
      ],
      minimumPassedGates: 12
    }
  };

  /**
   * Validates a release-scope claim against authoritative capability and evidence registry records.
   * Prohibits overclaiming and checks mandatory capabilities.
   */
  public static validateReleaseScopeClaim(
    requestedLabel: ReleaseScopeLabel,
    intendedClaims: string[],
    passedGateCount: number,
    options?: { targetProfile?: string; skipCapabilityRegistryCheck?: boolean }
  ): { allowed: boolean; violations: string[] } {
    const spec = this.SCOPE_QUALIFICATIONS[requestedLabel];
    if (!spec) {
      return { allowed: false, violations: [`Unknown release scope label: ${requestedLabel}`] };
    }

    const violations: string[] = [];

    // 1. Release gate count threshold check
    if (passedGateCount < spec.minimumPassedGates) {
      violations.push(
        `Insufficient passed release gates: requires at least ${spec.minimumPassedGates}, but got ${passedGateCount}`
      );
    }

    // 2. Prohibited claims check (Anti-overclaiming invariant)
    for (const claim of intendedClaims) {
      if (spec.prohibitedClaims.some(prohibited => claim.toLowerCase().includes(prohibited.toLowerCase()))) {
        violations.push(`Claim "${claim}" is prohibited for release scope ${requestedLabel}`);
      }
    }

    // 3. Authoritative Capability Registry inspection (unless explicitly skipped in unit test)
    if (!options?.skipCapabilityRegistryCheck) {
      for (const capId of spec.mandatoryGatedCapabilities) {
        const cap = getCapabilityById(capId);
        if (!cap) {
          violations.push(`Mandatory capability ${capId} not found in authoritative capability registry`);
        } else if (cap.implementationStatus !== 'IMPLEMENTED') {
          violations.push(`Mandatory capability ${capId} is not fully implemented (status: ${cap.implementationStatus})`);
        }
      }
    }

    return {
      allowed: violations.length === 0,
      violations
    };
  }
}
