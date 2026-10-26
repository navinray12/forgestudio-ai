# Dashboard Usage

The Usage section follows `main dashboard Usage page.pdf` inside the existing dashboard shell. All CSS is scoped to `.usage-page`. The header, sidebar, other sections, and original `/users/me/usage` response are unchanged.

## Data contract

`GET /api/v1/users/me/usage/dashboard?range=cycle|30d|90d` uses the authenticated session, never a client-supplied user ID. Responses are private and not cached. This is account usage across owned sites, independent of the sidebar workspace selection.

The endpoint reuses subscription and licensing services and reads existing Prisma models. It performs no provisioning, DDL, plan changes, or credit deductions.

| Display | Authority |
| --- | --- |
| Website slots | Owned website count and subscription plan `websiteLimit`; includes archived sites to match `checkWebsiteLimit` |
| Media storage | Sum of the account's `MediaAsset.sizeBytes`; subscription `storageLimitMb` |
| Image optimization balance | `User.optimizationCredits` |
| Optimizations performed | Positive `IMAGE_OPTIMIZATION` entries in `OptimizationCreditLedger`; excludes database cleanup |
| Licenses | Active, unexpired licenses and their production/development activation telemetry |
| Billing period | Subscription `currentPeriodStart` and `currentPeriodEnd`; no invented renewal/reset date |
| AI allowance | Subscription plan `aiCreditLimit` |
| Activity and site/user breakdown | Completed `AiExecution` records, grouped by UTC day and site/actor; uses `reservedUnits` as recorded execution units and counts completed operations |

Activity includes only owned, non-deleted, non-archived sites for which the existing `resolveWebsiteRole` still grants access. Revoked organization/workspace membership and explicit VIEW denials exclude a site. Names are fetched only for sites and actors represented in the authorized activity. License keys, email addresses, prompts, and provider payloads are never included.

**Monthly AI credits are not metered by the existing backend.** Execution units are admission reservations/settled operation units, not a financial credit ledger. The endpoint returns `NOT_METERED` and null used/remaining values rather than subtracting those units from the monthly allowance. The UI explicitly labels the balance unavailable and the activity as execution units. Optimization credits are a separate, real balance. A future billed AI-credit implementation needs an authoritative deduction/refund/reset policy and ledger before this page can claim a monthly balance or reset. The existing subscriptions page is linked as “Manage plan”; no fictitious credit checkout is offered.

Quota cards show current account totals. The range selector filters activity only. `cycle` begins at the real subscription start and ends at the earlier of now and a known period end; rolling ranges cover the preceding 30/90 days. Queries use a half-open interval. UTC chart buckets are zero-filled only after a successful activity read and preserve recorded totals, with at most 31 buckets. Missing sources return null plus a section-specific issue; healthy sources remain available. Missing subscription data never provisions a free plan.

## Validation

- `node --experimental-vm-modules --test tests/hardening/dashboard-usage.test.mjs tests/hardening/billing.test.mjs tests/hardening/website-scope.test.mjs`
- `node --test tests/browser/dashboard-usage.test.mjs tests/browser/workspace-members.test.mjs`
- Frontend targeted ESLint and production build; backend TypeScript check.

The deterministic tests use mocked persistence/HTTP and cover aggregation, account scope, revoked access, date bounds, partial failure, no synthetic balances, retry, empty/loading states, session expiry, response races, filters, shared navigation, and responsive layout. Browser screenshots are written to `artifacts/usage/`. They are not evidence of live production/database integration.
