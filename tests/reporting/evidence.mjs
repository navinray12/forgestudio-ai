/** A passing suite is not evidence that every feature using its test level passed. */
export function featureEvidence(registry, observed = []) {
  return registry.map((feature) => {
    const checks = observed.filter((check) => check.featureId === feature.id && check.commit && check.testId);
    const required = Array.isArray(feature.requiredTests) ? feature.requiredTests : [];
    const complete = required.length > 0 && required.every((id) => checks.some((check) => check.testId === id && check.passed === true));
    return { id: feature.id, module: feature.module, name: feature.name, priority: feature.priority,
      result: checks.some((check) => check.passed === false) ? "FAIL" : complete ? "PASS" : "NOT_VERIFIED",
      evidence: checks, missingTests: required.filter((id) => !checks.some((check) => check.testId === id && check.passed === true)) };
  });
}
export function summarizeSuites(suites) {
  return Object.entries(suites).map(([name, suite]) => ({name,
    passed: suite.passed, failed: suite.failed, checks: suite.results.length,
    status: suite.failed === 0 && suite.results.length > 0 ? "PASS" : "FAIL"}));
}
