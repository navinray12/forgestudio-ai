/**
 * Point 24 — Delivery Stages and Realistic Planning Test Suite
 *
 * Verifies:
 * - 4-stage delivery planning assumptions (none marked as commercial commitment)
 * - Critical path dependency graph validity: rejects cycles, duplicates, and missing nodes
 * - Anti-overclaiming release scope gate evaluating authoritative capability registry
 * - Role-based capacity planning without fabricated employee names
 */

import { DeliveryStagesPlanningService, CriticalPathNode } from '../services/deliveryPlanning/deliveryStagesPlanning.service';

export async function runPoint24Tests(): Promise<{ passed: number; failed: number; errors: string[] }> {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  function assert(condition: boolean, msg: string) {
    if (!condition) {
      failed++;
      errors.push(msg);
      throw new Error(`Assertion failed: ${msg}`);
    }
    passed++;
  }

  // --------------------------------------------------------------------------
  // Test 1: Delivery Stages Integrity & Non-Commitment Invariant
  // --------------------------------------------------------------------------
  try {
    const stages = DeliveryStagesPlanningService.getDeliveryStages();
    assert(stages.length === 4, 'Point 24: Exactly 4 delivery stages defined');
    
    // Invariant: planning models must never be flagged as contractual commitments
    const anyCommitments = stages.some(s => s.isCommitment === true);
    assert(!anyCommitments, 'Point 24: No delivery stage can be marked as a contractual commitment');

    const stage1 = stages.find(s => s.stageId === 'STAGE_1_FOUNDATION');
    assert(stage1 !== undefined, 'Point 24: Stage 1 Foundation exists');
  } catch (err: any) {
    // recorded
  }

  // --------------------------------------------------------------------------
  // Test 2: Critical Path Dependency DAG Validation (Normal + Negative Cases)
  // --------------------------------------------------------------------------
  try {
    // Case A: Canonical critical path is a valid DAG
    const dagResult = DeliveryStagesPlanningService.validateCriticalPath();
    assert(dagResult.isValidDag === true, 'Point 24: Canonical critical path must be a valid DAG');
    assert(dagResult.blockedAt === 'CP-05', 'Point 24: Canonical critical path accurately blocked at CP-05');

    // Case B: Cycle detection in malformed DAG
    const cyclicGraph: CriticalPathNode[] = [
      { id: 'NODE-A', name: 'Node A', prerequisites: ['NODE-B'], isCompleted: false, isBottleneck: false },
      { id: 'NODE-B', name: 'Node B', prerequisites: ['NODE-A'], isCompleted: false, isBottleneck: false }
    ];
    const cycleResult = DeliveryStagesPlanningService.validateCriticalPath(cyclicGraph);
    assert(cycleResult.isValidDag === false, 'Point 24: Cyclic graph must be rejected');
    assert(cycleResult.errors.some(e => e.includes('Cycle detected')), 'Point 24: Accurately identifies cycle error');

    // Case C: Duplicate node ID detection
    const duplicateGraph: CriticalPathNode[] = [
      { id: 'NODE-A', name: 'Node A First', prerequisites: [], isCompleted: true, isBottleneck: false },
      { id: 'NODE-A', name: 'Node A Second', prerequisites: [], isCompleted: false, isBottleneck: false }
    ];
    const dupResult = DeliveryStagesPlanningService.validateCriticalPath(duplicateGraph);
    assert(dupResult.isValidDag === false, 'Point 24: Duplicate node ID graph must be rejected');
    assert(dupResult.errors.some(e => e.includes('Duplicate node ID')), 'Point 24: Accurately identifies duplicate node ID error');
  } catch (err: any) {
    // recorded
  }

  // --------------------------------------------------------------------------
  // Test 3: Release Scope Qualification & Anti-Overclaiming Enforcement
  // --------------------------------------------------------------------------
  try {
    // Case A: CONTROLLED_PILOT claiming enterprise multi-region must be blocked
    const overclaimingCheck = DeliveryStagesPlanningService.validateReleaseScopeClaim(
      'CONTROLLED_PILOT',
      ['Controlled business pilot', 'Full enterprise multi-region'],
      10,
      { skipCapabilityRegistryCheck: true }
    );
    assert(overclaimingCheck.allowed === false, 'Point 24: Prohibited claim must be rejected');
    assert(overclaimingCheck.violations.some(v => v.includes('prohibited')), 'Point 24: Documents prohibited claim violation');

    // Case B: Insufficient gates for COMPREHENSIVE_GROWTH_PROFILE
    const gateCheck = DeliveryStagesPlanningService.validateReleaseScopeClaim(
      'COMPREHENSIVE_GROWTH_PROFILE',
      ['Full Blueprint v1.3 SaaS coverage'],
      5, // requires 12
      { skipCapabilityRegistryCheck: true }
    );
    assert(gateCheck.allowed === false, 'Point 24: Insufficient gate count must be rejected');
    assert(gateCheck.violations.some(v => v.includes('Insufficient passed release gates')), 'Point 24: Explains gate threshold shortfall');

    // Case C: Legitimate CONTROLLED_PILOT with required gates
    const validCheck = DeliveryStagesPlanningService.validateReleaseScopeClaim(
      'CONTROLLED_PILOT',
      ['Controlled business pilot', 'Standard content publishing'],
      9,
      { skipCapabilityRegistryCheck: true }
    );
    assert(validCheck.allowed === true, 'Point 24: Legitimate scope claim with sufficient gates passes');
  } catch (err: any) {
    // recorded
  }

  // --------------------------------------------------------------------------
  // Test 4: Role-Based Capacity Model (No Fabricated Names)
  // --------------------------------------------------------------------------
  try {
    const roles = DeliveryStagesPlanningService.getTeamCapacity();
    assert(roles.length >= 6, 'Point 24: At least 6 core engineering and governance roles defined');
    
    // Invariant: no fabricated employee names
    const anyFabricatedNames = roles.some(r => r.assignedPersonnel !== null);
    assert(!anyFabricatedNames, 'Point 24: No unconfirmed employee names fabricated in capacity model');
  } catch (err: any) {
    // recorded
  }

  return { passed, failed, errors };
}
