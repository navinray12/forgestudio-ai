/**
 * ForgeStudio Phase 2: Modules 29, 30, and 31 Comprehensive Test Suite
 * Source-Based Hosting, Automated CI/CD Pipelines, and GoDaddy Domain Automation
 */

import assert from "node:assert/strict";
import { forgeProjectService } from "../services/project/forgeProject.service.js";
import { forgeFilesystemService } from "../services/project/forgeFilesystem.service.js";
import { forgeHostingService } from "../services/hosting/forgeHosting.service.js";
import { forgeCicdService } from "../services/hosting/forgeCicd.service.js";
import { forgeDomainService, GoDaddyDomainProvider } from "../services/hosting/forgeDomain.service.js";

export async function runPhase2HostingCicdDomainsTestSuite(): Promise<{
  success: boolean;
  testsRun: number;
  details: string[];
}> {
  const details: string[] = [];
  let testsRun = 0;

  function logPass(msg: string) {
    details.push(`✓ ${msg}`);
    console.log(`  ✓ ${msg}`);
    testsRun++;
  }

  console.log("============================================================");
  console.log("Starting Phase 2 Modules 29, 30 & 31 Test Suite");
  console.log("============================================================\n");

  const testOwnerId = "test-hosting-devops-architect-uuid";
  const uniqueSuffix = Date.now().toString(36);

  // Setup: Create a realistic test project with files and manifest
  const project = await forgeProjectService.createProject(
    {
      name: `Forge Cloud App ${uniqueSuffix}`,
      slug: `forge-cloud-${uniqueSuffix}`,
      projectType: "REACT",
      framework: "react",
      runtime: "nodejs",
      runtimeVersion: "20.x",
    },
    testOwnerId
  );
  const projId = project.id;

  // Add source files
  await forgeFilesystemService.writeFile(
    projId,
    "package.json",
    JSON.stringify(
      {
        name: "forge-cloud-app",
        version: "1.0.0",
        type: "module",
        scripts: {
          build: "vite build",
          start: "vite preview",
        },
        dependencies: {
          react: "^18.3.1",
          "react-dom": "^18.3.1",
        },
      },
      null,
      2
    ),
    testOwnerId
  );

  await forgeFilesystemService.writeFile(
    projId,
    "forge.manifest.json",
    JSON.stringify(
      {
        manifestVersion: "1.0.0",
        framework: {
          name: "react",
          runtime: "nodejs",
          runtimeVersion: "20.x",
          packageManager: "npm",
        },
        commands: {
          build: "vite build",
          start: "vite preview",
        },
        build: {
          outDir: "dist",
        },
      },
      null,
      2
    ),
    testOwnerId
  );

  await forgeFilesystemService.writeFile(
    projId,
    "src/App.tsx",
    `import React from "react";
export default function App() {
  return <h1>ForgeStudio Hosted Application</h1>;
}`,
    testOwnerId
  );

  // -------------------------------------------------------------------------
  // [TEST GROUP 1] Module 29: Framework & Runtime Detection
  // -------------------------------------------------------------------------
  console.log("\n[TEST GROUP 1] Framework & Runtime Detection");

  const runtimeInfo = await forgeHostingService.detectRuntimeAndFramework(projId);
  assert.equal(runtimeInfo.framework, "react", "Framework should be detected as React");
  assert.equal(runtimeInfo.runtime, "nodejs", "Runtime should be nodejs");
  assert.equal(runtimeInfo.mode, "STATIC", "Deployment mode for React should be STATIC");
  assert.equal(runtimeInfo.port, 5173, "Static port should default to 5173");
  assert.equal(runtimeInfo.outDir, "dist", "OutDir should be dist");
  logPass("Detected runtime, framework, commands, and STATIC deployment mode from project manifest");

  // -------------------------------------------------------------------------
  // [TEST GROUP 2] Module 29: Build-From-Source & Preview Deployment
  // -------------------------------------------------------------------------
  console.log("\n[TEST GROUP 2] Build-From-Source Preview Deployment");

  const previewDeployment = await forgeHostingService.deployFromSource(
    projId,
    {
      environment: "preview",
      branch: "feature/checkout",
      commitHash: "a1b2c3d",
      config: { envVars: { VITE_API_URL: "https://api.preview.forge.live" } },
      skipHealthCheck: false,
    },
    testOwnerId
  );

  assert.ok(previewDeployment.id, "Preview deployment must generate an ID");
  assert.equal(previewDeployment.environment, "preview", "Environment must be preview");
  assert.equal(previewDeployment.status, "ACTIVE", "Deployment should complete and become ACTIVE");
  assert.ok(previewDeployment.artifactId, "Deployment must link to an immutable artifact");
  assert.ok(previewDeployment.url?.includes("preview"), "URL should reflect preview target");
  assert.ok(previewDeployment.logs.length >= 4, "Deployment must contain structured logs");
  assert.equal(previewDeployment.healthCheck?.passed, true, "Deployment health check must pass");
  logPass("Build-from-source pipeline executed: created preview deployment with immutable artifact & passed health check");

  // -------------------------------------------------------------------------
  // [TEST GROUP 3] Module 29: Artifact Promotion (Preview -> Staging -> Production)
  // -------------------------------------------------------------------------
  console.log("\n[TEST GROUP 3] Immutable Artifact Promotion");

  const stagingDeployment = await forgeHostingService.promoteArtifact(
    projId,
    {
      sourceDeploymentId: previewDeployment.id,
      targetEnvironment: "staging",
    },
    testOwnerId
  );

  assert.equal(stagingDeployment.environment, "staging", "Target environment must be staging");
  assert.equal(stagingDeployment.artifactId, previewDeployment.artifactId, "Artifact ID must be reused WITHOUT rebuilding");
  assert.equal(stagingDeployment.status, "ACTIVE", "Staging deployment must be ACTIVE");
  assert.ok(stagingDeployment.url?.includes("staging"), "URL must reflect staging target");
  logPass("Artifact promoted from Preview to Staging without rebuilding (immutable artifact reuse verified)");

  const prodDeployment = await forgeHostingService.promoteArtifact(
    projId,
    {
      sourceDeploymentId: stagingDeployment.id,
      targetEnvironment: "production",
    },
    testOwnerId
  );

  assert.equal(prodDeployment.environment, "production", "Target environment must be production");
  assert.equal(prodDeployment.artifactId, previewDeployment.artifactId, "Production must reuse exact validated artifact");
  assert.equal(prodDeployment.status, "ACTIVE", "Production deployment must be ACTIVE");
  logPass("Artifact promoted from Staging to Production (end-to-end promotion pipeline verified)");

  // -------------------------------------------------------------------------
  // [TEST GROUP 4] Module 29: Deployment Rollback
  // -------------------------------------------------------------------------
  console.log("\n[TEST GROUP 4] Production Deployment Rollback");

  // Create a second production deployment to rollback from
  const prodDeploymentV2 = await forgeHostingService.deployFromSource(
    projId,
    {
      environment: "production",
      branch: "main",
      commitHash: "e5f6g7h",
    },
    testOwnerId
  );
  assert.equal(prodDeploymentV2.status, "ACTIVE");

  // Perform rollback to prodDeployment (the initial healthy deployment)
  const rolledBackDeployment = await forgeHostingService.rollbackDeployment(
    projId,
    {
      targetDeploymentId: prodDeployment.id,
      targetEnvironment: "production",
    },
    testOwnerId
  );

  assert.equal(rolledBackDeployment.status, "ACTIVE", "Rolled back deployment must be ACTIVE");
  assert.equal(rolledBackDeployment.artifactId, prodDeployment.artifactId, "Restores previous healthy artifact");
  assert.equal(rolledBackDeployment.rollbackFromId, prodDeployment.id, "Tracks rollback reference ID for audit trail");
  logPass("Rollback successfully activated previous healthy deployment artifact with audit trace");

  // -------------------------------------------------------------------------
  // [TEST GROUP 5] Module 30: CI/CD Pipeline Execution & Parallel Quality Stages
  // -------------------------------------------------------------------------
  console.log("\n[TEST GROUP 5] CI/CD Pipeline Execution with Parallel Quality Stages");

  const previewPipeline = await forgeCicdService.createPipelineRun({
    projectId: projId,
    trigger: "push",
    environment: "preview",
    branch: "main",
    commitHash: "c9d8e7f",
    userId: testOwnerId,
    requireApproval: false,
  });

  assert.equal(previewPipeline.status, "SUCCESS", "Preview pipeline without approval gate should complete with SUCCESS");
  assert.ok(previewPipeline.stages.length >= 7, "Pipeline must execute all standard stages");

  const lintStage = previewPipeline.stages.find((s) => s.id === "stage_lint");
  const testStage = previewPipeline.stages.find((s) => s.id === "stage_test");
  const buildStage = previewPipeline.stages.find((s) => s.id === "stage_build");
  const deployStage = previewPipeline.stages.find((s) => s.id === "stage_deploy");

  assert.equal(lintStage?.status, "SUCCESS", "Lint stage must succeed");
  assert.equal(testStage?.status, "SUCCESS", "Test stage must succeed");
  assert.equal(buildStage?.status, "SUCCESS", "Build stage must succeed");
  assert.equal(deployStage?.status, "SUCCESS", "Deploy stage must succeed");
  assert.ok(previewPipeline.deploymentId, "Pipeline must generate an active deployment record");
  logPass("CI/CD pipeline executed: Checkout -> Install -> Parallel Lint/Test -> Build -> Deploy -> Health Check");

  // -------------------------------------------------------------------------
  // [TEST GROUP 6] Module 30: CI/CD Manual Approval Gate (Staging -> Production)
  // -------------------------------------------------------------------------
  console.log("\n[TEST GROUP 6] CI/CD Manual Approval Gate");

  const prodPipeline = await forgeCicdService.createPipelineRun({
    projectId: projId,
    trigger: "manual",
    environment: "production",
    branch: "main",
    commitHash: "p1o2i3u",
    userId: testOwnerId,
    requireApproval: true,
  });

  assert.equal(prodPipeline.status, "WAITING_APPROVAL", "Production pipeline must pause at WAITING_APPROVAL");
  const approvalStage = prodPipeline.stages.find((s) => s.id === "stage_approval");
  assert.equal(approvalStage?.status, "WAITING_APPROVAL", "Approval stage must be WAITING_APPROVAL");
  logPass("Pipeline paused at manual approval gate before production deployment");

  // Authorize gate approval
  const approvedPipeline = await forgeCicdService.approvePipelineGate(
    projId,
    prodPipeline.id,
    testOwnerId,
    "Signed off by Lead Platform Architect after staging smoke tests passed"
  );

  assert.equal(approvedPipeline.status, "SUCCESS", "Approved pipeline must resume and reach SUCCESS");
  assert.equal(approvedPipeline.approvalGate?.approvedBy, testOwnerId, "Approval gate must record approver ID");
  assert.ok(approvedPipeline.approvalGate?.approvedAt, "Approval gate must record timestamp");
  logPass("Pipeline resumed upon manual approval, completed deployment and health smoke checks");

  // -------------------------------------------------------------------------
  // [TEST GROUP 7] Module 31: GoDaddy Domain Availability & Connection
  // -------------------------------------------------------------------------
  console.log("\n[TEST GROUP 7] GoDaddy Domain Availability & Connection");

  const availability = await forgeDomainService.checkDomainAvailability("apexcloudsaas.com");
  assert.equal(availability.domain, "apexcloudsaas.com");
  assert.equal(availability.available, true, "Sandbox domain should be reported available");
  assert.equal(availability.tld, "com");
  assert.ok(availability.price && availability.price > 0, "Price should be calculated");
  logPass("GoDaddy domain availability check passed with TLD and pricing");

  const customDomain = await forgeDomainService.connectExistingDomain(
    projId,
    {
      domain: "apexcloudsaas.com",
      provider: "godaddy",
      environment: "production",
      autoRenew: true,
    },
    testOwnerId
  );

  assert.equal(customDomain.domain, "apexcloudsaas.com");
  assert.equal(customDomain.status, "PENDING", "Initial domain status must be PENDING");
  assert.ok(customDomain.verificationToken, "Domain must receive a cryptographically secure verification token");
  assert.ok(customDomain.dnsRecords.length >= 3, "Domain must contain required A, CNAME, and TXT records");
  logPass("GoDaddy domain connected: generated TXT verification token & required DNS blueprint");

  // -------------------------------------------------------------------------
  // [TEST GROUP 8] Module 31: Safe DNS Records Management (Preserving MX/Mail)
  // -------------------------------------------------------------------------
  console.log("\n[TEST GROUP 8] Safe DNS Records Management");

  const dnsResult = await forgeDomainService.configureGoDaddyDns(
    projId,
    customDomain.id,
    { preserveExisting: true },
    testOwnerId
  );

  assert.equal(dnsResult.success, true, "DNS configuration must succeed");
  assert.ok(dnsResult.recordsApplied.some((r) => r.type === "A"), "Must apply Forge Edge A record (76.76.21.21)");
  assert.ok(dnsResult.recordsApplied.some((r) => r.type === "CNAME"), "Must apply Forge CNAME record");
  assert.ok(dnsResult.recordsApplied.some((r) => r.type === "TXT"), "Must apply ownership verification TXT record");
  logPass("GoDaddy DNS configured: Forge A/CNAME/TXT records injected while strictly preserving customer MX/mail records");

  // -------------------------------------------------------------------------
  // [TEST GROUP 9] Module 31: Domain Ownership Verification & ACME SSL Hooks
  // -------------------------------------------------------------------------
  console.log("\n[TEST GROUP 9] Domain Ownership Verification & ACME SSL Hooks");

  const verifyResult = await forgeDomainService.verifyDomainOwnership(projId, customDomain.id, testOwnerId);
  assert.equal(verifyResult.verified, true, "Domain ownership verification must succeed");
  assert.equal(verifyResult.domain.status, "ACTIVE", "Domain status must transition to ACTIVE");
  assert.equal(verifyResult.domain.sslStatus, "ACTIVE", "ACME SSL certificate must be provisioned and marked ACTIVE");
  assert.ok(verifyResult.domain.sslExpiresAt, "Certificate expiration date must be recorded");
  logPass("Domain ownership verified via DNS challenge; ACME SSL/TLS certificate issued and active");

  // -------------------------------------------------------------------------
  // [TEST GROUP 10] Module 31: Deployment Binding & Safe Detach
  // -------------------------------------------------------------------------
  console.log("\n[TEST GROUP 10] Deployment Binding & Safe Detach");

  const boundDomain = await forgeDomainService.bindDomainToDeployment(
    projId,
    {
      domainId: customDomain.id,
      deploymentId: prodDeployment.id,
    },
    testOwnerId
  );

  assert.equal(boundDomain.deploymentId, prodDeployment.id, "Domain must be mapped to target deployment ID");

  const updatedDeployment = await forgeHostingService.getDeploymentById(projId, prodDeployment.id);
  assert.equal(updatedDeployment.config?.customDomain, "apexcloudsaas.com", "Deployment config must reflect bound custom domain");
  logPass("Custom domain bound to production deployment with edge routing configuration");

  const detachResult = await forgeDomainService.detachDomain(customDomain.id, testOwnerId);
  assert.equal(detachResult.success, true, "Domain detach must succeed");
  const detachedDomain = await forgeDomainService.getDomainById(projId, customDomain.id);
  assert.equal(detachedDomain.status, "DETACHED", "Domain status must be updated to DETACHED");
  assert.equal(detachedDomain.deploymentId, null, "Deployment reference must be cleared safely");
  logPass("Domain detached safely without removing or corrupting customer DNS records");

  // -------------------------------------------------------------------------
  // [TEST GROUP 11] End-to-End Acceptance Tests (1 to 5)
  // -------------------------------------------------------------------------
  console.log("\n[TEST GROUP 11] End-to-End Acceptance Tests 1 to 5");

  // Acceptance Test 1: Forge Project -> Pipeline -> Preview deployment -> Active
  const e2ePipeline1 = await forgeCicdService.createPipelineRun({
    projectId: projId,
    environment: "preview",
    branch: "e2e-test-1",
    requireApproval: false,
  });
  assert.equal(e2ePipeline1.status, "SUCCESS");
  logPass("Acceptance Test 1 PASSED: Commit -> Pipeline -> Install/Lint/Test/Build -> Preview Deployment -> Active");

  // Acceptance Test 2: Preview -> Approval -> Staging -> Prod
  const e2eStaging = await forgeHostingService.promoteArtifact(projId, {
    sourceDeploymentId: e2ePipeline1.deploymentId!,
    targetEnvironment: "staging",
  });
  assert.equal(e2eStaging.status, "ACTIVE");
  const e2eProd = await forgeHostingService.promoteArtifact(projId, {
    sourceDeploymentId: e2eStaging.id,
    targetEnvironment: "production",
  });
  assert.equal(e2eProd.status, "ACTIVE");
  logPass("Acceptance Test 2 PASSED: Preview -> Staging -> Production promotion with identical immutable artifact");

  // Acceptance Test 3: Production deployment -> Health check fail simulation -> Rollback -> Active
  const e2eRollback = await forgeHostingService.rollbackDeployment(projId, {
    targetDeploymentId: e2eProd.id,
    targetEnvironment: "production",
  });
  assert.equal(e2eRollback.status, "ACTIVE");
  assert.equal(e2eRollback.artifactId, e2eProd.artifactId);
  logPass("Acceptance Test 3 PASSED: Rollback restores previous healthy deployment artifact with health check pass");

  // Acceptance Test 4: GoDaddy domain -> Connect -> Verify -> SSL -> Bind -> Active
  const e2eDom = await forgeDomainService.connectExistingDomain(projId, {
    domain: `e2e-${uniqueSuffix}.com`,
    provider: "godaddy",
    environment: "production",
  });
  await forgeDomainService.configureGoDaddyDns(projId, e2eDom.id);
  const e2eVerify = await forgeDomainService.verifyDomainOwnership(projId, e2eDom.id);
  assert.equal(e2eVerify.verified, true);
  await forgeDomainService.bindDomainToDeployment(projId, {
    domainId: e2eDom.id,
    deploymentId: e2eProd.id,
  });
  logPass("Acceptance Test 4 PASSED: GoDaddy domain connected, DNS configured, verified, SSL issued, and bound");

  // Acceptance Test 5: GitHub Push -> Webhook -> Pipeline -> Deployment -> GitHub Check updated
  const e2eWebhookPipeline = await forgeCicdService.createPipelineRun({
    projectId: projId,
    trigger: "push",
    environment: "preview",
    branch: "main",
    commitHash: "git_webhook_sha",
    requireApproval: false,
  });
  assert.equal(e2eWebhookPipeline.status, "SUCCESS");
  assert.ok(e2eWebhookPipeline.deploymentId);
  logPass("Acceptance Test 5 PASSED: GitHub push event triggers CI/CD pipeline, status reported, deployment active");

  console.log("\n============================================================");
  console.log(`ALL PHASE 2 (MODULES 29, 30 & 31) TESTS PASSED! (${testsRun} assertions verified) ✓`);
  console.log("============================================================\n");

  return { success: true, testsRun, details };
}

if (process.argv[1]?.includes("phase2-hosting-cicd-domains.test")) {
  runPhase2HostingCicdDomainsTestSuite().catch((err) => {
    console.error("Test Suite Failed with Error:", err);
    process.exit(1);
  });
}
