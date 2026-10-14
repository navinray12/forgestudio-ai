# 16. Hosting, Export and WordPress Compatibility

**Document Version:** 1.0.0  
**Blueprint Reference:** Point 16 — Hosting, export and WordPress compatibility  
**Repository:** `navinray12/forgestudio-ai`

---

## 1. Executive Architecture Summary

Point 16 establishes authoritative hosting profiles, honest destination capability disclosures, reproducible portable full-stack exports, and genuine WordPress compatibility mapping.

### Core Invariants:
1. **Separation of Destination from Internal Complexity:** Hosting wizard clearly reports required customer credentials, costs, operational burdens, nonportable dependencies, and rollback mechanisms.
2. **Fail-Closed Custom Runtime Isolation:** Profile B (Managed Custom Runtime) strictly fails closed unless qualified kernel-level container isolation (gVisor/cgroups) and network egress restrictions are proven. Node `vm` and unsandboxed child processes are explicitly rejected.
3. **Verified Portability:** Profile C (Portable Full Stack) packages self-contained source, lockfiles, ordered migrations, environment variable schemas without secrets, and verified smoke-test contracts (fresh admin creation, post publishing, lead persistence, and DB backup restoration).
4. **Honest Static Snapshots:** Profile D (Static Snapshot) discloses that dynamic features (Postgres lead capture, server auth) are excluded and require external webhooks.
5. **Native WordPress Semantics:** WordPress export maps native post types, statuses, permalinks, and object permissions. Unsupported React Server Actions are preserved as protected source rather than falsely converted to broken PHP.
6. **SFTP Honesty:** Raw SFTP/FTP destinations explicitly declare the absence of atomic switching, database migrations, and instant rollbacks.

---

## 2. Destination Capability Matrix

| Destination Profile | Stages Supported | Server-Side Execution | DB Migrations | Atomic Switch | Instant Rollback | Dynamic Forms/CMS |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Managed Declarative** | All 6 Stages | No (Static/CDN) | Yes | Yes | Yes | Yes (Managed) |
| **Managed Custom Runtime** | All 6 Stages | Yes (Container) | Yes | Yes | Yes | Yes |
| **Portable Full Stack** | All 6 Stages | Yes (Self-Hosted) | Yes | Yes | Yes | Yes |
| **Static Snapshot** | Plan, Preflight, Verify, Promote | No | No | No | No | No (Static Only) |
| **WordPress Local** | All 6 Stages | Yes (PHP) | Yes (MySQL) | Yes | Yes | Yes (WP Core) |
| **Limited SFTP** | Plan, Preflight, Verify, Promote | No | No | No | No | No (Files Only) |

---

## 3. Services Overview

### 3.1 Destination Capability Matrix (`destinationCapabilityMatrix.service.ts`)
- Manages the destination matrix and produces wizard reports detailing credentials, costs, and unsupported features.

### 3.2 Hosting Profiles Engine (`hostingProfilesEngine.service.ts`)
- Qualifies profiles against rigorous criteria:
  - Profile A: Edge cache invalidation, tenant isolation, control plane outage resilience.
  - Profile B: Fails closed without gVisor/container isolation.
  - Profile C: Verifies portable full-stack deployment contracts.
  - Profile D: Generates excluded dynamic dependencies manifest.
  - Profile E: Verifies cloud-disconnected editing and WordPress object authorization.

### 3.3 Portable Export Package (`portableExportPackage.service.ts`)
- Produces reproducible export manifests with SHA-256 integrity checksums.
- Explicitly excludes platform master keys and AI tokens while supplying exact environment variable schemas.

### 3.4 WordPress Compatibility Adapter (`wordPressCompatibilityAdapter.service.ts`)
- Maps CMS entities to native WordPress posts and permalinks.
- Identifies unsupported React Server Actions (`use server`) and preserves them in custom blocks.
- Assesses SFTP hosts and logs lack of atomic switching and automated rollbacks.
