/**
 * Cross-Point Regression Gate: Points 19, 20, 21, 22, and 23
 *
 * Coordinates execution of:
 * - Point 19: Adaptive Infrastructure & Operating Economics
 * - Point 20: Service Objectives & Failure Behavior
 * - Point 21: Repository-Specific Remediation Order (P0, P1, P2)
 * - Point 22: Target Repository Responsibilities (Module Responsibility Matrix)
 * - Point 23: Work Packages, Dependencies & Acceptance Owners (WP-01 to WP-15)
 */

import { runPoint19Tests } from './point19-adaptive-infrastructure.test';
import { runPoint20Tests } from './point20-service-objectives.test';
import { runPoint21Tests } from './point21-repository-remediation.test';
import { ModuleResponsibilityMatrixService } from '../services/architectureResponsibilities/moduleResponsibilityMatrix.service';
import { WorkPackagesRegisterService } from '../services/architectureResponsibilities/workPackagesRegister.service';

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

export async function runPoints19To23RegressionGate(): Promise<MasterGateReport> {
  const suites: GateSuiteResult[] = [];

  // Suite 1: Point 19 Tests
  const res19 = await runPoint19Tests();
  suites.push({
    suite: 'Point 19 — Adaptive Infrastructure & Economics',
    passed: res19.passed,
    failed: res19.failed,
    errors: res19.errors
  });

  // Suite 2: Point 20 Tests
  const res20 = await runPoint20Tests();
  suites.push({
    suite: 'Point 20 — Service Objectives & Failure Isolation',
    passed: res20.passed,
    failed: res20.failed,
    errors: res20.errors
  });

  // Suite 3: Point 21 Tests
  const res21 = await runPoint21Tests();
  suites.push({
    suite: 'Point 21 — Repository Remediation Order (P0/P1)',
    passed: res21.passed,
    failed: res21.failed,
    errors: res21.errors
  });

  // Suite 4: Point 22 Module Responsibility Matrix Validation
  let p22Passed = 0;
  let p22Failed = 0;
  const p22Errors: string[] = [];

  try {
    const matrix = ModuleResponsibilityMatrixService.getMatrix();
    if (matrix.length >= 10) p22Passed++;
    else {
      p22Failed++;
      p22Errors.push(`Expected at least 10 module matrix entries, got ${matrix.length}`);
    }

    const summary = ModuleResponsibilityMatrixService.summarizeStatus();
    if (summary.total > 0 && summary.aligned > 0) p22Passed++;
    else {
      p22Failed++;
      p22Errors.push('Summary shows no aligned or total entries in matrix');
    }

    const formsLeadsEntry = ModuleResponsibilityMatrixService.getEntry('backend/src/modules/forms-leads/');
    if (formsLeadsEntry && formsLeadsEntry.authoritativeDataOwner.includes('Lead')) p22Passed++;
    else {
      p22Failed++;
      p22Errors.push('Missing authoritative entry for backend/src/modules/forms-leads/');
    }
  } catch (err: any) {
    p22Failed++;
    p22Errors.push(err.message);
  }

  suites.push({
    suite: 'Point 22 — Target Repository Responsibilities Matrix',
    passed: p22Passed,
    failed: p22Failed,
    errors: p22Errors
  });

  // Suite 5: Point 23 Work Packages Register Validation
  let p23Passed = 0;
  let p23Failed = 0;
  const p23Errors: string[] = [];

  try {
    const packages = WorkPackagesRegisterService.getAllPackages();
    if (packages.length === 15) p23Passed++;
    else {
      p23Failed++;
      p23Errors.push(`Expected 15 work packages (WP-01 to WP-15), got ${packages.length}`);
    }

    // Verify WP-01 has no prerequisites
    const wp01Check = WorkPackagesRegisterService.validatePrerequisites('WP-01');
    if (wp01Check.satisfied) p23Passed++;
    else {
      p23Failed++;
      p23Errors.push('WP-01 should have 0 prerequisites');
    }

    // Verify WP-05 prerequisites
    const wp05 = WorkPackagesRegisterService.getPackage('WP-05');
    if (wp05 && wp05.prerequisites.includes('WP-02') && wp05.prerequisites.includes('WP-04')) p23Passed++;
    else {
      p23Failed++;
      p23Errors.push('WP-05 must declare WP-02 and WP-04 as prerequisites');
    }

    // Verify summary counts
    const summary = WorkPackagesRegisterService.getSummary();
    if (summary.IMPLEMENTED_PARTIALLY_UNVERIFIED > 0) p23Passed++;
    else {
      p23Failed++;
      p23Errors.push('Summary should record IMPLEMENTED_PARTIALLY_UNVERIFIED packages');
    }
  } catch (err: any) {
    p23Failed++;
    p23Errors.push(err.message);
  }

  suites.push({
    suite: 'Point 23 — Work Packages & Accountability Register',
    passed: p23Passed,
    failed: p23Failed,
    errors: p23Errors
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
