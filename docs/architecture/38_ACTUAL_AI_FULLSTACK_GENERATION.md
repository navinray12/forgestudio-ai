# Architecture Specification: Actual AI Full-Stack Generation Pipeline (Point 38)

## 1. Overview & Principles

ForgeStudio Blueprint Point 38 establishes the 10-stage full-stack application generation pipeline. It guarantees:
- AI generation produces real, functional software (controllers, repositories, use cases, domain rules, typed contracts, migrations, tests, frontend clients) rather than static mock arrays.
- Complete provenance and auditing with secret redaction (credentials, tokens, keys).
- Truthful generation mode reporting (`provider-generated`, `deterministic-recompile`, `approved-template`).
- Independent verification of database persistence writes using isolated, disposable test environments (never scratch execution on production databases).
- Bounded repair iterations (maximum 3 attempts) that create patch artifacts with test evidence, never test suppression.

## 2. The 10-Stage Generation Pipeline

```
[1. UNDERSTAND] ──► [2. MODEL] ──► [3. PLAN] ──► [4. GENERATE] ──► [5. ASSEMBLE]
                                                                        │
[10. PROMOTE/EXPORT] ◄── [9. REVIEW] ◄── [8. REPAIR] ◄── [7. VERIFY] ◄── [6. PREPARE_DB]
```

1. **Understand:** Analyzes functional brief, requirement IDs, actor inventory, and use cases. Detects critical ambiguities (e.g. unspecified payment gateways) and transitions to `clarifying` or `blocked` rather than making hallucinations.
2. **Model:** Produces validated proposals for `ApplicationSpec` and `SiteSpec`. Maintains strict separation across CMS, Application, and Platform domains.
3. **Plan:** Emits an immutable plan with API contracts digest, database migration digests, target runtime, and usage costs.
4. **Generate:** Synthesizes real application code:
   - Express/Next controllers with session binding.
   - Authorized repositories enforcing tenant isolation.
   - Domain services implementing business invariants and state transitions.
   - Physical SQL migrations (`CREATE TABLE`, indexes).
   - Automated test specifications.
   - Frontend fetch client bindings.
5. **Assemble:** Connects routes, imports, client/server boundaries, and deployment configurations.
6. **Prepare Database:** Executes schema migrations against an isolated, disposable test database and populates synthetic test fixtures.
7. **Verify:** Executes test suites asserting API contracts, authorization rules, and persistence writes.
8. **Repair:** Bounded repair loop (up to 3 configured attempts). Emits formal patch records; never suppresses failing tests or substitutes fake backends.
9. **Review:** Summarizes file changes, schema diffs, routes, permissions, and test evidence for developer/operator inspection.
10. **Promote / Export:** Commits verified candidate to an authoritative checkpoint via `WorkspaceCoordinatorService`, leaving existing production releases intact until explicit promotion.

## 3. Truthful Generation States & Resource Contract

The pipeline transitions across 13 explicit lifecycle states:
- `requested`: Job received.
- `clarifying`: User input required for missing critical business rules.
- `spec-ready`: ApplicationSpec proposal generated.
- `plan-ready`: Immutable plan and digests approved.
- `generating`: Code synthesis in progress.
- `assembling`: Wires imports and client bindings.
- `migration-preflight`: Disposable database schema preparation.
- `testing`: Verifying builds, tests, and persistence writes.
- `repair-pending`: Bounded repair patch in progress.
- `verified`: All verification tests and persistence checks passed.
- `blocked`: Invariant or policy violation halting generation.
- `failed`: Terminal failure with diagnostic record.
- `cancelled`: User or operator cancelled.

## 4. Security Invariants
- **Session-Bound Tenancy:** Controllers extract `tenantId` strictly from authenticated user sessions (`(req as any).user.tenantId`). User request bodies attempting to inject or modify `tenantId` are ignored or rejected.
- **Privileged Workflow Commands:** State transitions (e.g., `approveRecord`, `cancelBooking`) are modeled as dedicated command endpoints with explicit role requirements (`Admin`), preventing open REST status updates.
