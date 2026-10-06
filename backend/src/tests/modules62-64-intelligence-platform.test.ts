/**
 * ForgeStudio Modules 62–64 Comprehensive Production Test Suite
 * Module 62: Optimization Engine (Bundle Analysis, Heavy Dependencies, Dead Code, Web Vitals, AI Patches)
 * Module 63: Project Snapshot / Checkpoint / Recovery (Multi-Layer Capture, Diff Comparator, Atomic Rollback, Disaster Recovery)
 * Module 64: Architecture Visualization (Multi-Layer Topology, Circular Dependencies, Database ER, Mermaid Synthesis)
 */

import assert from "node:assert/strict";
import { forgeProjectService } from "../services/project/forgeProject.service.js";
import { forgeFilesystemService } from "../services/project/forgeFilesystem.service.js";
import { optimizationEngineService } from "../modules/intelligence-platform/optimization/optimizationEngine.service.js";
import { projectRecoveryService } from "../modules/intelligence-platform/recovery/projectRecovery.service.js";
import { architectureVisualizationService } from "../modules/intelligence-platform/architecture-viz/architectureVisualization.service.js";
import { forgeCliService } from "../services/cli/forgeCli.service.js";

export async function runModules62to64TestSuite(): Promise<{
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
  console.log("Starting Modules 62–64 (Optimization, Checkpoint/Recovery, Architecture Viz) Test Suite");
  console.log("============================================================\n");

  const testUserId = "test-architect-user-uuid";
  const suffix = Date.now().toString(36);

  // ------------------------------------------------------------
  // Setup: Create test project and seed with realistic codebase
  // ------------------------------------------------------------
  const project = await forgeProjectService.createProject(testUserId, {
    name: `Intelligence Engineering System ${suffix}`,
    slug: `intelligence-sys-${suffix}`,
    projectType: "FULLSTACK",
    framework: "nextjs",
    runtime: "nodejs",
    runtimeVersion: "20.x",
  });
  const projId = project.id;
  logPass(`Setup: Test Project created with id ${projId}`);

  // Seed package.json with heavy dependencies
  await forgeFilesystemService.writeFile(
    projId,
    "package.json",
    JSON.stringify(
      {
        name: "forge-intelligence-app",
        version: "1.0.0",
        dependencies: {
          react: "19.0.0",
          "react-dom": "19.0.0",
          moment: "2.29.4",       // Heavy dependency (recommend dayjs or date-fns)
          lodash: "4.17.21",      // Heavy dependency (recommend lodash-es)
          xlsx: "0.18.5",         // Heavy dependency (recommend exceljs)
          "crypto-js": "4.2.0",   // Heavy dependency (recommend Web Crypto API)
          express: "4.19.2",
        },
      },
      null,
      2
    )
  );

  // Seed circular dependency between Service A and Service B
  await forgeFilesystemService.writeFile(
    projId,
    "src/services/userService.ts",
    `
    import { getAuthToken } from "./authService";

    export function getUserProfile(userId: string) {
      const token = getAuthToken();
      return { id: userId, token };
    }

    export function deadFunctionNeverUsed() {
      return "This is dead code that should be detected";
    }
    `
  );

  await forgeFilesystemService.writeFile(
    projId,
    "src/services/authService.ts",
    `
    import { getUserProfile } from "./userService";

    export function getAuthToken() {
      return "jwt-sample-token";
    }

    export function authenticateSession(userId: string) {
      const user = getUserProfile(userId);
      return { authenticated: true, user };
    }
    `
  );

  // Seed UI Pages & Components
  await forgeFilesystemService.writeFile(
    projId,
    "src/components/Header.tsx",
    `
    import React from "react";
    import moment from "moment";

    export const Header: React.FC = () => {
      const dateStr = moment().format("YYYY-MM-DD");
      return <header>Today is {dateStr}</header>;
    };
    `
  );

  await forgeFilesystemService.writeFile(
    projId,
    "src/components/Footer.tsx",
    `
    import React from "react";

    export const Footer: React.FC = () => {
      return <footer>ForgeStudio Footer &copy; 2026</footer>;
    };
    `
  );

  await forgeFilesystemService.writeFile(
    projId,
    "src/pages/DashboardPage.tsx",
    `
    import React from "react";
    import { Header } from "../components/Header";
    import { Footer } from "../components/Footer";
    import { getUserProfile } from "../services/userService";
    import _ from "lodash";

    export const DashboardPage: React.FC = () => {
      const user = getUserProfile("usr-1");
      const cloned = _.cloneDeep(user);
      return (
        <div>
          <Header />
          <main>Welcome, {cloned.id}</main>
          <Footer />
        </div>
      );
    };
    `
  );

  // Seed Database Schema (Prisma)
  await forgeFilesystemService.writeFile(
    projId,
    "prisma/schema.prisma",
    `
    datasource db {
      provider = "postgresql"
      url      = env("DATABASE_URL")
    }

    model User {
      id        String    @id @default(uuid())
      email     String    @unique
      name      String?
      createdAt DateTime  @default(now())
      orders    Order[]
    }

    model Order {
      id        String    @id @default(uuid())
      userId    String
      amount    Float
      createdAt DateTime  @default(now())
      user      User      @relation(fields: [userId], references: [id])
    }
    `
  );

  logPass("Setup: Test project filesystem populated with multi-layer code, dependencies, and circular service edges");

  // ============================================================
  // MODULE 62: Optimization Engine Tests
  // ============================================================
  console.log("\n[Module 62] Optimization Engine Tests:");

  // 62.1 Run Optimization Audit
  const audit = await optimizationEngineService.runOptimizationAudit(projId);
  assert(audit.id, "Audit must have a generated ID");
  assert(audit.projectId === projId, "Audit projectId must match");
  assert(typeof audit.score === "number" && audit.score >= 0 && audit.score <= 100, "Audit score must be 0-100");
  assert(audit.totalBytes > 0, "Total bytes must be computed > 0");
  assert(audit.estimatedGzipBytes > 0, "Estimated gzip bytes must be computed > 0");
  assert(audit.estimatedGzipBytes < audit.totalBytes, "Gzip bytes must be less than raw bytes");
  logPass(`62.1 Run Audit: Score=${audit.score}/100, Total=${audit.totalBytes} B, Gzip=${audit.estimatedGzipBytes} B`);

  // 62.2 Heavy Dependencies Detection
  const metrics = audit.metrics as any;
  const heavyPackages = metrics.heavyDependencies || [];
  assert(heavyPackages.length >= 3, `Expected at least 3 heavy dependencies, found ${heavyPackages.length}`);
  const momentDep = heavyPackages.find((p: any) => p.name === "moment");
  assert(momentDep, "Moment.js must be detected as a heavy package");
  assert(momentDep.alternative && momentDep.alternative.length > 0, "Moment.js recommendation must provide lighter alternatives");
  const lodashDep = heavyPackages.find((p: any) => p.name === "lodash");
  assert(lodashDep, "Lodash must be detected as a heavy package");
  logPass(`62.2 Heavy Dependencies: Found ${heavyPackages.map((p: any) => p.name).join(", ")}`);

  // 62.3 Dead Code Detection
  const unusedExports = metrics.unusedExports || [];
  assert(unusedExports.length > 0, "Dead code / unused export candidates must be detected");
  const deadFn = unusedExports.find((d: any) => d.identifier === "deadFunctionNeverUsed");
  assert(deadFn, "Unused function 'deadFunctionNeverUsed' must be flagged as unused export");
  logPass(`62.3 Dead Code Detection: Correctly identified unused symbol '${deadFn.identifier}' in ${deadFn.file}`);

  // 62.4 Web Vitals Projections & Recommendations
  const webVitals = metrics.webVitalsProjection;
  assert(webVitals && webVitals.lcpMs > 0, "LCP projection must be positive number");
  assert(webVitals.fidMs > 0, "FID projection must be positive number");
  assert(typeof webVitals.cls === "number", "CLS projection must be a number");
  assert(audit.recommendations.length > 0, "Recommendations list must contain actionable optimizations");
  logPass(`62.4 Web Vitals & Recommendations: LCP=${webVitals.lcpMs}ms, FID=${webVitals.fidMs}ms, ${audit.recommendations.length} Recommendations`);

  // 62.5 Retrieve Latest Audit
  const latestAudit = await optimizationEngineService.getLatestAudit(projId);
  assert(latestAudit && latestAudit.id === audit.id, "Latest audit must match freshly created audit");
  logPass("62.5 Retrieve Latest Audit: Successfully persisted and retrieved audit record");

  // 62.6 AI Patch Synthesis
  const recToPatch = audit.recommendations[0];
  const patch = await optimizationEngineService.generateAiOptimizationPatch(projId, recToPatch.id);
  assert(patch.recommendationId === recToPatch.id, "Patch recommendationId must match");
  assert(patch.summary && patch.summary.length > 0, "Patch summary must be generated");
  assert(patch.patchCode && patch.patchCode.length > 0, "Patch code must be generated");
  logPass(`62.6 AI Optimization Patch: Generated patch for '${recToPatch.title}'`);

  // ============================================================
  // MODULE 63: Project Snapshot / Checkpoint / Recovery Tests
  // ============================================================
  console.log("\n[Module 63] Project Snapshot & Recovery Tests:");

  // 63.1 Create Baseline Checkpoint
  const cp1 = await projectRecoveryService.createCheckpoint(projId, {
    name: "v1.0 Baseline Production",
    tag: "PRE_DEPLOY",
    description: "Initial production baseline before refactor",
  });
  assert(cp1.id, "Checkpoint 1 must have an ID");
  assert(cp1.filesCount >= 6, `Checkpoint 1 must capture all files, captured ${cp1.filesCount}`);
  assert(cp1.tag === "PRE_DEPLOY", "Checkpoint tag must match");
  logPass(`63.1 Baseline Checkpoint: Created '${cp1.name}' capturing ${cp1.filesCount} files (${cp1.totalBytes} bytes)`);

  // 63.2 List Checkpoints
  const checkpointsList = await projectRecoveryService.listCheckpoints(projId);
  assert(checkpointsList.length >= 1, "Checkpoints list must contain at least 1 item");
  assert(checkpointsList[0].id === cp1.id, "First checkpoint in list must match cp1");
  logPass(`63.2 List Checkpoints: Returned ${checkpointsList.length} checkpoints`);

  // 63.3 Mutate Active Workspace (Add, Modify, Delete)
  await forgeFilesystemService.writeFile(
    projId,
    "src/experimental/newFeature.ts",
    "export const experimentalFeature = true;"
  );
  await forgeFilesystemService.writeFile(
    projId,
    "src/pages/DashboardPage.tsx",
    "// MODIFIED DASHBOARD CONTENT FOR DIFF TEST\nexport const DashboardPage = () => null;"
  );
  await forgeFilesystemService.deleteFile(projId, "src/components/Footer.tsx");
  logPass("63.3 Workspace Mutation: Added newFeature.ts, modified DashboardPage.tsx, deleted Footer.tsx");

  // 63.4 Compare Workspace Diff Against Checkpoint
  const diffResult = await projectRecoveryService.compareDiff(projId, cp1.id);
  assert(diffResult.totalChanges > 0, "Diff comparator must detect workspace changes");
  assert(diffResult.addedCount >= 1, "Diff must detect at least 1 added file");
  assert(diffResult.modifiedCount >= 1, "Diff must detect at least 1 modified file");
  assert(diffResult.deletedCount >= 1, "Diff must detect at least 1 deleted file");

  const diffsList = (diffResult.diffs || []) as any[];
  const addedDiff = diffsList.find((d: any) => d.path === "src/experimental/newFeature.ts");
  assert(addedDiff && addedDiff.status === "ADDED", "newFeature.ts must be marked ADDED");

  const modDiff = diffsList.find((d: any) => d.path === "src/pages/DashboardPage.tsx");
  assert(modDiff && modDiff.status === "MODIFIED", "DashboardPage.tsx must be marked MODIFIED");

  const delDiff = diffsList.find((d: any) => d.path === "src/components/Footer.tsx");
  assert(delDiff && delDiff.status === "DELETED", "Footer.tsx must be marked DELETED");
  logPass(`63.4 Diff Comparator: Correctly identified +${diffResult.addedCount} ~${diffResult.modifiedCount} -${diffResult.deletedCount}`);

  // 63.5 Selective Single-File Restore
  const singleRestoreResult = await projectRecoveryService.restoreSingleFile(
    projId,
    cp1.id,
    "src/components/Footer.tsx"
  );
  assert(singleRestoreResult.path === "src/components/Footer.tsx", "Restored path must match");
  const restoredFooter = await forgeFilesystemService.readFile(projId, "src/components/Footer.tsx");
  assert(restoredFooter.content && restoredFooter.content.includes("ForgeStudio Footer"), "Restored file content must match checkpoint");
  logPass("63.5 Single-File Restore: Restored deleted 'src/components/Footer.tsx' with exact checkpoint content");

  // 63.6 Atomic Full Project Rollback
  const rollbackResult = await projectRecoveryService.rollbackToCheckpoint(projId, cp1.id);
  assert(rollbackResult.status === "SUCCESS", "Rollback status must be SUCCESS");
  assert(rollbackResult.filesRestoredCount >= 6, "Rollback must restore baseline files");
  assert(rollbackResult.filesDeletedCount >= 1, "Rollback must delete post-checkpoint added files");

  // Verify post-checkpoint file was pruned
  let newFeatureStillExists = true;
  try {
    await forgeFilesystemService.readFile(projId, "src/experimental/newFeature.ts");
  } catch {
    newFeatureStillExists = false;
  }
  assert(!newFeatureStillExists, "Post-checkpoint file 'src/experimental/newFeature.ts' must be cleanly pruned on rollback");

  // Verify modified file was restored to original
  const restoredDashboard = await forgeFilesystemService.readFile(projId, "src/pages/DashboardPage.tsx");
  assert(restoredDashboard.content && restoredDashboard.content.includes("Welcome, {cloned.id}"), "DashboardPage must be restored to original baseline");
  logPass(`63.6 Atomic Rollback: Restored ${rollbackResult.filesRestoredCount} files, pruned ${rollbackResult.filesDeletedCount} files in ${rollbackResult.durationMs}ms`);

  // 63.7 Disaster Recovery Bundle Export & Import
  const drBundle = await projectRecoveryService.exportDisasterRecoveryBundle(projId, cp1.id);
  assert(drBundle.formatVersion === "1.0", "DR bundle formatVersion must match 1.0");
  assert(drBundle.checkpoint.id === cp1.id, "DR bundle checkpoint ID must match");
  assert(drBundle.checkpoint.filesSnapshot.length >= 6, "DR bundle must contain file snapshots");
  logPass(`63.7 DR Bundle Export: Exported portable bundle from ${drBundle.exportedAt}`);

  const importRollbackResult = await projectRecoveryService.importDisasterRecoveryBundle(projId, drBundle);
  assert(importRollbackResult.status === "SUCCESS", "Imported DR bundle rollback must succeed");
  logPass(`63.8 DR Bundle Import: Imported recovery checkpoint restoring ${importRollbackResult.filesRestoredCount} files`);

  // ============================================================
  // MODULE 64: Architecture Visualization Tests
  // ============================================================
  console.log("\n[Module 64] Architecture Visualization Tests:");

  // 64.1 Multi-Layer Topology Graph Generation
  const archGraph = await architectureVisualizationService.generateArchitectureGraph(projId, "ALL");
  assert(archGraph.nodes.length >= 5, `Architecture graph must contain nodes, found ${archGraph.nodes.length}`);
  assert(archGraph.edges.length >= 2, `Architecture graph must contain edges, found ${archGraph.edges.length}`);
  logPass(`64.1 Topology Graph: Generated ${archGraph.nodes.length} nodes and ${archGraph.edges.length} edges`);

  // 64.2 Circular Dependency Cycle Detection
  const circularEdges = archGraph.edges.filter((e) => e.isCircular);
  assert(circularEdges.length >= 2, "Must detect circular dependency edges between userService and authService");
  logPass(`64.2 Circular Dependency: Detected circular edges: ${circularEdges.map((e) => e.id).join(", ")}`);

  // 64.3 Node Metrics Calculation (Fan-In, Fan-Out, Risk Score)
  const headerNode = archGraph.nodes.find((n) => n.path?.includes("Header.tsx"));
  assert(headerNode, "Header node must exist in graph");
  assert(typeof headerNode.fanIn === "number", "Node must have fanIn metric");
  assert(typeof headerNode.fanOut === "number", "Node must have fanOut metric");
  assert(typeof headerNode.riskScore === "number" && headerNode.riskScore >= 0 && headerNode.riskScore <= 100, "Node must have risk score 0-100");
  logPass(`64.3 Node Metrics: Header.tsx (fanIn=${headerNode.fanIn}, fanOut=${headerNode.fanOut}, riskScore=${headerNode.riskScore})`);

  // 64.4 Filtered Layer Topology
  const servicesOnlyGraph = await architectureVisualizationService.generateArchitectureGraph(projId, "SERVICES");
  assert(servicesOnlyGraph.nodes.every((n) => n.layer === "backend"), "Filtered graph must only contain backend services nodes");
  logPass(`64.4 Layer Filtering: Filtered graph by SERVICES layer (${servicesOnlyGraph.nodes.length} nodes)`);

  // 64.5 Database ER Diagram Generation
  assert(archGraph.databaseEr.length >= 2, `ER diagram must detect tables, found ${archGraph.databaseEr.length}`);
  const userTable = archGraph.databaseEr.find((e) => e.tableName.toLowerCase() === "user");
  const orderTable = archGraph.databaseEr.find((e) => e.tableName.toLowerCase() === "order");
  assert(userTable && orderTable, "ER diagram must detect User and Order tables from Prisma schema");
  logPass(`64.5 Database ER Diagram: Extracted tables [${archGraph.databaseEr.map((e) => e.tableName).join(", ")}]`);

  // 64.6 Mermaid Diagram Synthesis
  assert(archGraph.mermaid.startsWith("graph TD"), "Mermaid diagram must start with 'graph TD'");
  assert(archGraph.mermaid.includes("-->"), "Mermaid diagram must contain connection edges");
  logPass("64.6 Mermaid Flow Synthesis: Successfully generated valid graph TD syntax with node connections");

  // ============================================================
  // Forge CLI Tooling Integration Tests
  // ============================================================
  console.log("\n[CLI Integration] Testing 'forge' command extensions:");

  const cliOpt = await forgeCliService.executeCommand("forge optimize run", { projectId: projId });
  assert(cliOpt.output.includes("Optimization Audit Completed") || cliOpt.output.includes("Score:"), "CLI optimize run must succeed");
  logPass("CLI Integration: 'forge optimize run' successfully triggered audit");

  const cliCheckpoints = await forgeCliService.executeCommand("forge checkpoint list", { projectId: projId });
  assert(cliCheckpoints.output.includes("Checkpoints for project"), "CLI checkpoint list must return checkpoints");
  logPass("CLI Integration: 'forge checkpoint list' successfully listed checkpoints");

  const cliArch = await forgeCliService.executeCommand("forge arch graph", { projectId: projId });
  assert(cliArch.output.includes("Nodes:") && cliArch.output.includes("Edges:"), "CLI arch graph must output node/edge stats");
  logPass("CLI Integration: 'forge arch graph' successfully printed architecture topology");

  const cliMermaid = await forgeCliService.executeCommand("forge arch mermaid", { projectId: projId });
  assert(cliMermaid.output.includes("graph TD"), "CLI arch mermaid must generate graph TD diagram");
  logPass("CLI Integration: 'forge arch mermaid' successfully generated Mermaid output");

  // Cleanup: Archive test project
  await forgeProjectService.transitionProjectLifecycle(projId, "ARCHIVED", { id: testUserId, role: "ADMIN" });
  logPass(`Teardown: Test project ${projId} archived`);

  console.log("\n============================================================");
  console.log(`All Modules 62–64 Tests Passed! Total: ${testsRun} assertions verified.`);
  console.log("============================================================\n");

  return {
    success: true,
    testsRun,
    details,
  };
}
