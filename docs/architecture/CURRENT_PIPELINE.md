# ForgeStudio current end-to-end pipeline

Status: implementation and qualification reference for the current `main` branch.

This document describes the pipeline that exists in the repository today and the production direction. It does not convert unimplemented target architecture into a claim of working code.

## 1. Trust and ownership model

The current SaaS hierarchy is:

```text
User identity
  -> organization membership
     -> organization / tenant
        -> workspace membership
           -> workspace
              -> website
                 -> editor document / revisions
                 -> content and media
                 -> deployments and integrations
```

Organization is the business tenant boundary. Workspace membership is an additional resource boundary; organization membership alone must not grant access to a restricted sibling workspace. Website access is evaluated against the authenticated user, organization, workspace and resource.

## 2. Browser request pipeline

```text
React/Vite browser
  -> centralized API call
  -> same application origin in production
  -> browser-origin / CSRF-sensitive admission where required
  -> session authentication
  -> active-account and session-version checks
  -> requested organization/workspace resolution
  -> current membership / resource authorization
  -> schema and business validation
  -> application/service operation
  -> PostgreSQL transaction
  -> response with stable failure semantics
```

The frontend may hide actions based on capability information, but server authorization remains authoritative.

On logout or an authentication transition, scoped browser state must be discarded. An old browser response or WebSocket connection is not a durable grant of access.

## 3. Managed identity pipeline

Production identity is designed around managed OIDC. Local password/OTP flows are restricted to approved non-production/test modes.

```text
Browser
  -> begin OIDC authorization
  -> state + nonce + PKCE S256 challenge
  -> managed identity provider
  -> callback
  -> issuer / audience / signature / expiry / nonce verification
  -> issuer+subject identity binding
  -> active Forge account validation
  -> Forge session creation
  -> HttpOnly browser session
```

Email equality alone does not establish an external identity binding.

Privileged operations use authentication-assurance checks. Identity cutover has an explicit preflight because enabling managed-only production authentication before existing users are correctly bound can lock users out.

### Local/test verification

Local verification uses expiring, single-use challenges. Challenges are browser-bound, rate limited and transactionally consumed. Failed delivery must not create a usable successful verification state.

## 4. Session pipeline

```text
incoming session token
  -> token hash lookup
  -> expiry / revocation validation
  -> account active-state validation
  -> account/session security-version validation
  -> authenticated request context
```

Users can inspect and revoke sessions. Security-sensitive revocation and mandatory audit behavior are intended to commit consistently.

## 5. Workspace command pipeline

Workspace writes use explicit authorization and durable command identity.

```text
authenticated request
  -> organization membership
  -> workspace membership / role
  -> operation permission
  -> idempotency key + normalized request identity
  -> transaction
       -> business mutation
       -> mandatory audit record
       -> workspace outbox intent
       -> durable command result
  -> commit
  -> response
```

The same idempotency key with a different logical payload is a conflict. Concurrent duplicates converge on one committed business result.

Workspace lifecycle currently includes creation, settings, member administration, in-organization invitations, archive/restore and controlled ownership/role changes. Archived/read-only workspaces reject protected child mutations.

## 6. Editor load and save pipeline

### Load

```text
editor route
  -> authenticated website request
  -> current organization/workspace/resource authorization
  -> server document + documentVersion
  -> editor state
```

Browser recovery data must never override a current server denial.

### Save

```text
editor change
  -> save coordinator
  -> If-Match: expected document version
  -> Idempotency-Key
  -> X-Forge-Intent: document-command
  -> current authorization
  -> transactional conditional update
  -> audit / revision behavior
  -> new document version
```

A stale editor receives a precondition conflict rather than silently overwriting newer data. An uncertain network result retries the same logical command identity before later edits are considered committed.

## 7. Realtime collaboration/presence pipeline

```text
WebSocket connection
  -> approved browser origin
  -> current authenticated session
  -> connection admission limits
  -> website/workspace authorization
  -> room join
  -> bounded payload/buffer handling
  -> recurring authorization freshness checks
  -> disconnect/reject after revocation
```

Client-supplied identity is not authoritative. The current presence implementation is not a claim of horizontally distributed realtime capacity.

## 8. Subscription and commercial pipeline

The unsafe historical pattern of activating paid access from plan selection is not the intended production contract.

The production commercial flow is:

```text
organization selects commercial plan
  -> trusted checkout intent
  -> payment provider
  -> signed/verified provider event
  -> durable provider-event inbox
  -> idempotent reconciliation
  -> organization subscription state
  -> entitlement version
  -> quota/seat availability
  -> authorized feature execution
```

Free/trial/manual grants must be explicit and auditable.

Important: complete organization-scoped provider checkout, verified billing webhooks, seats, usage reservations and reconciliation remain separate implementation work until their dedicated release gates pass.

## 9. Durable asynchronous execution target

Business transactions that require asynchronous work use the transactional-outbox contract:

```text
business transaction
  -> business state
  -> audit intent
  -> outbox event
  -> commit

outbox dispatcher
  -> queue/event adapter
  -> bounded worker
  -> idempotent consumer/inbox
  -> side effect
  -> durable result / retry / reconciliation / DLQ
```

Accepted durable work must never exist only in process memory. External timeouts can produce an unknown outcome and must be reconciled rather than blindly repeated.

The repository has outbox foundations for selected flows. Full production dispatcher/queue/worker coverage is still a staged platform migration and must not be inferred from this document.

## 10. Publishing pipeline

The production publishing contract is:

```text
authorized editor revision
  -> publish request
  -> optional approval
  -> immutable source revision
  -> durable deployment record
  -> outbox/job
  -> renderer
  -> destination adapter
  -> verification
  -> SUCCEEDED / FAILED / RECONCILIATION_REQUIRED
```

Published output must reference an immutable source revision and renderer version. A local database rollback cannot pretend to undo an already completed remote WordPress/SFTP side effect.

## 11. Files and object-storage pipeline

The required production object lifecycle is:

```text
authorize upload + reserve quota
  -> server-generated tenant/workspace object identity
  -> short-lived upload capability
  -> quarantine object
  -> size / MIME signature / extension / digest checks
  -> malware and archive-safety checks
  -> immutable approved object version
  -> processing/indexing
  -> authorized download
```

Quarantine objects are not public. Download authorization comes from application metadata, not from knowing an object key.

Full production S3/quarantine/scanning coverage remains a dedicated implementation/qualification area.

## 12. Integration pipeline

Connections are tenant/workspace scoped. Credentials are referenced through governed secret storage rather than returned to ordinary UI clients.

Inbound webhook target contract:

```text
bounded raw request
  -> registered connection
  -> exact-byte provider signature verification
  -> freshness/replay checks
  -> tenant binding
  -> durable inbox
  -> asynchronous processing
```

Outbound target contract:

```text
durable delivery intent
  -> current tenant/feature/connection checks
  -> SSRF-safe destination validation
  -> bounded egress client
  -> idempotent provider operation where available
  -> retry / terminal failure / unknown-outcome reconciliation
```

## 13. Database and migration pipeline

Production schema changes are versioned migrations. Runtime HTTP authentication and ordinary application services must not repair schema with DDL.

The safe rollout model is expand -> compatible application -> bounded backfill -> verify -> switch reads/writes -> later contract/remove.

Tenant isolation requires both application predicates and PostgreSQL RLS for applicable tenant tables, using a non-owner/non-BYPASSRLS runtime role and transaction-local tenant context on the same acquired connection.

Repository-wide legacy ownership/RLS migration remains an active production-readiness workstream.

## 14. Current CI and qualification pipeline

Current `main` uses multiple independent gates:

1. Production build validation.
2. Production-hardening source-unit tests.
3. Workspace PostgreSQL and HTTP contracts.
4. ForgeStudio Part B regression suite.
5. Reviewed SaaS increment qualification for staged security-sensitive changes.
6. Identity-boundary qualification where applicable.
7. Dependency candidate qualification for explicit dependency remediation.

The reviewed SaaS increment qualification stages hash-bound Git blobs and then runs:

```text
dependency audit evidence
  -> locked backend/frontend install
  -> backend production build
  -> frontend production build
  -> source + architecture checks
  -> signed OIDC fixtures
  -> real local TLS SMTP contracts
  -> PostgreSQL workspace/document contracts
  -> identity migration + negative HTTP contracts
  -> actual WebSocket authorization/revocation tests
  -> compiled workspace/editor browser journey
  -> identity browser journey
  -> high/critical dependency release gate
  -> export exact tested blob identities
```

A candidate is published only from those tested blob identities. A failed qualification remains evidence and is not rewritten as a pass.

## 15. Deployment pipeline target

```text
source commit
  -> CI quality/security gates
  -> immutable application artifacts
  -> SBOM / vulnerability evidence / provenance
  -> DEV
  -> TEST
  -> STAGING
       -> migration rehearsal
       -> smoke/E2E
       -> security
       -> representative load/failure checks
  -> approved production promotion
  -> canary/rolling deployment
  -> health/SLO stabilization
  -> complete or rollback/forward-repair
```

The same artifact digest should be promoted between environments. Environment configuration and secrets change independently of the compiled artifact.

## 16. Target AWS runtime topology

The target production topology remains:

```text
Route 53
  -> CloudFront
  -> WAF
  -> ALB
  -> private ECS/Fargate application roles
       -> API
       -> realtime
       -> integration ingress
       -> workers
       -> scheduler
  -> managed PostgreSQL
  -> S3
  -> durable queues
  -> optional Redis/search/AI adapters by qualified profile
  -> Secrets Manager/KMS
  -> OpenTelemetry/approved telemetry backend
```

The separately secured Platform Control Center is a distinct privileged boundary and must not become a synchronous dependency for every tenant request.

## 17. Control Center target pipeline

```text
operator request
  -> separate platform identity/audience
  -> change draft
  -> dependency and safety validation
  -> impact plan + digest
  -> independent approval where required
  -> apply through controlled runtime/IaC/deployment mechanism
  -> verify
  -> stabilize
  -> complete / rollback / manual forward repair
```

Authentication, authorization, tenant isolation, durable primary storage, mandatory audit and other locked controls have no ordinary off switch.

## 18. Observability and operations

Every important operation should carry request/correlation identity through asynchronous work. Logs must redact credentials, cookies, tokens, verification material and sensitive payloads.

Production qualification requires operational evidence for:
- API latency/errors/saturation.
- database pools, locks and slow queries.
- outbox and queue age.
- worker retries/DLQ.
- integration and webhook outcomes.
- security and privileged changes.
- deployment/configuration versions.
- backup/restore state.

Liveness is process health. Readiness is traffic admission. Optional provider failure must not create a restart storm.

## 19. Backup and recovery pipeline

```text
scheduled protected backups / PITR / object versions
  -> independent restore environment
  -> schema/config/secret recovery
  -> integrity validation
  -> job/event reconciliation
  -> controlled traffic cutover
  -> measured RPO/RTO evidence
```

A successful backup job is not restore evidence. Production readiness requires an actual restore exercise for the selected deployment profile.

## 20. Production-readiness rule

A successful build is necessary but not sufficient.

A capability is production-ready only when its authorization and tenant boundaries, durable behavior, migrations, failure/degraded behavior, telemetry, recovery path and reproducible acceptance evidence are complete for the declared deployment profile.

At the time this document was introduced, identity/workspace/editor qualification is materially stronger, while repository-wide RLS, full commercial billing, durable worker coverage, production object storage, the full Control Center, AWS provisioning, restore exercises and contracted load qualification remain explicit workstreams rather than hidden assumptions.
