# Blueprint Point 42 — Environment Bindings, Secrets and Isolation

## 1. Overview & Architectural Boundary

Blueprint Point 42 defines the authoritative [EnvironmentBindingService](file:///c:/Users/navin/Downloads/forge-main/forge-main/backend/src/services/environment/environmentBinding.service.ts) and [TargetResolutionService](file:///c:/Users/navin/Downloads/forge-main/forge-main/backend/src/services/environment/targetResolution.service.ts), establishing rigorous separation between development, staging, and production targets.

---

## 2. EnvironmentBinding Contract

An authoritative `EnvironmentBinding` contains:
- `bindingId` and `version`.
- `projectId` and `applicationId`.
- `environmentClass`: `DEVELOPMENT`, `STAGING`, or `PRODUCTION`.
- `databaseProvider`: `postgresql`, `cockroachdb`, or `sqlite`.
- `targetFingerprint`: Cryptographic SHA-256 hash of endpoint metadata.
- `safeDisplayLabel`: Masked presentation label.
- `secretRef`: Vault key reference. **NEVER** stores raw connection strings or passwords.
- `roles`: `{ runtimeRole, inspectionRole, migratorRole }`.
- `poolLimits`: Minimum connections, maximum connections, idle timeout, and connection timeout.
- `protectionLevel`: `SANDBOX`, `CONTROLLED_STAGING`, or `RESTRICTED_PRODUCTION`.
- `verificationHistory`: Timestamped TLS 1.3, target identity, and role verification records.

---

## 3. Security Invariants & Isolation Controls

1. **Step-Up Verification for Production:**
   - Any mutation or rotation of a `PRODUCTION` binding requires explicit step-up verification.
2. **Unified Target Resolution & Pool Lifecycle:**
   - Single target-resolution provider for generated apps, background jobs, and Database Studio.
   - Pool keys are strictly scoped: `bindingId:version:role`.
   - Credential rotation gracefully drains obsolete pools for previous binding versions.
3. **Connection Quarantine on Reset Failure:**
   - When a pooled client connection cannot be cleanly reset, it is immediately discarded and quarantined, preventing cross-tenant session leaks.
4. **Positive Shadow/Scratch Database Verification:**
   - Shadow databases must declare `isDisposable: true`, `environmentClass: DEVELOPMENT`, and unique fingerprints.
   - **CRITICAL INVARIANT:** Production databases are strictly forbidden from acting as scratch or shadow targets.
5. **Promotion & Data Cloning Safety:**
   - Code and schema artifacts are promoted from development to staging to production.
   - Development databases and development credentials are never promoted.
   - Production cloning is disabled by default; sanitized or synthetic fixtures are used instead.
