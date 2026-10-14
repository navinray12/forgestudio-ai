/**
 * Point 21 — Repository-Specific Remediation Order Test Suite
 *
 * Verifies:
 * - P0: Integrated publishing and release enforces immutable candidate digests & destination preflights
 * - P1: Unified compiler AST normalization preserves unsupported components in structured fallback containers
 */

import { IntegratedPublishingReleaseService } from '../services/publishing/integratedPublishingRelease.service';
import { UnifiedCompilerNormalizationService } from '../services/compiler/unifiedCompilerNormalization.service';

export async function runPoint21Tests(): Promise<{ passed: number; failed: number; errors: string[] }> {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  function assert(condition: boolean, msg: string) {
    if (!condition) {
      failed++;
      errors.push(msg);
      throw new Error(`Assertion failed: ${msg}`);
    }
    passed++;
  }

  // --------------------------------------------------------------------------
  // Test 3: P0 — Integrated Publishing Rejects Tampered Digest & Missing Verification
  // --------------------------------------------------------------------------
  try {
    const validCandidate = {
      candidateId: 'cand-777',
      websiteId: 'site-123',
      tenantId: 'tenant-456',
      expectedDigest: 'sha256-verified-digest-abc123xyz',
      destinationType: 'DOCKER_COMPOSE' as const,
      isVerified: true
    };

    // Preflight check
    const preflight = IntegratedPublishingReleaseService.preflightPublishCandidate(validCandidate);
    assert(preflight.allowed === true, 'P0 Publishing: Valid verified candidate passes preflight');

    // Tampered digest check
    const tamperedCandidate = {
      ...validCandidate,
      actualArtifactDigest: 'sha256-tampered-corrupted-hash'
    };
    const tamperedPreflight = IntegratedPublishingReleaseService.preflightPublishCandidate(tamperedCandidate);
    assert(tamperedPreflight.allowed === false, 'P0 Publishing: Tampered artifact digest must be blocked');
    assert(tamperedPreflight.rejectionReason?.includes('digest mismatch') || false, 'P0 Publishing: Explains digest mismatch');

    // Unverified candidate check
    const unverifiedCandidate = {
      ...validCandidate,
      isVerified: false
    };
    const unverifiedPreflight = IntegratedPublishingReleaseService.preflightPublishCandidate(unverifiedCandidate);
    assert(unverifiedPreflight.allowed === false, 'P0 Publishing: Unverified candidate must be blocked from publishing');
  } catch (err: any) {
    // failure recorded
  }

  // --------------------------------------------------------------------------
  // Test 4: P1 — Unified Compiler Normalization Preserves Unsupported Components
  // --------------------------------------------------------------------------
  try {
    const inputNodes = [
      {
        id: 'node-1',
        type: 'STANDARD_BUTTON',
        props: { label: 'Submit', variant: 'primary' },
        children: []
      },
      {
        id: 'node-2',
        type: 'CUSTOM_3D_VIEWER_PLUGIN', // Unsupported custom component
        props: { modelUrl: 'https://example.com/model.glb', fov: 45 },
        children: []
      }
    ];

    const normalized = UnifiedCompilerNormalizationService.normalizeAst(inputNodes, 'STATIC_HTML');

    assert(normalized.nodes.length === 2, 'P1 Compiler: Exactly 2 nodes preserved in normalized AST');
    assert(normalized.unsupportedCount === 1, 'P1 Compiler: Identifies 1 unsupported node');

    const fallbackNode = normalized.nodes.find(n => n.id === 'node-2');
    assert(fallbackNode !== undefined, 'P1 Compiler: Unsupported node must NOT be silently discarded');
    assert(fallbackNode?.isFallbackContainer === true, 'P1 Compiler: Wrapped in fallback container');
    assert(fallbackNode?.fallbackMetadata?.originalType === 'CUSTOM_3D_VIEWER_PLUGIN', 'P1 Compiler: Retains original component identity and props');
  } catch (err: any) {
    // failure recorded
  }

  return { passed, failed, errors };
}
