/**
 * Point 07: Immutable Input Snapshot Service
 * 
 * Captures and pins an immutable, cryptographic snapshot of all generation inputs
 * across Point 06 authoritative records and Point 05 capability manifests before
 * any AI invocation:
 * - Approved business facts, claims, and offers (Record 1)
 * - Base SiteSpec revision (Record 2)
 * - Protected source manifest & hashes (Record 3)
 * - Content schema & content entries snapshot (Record 4)
 * - Capability manifest & selected profile (Point 05)
 * - Provider routing policy version & compiler pipeline version
 */

import { createHash } from "crypto";
import { record1BusinessFactsService } from "../authoritative/record1-business-facts.service.js";
import { record2SiteSpecService } from "../authoritative/record2-sitespec.service.js";
import { record3SourceManifestService } from "../authoritative/record3-source-manifest.service.js";
import { record4ContentSchemaService } from "../authoritative/record4-content-schema.service.js";
import { capabilityManifestService } from "../capabilities/capabilityManifest.js";

export interface ImmutableInputSnapshot {
  snapshotId: string;
  jobId: string;
  websiteId: string;
  tenantId: string;
  capturedAt: string;
  snapshotHash: string;
  brief: {
    purpose: string;
    targetAudience: string;
    requiredRoutes: string[];
    selectedProfile: string;
  };
  factsRecord: {
    revision: number;
    approvedFactsCount: number;
    approvedClaims: string[];
    offersCount: number;
  };
  siteSpecRecord: {
    baseRevision: number;
    pageCount: number;
    componentCount: number;
    tokensCount: number;
  };
  sourceRecord: {
    sourceRevision: number;
    protectedFileCount: number;
    protectedFileHashes: Record<string, string>;
  };
  contentRecord: {
    schemaRevision: number;
    schemaTypes: string[];
    entriesCount: number;
  };
  capabilities: {
    profile: string;
    requiredCapabilities: string[];
    manifestHash: string;
  };
  toolchain: {
    compilerVersion: string;
    routingPolicyVersion: string;
    promptTemplateVersion: string;
  };
}

export class ImmutableInputSnapshotService {
  private static instance: ImmutableInputSnapshotService;
  private snapshots = new Map<string, ImmutableInputSnapshot>();

  private constructor() {}

  public static getInstance(): ImmutableInputSnapshotService {
    if (!ImmutableInputSnapshotService.instance) {
      ImmutableInputSnapshotService.instance = new ImmutableInputSnapshotService();
    }
    return ImmutableInputSnapshotService.instance;
  }

  public reset(): void {
    this.snapshots.clear();
  }

  /**
   * Captures an immutable input snapshot before AI generation begins.
   * Never mutates after creation.
   */
  public async captureSnapshot(params: {
    snapshotId: string;
    jobId: string;
    websiteId: string;
    tenantId: string;
    brief: {
      purpose: string;
      targetAudience: string;
      requiredRoutes: string[];
      selectedProfile: string;
    };
    routingPolicyVersion?: string;
    promptTemplateVersion?: string;
  }): Promise<ImmutableInputSnapshot> {
    const existing = this.snapshots.get(params.snapshotId);
    if (existing) {
      return existing;
    }

    // 1. Fetch Record 1: Approved Business Facts & Offers
    const facts = record1BusinessFactsService.getApprovedFacts(params.websiteId);
    const offers = record1BusinessFactsService.getApprovedOffers(params.websiteId);
    const factsRevision = record1BusinessFactsService.getFactsRevision(params.websiteId);

    // 2. Fetch Record 2: Base SiteSpec
    const siteSpec = record2SiteSpecService.getSiteSpec(params.websiteId);

    // 3. Fetch Record 3: Protected Source Manifest
    const protectedFiles = record3SourceManifestService.getProtectedFiles(params.websiteId);
    const sourceRevision = record3SourceManifestService.getSourceRevision(params.websiteId);
    const protectedHashes: Record<string, string> = {};
    for (const f of protectedFiles) {
      protectedHashes[f.filePath] = f.contentHash;
    }

    // 4. Fetch Record 4: Content Schema & Entries
    const schemas = record4ContentSchemaService.getContentSchemas(params.websiteId);
    const entries = record4ContentSchemaService.getContentEntries(params.websiteId);
    const schemaRevision = record4ContentSchemaService.getSchemaRevision(params.websiteId);

    // 5. Fetch Point 05 Capability Manifest for Profile
    const profile = params.brief.selectedProfile || "STANDARD_COMMERCE";
    const capabilityManifest = capabilityManifestService.getManifestForProfile(profile);

    // 6. Toolchain versions
    const compilerVersion = "2.2.0"; // Point 06 12-pass deterministic compiler
    const routingPolicyVersion = params.routingPolicyVersion || "2026.04.v1";
    const promptTemplateVersion = params.promptTemplateVersion || "v1.2.0";

    const capturedAt = new Date().toISOString();

    // 7. Compute deterministic cryptographic hash of all captured inputs
    const hashPayload = JSON.stringify({
      brief: params.brief,
      factsRevision,
      approvedClaims: facts.map(f => f.claimText),
      offersCount: offers.length,
      siteSpecRevision: siteSpec?.revision || 0,
      sourceRevision,
      protectedHashes,
      schemaRevision,
      schemaTypes: schemas.map(s => s.typeName),
      entriesCount: entries.length,
      profile,
      capabilities: capabilityManifest.requiredCapabilities,
      compilerVersion,
      routingPolicyVersion,
      promptTemplateVersion
    });

    const snapshotHash = createHash("sha256").update(hashPayload).digest("hex");

    const snapshot: ImmutableInputSnapshot = {
      snapshotId: params.snapshotId,
      jobId: params.jobId,
      websiteId: params.websiteId,
      tenantId: params.tenantId,
      capturedAt,
      snapshotHash,
      brief: { ...params.brief },
      factsRecord: {
        revision: factsRevision,
        approvedFactsCount: facts.length,
        approvedClaims: facts.map(f => f.claimText),
        offersCount: offers.length
      },
      siteSpecRecord: {
        baseRevision: siteSpec?.revision || 0,
        pageCount: siteSpec?.pages.length || 0,
        componentCount: siteSpec?.pages.reduce((acc, p) => acc + (p.components?.length || 0), 0) || 0,
        tokensCount: Object.keys(siteSpec?.designTokens || {}).length
      },
      sourceRecord: {
        sourceRevision,
        protectedFileCount: protectedFiles.length,
        protectedFileHashes: protectedHashes
      },
      contentRecord: {
        schemaRevision,
        schemaTypes: schemas.map(s => s.typeName),
        entriesCount: entries.length
      },
      capabilities: {
        profile,
        requiredCapabilities: [...capabilityManifest.requiredCapabilities],
        manifestHash: capabilityManifest.manifestHash
      },
      toolchain: {
        compilerVersion,
        routingPolicyVersion,
        promptTemplateVersion
      }
    };

    this.snapshots.set(params.snapshotId, snapshot);
    return snapshot;
  }

  public getSnapshot(snapshotId: string): ImmutableInputSnapshot {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error(`Immutable input snapshot not found: ${snapshotId}`);
    }
    return snapshot;
  }

  /**
   * Validates whether underlying protected source has mutated since the snapshot was taken.
   * If mutated, detects conflict and blocks stale promotion.
   */
  public verifySourcePreservation(snapshotId: string): { isClean: boolean; conflicts: string[] } {
    const snapshot = this.getSnapshot(snapshotId);
    const conflicts: string[] = [];

    const currentFiles = record3SourceManifestService.getProtectedFiles(snapshot.websiteId);
    const currentHashMap = new Map<string, string>();
    for (const f of currentFiles) {
      currentHashMap.set(f.filePath, f.contentHash);
    }

    for (const [path, expectedHash] of Object.entries(snapshot.sourceRecord.protectedFileHashes)) {
      const currentHash = currentHashMap.get(path);
      if (!currentHash) {
        conflicts.push(`Protected file deleted: ${path}`);
      } else if (currentHash !== expectedHash) {
        conflicts.push(`Protected file modified since snapshot: ${path}`);
      }
    }

    return {
      isClean: conflicts.length === 0,
      conflicts
    };
  }
}

export const immutableInputSnapshotService = ImmutableInputSnapshotService.getInstance();
