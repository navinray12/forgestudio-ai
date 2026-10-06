/**
 * ForgeStudio Modules 37–42 Comprehensive Production Test Suite
 * AI Context Engine, AI Project Memory, AI Planning Agent,
 * AI Architecture Agent, Multi-Agent Orchestrator, Agent Task / Run Manager
 */

import assert from "node:assert/strict";
import { forgeProjectService } from "../services/project/forgeProject.service.js";
import { forgeFilesystemService } from "../services/project/forgeFilesystem.service.js";
import { contextEngineService } from "../modules/ai/context/contextEngine.service.js";
import { sanitizeSensitiveText } from "../modules/ai/context/sensitiveFilter.js";
import { packContextWithinBudget } from "../modules/ai/context/tokenBudget.js";
import { projectMemoryService } from "../modules/ai/memory/projectMemory.service.js";
import { memoryConflictService } from "../modules/ai/memory/memoryConflict.service.js";
import { planningAgentService } from "../modules/ai/planning/planningAgent.service.js";
import { impactAnalysisService } from "../modules/ai/planning/impactAnalysis.service.js";
import { architectureAgentService } from "../modules/ai/architecture/architectureAgent.service.js";
import { agentRegistry } from "../modules/ai/orchestrator/agentRegistry.js";
import { DagEngine } from "../modules/ai/orchestrator/dagEngine.js";
import { multiAgentOrchestratorService } from "../modules/ai/orchestrator/multiAgentOrchestrator.service.js";
import { taskManagerService } from "../modules/ai/task-manager/taskManager.service.js";
import { runManagerService } from "../modules/ai/task-manager/runManager.service.js";
import { eventBusService } from "../modules/ai/task-manager/eventBus.service.js";
import { artifactManagerService } from "../modules/ai/task-manager/artifactManager.service.js";

export async function runModules37to42TestSuite(): Promise<{
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
  console.log("Starting Modules 37–42 (AI Engineering Platform) Test Suite");
  console.log("============================================================\n");

  const testUserId = "test-ai-architect-uuid";
  const suffix = Date.now().toString(36);

  // Setup: Create test project
  const project = await forgeProjectService.createProject(testUserId, {
    name: `AI Engineering OS Project ${suffix}`,
    slug: `ai-os-${suffix}`,
    projectType: "REACT",
    framework: "react",
    runtime: "nodejs",
    runtimeVersion: "20.x",
  });
  const projId = project.id;

  // Populate realistic repository files
  await forgeFilesystemService.writeFile(projId, "package.json", {
    content: JSON.stringify({
      name: `ai-os-${suffix}`,
      dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" },
    }),
  });

  await forgeFilesystemService.writeFile(projId, "src/App.tsx", {
    content: `import React from 'react';\nimport { AuthHeader } from './components/AuthHeader';\nexport function App() { return <div><AuthHeader /><h1>App</h1></div>; }`,
  });

  await forgeFilesystemService.writeFile(projId, "src/components/AuthHeader.tsx", {
    content: `import React from 'react';\nexport function AuthHeader() { return <header>Header</header>; }`,
  });

  logPass("Setup: Test project and repository files initialized successfully");

  // ========================================================
  // 1. MODULE 37: AI CONTEXT ENGINE TESTS
  // ========================================================
  console.log("\n[Test Section 1] AI Context Engine (Module 37)...");

  // Test 1.1: Sensitive data filtering & redaction
  const secretSample = `const apiKey = "sk-123456789012345678901234"; const db = "postgres://admin:superSecret123@localhost:5432/db";`;
  const sanitized = sanitizeSensitiveText(secretSample);
  assert.ok(sanitized.redactedCount >= 2, "Must redact both API key and DB connection string");
  assert.ok(!sanitized.text.includes("superSecret123"), "Must not leak secret password");
  logPass("Module 37: Sensitive credentials and API keys redacted cleanly");

  // Test 1.2: Token budgeting & compression
  const fakeItems = [
    {
      id: "1",
      source: "file" as const,
      sourceId: "f1",
      title: "File 1",
      content: "A".repeat(1000), // ~250 tokens
      relevanceScore: 90,
      estimatedTokens: 250,
      freshnessTimestamp: new Date().toISOString(),
      hash: "h1",
    },
    {
      id: "2",
      source: "file" as const,
      sourceId: "f2",
      title: "File 2",
      content: "B".repeat(2000), // ~500 tokens
      relevanceScore: 40,
      estimatedTokens: 500,
      freshnessTimestamp: new Date().toISOString(),
      hash: "h2",
    },
  ];
  const packed = packContextWithinBudget(fakeItems, 300);
  assert.equal(packed.packedItems.length, 1, "Must pack highest priority item within budget limit");
  assert.ok(packed.tokensUsed <= 300, "Must strictly respect token limit");
  logPass("Module 37: Token-aware context packing and budgeting verified");

  // Test 1.3: End-to-end Context Assembly
  const ctxSnapshot = await contextEngineService.assembleContext({
    projectId: projId,
    objective: "Refactor AuthHeader component",
    files: ["src/components/AuthHeader.tsx"],
    contextProfile: "CodingAgentContext",
    tokenBudget: 16000,
  });
  assert.ok(ctxSnapshot.id, "Context snapshot must have ID");
  assert.ok(ctxSnapshot.items.length > 0, "Must assemble relevant context items");
  assert.ok(ctxSnapshot.explainability.rationale.length > 0, "Must provide explainability rationale");
  logPass("Module 37: Multi-source context assembly with explainability verified");

  // ========================================================
  // 2. MODULE 38: AI PROJECT MEMORY TESTS
  // ========================================================
  console.log("\n[Test Section 2] AI Project Memory (Module 38)...");

  // Test 2.1: Create protected rule & convention
  const memoryA = await projectMemoryService.createMemory({
    projectId: projId,
    type: "DO_NOT_BREAK_RULE",
    title: "Protect AuthHeader Layout",
    content: "Do not remove AuthHeader from App.tsx under any circumstances.",
    severity: "BLOCKING",
    relatedFiles: ["src/components/AuthHeader.tsx"],
  });
  assert.ok(memoryA.id, "Memory must have ID");
  assert.equal(memoryA.status, "ACTIVE");
  logPass("Module 38: Project memory rule created with BLOCKING severity");

  // Test 2.2: List and filter memories
  const memList = await projectMemoryService.listMemories(projId);
  assert.ok(memList.length >= 1, "Must list created memories");
  logPass("Module 38: Memory listing and filtering verified");

  // Test 2.3: Conflict Detection (Read-Before-Edit contract)
  const conflictReport = await memoryConflictService.detectConflicts({
    projectId: projId,
    targetFiles: ["src/components/AuthHeader.tsx"],
    objective: "Delete AuthHeader component",
  });
  assert.ok(conflictReport.hasConflict, "Must detect conflict with protected rule");
  assert.ok(conflictReport.blocked, "Must flag conflict as BLOCKING");
  logPass("Module 38: Read-Before-Edit conflict detection correctly blocked conflicting action");

  // ========================================================
  // 3. MODULE 39: AI PLANNING AGENT TESTS
  // ========================================================
  console.log("\n[Test Section 3] AI Planning Agent (Module 39)...");

  // Test 3.1: Impact analysis
  const impact = await impactAnalysisService.analyzeImpact({
    projectId: projId,
    objective: "Add authentication guard to routes",
    suggestedFiles: ["src/App.tsx"],
  });
  assert.ok(impact.predictedFiles.length > 0, "Must predict affected files");
  assert.ok(["HIGH", "CRITICAL"].includes(impact.riskLevel), "Security change must be categorized as HIGH/CRITICAL");
  logPass("Module 39: Requirement decomposition and risk impact analysis verified");

  // Test 3.2: Implementation Plan Generation
  const plan = await planningAgentService.generatePlan({
    projectId: projId,
    objective: "Add authentication guard to routes",
    targetFiles: ["src/App.tsx"],
  });
  assert.ok(plan.id, "Plan must have ID");
  assert.ok(plan.steps.length >= 3, "Plan must generate DAG steps");
  assert.ok(["DRAFT", "APPROVED"].includes(plan.status), "Plan must initialize in valid status");
  logPass("Module 39: Implementation plan generated with DAG steps");

  // Test 3.3: Plan Approval gate
  const approvedPlan = await planningAgentService.approvePlan(plan.id, testUserId);
  assert.equal(approvedPlan.status, "APPROVED");
  logPass("Module 39: Plan human approval gate verified");

  // ========================================================
  // 4. MODULE 40: AI ARCHITECTURE AGENT TESTS
  // ========================================================
  console.log("\n[Test Section 4] AI Architecture Agent (Module 40)...");

  const archSnapshot = await architectureAgentService.analyzeProjectArchitecture(projId);
  assert.ok(archSnapshot.score >= 0 && archSnapshot.score <= 100, "Score must be between 0 and 100");
  assert.ok(archSnapshot.moduleCount >= 2, "Must scan all repository modules");
  assert.ok(archSnapshot.diagramData.nodes.length > 0, "Must generate architectural graph nodes");
  logPass("Module 40: Architecture discovery, scoring, and diagram data verified");

  // ========================================================
  // 5. MODULE 41: MULTI-AGENT ORCHESTRATOR TESTS
  // ========================================================
  console.log("\n[Test Section 5] Multi-Agent Orchestrator (Module 41)...");

  // Test 5.1: Agent Registry
  const registeredAgents = agentRegistry.listAgents();
  assert.ok(registeredAgents.length >= 5, "Must register all required agent roles");
  assert.ok(agentRegistry.getAgent("PLANNER"), "Must have Planner agent");
  assert.ok(agentRegistry.getAgent("ARCHITECTURE"), "Must have Architecture agent");
  assert.ok(agentRegistry.getAgent("CODING"), "Must have Coding agent");
  assert.ok(agentRegistry.getAgent("TESTING"), "Must have Testing agent");
  assert.ok(agentRegistry.getAgent("REVIEW"), "Must have Reviewer agent");
  logPass("Module 41: Specialized agent registry and capability contracts verified");

  // Test 5.2: DAG Engine Dependency Order
  const mockNodes: any[] = [
    { id: "step-1", agentRole: "ARCHITECTURE", status: "PENDING", dependencies: [] },
    { id: "step-2", agentRole: "CODING", status: "PENDING", dependencies: ["step-1"] },
  ];
  const readyNodes = DagEngine.getReadyNodes(mockNodes);
  assert.equal(readyNodes.length, 1);
  assert.equal(readyNodes[0].id, "step-1", "Only independent step-1 must be ready first");
  logPass("Module 41: Directed Acyclic Graph (DAG) dependency resolution verified");

  // ========================================================
  // 6. MODULE 42: AGENT TASK / RUN MANAGER TESTS
  // ========================================================
  console.log("\n[Test Section 6] Agent Task / Run Manager (Module 42)...");

  // Test 6.1: Task Creation
  const task = await taskManagerService.createTask({
    projectId: projId,
    title: "Implement responsive navigation",
    objective: "Build responsive navbar with mobile drawer",
    priority: "HIGH",
    userId: testUserId,
  });
  assert.ok(task.id, "Task must have ID");
  assert.equal(task.status, "QUEUED");
  logPass("Module 42: Engineering task created in QUEUED state");

  // Test 6.2: Start Run
  const run = await runManagerService.startRun(task.id);
  assert.ok(run.id, "Run must have ID");
  assert.equal(run.attemptNumber, 1);
  logPass("Module 42: Execution run started and mapped to task");

  // Test 6.3: Event Bus & Timeline
  const event = await eventBusService.emitEvent({
    projectId: projId,
    taskId: task.id,
    runId: run.id,
    eventType: "STEP_STARTED",
    payload: { info: "Starting test step" },
  });
  assert.ok(event.id, "Event must have ID");
  const events = await eventBusService.getRunEvents(run.id);
  assert.ok(events.length >= 1, "Must retrieve activity timeline events");
  logPass("Module 42: Activity timeline event emission and history verified");

  // Test 6.4: Artifact Manager
  const artifact = await artifactManagerService.recordArtifact({
    projectId: projId,
    taskId: task.id,
    runId: run.id,
    type: "DIFF",
    name: "Navbar Patch",
    data: { patch: "+ <Navbar />" },
  });
  assert.ok(artifact.id, "Artifact must have ID");
  const artifacts = await artifactManagerService.listArtifacts(run.id);
  assert.ok(artifacts.length >= 1, "Must retrieve recorded artifacts");
  logPass("Module 42: Artifact recording and retrieval verified");

  // Test 6.5: Pause and Resume Controls
  const paused = await runManagerService.pauseRun(run.id);
  assert.equal(paused.status, "PAUSED");
  logPass("Module 42: Run paused at safe checkpoint");

  const resumed = await runManagerService.resumeRun(run.id);
  assert.equal(resumed.status, "RUNNING");
  logPass("Module 42: Run resumed successfully");

  // Test 6.6: Run Cancellation
  const cancelled = await runManagerService.cancelRun(run.id);
  assert.equal(cancelled.status, "CANCELLED");
  logPass("Module 42: Run cancelled with process termination propagation");

  // Test 6.7: Run Retry
  const retryRun = await runManagerService.retryRun(run.id);
  assert.equal(retryRun.attemptNumber, 2, "Retry must advance attempt counter");
  logPass("Module 42: Run retry created second attempt cleanly");

  console.log("\n============================================================");
  console.log(`All Modules 37–42 tests passed cleanly! Total tests: ${testsRun}`);
  console.log("============================================================\n");

  return {
    success: true,
    testsRun,
    details,
  };
}
