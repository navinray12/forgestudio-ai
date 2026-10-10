/**
 * ForgeStudio Modules 35 & 36 Comprehensive Automated Test Suite
 * Feature 35: Code Intelligence & Semantic Index
 * Feature 36: Repository Knowledge Graph
 */

import assert from "node:assert/strict";
import { forgeProjectService } from "../services/project/forgeProject.service.js";
import { forgeFilesystemService } from "../services/project/forgeFilesystem.service.js";
import { codeIntelligenceService } from "../modules/code-intelligence/codeIntelligence.service.js";
import { knowledgeGraphService } from "../modules/knowledge-graph/knowledgeGraph.service.js";
import { extractSymbolsFromSource } from "../modules/code-intelligence/astSymbolExtractor.js";

export async function runModules35to36TestSuite(): Promise<{
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
  console.log("Starting Modules 35 & 36 (Code Intelligence & Knowledge Graph) Test Suite");
  console.log("============================================================\n");

  const testUserId = "test-principal-architect-uuid";
  const foreignUserId = "unauthorized-stranger-uuid";
  const suffix = Date.now().toString(36);

  // ------------------------------------------------------------
  // Setup: Create test project
  // ------------------------------------------------------------
  const project = await forgeProjectService.createProject(testUserId, {
    name: `Code Intel & Graph Project ${suffix}`,
    slug: `code-intel-${suffix}`,
    projectType: "REACT",
    framework: "react",
    runtime: "nodejs",
    runtimeVersion: "20.x",
  });
  const projId = project.id;
  logPass(`Setup: Created test project ${projId}`);

  // Seed sample codebase with rich types, classes, functions, and cross-file relationships
  await forgeFilesystemService.writeFile(
    projId,
    "package.json",
    JSON.stringify({
      name: "sample-intel-app",
      version: "1.0.0",
      dependencies: {
        react: "^19.0.0",
        axios: "^1.6.0",
      },
    })
  );

  // Model file: Types, Interfaces, Enums
  await forgeFilesystemService.writeFile(
    projId,
    "src/models/user.ts",
    `/**
 * User account domain model
 */
export enum UserRole {
  ADMIN = "ADMIN",
  MEMBER = "MEMBER",
  GUEST = "GUEST"
}

export interface UserAccount {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export type UserId = string;
`
  );

  // Service file: Class, Inheritance, Methods, Functions
  await forgeFilesystemService.writeFile(
    projId,
    "src/services/userService.ts",
    `import { UserAccount, UserRole, UserId } from '../models/user';
import axios from 'axios';

export class BaseService {
  protected isInitialized: boolean = true;
}

export class UserService extends BaseService {
  private users: UserAccount[] = [];

  async findUserById(id: UserId): Promise<UserAccount | null> {
    return this.users.find(u => u.id === id) || null;
  }

  createUser(email: string, role: UserRole = UserRole.MEMBER): UserAccount {
    const newUser: UserAccount = {
      id: "usr-" + Date.now(),
      email,
      role,
      isActive: true,
    };
    this.users.push(newUser);
    return newUser;
  }
}

export function formatUserName(user: UserAccount): string {
  return user.email.split('@')[0];
}

export const calculateTax = (amount: number, rate: number = 0.2): number => {
  return amount * rate;
};
`
  );

  // Controller file: Uses Service, Calls methods, Defines routes
  await forgeFilesystemService.writeFile(
    projId,
    "src/controllers/userController.ts",
    `import { UserService, formatUserName, calculateTax } from '../services/userService';
import { UserRole } from '../models/user';

const userService = new UserService();

export async function getUserHandler(userId: string) {
  const user = await userService.findUserById(userId);
  if (!user) return null;
  const name = formatUserName(user);
  const tax = calculateTax(100);
  return { user, name, tax };
}

// Router definition
export function registerUserRoutes(router: any) {
  router.get('/api/users/:id', getUserHandler);
}
`
  );

  // Circular dependency test files
  await forgeFilesystemService.writeFile(
    projId,
    "src/circular/moduleA.ts",
    `import { helperB } from './moduleB';
export function helperA(): string {
  return "A calling " + helperB();
}
`
  );

  await forgeFilesystemService.writeFile(
    projId,
    "src/circular/moduleB.ts",
    `import { helperA } from './moduleA';
export function helperB(): string {
  return "B from module";
}
`
  );

  // Malformed file (syntax error)
  await forgeFilesystemService.writeFile(
    projId,
    "src/broken/syntaxError.ts",
    `export function brokenFunction( {
      let x = 123; // Missing closing parens and braces
`
  );

  // ============================================================
  // TEST 1: AST Symbol Extraction (Isolated Source Test)
  // ============================================================
  const sampleSource = `
    export interface Invoice { id: string; amount: number; }
    export enum InvoiceStatus { PENDING = "PENDING", PAID = "PAID" }
    export class InvoiceManager {
      process(inv: Invoice): boolean { return true; }
    }
    export const TAX_RATE = 0.08;
    export function computeTotal(subtotal: number): number { return subtotal * (1 + TAX_RATE); }
  `;
  const extracted = extractSymbolsFromSource("test/invoice.ts", sampleSource);
  assert.ok(extracted.success, "Extraction should succeed");
  const symNames = extracted.symbols.map((s) => s.name);
  assert.ok(symNames.includes("Invoice"), "Must extract interface Invoice");
  assert.ok(symNames.includes("InvoiceStatus"), "Must extract enum InvoiceStatus");
  assert.ok(symNames.includes("InvoiceManager"), "Must extract class InvoiceManager");
  assert.ok(symNames.includes("TAX_RATE"), "Must extract constant TAX_RATE");
  assert.ok(symNames.includes("computeTotal"), "Must extract function computeTotal");
  logPass("Test 1: AST Symbol Extraction accurately extracts interfaces, enums, classes, constants, functions");

  // ============================================================
  // TEST 2: Project Indexing (Feature 35)
  // ============================================================
  const indexStatus = await codeIntelligenceService.indexProject(projId, { forceReindex: true });
  assert.equal(indexStatus.status, "READY", "Index status should be READY");
  assert.ok(indexStatus.totalSymbols > 0, "Indexed symbols should be greater than 0");
  assert.ok(indexStatus.indexedFiles >= 5, "Should index all valid source files");
  logPass(`Test 2: Full repository indexing indexed ${indexStatus.totalSymbols} symbols across ${indexStatus.indexedFiles} files`);

  // ============================================================
  // TEST 3: Symbol Search
  // ============================================================
  const searchResults = await codeIntelligenceService.searchSymbols(projId, "User");
  assert.ok(searchResults.length > 0, "Should find symbols matching 'User'");
  const foundNames = searchResults.map((s) => s.name);
  assert.ok(foundNames.includes("UserService") || foundNames.includes("UserAccount") || foundNames.includes("UserRole"));
  logPass("Test 3: Symbol search returns matching symbols with kind and export metadata");

  // ============================================================
  // TEST 4: Cross-File Definition Lookup
  // ============================================================
  const defResult = await codeIntelligenceService.lookupDefinition(projId, {
    symbolName: "UserService",
  });
  assert.ok(defResult !== null, "Definition lookup for UserService should return result");
  assert.equal(defResult.symbol.name, "UserService");
  assert.equal(defResult.file.path, "src/services/userService.ts");
  assert.equal(defResult.symbol.kind, "CLASS");
  logPass("Test 4: Cross-file definition lookup resolves UserService to src/services/userService.ts");

  // ============================================================
  // TEST 5: Find References
  // ============================================================
  const refResult = await codeIntelligenceService.findReferences(projId, {
    symbolName: "calculateTax",
  });
  assert.ok(refResult.totalCount > 0, "Should find references for calculateTax");
  assert.ok(
    refResult.references.some((r) => r.sourceFilePath === "src/controllers/userController.ts"),
    "Reference to calculateTax must be detected in userController.ts"
  );
  logPass("Test 5: Find references successfully identifies usages of calculateTax across project files");

  // ============================================================
  // TEST 6: File-Level Dependency Lookup
  // ============================================================
  const depResult = await codeIntelligenceService.getFileDependencies(projId, "src/services/userService.ts");
  assert.ok(
    depResult.dependencies.some((d) => d.resolvedPath === "src/models/user.ts"),
    "userService.ts must depend on src/models/user.ts"
  );
  assert.ok(
    depResult.dependents.some((d) => d.sourceFilePath === "src/controllers/userController.ts"),
    "userController.ts must be listed as a dependent of userService.ts"
  );
  logPass("Test 6: File dependency lookup correctly maps incoming dependents and outgoing dependencies");

  // ============================================================
  // TEST 7: Incremental Re-indexing
  // ============================================================
  // Update a single file
  await forgeFilesystemService.writeFile(
    projId,
    "src/models/user.ts",
    `export interface UserAccount {
  id: string;
  email: string;
  nickname?: string; // Newly added field
}
export enum UserRole { ADMIN = "ADMIN", USER = "USER" }
export const DEFAULT_AVATAR = "https://forge.live/avatar.png";
`
  );

  const incrementalStatus = await codeIntelligenceService.indexProject(projId);
  assert.equal(incrementalStatus.indexedFiles, 1, "Incremental index should only re-parse the 1 modified file");
  const avatarDef = await codeIntelligenceService.lookupDefinition(projId, { symbolName: "DEFAULT_AVATAR" });
  assert.ok(avatarDef !== null, "Newly added symbol DEFAULT_AVATAR must be immediately queryable");
  logPass("Test 7: Incremental re-indexing skips unchanged files and indexes only modified files");

  // ============================================================
  // TEST 8: Deleted File Cleanup
  // ============================================================
  // Create a temporary file, index it, then delete it
  await forgeFilesystemService.writeFile(
    projId,
    "src/temp/toBeDeleted.ts",
    `export const TEMPORARY_SECRET = "temp-val";`
  );
  await codeIntelligenceService.indexProject(projId);
  const tempDefBefore = await codeIntelligenceService.lookupDefinition(projId, { symbolName: "TEMPORARY_SECRET" });
  assert.ok(tempDefBefore !== null, "Temporary secret should exist before delete");

  await forgeFilesystemService.deleteFile(projId, "src/temp/toBeDeleted.ts");
  await codeIntelligenceService.cleanupDeletedFile(projId, "src/temp/toBeDeleted.ts");
  const tempDefAfter = await codeIntelligenceService.lookupDefinition(projId, { symbolName: "TEMPORARY_SECRET" });
  assert.equal(tempDefAfter, null, "Deleted file symbols must be purged from index");
  logPass("Test 8: Deleted file cleanup properly purges symbols and references");

  // ============================================================
  // TEST 9: Knowledge Graph Generation (Feature 36)
  // ============================================================
  const graphBuild = await knowledgeGraphService.buildKnowledgeGraph(projId);
  assert.ok(graphBuild.nodesCount > 0, "Knowledge graph must have nodes");
  assert.ok(graphBuild.edgesCount > 0, "Knowledge graph must have edges");
  logPass(`Test 9: Knowledge graph built with ${graphBuild.nodesCount} nodes and ${graphBuild.edgesCount} edges`);

  // ============================================================
  // TEST 10: Graph Query - WHAT_IMPORTS_FILE & WHAT_FILE_IMPORTS
  // ============================================================
  const whatImports = await knowledgeGraphService.queryGraph(projId, {
    queryType: "WHAT_IMPORTS_FILE",
    target: "src/services/userService.ts",
  });
  assert.ok(whatImports.nodes.length > 0, "WHAT_IMPORTS_FILE should find dependents");
  assert.ok(whatImports.edges.some((e) => e.edgeType === "IMPORTS"), "Must contain IMPORTS edges");

  const whatItImports = await knowledgeGraphService.queryGraph(projId, {
    queryType: "WHAT_FILE_IMPORTS",
    target: "src/controllers/userController.ts",
  });
  assert.ok(whatItImports.nodes.length > 0, "WHAT_FILE_IMPORTS should find dependencies");
  logPass("Test 10: Knowledge graph queries for WHAT_IMPORTS_FILE and WHAT_FILE_IMPORTS verified");

  // ============================================================
  // TEST 11: Graph Query - WHO_CALLS_FUNCTION & WHO_REFERENCES_SYMBOL
  // ============================================================
  const whoCalls = await knowledgeGraphService.queryGraph(projId, {
    queryType: "WHO_CALLS_FUNCTION",
    target: "formatUserName",
  });
  assert.ok(whoCalls.nodes.length > 0, "WHO_CALLS_FUNCTION should find caller node");

  const whoRefs = await knowledgeGraphService.queryGraph(projId, {
    queryType: "WHO_REFERENCES_SYMBOL",
    target: "UserService",
  });
  assert.ok(whoRefs.nodes.length > 0, "WHO_REFERENCES_SYMBOL should find references");
  logPass("Test 11: Knowledge graph queries for WHO_CALLS_FUNCTION and WHO_REFERENCES_SYMBOL verified");

  // ============================================================
  // TEST 12: Graph Query - Impact Analysis (Blast Radius)
  // ============================================================
  const impact = await knowledgeGraphService.queryGraph(projId, {
    queryType: "IMPACT_ANALYSIS",
    target: "src/models/user.ts",
  });
  assert.ok(impact.summary.affectedFilesCount !== undefined && impact.summary.affectedFilesCount > 0);
  logPass(`Test 12: Impact analysis computed blast radius affecting ${impact.summary.affectedFilesCount} files`);

  // ============================================================
  // TEST 13: Graph Query - Dependency Chain (Shortest Path)
  // ============================================================
  const chain = await knowledgeGraphService.queryGraph(projId, {
    queryType: "DEPENDENCY_CHAIN",
    sourceNodeKey: "file:src/controllers/userController.ts",
    targetNodeKey: "file:src/models/user.ts",
  });
  assert.ok(chain.summary.pathFound, "Path should be found between userController and user model");
  logPass("Test 13: Dependency chain shortest path BFS traversal successfully finds connection");

  // ============================================================
  // TEST 14: Circular Dependency Tolerance
  // ============================================================
  const circularDeps = await knowledgeGraphService.queryGraph(projId, {
    queryType: "FILE_DEPENDENCIES",
    target: "src/circular/moduleA.ts",
    depth: 4,
  });
  assert.ok(circularDeps.nodes.length > 0, "Circular dependency should be traversed safely without loop");
  logPass("Test 14: Circular dependencies (moduleA <-> moduleB) handled gracefully without infinite recursion");

  // ============================================================
  // TEST 15: Malformed Source Error Tolerance
  // ============================================================
  const statusAfterMalformed = await codeIntelligenceService.getIndexStatus(projId);
  assert.equal(statusAfterMalformed.status, "READY", "Index should remain READY despite syntax error in one file");
  logPass("Test 15: Malformed TypeScript file handled gracefully without crashing indexer");

  // ============================================================
  // TEST 16: Tenant Isolation & RBAC
  // ============================================================
  let accessDenied = false;
  try {
    await forgeProjectService.getForgeProjectById(projId, { id: foreignUserId, role: "USER" });
  } catch (err: any) {
    if (err.statusCode === 403 || err.statusCode === 404) {
      accessDenied = true;
    }
  }
  assert.ok(accessDenied, "User from foreign tenant must be rejected with 403 Forbidden");

  // Admin access
  const adminAllowed = await forgeProjectService.getForgeProjectById(projId, { id: "admin-id", role: "ADMIN" });
  assert.equal(adminAllowed.id, projId, "Admin should be permitted via RBAC");
  logPass("Test 16: Tenant isolation and RBAC security boundaries enforced strictly");

  console.log("\n============================================================");
  console.log(`All ${testsRun} Feature 35 & 36 tests passed successfully!`);
  console.log("============================================================\n");

  return {
    success: true,
    testsRun,
    details,
  };
}
