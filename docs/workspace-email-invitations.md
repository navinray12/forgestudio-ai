# Workspace email invitations

Existing `{ userId, role }` in-app invitations remain
compatible. `{ email, role }` invitations support registered and future users.
Neither path grants organization/workspace membership before acceptance.

## Configuration and rollout

1. Review/back up the target database and apply migration
   `20261022100000_workspace_email_invitations` using the migration identity
   (`npm --prefix backend run db:migrate`). Do not use `db push` in production.
   The migration backfills normalized recipient emails, retains old invitations,
   and aborts atomically if historical pending email duplicates need resolution.
   It does not resolve duplicates or grant memberships automatically. Existing
   invitations with no email remain bound to their user ID.
   Legacy local databases missing the SaaS foundations migration receive only the
   pure `forge_actor_uuid()` transaction-context helper needed by this migration;
   an existing helper is retained. If unrelated migrations are failed/pending,
   review those separately rather than blindly deploying the entire backlog.
2. Set the same **WORKSPACE_INVITATION_TOKEN_KEY** on API and worker: 32 random
   bytes encoded as 64 hex characters. Generate/store it through the deployment's
   secret manager; do not commit or print it. This key derives domain-separated
   HMAC-SHA256 invitation proofs; only SHA-256 proof hashes are stored. Rotating
   it requires renewing undelivered pending invitations. Already delivered proofs
   remain verifiable against their stored hash until renewal/revocation/expiry.
3. Configure **FRONTEND_URL** as the exact browser origin (HTTPS in production),
   and **SMTP_HOST**, **SMTP_PORT** (465, 587 or 2525), **SMTP_USER**,
   **SMTP_PASSWORD**, **SMTP_FROM**. Use an authenticated sender/domain configured
   for the provider's SPF/DKIM requirements. Non-465 connections require STARTTLS.
4. Deploy API and `npm --prefix backend run worker` after the migration and
   Prisma generation/build. The existing worker model needs a dedicated database
   identity with cross-tenant outbox polling access (BYPASSRLS); keep the API
   identity restricted. Do not grant worker credentials to browser clients.
5. Deploy the frontend invitation page at `/workspace-invitations/:id`. Its
   tab-scoped session context preserves the proof through login/signup, OTP,
   account switching, and the existing OIDC dashboard callback. The proof is
   removed from the address bar and never enters login URLs or provider requests.
   Browser context expires after one hour; users can reopen the original email
   link while the server-side invitation remains valid. Session storage is needed
   to resume across authentication/reloads; the page explains how to recover when
   browser storage is blocked. Successful acceptance clears that context and opens
   `/dashboard/workspaces/:workspaceId`, reusing the existing workspace dashboard.

No migration or real SMTP send is performed by the development validation commands
below against the configured application database.

## HTTP contracts

All paths start with `/api/v1/tenant-workspaces`. Use the existing session cookie,
JSON, `X-Forge-Intent: workspace-command` and an `Idempotency-Key` for commands.
Existing production recent-MFA requirements continue to apply. New email
invitations expire after seven days. Never put proofs in API query parameters.

- `POST /:workspaceId/invitations`: `{ "email": "recipient@example.test", "role": "MEMBER" }`.
  Returns a safe invitation and `delivery: "QUEUED"`, never the secret or hash.
  Owners may invite ADMIN/MEMBER; admins may invite MEMBER. The legacy user-ID
  form remains in-app only, requires an existing verified user, and returns IN_APP.
- Email link: `{FRONTEND_URL}/workspace-invitations/:id#token=...`. The fragment
  keeps the proof out of HTTP request logs and Referer headers. The landing page
  removes it from browser history, retains it in session storage through
  authentication, and never sends it to analytics or logs it.
- `POST /invitations/:id/resolve`: `{ "token": "..." }`. Authenticated, verified
  invited email required. Returns minimal workspace/role/expiry details. Does not
  consume the invitation or create membership.
- `POST /:workspaceId/invitations/:id/accept`: `{ "token": "..." }`. Revalidates
  the signed-in user's verified email, any existing recipient-ID binding, token,
  expiry, pending status, workspace state, and inviter's current authority.
  Organization membership, workspace membership, ACCEPTED status, workspace
  version, audit and journal commit together. Legacy in-app invites still accept
  `{}` only for their bound verified recipient.
- Renew/revoke routes and `If-Match: "invitationId:version"` remain unchanged.
  Email renewals rotate the proof and enqueue a new message. Prior queued versions
  are skipped, and prior links fail. Renewals are throttled to once per minute;
  email enqueueing is capped at 100 per actor/organization/hour, and workspaces
  retain their existing 200 pending-invitation limit. Expired pending invitations
  must be renewed or revoked rather than creating duplicates.

## Delivery and operations

Invitation and delivery intent commit in one Prisma serializable transaction.
The existing workspace outbox gains non-secret `{invitationId, version}` payloads,
attempt counts, availability times and fenced leases. The worker reconstructs the
proof only while composing the email; it is absent from stored jobs and journals.
One worker tick claims one email using `FOR UPDATE SKIP LOCKED`; multiple worker
processes can run safely. A crashed worker's 60-second lease is reclaimable.

SMTP connections have a 10-second absolute deadline. Failed delivery retries with
30-second exponential backoff capped at one hour, up to eight failed attempts.
An invitation exposes `emailStatus` (NONE/QUEUED/SENT/FAILED), `emailQueuedAt`, and
`emailSentAt` to its managers. Exhaustion leaves an outbox failure code and marks
the invitation FAILED for delivery; membership/invitation acceptance status is
independent. Renew the invitation after correcting provider/configuration errors.
Superseded, accepted, expired and revoked versions are skipped before sending.

Delivery is **at least once**: an SMTP success followed by a process crash before
database acknowledgement can produce a duplicate email with the same proof and
stable Message-ID. SMTP cannot guarantee exactly-once or inbox arrival. SENT means
SMTP recipient acceptance, not a bounce/open/delivery webhook. Duplicate emails
cannot create duplicate memberships or replay an accepted invitation.

Provider failures are persisted as fixed codes; message bodies, proofs, passwords
and cookies must not be logged. Missing invitation schema fails with
MIGRATION_REQUIRED instead of invoking automatic schema repair.

## Validation

- `npm --prefix backend run build`
- `node --experimental-vm-modules --test tests/hardening/workspace-invitation-token.test.mjs tests/hardening/workspace-invitation-routes.test.mjs tests/hardening/workspace-command.test.mjs`
- `node --test tests/integration/workspace-email-invitations.test.mjs`
- `node --experimental-vm-modules --test tests/hardening/workspace-invitation-context.test.mjs`
- `node --test tests/browser/workspace-invitation-flow.test.mjs`

The integration suite starts its own loopback-only PostgreSQL instance in an owned
temporary directory, applies real migrations to legacy fixtures, tests a restricted
API role, and removes the cluster afterward. It never reads the application's
DATABASE_URL. Set `FORGE_TEST_POSTGRES_BIN` to the directory containing initdb and
pg_ctl when PostgreSQL 18 is installed elsewhere. Delivery uses a capture function;
no real emails are sent. Build first because the suite imports compiled services.

The browser suite starts an isolated Vite server and headless Chrome, mocks HTTP
responses, and never connects to a database or sends email. It covers local and
managed authentication, verification gates, wrong accounts, expiry, MFA/401,
idempotent retries/reload recovery, blocked storage, and ordinary-login behavior.
Set `FORGE_CHROME_PATH` when Chrome/Edge is not installed in a standard location.

## Workspace Members page

The existing Members layout now sends `{email, role}` invitations, without adding
members until acceptance. Owners can invite admins or members and change active
non-owner roles. Admins can invite members; only owners may renew admin invites.
Managers may revoke pending invitations, including in archived workspaces. The
backend remains the authority for every operation.

The page separates pending/expired/accepted/revoked invitation status from
queued/sent/failed email delivery. Resend uses the existing renewal endpoint,
version preconditions, and 60-second cooldown. Legacy in-app invitations remain
renewable. Failed modal requests retain their draft and idempotency key. A
successful send followed by a failed reload displays a read error, without
encouraging a duplicate send. Session expiry clears protected data and offers login.

Member details include email, workspace role, join date, and effective membership
status derived from account status and valid organization/workspace membership.
No credentials or internal organization-role records are returned. The response
is still limited to 200 members and the page labels that limit.

Members reload after mutations, on visible-tab focus, every 30 seconds while
visible, and after same-origin acceptance notifications. Notifications contain
only the workspace ID. Abortable loads prevent stale workspace selections from
replacing newer data. No new environment variables or migrations are needed for
these UI changes; email still requires the SMTP worker configuration above.

Additional validation:

- `node --experimental-vm-modules --test tests/hardening/members-model.test.mjs tests/hardening/workspace-auth.test.mjs`
- `node --test tests/browser/workspace-members.test.mjs`

The Members browser suite mocks HTTP and sends no email. It covers permissions,
role filters and details, invitation state and version conflicts, retry safety,
session expiry, stale responses, and focus/channel/periodic acceptance refresh.

## Real local stack verification

Build the backend, then run this explicitly opted-in test from the project root:

```powershell
npm --prefix backend run build
$env:FORGE_RUN_LIVE_MEMBERS = "1"
node --test tests/integration/workspace-members-live.test.mjs
Remove-Item Env:FORGE_RUN_LIVE_MEMBERS
```

This uses real PostgreSQL on the local development server, a real Express server,
Vite/React in Chrome, the production background-worker entry point, and an
in-memory authenticated STARTTLS SMTP inbox on loopback port 2525. There are no
mocked local API responses and no injected OTP delivery port. All recipient
addresses end in `example.test`; the inbox rejects every other domain and never
relays. A temporary self-signed localhost certificate is trusted only by the test
child processes using `NODE_EXTRA_CA_CERTS`; TLS verification stays enabled.

The test reads `backend/.env` only to locate the local PostgreSQL source. It makes
a schema-only copy in a uniquely named `forge_members_e2e_*` database. No existing
accounts, credentials, rows or queued work are copied, and application processes
never point to the source database. Fixture subscriptions and accounts exist only
in the disposable database. Critical source-table counts and content digests are
compared before/after. The test stops its processes, drops only its own verified
test database, and removes temporary keys/schema files. A credential-free result
is written to `.data/workspace-members-live/report.json`.

Prerequisites: permission to create a local test database, PostgreSQL client
utilities, OpenSSL, installed project dependencies, available port 2525, and
Chrome/Edge. Set `FORGE_TEST_POSTGRES_BIN`, `FORGE_TEST_OPENSSL`, or
`FORGE_CHROME_PATH` for nonstandard Windows installations. The test overrides
SMTP, the invitation key, origins and ports only in its own process environment;
it does not edit `.env`. It waits through the real SMTP retry backoff. To keep the
run short, it ages only disposable invitation timestamps for cooldown/expiry
cases; it never changes the system clock or disables backend checks.

For ordinary development outside this test, configure `FRONTEND_URL`,
`WORKSPACE_INVITATION_TOKEN_KEY` (64 hex characters, shared by API and worker),
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`, then run
both the API and `npm --prefix backend run worker`. Use a trusted TLS-capable
provider/test inbox (ports 465, 587 or 2525). The test inbox and its temporary
certificate are not a persistent development mail service.

A missing general durable-outbox table is reported as `outbox-dispatch-failed`;
it no longer aborts the worker before the independent invitation dispatcher can
start. Other job features still require their reviewed platform migrations. Do
not use `db push`, reset the development database, or blindly deploy unrelated
pending migrations to resolve that warning.

## Verification email not arriving

If SMTP settings are absent or delivery fails, identity code delivery now returns
`503 IDENTITY_DELIVERY_UNAVAILABLE` and marks the challenge FAILED with its proof
cleared. It no longer reports a successful development fallback for an email
that was never delivered. Verification codes are not printed to application logs.
Configure SMTP locally, restart the backend, and start sign-in again to request a
fresh code. If a failed signup already created the account, use sign-in rather
than submitting signup again.

For an explicitly chosen local-only development alternative, the existing
`LocalOtpDelivery` adapter can write the code to a private temporary JSON file.
Start the backend with `FORGE_AUTH_MODE=local` and `FORGE_LOCAL_OTP_FILE` set to an
absolute file directly inside the operating system temporary directory, named
`forge-local-otp.json`. Open that private file locally to read the code; do not
commit or share it. This option is forbidden in production and sends no email.
The real-stack test's SMTP inbox is temporary and is stopped after testing; it
does not configure ordinary development sign-in.
