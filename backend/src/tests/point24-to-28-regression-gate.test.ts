/**
 * Cross-Point Regression Gate: Points 24, 25, 26, 27, and 28
 *
 * Coordinates execution of:
 * - Point 24: Delivery Stages & Realistic Planning (DAG validation, anti-overclaiming)
 * - Point 25: Test Program, Evidence Freshness & Benchmarks (648 source items, mutations)
 * - Point 26: Commercial Operations & Support (commerce isolation, transfer rollback)
 * - Point 27: Migration & Existing-Customer Protection (snapshots, shadow generation)
 * - Point 28: Decision Register & Launch Risks (D-01..D-12, 10 release blocking risks)
 */

import { runPoint24Tests } from './point24-delivery-stages.test';
import { runPoint25Tests } from './point25-test-program-benchmarks.test';
import { runPoint26Tests } from './point26-commercial-agency-support.test';
import { runPoint27Tests } from './point27-migration-customer-protection.test';
import { runPoint28Tests } from './point28-decision-register-risks.test';

export interface GateSuiteResult {
  suite: string;
  passed: number;
  failed: number;
  errors: string[];
}

export interface MasterGateReport {
  timestamp: string;
  suites: GateSuiteResult[];
  totalPassed: number;
  totalFailed: number;
  overallStatus: 'PASSED' | 'FAILED';
}

export async function runPoints24To28RegressionGate(): Promise<MasterGateReport> {
  const suites: GateSuiteResult[] = [];

  // Suite 1: Point 24 Tests
  const res24 = await runPoint24Tests();
  suites.push({
    suite: 'Point 24 — Delivery Stages & Realistic Planning',
    passed: res24.passed,
    failed: res24.failed,
    errors: res24.errors
  });

  // Suite 2: Point 25 Tests
  const res25 = await runPoint25Tests();
  suites.push({
    suite: 'Point 25 — Test Program & Benchmark Targets',
    passed: res25.passed,
    failed: res25.failed,
    errors: res25.errors
  });

  // Suite 3: Point 26 Tests
  const res26 = await runPoint26Tests();
  suites.push({
    suite: 'Point 26 — Commercial Operations & Agency Support',
    passed: res26.passed,
    failed: res26.failed,
    errors: res26.errors
  });

  // Suite 4: Point 27 Tests
  const res27 = await runPoint27Tests();
  suites.push({
    suite: 'Point 27 — Migration & Existing-Customer Protection',
    passed: res27.passed,
    failed: res27.failed,
    errors: res27.errors
  });

  // Suite 5: Point 28 Tests
  const res28 = await runPoint28Tests();
  suites.push({
    suite: 'Point 28 — Decision Register & Risk Controls',
    passed: res28.passed,
    failed: res28.failed,
    errors: res28.errors
  });

  const totalPassed = suites.reduce((sum, s) => sum + s.passed, 0);
  const totalFailed = suites.reduce((sum, s) => sum + s.failed, 0);

  return {
    timestamp: new Date().toISOString(),
    suites,
    totalPassed,
    totalFailed,
    overallStatus: totalFailed === 0 ? 'PASSED' : 'FAILED'
  };
}
