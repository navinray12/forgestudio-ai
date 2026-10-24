import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";

// This machine-readable cross-check measures source/test FILE PRESENCE ONLY.
// Runtime behavior, SaaS readiness, external provider delivery, permissions,
// payment completion and production certification require separate live proof.
const items = [
  ["F03-01", "WP-03", "Visual editor", ["frontend/src/pages/editor/WebsiteEditor.tsx"], ["frontend/tests/website-editor/manual-save.test.tsx"], "Editor → save → reload → preview → published URL"],
  ["F03-02", "WP-03", "Global widgets/templates", ["frontend/src/features/global-widget/services/globalWidgetService.ts", "backend/src/services/template.service.ts"], ["frontend/tests/global-widget-service.test.ts"], "Cross-site component reuse and publishing parity"],
  ["F03-03", "WP-03", "Versioned concurrent save", ["backend/src/services/websites/save-document.ts"], ["frontend/tests/website-editor/editor-history.test.tsx"], "Conflicting browser edits never silently overwrite"],
  ["F04-01", "WP-04", "CMS", ["backend/src/services/cms/contentLifecycle.service.ts"], ["backend/src/tests/custom-post-type-cms.integration.test.ts"], "Public list/detail/SEO, verified on live domain"],
  ["F04-02", "WP-04", "Public forms/leads", ["backend/src/services/form/form.service.ts", "backend/src/services/form/formDeliveryPolicy.service.ts"], ["backend/src/tests/wp04-real-form-delivery.integration.test.ts"], "Visitor submit → lead → provider → owner notification"],
  ["F04-03", "WP-04", "Media/object storage", ["backend/src/modules/data-platform/storage/upload-presigner.service.ts"], ["backend/src/tests/wp04-confirm-upload-authorization.test.ts"], "S3/CDN object upload → signed/public delivery → restore"],
  ["F04-04", "WP-04", "Website kits/templates", ["backend/src/modules/design-system/projectTemplate.service.ts"], ["frontend/tests/wp03-template-service.test.ts"], "Preview/apply pages and assets then publish"],
  ["F05-01", "WP-05", "Publishing/release", ["backend/src/services/publishing.service.ts"], ["backend/src/tests/phase4-publishing.test.ts"], "Immutable public deployment, rollback and health"],
  ["F05-02", "WP-05", "Domains/TLS", ["backend/src/services/domains/customDomain.service.ts"], ["backend/src/tests/phase2-domains-server-sftp.test.ts"], "DNS validation/HTTPS issuance and renewal"],
  ["F05-03", "WP-05", "Hosted artifacts", ["backend/src/routes/hosted.routes.ts"], ["backend/src/tests/phase2-hosted-route-access.test.ts"], "Safe immutable deployment resolver (currently quarantined)"],
  ["F06-01", "WP-06", "AI design generation", ["backend/src/modules/ai/design/converter.ts"], ["backend/src/tests/ai-design-integration.test.ts"], "Real provider/job/proposal/edit/publish"],
  ["F06-02", "WP-06", "AI quotas", ["backend/src/modules/ai/ai-quota.ts"], ["backend/src/tests/ai-platform-capabilities.test.ts"], "Abuse limits and provider cost budget"],
  ["F07-01", "WP-07", "Identity/OTP", ["backend/src/modules/identity/application/local-authentication.ts"], ["backend/src/tests/identity-security.test.ts"], "Real browser signup → OTP → workspace"],
  ["F07-02", "WP-07", "Billing/entitlements", ["backend/src/modules/billing/billing.service.ts"], ["backend/src/tests/licensing-billing.test.ts"], "Real signed payment + webhook + plan changes"],
  ["F07-03", "WP-07", "Workspace onboarding", ["backend/src/modules/identity/application/account-sessions.ts"], ["backend/src/tests/workspace-integration.test.ts"], "First website and entitlement provisioning"],
  ["F08-01", "WP-08", "WordPress publish", ["backend/src/services/wordpress/connector/publishing.ts"], ["backend/src/tests/wordpress-publish-f495.test.ts"], "Live sandbox WordPress publish/rollback"],
  ["F08-02", "WP-08", "Connector credentials/egress", ["backend/src/platform/integrations/connector-credentials.ts"], ["backend/src/tests/regression/safe-egress-address.test.ts"], "Sandbox provider contract and revoke"],
  ["F08-03", "WP-08", "MCP/extensions", ["backend/src/modules/ai/mcp/mcpRegistry.service.ts"], ["backend/src/tests/regression/mcp-egress.test.ts"], "External execution/network trust and isolation"],
  ["F09-01", "WP-09", "SLO/monitoring", ["backend/src/services/monitoring.service.ts"], ["backend/src/tests/point48-acceptance-register-metrics.test.ts"], "Production metrics alert and incident receipt"],
  ["F09-02", "WP-09", "Backups/recovery", ["backend/src/modules/data-platform/database/database-backup.service.ts"], ["backend/src/tests/wp02-backup-integrity.test.ts"], "Real backup/restore with measured RPO/RTO"],
  ["F09-03", "WP-09", "Release/audit operations", ["backend/src/services/releaseIntegrity/mandatoryReleaseGates.service.ts"], ["backend/src/tests/point18-security-audit.test.ts"], "Incident and immutable audit/release exercises"],
  ["F10-01", "WP-10", "Behavior-preserving extraction", ["backend/src/controllers/project.controller.ts", "backend/src/controllers/project/shared.ts"], ["backend/src/tests/regression/project-authz-user-id.test.ts"], "Route/import coverage and no regression"],
  ["F10-02", "WP-10", "Performance and worker queues", ["backend/src/services/sitePerformance.service.ts", "backend/src/modules/runtime-platform/queues/taskQueue.service.ts"], ["backend/src/tests/ai-worker-smoke.test.ts"], "Load, queue and Web Vitals budgets"],
];

const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const features = items.map(([id, scope, feature, sources, tests, releaseAcceptance]) => {
  const foundSources = sources.filter(existsSync);
  const foundTests = tests.filter(existsSync);
  return {
    id, scope, feature, declaredSources: sources, foundSources,
    declaredTestSources: tests, foundTestSources: foundTests,
    inventoryStatus: foundSources.length === 0 ? "SOURCE_NOT_FOUND" :
      foundTests.length === 0 ? "SOURCE_PRESENT_NO_NAMED_TEST" : "SOURCE_AND_NAMED_TEST_PRESENT",
    productionAcceptance: "NOT_VERIFIED",
    releaseAcceptance,
  };
});

const report = {
  kind: "forgestudio-saas-feature-source-crosscheck-v1",
  commit, generatedFrom: "tracked-repository-files",
  limitation: "File presence != executable route, successful journey or production readiness",
  sourceAndTestPresent: features.filter(f => f.inventoryStatus === "SOURCE_AND_NAMED_TEST_PRESENT").length,
  sourceOnly: features.filter(f => f.inventoryStatus === "SOURCE_PRESENT_NO_NAMED_TEST").length,
  sourceNotFound: features.filter(f => f.inventoryStatus === "SOURCE_NOT_FOUND").length,
  productionAccepted: 0,
  features,
};
if (features.some(f => f.inventoryStatus === "SOURCE_NOT_FOUND")) {
  process.stderr.write("Feature audit found missing declared sources; inspect JSON report.\n");
}
const output = process.argv[2] ?? "saas-feature-crosscheck.json";
writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
process.stdout.write(JSON.stringify({commit, features: features.length,
  namedTestEvidence: report.sourceAndTestPresent, sourceOnly: report.sourceOnly,
  sourceNotFound: report.sourceNotFound, productionAccepted: 0, output}, null, 2) + "\n");
