# Architectural Decision Record (ADR 001)
## Framework Architecture Reconciliation: Express Host Baseline & Framework-Independent Domain Services

### Status
**Accepted / Ratified Baseline Reconciliation** (Point 02 Milestone)  
**Date:** 2026-10-12  
**Deciders:** ForgeStudio Core Architecture & Platform Engineering  

---

### 1. Context & Problem Statement

The *Website Master Blueprint v1.3* references enterprise modular architecture and NestJS application structure conventions. However, the existing active ForgeStudio production platform is implemented with a hardened Express 5.x host (installed: `express@^5.2.1`) running TypeScript and Prisma.

Rewriting the existing platform into NestJS or introducing duplicate controller/service trees would:
1. Introduce catastrophic regression risk across 50+ verified platform features (publishing, multi-tenant RBAC, WordPress connector, CMS sync, code generation bridges, and revision history).
2. Disrupt multiple engineering teams currently collaborating on active feature branches.
3. Create maintenance friction and code drift if dual Express/NestJS controllers were maintained simultaneously.

A clear, authoritative decision record is required to define the framework boundary, document the baseline deviation, and establish guardrails for domain service architecture.

---

### 2. Architectural Decision

1. **Retain Express as Host Runtime:**  
   ForgeStudio retains its existing Express 5.x HTTP server and router topology as the active API host. No framework migration or duplicate controller layer will be introduced at this time.

2. **Enforce Framework-Independent Domain Services:**  
   All core domain logic—including website document persistence, publishing pipelines, revision snapshots, tenant scoping, RBAC checks, and audit logging—must remain strictly decoupled from HTTP transport primitives.
   - Domain functions MUST NOT accept Express `Request`, `Response`, or `NextFunction` objects.
   - Domain functions MUST accept plain TypeScript objects, explicit transaction contexts, and typed identifiers.
   - Errors MUST be raised using typed domain errors (e.g., `AppError` with numeric HTTP hints and string machine codes) rather than directly sending HTTP responses.
   - Controllers in `src/controllers/` serve purely as thin HTTP adapters that unpack request headers/params/body, delegate to domain services, map headers (such as `ETag` and `Cache-Control`), and serialize JSON responses.

3. **Explicitly Defer NestJS Rewrite:**  
   Wholesale migration to NestJS is formally deferred. The current Express runtime satisfies all throughput, routing, middleware, and operational requirements.

---

### 3. Conditions for Future Framework Evolution

A NestJS host adapter or enterprise modular gateway may only be considered in the future if all of the following conditions are met:
1. **Clear Enterprise Driver:** An explicit requirement emerges for enterprise microservice transports (e.g., gRPC, Kafka event streaming) that natively benefit from NestJS's transport abstraction layer.
2. **Additive Adapter Pattern Only:** Any future NestJS introduction must exist strictly as an additive adapter layer consuming the unchanged, framework-independent domain services in `src/services/`. Domain logic must never be duplicated or rewritten.
3. **100% Backward Compatibility:** All existing route contracts, HTTP response shapes, ETag concurrency controls, custom headers, and security middlewares must demonstrate complete regression parity.
4. **Formal Change Review:** Transition requires explicit multi-team architectural sign-off and an end-to-end integration test pass.

---

### 4. Consequences & Verification

- **Positive:**
  - Zero disruption to active development on feature branches.
  - Zero duplicate code or dual-framework synchronization overhead.
  - Strict preservation of all existing integration test suites.
  - Clear architectural standard for future service authors.

- **Negative:**
  - Deviation from the initial high-level NestJS styling mentioned in earlier blueprint drafts.

- **Compliance Guardrail:**
  Any PR that imports Express primitives (`Request`, `Response`) inside `src/services/` (outside of dedicated HTTP transport adapters) violates this ADR and will be rejected in code review.
