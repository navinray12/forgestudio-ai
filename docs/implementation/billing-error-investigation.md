# Billing generic error: root cause and repair

## Request trace

1. `BillingView` gets the selected organization from the shared dashboard workspace context and sends a cookie-authenticated, no-store `GET /api/v1/organizations/:organizationId/billing/dashboard`. No local-storage bearer token is sent.
2. `app.ts` mounts `modules/billing/http/routes.ts` at that organization-scoped prefix. Its `requireAuth` validates the durable session and sets `res.locals.user`; missing/invalid sessions return 401, not the observed generic 500.
3. The dashboard handler calls `billingDashboard(organizationId, res.locals.user.id)`, which calls `getOrganizationBilling`. That service verifies OWNER/ADMIN membership, opens a tenant transaction, and queries the billing account, subscription, seats, and usage reservations. It then loads plans and stored invoices, and only afterward considers Stripe reads.
4. Replaying the exact first query against the configured local database after verifying a real owner membership failed with SQLSTATE **42P01**, `relation "organization_billing_accounts" does not exist`. This is a database failure after authorization, not a Stripe failure.
5. The generic error middleware previously classified that unwrapped PostgreSQL error as 500/`INTERNAL_SERVER_ERROR`, emitting “Something went wrong” to the frontend. The UI correctly displayed that response; changing its empty states would have concealed the failure.

## Exact schema drift

The local `forgestudio` database's `_prisma_migrations` marks `20260929093000_platform_foundations` finished, but its organization billing tables were absent: `organization_billing_accounts`, `organization_subscriptions_v2`, `organization_seat_assignments`, `organization_invoices`, `usage_reservations`, and the related billing intent/inbox tables. Legacy `billing_invoices`, `subscription_plans`, and `user_subscriptions` were present; they are a different billing scope and must not be silently substituted for an organization's records. The database also has an unrelated unfinished legacy-core migration. This fix neither changes that migration's history nor attempts a broad migration replay.

## Repair

Added `20261023180000_repair_organization_billing_foundations`, an additive, transactional repair of the billing portion of the existing platform foundation schema, including indexes and FORCE RLS tenant policies. It creates no customer, subscription, invoice, entitlement, payment method, or credential records. Existing tables/data are not dropped or truncated.

Applied it to the configured loopback development database with `backend/scripts/repair-local-billing-schema.mjs` (run from `backend`). This explicit local-only runner refuses production/non-loopback targets, records the new migration's checksum atomically, and does not falsify the earlier migration entries. Other environments should apply the reviewed migration through their migration/deployment procedure. Existing incompatible legacy billing table layouts require separate drift review; `CREATE TABLE IF NOT EXISTS` is not a destructive schema replacement.

`dashboard.service.ts` now converts missing-table/missing-column errors (42P01/42703) to an actionable 503/`BILLING_SCHEMA_UNAVAILABLE` response, preserving all other errors and access denials. Missing storage is never returned as a successful empty invoice collection. There is no request-time DDL, auth relaxation, frontend change, or approved-layout change.

After repair, the **actual dashboard service and tenant membership/SQL code**, executed against the configured local database for an existing organization owner, returned success with `account: null`, `subscription: null`, zero invoices, zero payment methods, and disabled provider actions. These are real empty states, not injected demo data. No live commercial action was attempted.

## Stripe is a separate blocker

The local configuration still lacks `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MAP_JSON`, and `FORGE_PLAN_CATALOG_JSON`; `FRONTEND_URL` is present. The repaired read succeeds without those values and reports the provider capabilities unavailable. Linking a real organization customer, configuring Stripe Billing Portal, prices and verified webhooks is still required for live checkout, card management, subscription changes and provider invoice downloads.

## Validation

- Real database: reproduced 42P01 before repair and successful full service read after repair, without creating business records.
- `RUN_BILLING_DB_TESTS=1 node --test tests/integration/billing-schema-repair.test.mjs`: disposable schema inside a rolled-back transaction; reproduces missing relation, applies repair twice, verifies exact read columns, empty commercial tables and FORCE RLS.
- `node --experimental-vm-modules --test tests/hardening/billing-dashboard.test.mjs tests/hardening/billing.test.mjs tests/hardening/auth.test.mjs`: missing schema, fail-closed portal, authorization, current session checks and billing regressions.
- `node --test tests/browser/billing-dashboard.test.mjs`: existing Billing UI/authentication/navigation/form/empty-state regression.
- Backend TypeScript check and whitespace checks.
