# Identity, session and presence boundary — implementation candidate

## Status and scope

This increment replaces user-ID-only proof paths; it is not a production release
approval or the completion of the SaaS architecture. Baseline source is
`9fe421bb09c24fc929f80995bb0df91ac3392564`. The current delivery channel has repository
read tools but no write action or authenticated Git CLI. Changes remain a local
candidate until an authorized publisher applies and commits them. Do not infer a
GitHub push, live IdP verification, deployed migration or browser pass from this file.

Governing requirements: Adaptive SaaS v3 locked L-01/L-02/L-05/L-08/L-10/L-11 and
Backend v2 chapters 09, 10, 24, 31, 34. Existing working workspace/document contracts
are retained and tested. Framework migration, the global capability registry and
whole-repository RLS are separate work.

## Implemented contracts

Production uses configured OIDC authorization-code flow with S256 PKCE, one-use
browser state, nonce and independently verified signed ID-token claims. The pinned
`openid-client` adapter validates the issuer, audience, signature, expiry, auth time
and provider endpoints. ID/access/refresh tokens are not sent to browser storage.
Only an opaque HttpOnly, Secure, host-only session cookie is issued in production.

Identity binding is by issuer and subject. Email collisions with an existing
account are rejected; email alone never links accounts. A self-service link requires
both a fresh verified current session and successful provider authentication. A
privileged existing identity needs a configured, approved MFA authentication
context; global staff identities need the stronger configured context.
The provider's actual factor/recovery policy still needs independent qualification.

Local password and email-code authentication exists only for non-production.
A password proof or initial registration produces an expiring browser-cookie-bound
challenge. User ID alone cannot send/verify codes or set a password. Codes are
hashed using the high-entropy browser secret and challenge ID, not stored raw.
Verification is single use with five attempts, account-wide resend cooldown,
atomic shared database attempt buckets and a finite hashing concurrency budget.
Email acceptance is recorded only after the SMTP receiver accepts delivery.
SMTP uses mandatory verified TLS, bounded stages and an absolute socket deadline.

Auth sessions carry method, audience, authentication time, assurance and account
epoch. Revoking all sessions increments the account epoch, which also invalidates
pending proof. Sensitive session mutations and audit records share one transaction.
Session listings are bounded and do not return tokens, hashes or credentials.
Old unscoped support/impersonation and user-ID password setup return 410.
Scoped support grants are NOT implemented by this retirement.

Presence upgrades require a current authenticated session and the exact browser
origin. Client-supplied user names/IDs are ignored. Joining/rejoining re-authorizes
the website and workspace. Revalidation, security leases, reconnect admission,
payload/frame budgets and outgoing-buffer limits bound the channel. This is a
single-process presence implementation, not distributed collaboration or a
reference-load WebSocket qualification.

## Important compatibility changes

- All legacy sessions are invalidated by the migration. Existing password hashes,
  accounts, workspaces and business documents are not reset.
- All production browser sign-ins require managed OIDC. Do not deploy before
  existing-account binding and administrator enrollment are resolved.
- Old social-provider callback URLs and unscoped support-token routes are retired.
  Configure social federation inside the managed identity provider instead.
- Phone/WhatsApp OTP and local password recovery are not simulated. Account
  recovery in production belongs to the configured IdP.
- Account creation no longer silently provisions commercial access. The existing
  explicit free-plan selection endpoint remains available; organization-scoped
  commercial onboarding is still a separate unfinished feature.
- Authentication uses the existing `VITE_API_URL` contract. API and browser domains,
  SameSite behavior, TLS, reverse proxy and callback routing require deployment
  review; this increment is not a universal cross-site cookie solution.
- Production workspace mutation and staff-role guards require recent approved
  assurance. The editor needs broader step-up UX and other entry-point coverage;
  these guards do not prove every legacy route has migrated.

## Files and boundaries

Application use cases: `backend/src/modules/identity/application/`.
Pure policy: `backend/src/modules/identity/domain/`.
HTTP: `backend/src/modules/identity/http/`.
Ports: `backend/src/platform/ports/identity-*.port.ts`.
Implementations: `backend/src/adapters/postgres/identity.store.ts` and
`backend/src/adapters/identity/`.
Composition: `backend/src/modules/identity/composition.ts`.
Configuration example: `backend/identity.env.example` (placeholders only).
Frontend: `frontend/src/features/identity/`; authentication pages are thin wrappers.
The feature manifest describes this increment only, not the full platform catalogue.
Architecture checks reject provider imports from its domain/application and database
imports from its new HTTP/session controllers.

## Migration and production cutover

Migration: `backend/prisma/migrations/20260928170000_identity_boundary/migration.sql`.

1. Review drift and a real backup; rehearse against a representative isolated copy.
   Do not run `prisma db push` against production.
2. Confirm the IdP issuer, exact callback/client, signed-token algorithm, S256
   support, allowed endpoint origins, factor enrollment and ACR assurance mapping.
3. Approve explicit existing-account issuer/subject bindings using verified
   provider records and dual-control identity migration. The application does not
   auto-fill these from email. Until this migration exists, cutover is blocked.
4. Quiesce legacy authentication; apply the versioned migration under the migration
   identity in an approved window. It adds identity data and invalidates old
   sessions, OTPs and reset proofs; all browsers must sign in again.
5. Run `node dist/operations/identity-cutover-preflight.js` using an authorized,
   read-only operator connection. It reports counts only and blocks missing
   configuration or unbound active accounts. A passing preflight is not a live
   provider acceptance test.
6. Verify ordinary and privileged OIDC login, account linking, recovery, logout,
   revoke-all, workspace access, delivery failures and socket revocation through
   the actual deployed domains. Redact authorization-code query parameters in ingress logs. Keep the release blocked until evidence passes.
7. Rotate previously exposed bootstrap credentials and revoke their sessions;
   removing old code does not revoke stored credentials.

New identity tables are explicitly global security data, not tenant business data.
Restrict their roles and maintain audit retention. Expired challenges/rate buckets
must be purged through an approved, bounded retention job before prolonged
production use; no retention duration or operator schedule is silently invented.

Recovery: do not roll back to user-ID-only proof routes or undo the epoch fence.
Pause new sign-in at ingress if needed, keep the database/audit, repair configuration
or publish a secure compatible build. Reconcile existing identities rather than
resetting privileged passwords from a startup routine.

## Verification boundaries

Locally executable evidence covers TypeScript/Vite builds, source-unit/architecture
checks, actual PostgreSQL migration and negative HTTP contracts, signed OIDC
library fixtures, real local STARTTLS delivery/refusal/deadline scenarios and real
WebSocket admission/revocation. OIDC adapter fixtures use real RSA signatures but
a controlled HTTP transport, not an external vendor tenant.

The local Chromium policy rejects all target URLs before the application opens.
Browser journeys therefore remain BLOCKED, not passed. The new read-only CI
workflow runs the compiled application, real PostgreSQL and browser fixtures when
an authorized publisher commits the candidate. Fixture delivery is injected only
by a test entry point requiring a named, opted-in local database. No production
environment variable enables a universal OTP or fake delivery.

The supplied dependency-audit snapshot still contains high-severity findings.
Network access to the npm registry was unavailable here; no unverified lockfile
downgrade/override was used to hide those findings. Dependency remediation and a
fresh successful scan remain release blockers. The CI dependency job fails on high
findings and preserves its report.

## Still open

External IdP enrollment/recovery, provider-side logout/deprovisioning propagation and callback qualification; browser E2E;
existing-account identity migration; separately secured control audience and
operator application; complete entry-point MFA/authorization coverage; scoped
support grants; dependency remediation; identity retention scheduling;
organization-scoped billing/onboarding; repository-wide RLS; distributed presence;
outbox dispatch/workers, storage scanning, regulated secrets, IaC, load and restore
qualification. Passing this increment's tests does not mark these items complete.
