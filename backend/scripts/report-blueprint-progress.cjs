/** Planning progress only. This report never authorizes publishing. */
const fs = require('node:fs');
const path = require('node:path');
const file = path.resolve(__dirname, '../../docs/implementation/progress-v2.1.json');
const progress = JSON.parse(fs.readFileSync(file, 'utf8'));
const required = Array.from({ length: 27 }, (_, i) => `WP-${String(i + 1).padStart(2, '0')}`);
const allowed = new Set(['not_assessed', 'in_progress', 'awaiting_verification', 'verified_complete']);
if (progress.schemaVersion !== 1 || !Array.isArray(progress.workPackages) || progress.workPackages.length !== required.length) {
  throw new Error('Progress must retain all 27 blueprint work packages.');
}
const ids = progress.workPackages.map((p) => p.id);
if (new Set(ids).size !== 27 || required.some((id) => !ids.includes(id))) throw new Error('Missing or duplicate work package.');
for (const wp of progress.workPackages) {
  if (!allowed.has(wp.status)) throw new Error(`Unknown status: ${wp.id}`);
  if (wp.status === 'verified_complete' && (!wp.exitEvidence || !wp.reviewedBy || !wp.verifiedAt)) {
    throw new Error(`Full exit evidence and review are required for ${wp.id}.`);
  }
}
const complete = progress.workPackages.filter((p) => p.status === 'verified_complete').length;
const partial = progress.workPackages.filter((p) => p.status === 'in_progress').length;
const unassessed = progress.workPackages.filter((p) => p.status === 'not_assessed').length;
console.log(JSON.stringify({
  blueprint: progress.blueprint,
  metric: 'verified-complete work packages / all 27 work packages; not effort-weighted',
  verifiedComplete: complete, totalWorkPackages: 27,
  verifiedCompletionPercent: Number((complete / 27 * 100).toFixed(2)),
  inProgress: partial, notAssessed: unassessed,
  implementationEstimatePercent: null,
  note: 'Partial changes and passing unit tests do not count as completed work packages. Existing functionality is not assumed absent.',
  latestScopedVerification: progress.latestScopedVerification,
}, null, 2));
