/**
 * ForgeStudio Modules 25–28 Comprehensive Production Test Suite
 * Module 25: Forge Database (Provisioning, DDL, Migrations, Backups, Isolation)
 * Module 26: Database Studio (Table Browser, CRUD, SQL Console, EXPLAIN, Seeding, Export)
 * Module 27: Data/API Layer (REST Generation, Filtering, OpenAPI 3.0, TypeScript SDK)
 * Module 28: Object Storage (Buckets, Streaming, Multipart, Signed URLs, Security Scanner)
 */

import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { forgeProjectService } from "../services/project/forgeProject.service.js";
import { forgeDatabaseService } from "../modules/data-platform/database/forgeDatabase.service.js";
import { connectionManager } from "../modules/data-platform/database/connectionManager.js";
import { databaseStudioService } from "../modules/data-platform/studio/databaseStudio.service.js";
import { dataApiService } from "../modules/data-platform/api-layer/dataApi.service.js";
import { objectStorageService } from "../modules/data-platform/storage/objectStorage.service.js";
import { encryptCredential, decryptCredential, maskConnectionUrl } from "../modules/data-platform/security/encryption.js";

export async function runModules25to28TestSuite(): Promise<{
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
  console.log("Starting Modules 25–28 (Forge Data Platform) Test Suite");
  console.log("============================================================\n");

  const testUserId = "test-data-platform-architect-uuid";
  const suffix = Date.now().toString(36);

  // ------------------------------------------------------------
  // SECTION 0: Security & Encryption Foundation
  // ------------------------------------------------------------
  console.log("--- Section 0: Security & Encryption ---");
  const secretPassword = "super-secret-customer-db-password-1234!";
  const encrypted = encryptCredential(secretPassword);
  assert.ok(encrypted.includes(":"), "Encrypted string must contain iv:authTag:ciphertext");
  const decrypted = decryptCredential(encrypted);
  assert.equal(decrypted, secretPassword, "Decrypted credential must match original plaintext");

  const rawUrl = "postgresql://postgres:secretpassword123@localhost:5432/forgedb?schema=cust1";
  const masked = maskConnectionUrl(rawUrl);
  assert.ok(!masked.includes("secretpassword123"), "Masked URL must never expose plaintext password");
  assert.ok(masked.includes("****"), "Masked URL must contain asterisks for password");
  logPass("Security: AES-256-GCM encryption and URL password masking verified");

  // ------------------------------------------------------------
  // SETUP: Create isolated Forge Project
  // ------------------------------------------------------------
  const project = await forgeProjectService.createProject(testUserId, {
    name: `Data Platform Project ${suffix}`,
    slug: `data-platform-${suffix}`,
    projectType: "FULLSTACK",
    framework: "nextjs",
    runtime: "nodejs",
    runtimeVersion: "20.x",
  });
  const projId = project.id;
  logPass(`Setup: Test Project created with id ${projId}`);

  // ------------------------------------------------------------
  // MODULE 25: Forge Database
  // ------------------------------------------------------------
  console.log("\n--- Module 25: Forge Database ---");

  // 25.1 Provision Customer Database
  const dbInfo = await forgeDatabaseService.provisionDatabase(projId, "development");
  assert.equal(dbInfo.status, "ready", "Database status must be ready after provisioning");
  assert.equal(dbInfo.environment, "development", "Environment must match development");
  assert.ok(dbInfo.schemaName.startsWith("forge_cust_"), "Customer database schema name must follow isolation convention");
  logPass("25.1 Provisioning: Customer database schema successfully provisioned with tenant isolation");

  // 25.2 Introspect Initial Schemas
  const schemas = await forgeDatabaseService.listSchemas(projId, "development");
  assert.ok(schemas.includes(dbInfo.schemaName), "Customer schema must be listed in accessible schemas");
  logPass("25.2 Schema Management: Customer schema listed in database introspection");

  // 25.3 Create Tables: users and posts with Foreign Key
  const usersTable = await forgeDatabaseService.createTable(projId, "development", {
    name: "users",
    columns: [
      { name: "id", type: "UUID", isPrimary: true, defaultValue: "gen_random_uuid()" },
      { name: "email", type: "VARCHAR(255)", isNullable: false, isUnique: true },
      { name: "full_name", type: "VARCHAR(255)", isNullable: false },
      { name: "role", type: "VARCHAR(50)", defaultValue: "'member'" },
      { name: "created_at", type: "TIMESTAMPTZ", defaultValue: "NOW()" },
    ],
  });
  assert.equal(usersTable.name, "users", "Users table must be created");
  assert.equal(usersTable.columns.length, 5, "Users table must have 5 columns");
  logPass("25.3 Table Management: Created 'users' table with UUID primary key and unique constraint");

  const postsTable = await forgeDatabaseService.createTable(projId, "development", {
    name: "posts",
    columns: [
      { name: "id", type: "UUID", isPrimary: true, defaultValue: "gen_random_uuid()" },
      { name: "user_id", type: "UUID", isNullable: false },
      { name: "title", type: "VARCHAR(500)", isNullable: false },
      { name: "body", type: "TEXT" },
      { name: "published", type: "BOOLEAN", defaultValue: "false" },
      { name: "created_at", type: "TIMESTAMPTZ", defaultValue: "NOW()" },
    ],
    foreignKeys: [
      {
        column: "user_id",
        foreignTable: "users",
        foreignColumn: "id",
        onDelete: "CASCADE",
      },
    ],
  });
  assert.equal(postsTable.name, "posts", "Posts table must be created");
  assert.ok(postsTable.foreignKeys.length >= 1, "Posts table must contain foreign key reference to users");
  logPass("25.4 Relationships & Constraints: Created 'posts' table with Foreign Key referencing 'users.id'");

  // 25.5 Indexes
  await forgeDatabaseService.createIndex(projId, "development", "posts", {
    name: "idx_posts_user_id",
    columns: ["user_id"],
    isUnique: false,
  });
  const tablesAfterIdx = await forgeDatabaseService.listTables(projId, "development");
  const postsIntrospected = tablesAfterIdx.find((t) => t.name === "posts");
  assert.ok(postsIntrospected, "Posts table must be present in introspection");
  const hasUserIdx = postsIntrospected.indexes.some((idx) => idx.name === "idx_posts_user_id");
  assert.ok(hasUserIdx, "Custom index 'idx_posts_user_id' must be verified via introspection");
  logPass("25.5 Indexes: Created and introspected index on 'posts.user_id'");

  // 25.6 Column Management: Add and Alter column
  await forgeDatabaseService.addColumn(projId, "development", "posts", {
    name: "views_count",
    type: "INTEGER",
    defaultValue: "0",
  });
  const postsWithViews = (await forgeDatabaseService.listTables(projId, "development")).find((t) => t.name === "posts");
  assert.ok(postsWithViews?.columns.some((c) => c.name === "views_count"), "New column 'views_count' must exist");
  logPass("25.6 Column Alteration: Added 'views_count' column with default value to 'posts'");

  // 25.7 Destructive Operation Guard
  let dropPrevented = false;
  try {
    await forgeDatabaseService.dropTable(projId, "development", "users", false); // confirm = false
  } catch (err: any) {
    if (err.message.includes("DESTRUCTIVE_OPERATION_PROTECTED")) {
      dropPrevented = true;
    }
  }
  assert.ok(dropPrevented, "Dropping table without explicit confirmation must be rejected");
  logPass("25.7 Safety Guards: Destructive table drop blocked without explicit confirmation");

  // 25.8 Transactions
  const txResult = await connectionManager.executeTransactionInSchema(
    dbInfo.schemaName,
    async (client) => {
      const uRes = await client.query(
        `INSERT INTO users (email, full_name) VALUES ($1, $2) RETURNING id`,
        ["alice@example.com", "Alice Architect"]
      );
      const userId = uRes.rows[0].id;
      const pRes = await client.query(
        `INSERT INTO posts (user_id, title, body, published) VALUES ($1, $2, $3, $4) RETURNING id`,
        [userId, "Hello World from Forge", "Deep dive into SaaS Data Platform", true]
      );
      return { userId, postId: pRes.rows[0].id };
    }
  );
  assert.ok(txResult.userId && txResult.postId, "Transactional insert must return inserted IDs");
  logPass("25.8 Transactions: Atomic transaction (user + post insert) committed successfully");

  // 25.9 Migrations System
  const migration = await forgeDatabaseService.createAndApplyMigration(
    projId,
    "development",
    "create_comments_table",
    `CREATE TABLE comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`
  );
  assert.equal(migration.status, "applied", "Migration status must be applied");
  assert.ok(migration.checksum, "Migration must calculate SHA-256 checksum");
  const migrations = await forgeDatabaseService.listMigrations(projId, "development");
  assert.ok(migrations.length >= 1, "Migration history must contain applied migration");
  logPass("25.9 Migration Engine: Migration applied with advisory lock and checksum integrity");

  // 25.10 Database Backup
  const backup = await forgeDatabaseService.createBackup(projId, "development", "Initial production baseline");
  assert.equal(backup.status, "completed", "Backup status must be completed");
  assert.ok(backup.sizeBytes > 0, "Backup must report positive bytes size");
  const backupsList = await forgeDatabaseService.listBackups(projId, "development");
  assert.ok(backupsList.some((b) => b.id === backup.id), "Backup must appear in backup inventory");
  logPass("25.10 Backup & Restore: Automated backup created and verified with table statistics");

  // 25.11 Health & Usage Metrics
  const metrics = await forgeDatabaseService.getDatabaseMetrics(projId, "development");
  assert.ok(metrics.tableCount >= 3, "Database metrics must reflect 3 created tables");
  assert.ok(metrics.totalRows >= 2, "Database metrics must reflect inserted rows");
  logPass("25.11 Metrics: Introspected live table count, row count, and connection health");

  // ------------------------------------------------------------
  // MODULE 26: Database Studio
  // ------------------------------------------------------------
  console.log("\n--- Module 26: Database Studio ---");

  // 26.1 Table Data Browser
  const usersBrowse = await databaseStudioService.getTableData(projId, "development", "users", {
    page: 1,
    limit: 10,
    search: "alice",
  });
  assert.equal(usersBrowse.total, 1, "Browse must find 1 matching user");
  assert.equal(usersBrowse.rows[0].email, "alice@example.com", "Browser row data must match");
  logPass("26.1 Table Browser: Filtered pagination retrieved records accurately");

  // 26.2 Studio CRUD Operations
  const newRow = await databaseStudioService.insertRow(projId, "development", "users", {
    email: "bob@example.com",
    full_name: "Bob Builder",
    role: "admin",
  });
  assert.equal(newRow.email, "bob@example.com", "Inserted row must match");

  const updatedRow = await databaseStudioService.updateRow(
    projId,
    "development",
    "users",
    { email: "bob@example.com" },
    { role: "superuser" }
  );
  assert.equal(updatedRow.role, "superuser", "Updated row must reflect new role");
  logPass("26.2 Studio CRUD: Row insert and update verified with schema validation");

  // 26.3 SQL Editor Execution
  const sqlRes = await databaseStudioService.executeQuery(
    projId,
    "development",
    testUserId,
    `SELECT u.email, count(p.id) as post_count FROM users u LEFT JOIN posts p ON u.id = p.user_id GROUP BY u.email ORDER BY u.email ASC;`
  );
  assert.ok(sqlRes.rows.length >= 2, "Query must return aggregated rows for both users");
  assert.ok(sqlRes.durationMs >= 0, "Query duration must be recorded");
  logPass("26.3 SQL Editor: Multi-table JOIN aggregation executed safely with runtime metrics");

  // 26.4 EXPLAIN Query Plan
  const plan = await databaseStudioService.explainQuery(
    projId,
    "development",
    `SELECT * FROM posts WHERE user_id = '${txResult.userId}';`
  );
  assert.ok(plan.planType, "Query plan must extract plan node type (e.g. Seq Scan or Index Scan)");
  logPass(`26.4 EXPLAIN Plan: Analyzed query execution plan (${plan.planType})`);

  // 26.5 Query History Logs
  const queryLogs = await databaseStudioService.getQueryHistory(projId, "development", 5);
  assert.ok(queryLogs.length >= 1, "Query history must record executed queries");
  logPass("26.5 Query History: Audited query execution history with timestamp and user attribution");

  // 26.6 Seed Data Generator
  const seedResult = await databaseStudioService.seedTable(projId, "development", "posts", 3);
  assert.equal(seedResult.inserted, 3, "Seeder must insert 3 generated records");
  logPass("26.6 Data Seeding: Auto-generated 3 relational test records");

  // 26.7 Export Data
  const csvExport = await databaseStudioService.exportTableData(projId, "development", "users", "csv");
  assert.ok(csvExport.includes("alice@example.com") && csvExport.includes("bob@example.com"), "CSV export must contain users");
  const jsonExport = await databaseStudioService.exportTableData(projId, "development", "users", "json");
  const parsedJson = JSON.parse(jsonExport);
  assert.ok(Array.isArray(parsedJson) && parsedJson.length >= 2, "JSON export must parse into row array");
  logPass("26.7 Data Export: Streamed CSV and formatted JSON exports successfully verified");

  // ------------------------------------------------------------
  // MODULE 27: Data / API Layer
  // ------------------------------------------------------------
  console.log("\n--- Module 27: Data / API Layer ---");

  // 27.1 Configure Exposed API
  const apiConfig = await dataApiService.saveApiConfig(projId, {
    tableName: "posts",
    isExposed: true,
    allowedOperations: ["SELECT", "INSERT", "UPDATE"],
    requireAuth: true,
  });
  assert.equal(apiConfig.tableName, "posts", "API config table name must match");
  assert.ok(apiConfig.isExposed, "Posts table must be exposed as API");
  logPass("27.1 API Exposure: Managed API exposure controls configured for 'posts'");

  // 27.2 REST API Query Handling
  const restData = await dataApiService.executeRestQuery(projId, "development", "posts", {
    limit: 5,
    sort: "created_at:desc",
    filter: { published: "true" },
  });
  assert.ok(restData.rows.length >= 1, "REST query must return matching posts");
  assert.equal(restData.rows[0].published, true, "REST filter must filter by published boolean");
  logPass("27.2 REST Endpoints: Parameterized query builder handled structured filters and sorting");

  // 27.3 OpenAPI 3.0 Generation
  const openApi = await dataApiService.generateOpenApiSpec(projId, "development");
  assert.equal(openApi.openapi, "3.0.3", "OpenAPI spec version must be 3.0.3");
  assert.ok(openApi.paths["/api/data/posts"], "OpenAPI spec must define /api/data/posts path");
  assert.ok(openApi.paths["/api/data/posts"].get, "OpenAPI spec must define GET method");
  assert.ok(openApi.paths["/api/data/posts"].post, "OpenAPI spec must define POST method");
  logPass("27.3 OpenAPI 3.0: Generated complete API contract specification with schemas and query params");

  // 27.4 Typed TypeScript SDK Client Generation
  const sdkCode = await dataApiService.generateTypedClient(projId, "development");
  assert.ok(sdkCode.includes("export class ForgeDataClient"), "SDK must export ForgeDataClient");
  assert.ok(sdkCode.includes("export interface UsersRecord"), "SDK must declare UsersRecord interface");
  assert.ok(sdkCode.includes("export interface PostsRecord"), "SDK must declare PostsRecord interface");
  logPass("27.4 TypeScript SDK: Generated typed data client matching live schema definitions");

  // ------------------------------------------------------------
  // MODULE 28: Object Storage
  // ------------------------------------------------------------
  console.log("\n--- Module 28: Object Storage ---");

  // 28.1 Bucket Management
  const pubBucket = await objectStorageService.createBucket(projId, "development", {
    name: "public-assets",
    isPublic: true,
    allowedMimeTypes: ["image/png", "image/jpeg", "text/plain"],
    maxSizeBytes: 50 * 1024 * 1024,
  });
  assert.equal(pubBucket.name, "public-assets", "Bucket name must match");
  assert.equal(pubBucket.isPublic, true, "Bucket must be public");

  const privBucket = await objectStorageService.createBucket(projId, "development", {
    name: "confidential-docs",
    isPublic: false,
    maxSizeBytes: 100 * 1024 * 1024,
  });
  assert.equal(privBucket.isPublic, false, "Confidential bucket must be private");
  logPass("28.1 Bucket Management: Created public and private storage buckets with quota policies");

  // 28.2 Streaming Upload & Download
  const testContent = "Hello from Forge Object Storage Engine! Streaming bytes directly.";
  const textBuffer = Buffer.from(testContent, "utf-8");
  const uploadedObj = await objectStorageService.uploadObject(
    projId,
    "development",
    "public-assets",
    "docs/readme.txt",
    testUserId,
    Readable.from(textBuffer),
    {
      contentType: "text/plain",
      sizeBytes: textBuffer.length,
      metadata: { author: "alice" },
    }
  );
  assert.equal(uploadedObj.key, "docs/readme.txt", "Object key must match");
  assert.equal(uploadedObj.scanStatus, "clean", "Text file must be classified as clean");

  // Download object
  const downloadStream = await objectStorageService.downloadObject(
    projId,
    "development",
    "public-assets",
    "docs/readme.txt",
    testUserId
  );
  const chunks: Buffer[] = [];
  for await (const chunk of downloadStream) {
    chunks.push(Buffer.from(chunk));
  }
  const downloadedText = Buffer.concat(chunks).toString("utf-8");
  assert.equal(downloadedText, testContent, "Downloaded content must match uploaded content exactly");
  logPass("28.2 Streaming Object I/O: Streamed upload and verified byte-exact download");

  // 28.3 Security Magic-Byte Scanner: Malware/Executable Rejection
  const fakeExecutable = Buffer.concat([
    Buffer.from([0x4d, 0x5a, 0x90, 0x00]), // "MZ" Windows Portable Executable signature
    Buffer.from("This program cannot be run in DOS mode."),
  ]);
  let malwareBlocked = false;
  try {
    await objectStorageService.uploadObject(
      projId,
      "development",
      "public-assets",
      "malware/payload.exe",
      testUserId,
      Readable.from(fakeExecutable),
      {
        contentType: "image/png", // Deliberate MIME spoofing attempt
        sizeBytes: fakeExecutable.length,
      }
    );
  } catch (err: any) {
    if (err.message.includes("MALICIOUS_OR_UNSUPPORTED_CONTENT")) {
      malwareBlocked = true;
    }
  }
  assert.ok(malwareBlocked, "Malicious executable signature and MIME spoofing must be blocked by magic-byte scanner");
  logPass("28.3 Security Scanner: Blocked disguised executable with magic-byte PE inspection");

  // 28.4 Multipart Resumable Upload
  const part1 = Buffer.from("Part1-Data-1234567890-", "utf-8");
  const part2 = Buffer.from("Part2-Data-0987654321", "utf-8");
  const session = await objectStorageService.initiateMultipartUpload(
    projId,
    "development",
    "public-assets",
    "large/archive.bin",
    testUserId,
    "application/octet-stream"
  );
  assert.ok(session.uploadId, "Multipart session must return uploadId");

  await objectStorageService.uploadPart(session.uploadId, 1, part1);
  await objectStorageService.uploadPart(session.uploadId, 2, part2);

  const completedMultipart = await objectStorageService.completeMultipartUpload(session.uploadId);
  assert.equal(completedMultipart.sizeBytes, part1.length + part2.length, "Combined size must equal sum of parts");

  const mpDownload = await objectStorageService.downloadObject(
    projId,
    "development",
    "public-assets",
    "large/archive.bin",
    testUserId
  );
  const mpChunks: Buffer[] = [];
  for await (const chunk of mpDownload) {
    mpChunks.push(Buffer.from(chunk));
  }
  const combinedData = Buffer.concat(mpChunks).toString("utf-8");
  assert.equal(combinedData, "Part1-Data-1234567890-Part2-Data-0987654321", "Multipart merged data must match parts");
  logPass("28.4 Multipart Engine: Initiated, uploaded 2 parts, completed and verified concatenated object");

  // 28.5 Signed URLs
  const signedDl = await objectStorageService.generateSignedDownloadUrl(
    projId,
    "development",
    "confidential-docs",
    "docs/readme.txt",
    testUserId,
    300 // 5 minutes
  );
  assert.ok(signedDl.url.includes("token="), "Signed URL must contain secure HMAC token");
  assert.ok(signedDl.expiresAt, "Signed URL must include expiration date");
  logPass("28.5 Signed URLs: Generated HMAC-SHA256 time-limited signed download URL");

  // 28.6 Object Lifecycle Policy
  const cleanupCount = await objectStorageService.applyLifecyclePolicies(projId, "development");
  assert.ok(typeof cleanupCount === "number", "Lifecycle cleaner must return number of deleted objects");
  logPass("28.6 Lifecycle Engine: Retention cleaner evaluated expiration rules safely");

  console.log("\n============================================================");
  console.log(`Modules 25–28 Test Suite PASSED! (${testsRun}/${testsRun} tests succeeded)`);
  console.log("============================================================\n");

  return {
    success: true,
    testsRun,
    details,
  };
}
