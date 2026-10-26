# Billing dashboard

The Billing sidebar entry and dashboard shell are unchanged. The page follows `main subscription dashboard.pdf`, with a subscription hero, searchable/status-filtered invoice table, current-plan and saved-card panel, quick actions, support navigation, and the preserved billing-profile/payment-preference form.

## Authentication and scope

All frontend billing requests use session cookies and omit obsolete local-storage bearer tokens. The old bearer header took precedence over the valid session cookie and caused the reported expired-session error. Organization selection controls both the dashboard and profile form; requests are aborted on selection changes. Server authorization requires organization OWNER/ADMIN access before any provider or invoice reads. Portal commands require the existing privileged-mutation check and a billing intent header. Invoice and portal responses are private/no-store. Card numbers, provider credentials and customer objects are not sent to the browser.

## APIs

- Existing organization billing/profile/plans/checkout services remain authoritative.
- `GET /api/v1/organizations/:organizationId/billing/dashboard` adds the authorized organization summary, configured organization plans, stored invoices, and live Stripe invoices/cards/subscription price and dates where available.
- `POST .../billing/portal` creates a Stripe Billing Portal session using the authorized organization's customer and server-configured `FRONTEND_URL` return URL. It accepts no client customer or redirect override.
- Existing checkout accepts the selected configured plan and an idempotency key retained for retries. Existing subscriptions are managed through the Stripe portal rather than creating duplicate subscriptions. No local paid-plan activation is performed.
- Invoice download links are provider-issued HTTPS URLs with an explicit Stripe host allowlist; there are no fabricated PDFs. Stored invoices remain readable without provider configuration but downloads are unavailable. Provider collections follow Stripe pagination to include the full available history.

Stripe and stored invoice amounts are minor currency units; the UI converts them using the returned currency. Prices, renewal dates, invoice periods, statuses and card suffixes are never taken from reference sample values. A missing profile remains editable via the existing service; saved bank/PayPal choices are preferences, not payment authorization.

## Configuration blockers

Local `.env` files inspected during implementation have `FRONTEND_URL` but no configured `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MAP_JSON` or `FORGE_PLAN_CATALOG_JSON`. Runtime deployment environment variables may differ.

Live saved-card reads, provider invoice downloads, and portal operations require a Stripe secret and linked organization customer. Stripe Billing Portal must also be configured in Stripe, including permitted subscription changes/prices. Initial checkout additionally needs an organization plan catalogue, matching Stripe price map and a verified webhook endpoint/secret so payment results can synchronize through the existing billing webhook handler. Missing capabilities are described in the UI; checkout and portal controls are disabled where prerequisites are absent. Bank transfer and PayPal processing are not implemented by the existing Stripe adapter and are not simulated.

## Validation

`tests/hardening/billing-dashboard.test.mjs` covers authority, tenant boundaries, provider mapping/failures, unconfigured states, portal customer scope and URL safety. `tests/browser/billing-dashboard.test.mjs` covers invoices/search/filter/download links, masked cards, portal errors, profile saves, organization selection, obsolete-token omission, empty/session states and mobile overflow. Existing billing and shared-dashboard regressions also run. These are controlled provider/HTTP tests; no live checkout, charge or production provider verification is claimed.
