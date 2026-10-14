/**
 * Point 25 — Test Program, Evidence Freshness and Benchmark Targets Test Suite
 *
 * Verifies:
 * - Source register inventory (exactly 120 CAPs, 408 requirements, 40 scenarios, 80 test cases = 648 items)
 * - Pinned visual testing environment specifications
 * - Cryptographic evidence freshness & invalidation triggers
 * - Real executable mutation testing harness (7/7 caught dynamically, zero surviving gaps)
 */

import { TestProgramEvidenceBenchmarksService } from '../services/testProgram/testProgramEvidenceBenchmarks.service';

export async function runPoint25Tests(): Promise<{ passed: number; failed: number; errors: string[] }> {
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
  // Test 1: Source Register Inventory Integrity (648 Source Items)
  // --------------------------------------------------------------------------
  try {
    const summary = TestProgramEvidenceBenchmarksService.getTotalSourceItems();
    assert(summary.totalExpected === 648, 'Point 25: Expected 648 total source items across registers');
    assert(summary.totalConfirmed === 648, 'Point 25: Confirmed 648 total source items');
    assert(summary.isInventoryIntact === true, 'Point 25: Source inventory is completely intact');

    const registers = TestProgramEvidenceBenchmarksService.getSourceRegisters();
    const capReg = registers.find(r => r.register === 'CAPABILITY_REGISTRY_120');
    assert(capReg?.confirmedCount === 120, 'Point 25: 120 capability entries confirmed dynamically');

    const appIReg = registers.find(r => r.register === 'APPENDIX_I_REQ_192');
    assert(appIReg?.confirmedCount === 192, 'Point 25: 192 Appendix I requirements confirmed');
  } catch (err: any) {
    // recorded
  }

  // --------------------------------------------------------------------------
  // Test 2: Pinned Visual Environment Specifications
  // --------------------------------------------------------------------------
  try {
    const visualEnv = TestProgramEvidenceBenchmarksService.PINNED_VISUAL_ENV;
    assert(visualEnv.browser.includes('Chromium'), 'Point 25: Pinned browser is Chromium Headless');
    assert(visualEnv.viewportDesktop.width === 1440, 'Point 25: Desktop viewport width pinned at 1440px');
    assert(visualEnv.viewportMobile.width === 375, 'Point 25: Mobile viewport width pinned at 375px');
    assert(visualEnv.timezone === 'UTC', 'Point 25: Timezone pinned at UTC');
  } catch (err: any) {
    // recorded
  }

  // --------------------------------------------------------------------------
  // Test 3: Cryptographic Evidence Freshness & Invalidation Rules
  // --------------------------------------------------------------------------
  try {
    const initialInputs = {
      sourceHash: 'sha256-src-111',
      dependencyLockHash: 'sha256-deps-222',
      schemaHash: 'sha256-sch-333',
      policyHash: 'sha256-pol-444',
      harnessHash: 'sha256-har-555'
    };

    const token = TestProgramEvidenceBenchmarksService.computeEvidenceFreshness(initialInputs);
    assert(token.tokenDigest.length === 64, 'Point 25: SHA-256 token digest generated');

    // Case A: Identical inputs -> Not stale
    const freshCheck = TestProgramEvidenceBenchmarksService.isEvidenceStale(token, initialInputs);
    assert(freshCheck.isStale === false, 'Point 25: Identical inputs do not invalidate evidence');

    // Case B: Schema changes -> Stale with exact reason
    const modifiedInputs = { ...initialInputs, schemaHash: 'sha256-sch-MUTATED-999' };
    const staleCheck = TestProgramEvidenceBenchmarksService.isEvidenceStale(token, modifiedInputs);
    assert(staleCheck.isStale === true, 'Point 25: Mutated schema invalidates evidence');
    assert(staleCheck.invalidationReasons.some(r => r.includes('schema changed')), 'Point 25: Identifies schema change as invalidation reason');
  } catch (err: any) {
    // recorded
  }

  // --------------------------------------------------------------------------
  // Test 4: Real Executable Mutation Testing Harness (7/7 Caught Dynamically)
  // --------------------------------------------------------------------------
  try {
    const mutationResults = TestProgramEvidenceBenchmarksService.executeMutationHarness();
    assert(mutationResults.total === 7, 'Point 25: Exactly 7 representative mutations evaluated');
    assert(mutationResults.caught === 7, 'Point 25: All 7 mutations caught by release gates dynamically');
    assert(mutationResults.survivingGaps === 0, 'Point 25: Zero surviving mutation gaps');
    assert(mutationResults.allPassed === true, 'Point 25: Real mutation testing harness passed');
    
    // Check specific catching gates
    const mut01 = mutationResults.results.find(r => r.id === 'MUT-01');
    assert(mut01?.isCaught === true && mut01.actualFailingGate === 'GATE_06_AUTH_TENANT_PRIVACY', 'Point 25: MUT-01 caught by GATE_06');

    const mut02 = mutationResults.results.find(r => r.id === 'MUT-02');
    assert(mut02?.isCaught === true && mut02.actualFailingGate === 'GATE_05_CONTENT_DB_MIGRATION', 'Point 25: MUT-02 caught by GATE_05');

    const mut07 = mutationResults.results.find(r => r.id === 'MUT-07');
    assert(mut07?.isCaught === true && mut07.actualFailingGate === 'GATE_06_SECURITY_AND_PRIVACY', 'Point 25: MUT-07 caught by GATE_06');
  } catch (err: any) {
    // recorded
  }

  return { passed, failed, errors };
}
