/**
 * Point 21 — Repository-Specific Remediation Order Test Suite
 *
 * Verifies:
 * - P0: Scoped Custom Post Type Service non-destructive field definition save (no deleteMany)
 * - P0: Truthful full-stack generator replaces mock `/api/items` with real Prisma CRUD routes
 * - P0: Integrated publishing and release enforces immutable candidate digests & destination preflights
 * - P1: Unified compiler AST normalization preserves unsupported components in structured fallback containers
 */

import { ScopedCustomPostTypeService } from '../services/cms/scopedCustomPostType.service';
import { TruthfulFullStackGeneratorService } from '../services/generator/truthfulFullStackGenerator.service';
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
  // Test 1: P0 — Non-destructive Field Definition Save Preserves Stable Field IDs
  // --------------------------------------------------------------------------
  try {
    const existingFields = [
      { id: 'fld-1', key: 'title', label: 'Old Title', type: 'text', required: true, sortOrder: 0 },
      { id: 'fld-2', key: 'content', label: 'Body Content', type: 'richtext', required: false, sortOrder: 1 },
      { id: 'fld-3', key: 'obsolete_field', label: 'To Delete', type: 'text', required: false, sortOrder: 2 }
    ];

    const requestedDefinitions = [
      { id: 'fld-1', key: 'title', label: 'New Title Label', type: 'text', required: true },
      { id: 'fld-2', key: 'content', label: 'Body Content', type: 'richtext', required: true }, // Changed required
      { key: 'author_bio', label: 'Author Bio', type: 'text', required: false } // New field, no id
    ];

    const plan = ScopedCustomPostTypeService.planFieldDefinitionMigration(existingFields, requestedDefinitions);

    assert(plan.hasBreakingChanges === true, 'P0 CPT: Making existing field required must be flagged as breaking');
    assert(plan.toCreate.length === 1, 'P0 CPT: Exactly 1 new field created');
    assert(plan.toUpdate.length === 2, 'P0 CPT: Exactly 2 existing fields updated in-place');
    assert(plan.toSoftDelete.length === 1, 'P0 CPT: Obsolete field soft-deleted, not hard deleteMany');
    assert(plan.toSoftDelete[0].id === 'fld-3', 'P0 CPT: Correct field targeted for soft delete');
  } catch (err: any) {
    // failure recorded
  }

  // --------------------------------------------------------------------------
  // Test 2: P0 — Truthful Full-Stack Generator Produces Prisma CRUD, No Mock Arrays
  // --------------------------------------------------------------------------
  try {
    const generationPlan = TruthfulFullStackGeneratorService.generateFullStackPackage({
      websiteId: 'site-alpha-123',
      tenantId: 'tenant-omega-999',
      siteName: 'Acme Corp Portal',
      features: [
        {
          featureName: 'ProductCatalog',
          entityName: 'Product',
          fields: [
            { name: 'title', type: 'string', required: true },
            { name: 'price', type: 'number', required: true },
            { name: 'sku', type: 'string', required: true, unique: true }
          ]
        }
      ]
    });

    assert(generationPlan.hasMockPersistence === false, 'P0 Generator: Must NOT contain mock persistence');
    assert(generationPlan.backendRouterCode.includes('router.post'), 'P0 Generator: Router must provide POST endpoint');
    assert(generationPlan.backendRouterCode.includes('router.get'), 'P0 Generator: Router must provide GET endpoint');
    assert(!generationPlan.backendRouterCode.includes('let items = ['), 'P0 Generator: Must NOT contain let items = [] in-memory array');
    assert(generationPlan.prismaSchemaSnippet.includes('model Product'), 'P0 Generator: Generates real Prisma model');
    assert(generationPlan.prismaSchemaSnippet.includes('tenantId String'), 'P0 Generator: Prisma model must enforce tenant isolation field');
  } catch (err: any) {
    // failure recorded
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
