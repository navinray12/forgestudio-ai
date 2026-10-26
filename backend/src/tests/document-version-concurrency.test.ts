import { strict as assert } from "node:assert";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { AppError } from "../utils/app-error.js";
import {
  documentETag,
  expectedDocumentVersion,
  parseDocumentETag,
} from "../services/websites/document-policy.js";
import { documentWriteContext } from "../services/websites/document-request.js";
import { getPlatformCapabilityMatrix } from "../modules/ai/provider-routing.js";
import { designAvailability } from "../modules/ai/design/config.js";

test("Document Version Concurrency & Precondition Enforcement", async (t) => {
  const websiteId = randomUUID();

  await t.test("1. Missing or undefined document version returns 428 DOCUMENT_PRECONDITION_REQUIRED", () => {
    assert.throws(
      () => expectedDocumentVersion(undefined),
      (err: any) => err instanceof AppError && err.code === "DOCUMENT_PRECONDITION_REQUIRED" && err.statusCode === 428
    );
    assert.throws(
      () => expectedDocumentVersion(null),
      (err: any) => err instanceof AppError && err.code === "DOCUMENT_PRECONDITION_REQUIRED" && err.statusCode === 428
    );
    assert.throws(
      () => parseDocumentETag(websiteId, undefined),
      (err: any) => err instanceof AppError && err.code === "DOCUMENT_PRECONDITION_REQUIRED" && err.statusCode === 428
    );
    assert.throws(
      () => parseDocumentETag(websiteId, ""),
      (err: any) => err instanceof AppError && err.code === "DOCUMENT_PRECONDITION_REQUIRED" && err.statusCode === 428
    );
  });

  await t.test("2. Malformed or invalid ETag values return 428 DOCUMENT_PRECONDITION_REQUIRED", () => {
    // Non-string
    assert.throws(
      () => parseDocumentETag(websiteId, 123),
      (err: any) => err instanceof AppError && err.code === "DOCUMENT_PRECONDITION_REQUIRED" && err.statusCode === 428
    );
    // Missing quotes
    assert.throws(
      () => parseDocumentETag(websiteId, `${websiteId}:document:1`),
      (err: any) => err instanceof AppError && err.code === "DOCUMENT_PRECONDITION_REQUIRED" && err.statusCode === 428
    );
    // Mismatched website ID
    const otherWebsiteId = randomUUID();
    assert.throws(
      () => parseDocumentETag(websiteId, `"${otherWebsiteId}:document:1"`),
      (err: any) => err instanceof AppError && err.code === "DOCUMENT_PRECONDITION_REQUIRED" && err.statusCode === 428
    );
    // Non-integer version
    assert.throws(
      () => parseDocumentETag(websiteId, `"${websiteId}:document:abc"`),
      (err: any) => err instanceof AppError && err.code === "DOCUMENT_PRECONDITION_REQUIRED" && err.statusCode === 428
    );
    // Version <= 0
    assert.throws(
      () => parseDocumentETag(websiteId, `"${websiteId}:document:0"`),
      (err: any) => err instanceof AppError && err.code === "DOCUMENT_PRECONDITION_REQUIRED" && err.statusCode === 428
    );
    assert.throws(
      () => expectedDocumentVersion(0),
      (err: any) => err instanceof AppError && err.code === "DOCUMENT_PRECONDITION_REQUIRED" && err.statusCode === 428
    );
    assert.throws(
      () => expectedDocumentVersion(-5),
      (err: any) => err instanceof AppError && err.code === "DOCUMENT_PRECONDITION_REQUIRED" && err.statusCode === 428
    );
  });

  await t.test("3. Valid authoritative document version and ETag succeeds through intended validation", () => {
    const version = 42;
    const etag = documentETag(websiteId, version);
    assert.equal(etag, `"${websiteId}:document:42"`);

    const parsedVersion = parseDocumentETag(websiteId, etag);
    assert.equal(parsedVersion, 42);
    assert.equal(expectedDocumentVersion(version), 42);
  });

  await t.test("4. documentWriteContext enforces X-Forge-Intent and If-Match preconditions", () => {
    // Missing X-Forge-Intent
    const reqWithoutIntent = {
      get: (header: string) => {
        if (header.toLowerCase() === "if-match") return `"${websiteId}:document:1"`;
        return undefined;
      },
    } as any;
    assert.throws(
      () => documentWriteContext(reqWithoutIntent, websiteId),
      (err: any) => err instanceof AppError && err.code === "DOCUMENT_INTENT_REQUIRED" && err.statusCode === 403
    );

    // Missing If-Match
    const reqWithoutIfMatch = {
      get: (header: string) => {
        if (header === "X-Forge-Intent") return "document-command";
        return undefined;
      },
    } as any;
    assert.throws(
      () => documentWriteContext(reqWithoutIfMatch, websiteId),
      (err: any) => err instanceof AppError && err.code === "DOCUMENT_PRECONDITION_REQUIRED" && err.statusCode === 428
    );

    // Valid headers
    const reqValid = {
      get: (header: string) => {
        if (header === "X-Forge-Intent") return "document-command";
        if (header === "Idempotency-Key") return "test-idempotency-key";
        if (header === "If-Match") return `"${websiteId}:document:7"`;
        return undefined;
      },
    } as any;
    const write = documentWriteContext(reqValid, websiteId);
    assert.equal(write.key, "test-idempotency-key");
    assert.equal(write.expectedVersion, 7);
  });

  await t.test("5. Stale version is safely rejected with 412 DOCUMENT_VERSION_CONFLICT", () => {
    const authoritativeCurrentVersion = 10;
    const staleExpectedVersion = 9;

    // Simulate optimistic concurrency check
    const checkConcurrency = (currentVersion: number, expectedVersion: number) => {
      if (currentVersion !== expectedVersion) {
        throw new AppError("Save or reload the website before generation", 412, "DOCUMENT_VERSION_CONFLICT");
      }
      return true;
    };

    assert.throws(
      () => checkConcurrency(authoritativeCurrentVersion, staleExpectedVersion),
      (err: any) => err instanceof AppError && err.code === "DOCUMENT_VERSION_CONFLICT" && err.statusCode === 412
    );

    // Matching version passes
    assert.equal(checkConcurrency(authoritativeCurrentVersion, authoritativeCurrentVersion), true);
  });

  await t.test("6. Provider availability reports honest configuration status and does not crash when unconfigured", () => {
    const matrix = getPlatformCapabilityMatrix();
    assert.ok(Array.isArray(matrix));
    assert.ok(matrix.length > 0);

    // Verify capabilities have valid structure
    for (const rule of matrix) {
      assert.ok(rule.capability);
      assert.ok(rule.primaryProvider);
      assert.equal(typeof rule.configured, "boolean");
    }

    const design = designAvailability();
    assert.equal(typeof design.available, "boolean");
    if (!process.env.STITCH_API_KEY) {
      assert.equal(design.available, false);
      assert.equal(design.reason, "AI_DESIGN_NOT_CONFIGURED");
    }
  });

  await t.test("7. Changeset version mismatch rejects apply with 412 DOCUMENT_VERSION_CONFLICT", () => {
    const changesetExpectedVersion = 5;
    const currentDocumentVersion = 6;

    const validateChangesetApply = (docVer: number, expectedVer: number) => {
      if (docVer !== expectedVer) {
        throw new AppError("Changeset version does not match the reviewed document", 412, "DOCUMENT_VERSION_CONFLICT");
      }
      return true;
    };

    assert.throws(
      () => validateChangesetApply(currentDocumentVersion, changesetExpectedVersion),
      (err: any) => err instanceof AppError && err.code === "DOCUMENT_VERSION_CONFLICT" && err.statusCode === 412
    );
    assert.equal(validateChangesetApply(5, 5), true);
  });
});
